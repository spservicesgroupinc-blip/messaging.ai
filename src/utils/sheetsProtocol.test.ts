import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptySheetsDatabase,
  executeSheetAction,
  normalizeChannelName,
  validateSignupInput,
  canUserAccessChannel,
  hashPassword,
} from './sheetsProtocol';

test('normalizeChannelName converts arbitrary text into valid Slack-style channel slug', () => {
  assert.equal(normalizeChannelName('  Exec Strategy & Ops! '), 'exec-strategy-ops');
  assert.equal(normalizeChannelName('Q4_Product--Launch'), 'q4_product-launch');
});

test('validateSignupInput enforces name, email, and password constraints', () => {
  assert.equal(
    validateSignupInput({ fullName: 'A', email: 'alice@company.com', password: 'secret123' }).valid,
    false
  );
  assert.equal(
    validateSignupInput({ fullName: 'Alice Vance', email: 'not-an-email', password: 'secret123' }).valid,
    false
  );
  assert.equal(
    validateSignupInput({ fullName: 'Alice Vance', email: 'alice@company.com', password: '123' }).valid,
    false
  );
  assert.equal(
    validateSignupInput({ fullName: 'Alice Vance', email: 'alice@company.com', password: 'secret123' }).valid,
    true
  );
});

test('signup and login persist user in Users sheet and verify password hash', () => {
  let db = createEmptySheetsDatabase('2026-11-03T10:00:00.000Z');

  const signupRes = executeSheetAction(
    db,
    {
      action: 'signup',
      fullName: 'Elena Rostova',
      email: 'elena@acme.io',
      password: 'password123',
      roleTitle: 'Staff Engineer',
    },
    '2026-11-03T10:01:00.000Z'
  );

  assert.equal(signupRes.response.ok, true);
  assert.equal(signupRes.db.Users.length, 1);
  assert.equal(signupRes.response.user?.email, 'elena@acme.io');
  assert.equal(
    signupRes.db.Users[0].password_hash,
    hashPassword('password123', 'elena@acme.io')
  );
  db = signupRes.db;

  // Duplicate signup rejected
  const dupRes = executeSheetAction(db, {
    action: 'signup',
    fullName: 'Elena Duplicate',
    email: 'ELENA@acme.io',
    password: 'password123',
  });
  assert.equal(dupRes.response.ok, false);

  // Wrong password rejected
  const badLogin = executeSheetAction(db, {
    action: 'login',
    email: 'elena@acme.io',
    password: 'wrongpassword',
  });
  assert.equal(badLogin.response.ok, false);

  // Valid login succeeds
  const goodLogin = executeSheetAction(db, {
    action: 'login',
    email: 'elena@acme.io',
    password: 'password123',
  });
  assert.equal(goodLogin.response.ok, true);
  assert.equal(goodLogin.response.user?.full_name, 'Elena Rostova');
});

test('private channels enforce strict membership access control and message persistence', () => {
  let db = createEmptySheetsDatabase('2026-11-03T10:00:00.000Z');

  // Sign up User 1 (Alice) and User 2 (Bob)
  const s1 = executeSheetAction(db, {
    action: 'signup',
    fullName: 'Alice Chen',
    email: 'alice@acme.io',
    password: 'password123',
  });
  db = s1.db;
  const aliceId = s1.response.user!.user_id;

  const s2 = executeSheetAction(db, {
    action: 'signup',
    fullName: 'Bob Miller',
    email: 'bob@acme.io',
    password: 'password123',
  });
  db = s2.db;
  const bobId = s2.response.user!.user_id;

  // Alice creates a private channel without Bob
  const createRes = executeSheetAction(db, {
    action: 'createChannel',
    userId: aliceId,
    name: 'security-audit',
    description: 'Confidential security review',
    isPrivate: true,
  });
  assert.equal(createRes.response.ok, true);
  db = createRes.db;
  const privateChannel = createRes.response.channel!;
  assert.equal(privateChannel.is_private, true);

  // Alice can access, Bob cannot access
  assert.equal(canUserAccessChannel(privateChannel, db.ChannelMembers, aliceId), true);
  assert.equal(canUserAccessChannel(privateChannel, db.ChannelMembers, bobId), false);

  // Bob attempts to read or post in private channel -> denied
  const bobRead = executeSheetAction(db, {
    action: 'getMessages',
    userId: bobId,
    channelId: privateChannel.channel_id,
  });
  assert.equal(bobRead.response.ok, false);

  // Alice posts a message and a thread reply in private channel
  const post1 = executeSheetAction(db, {
    action: 'sendMessage',
    userId: aliceId,
    channelId: privateChannel.channel_id,
    content: 'Initial audit checklist uploaded.',
  });
  assert.equal(post1.response.ok, true);
  db = post1.db;
  const rootMsgId = post1.response.message!.message_id;

  const reply1 = executeSheetAction(db, {
    action: 'sendMessage',
    userId: aliceId,
    channelId: privateChannel.channel_id,
    parentMessageId: rootMsgId,
    content: 'Verified TLS 1.3 certificates.',
  });
  assert.equal(reply1.response.ok, true);
  db = reply1.db;

  const rootAfterReply = reply1.response.messages!.find((m) => m.message_id === rootMsgId);
  assert.equal(rootAfterReply?.reply_count, 1);

  // Alice invites Bob to private channel -> Bob now has access
  const addBob = executeSheetAction(db, {
    action: 'addChannelMember',
    userId: aliceId,
    channelId: privateChannel.channel_id,
    email: 'bob@acme.io',
  });
  assert.equal(addBob.response.ok, true);
  db = addBob.db;

  const bobReadAfterInvite = executeSheetAction(db, {
    action: 'getMessages',
    userId: bobId,
    channelId: privateChannel.channel_id,
  });
  assert.equal(bobReadAfterInvite.response.ok, true);
  assert.equal(bobReadAfterInvite.response.messages?.length, 2);

  // Alice edits the channel name and description
  const editRes = executeSheetAction(db, {
    action: 'editChannel',
    userId: aliceId,
    channelId: privateChannel.channel_id,
    name: 'Safety & Security Review!',
    description: 'Updated audit channel description',
    isPrivate: true,
  });
  assert.equal(editRes.response.ok, true);
  assert.equal(editRes.response.channel?.name, 'safety-security-review');
  assert.equal(editRes.response.channel?.description, 'Updated audit channel description');
  db = editRes.db;

  // Duplicate channel name rejected on edit
  const dupEdit = executeSheetAction(db, {
    action: 'editChannel',
    userId: aliceId,
    channelId: privateChannel.channel_id,
    name: 'general',
  });
  assert.equal(dupEdit.response.ok, false);

  // Alice deletes the channel -> channel, memberships, and messages are removed
  const delRes = executeSheetAction(db, {
    action: 'deleteChannel',
    userId: aliceId,
    channelId: privateChannel.channel_id,
  });
  assert.equal(delRes.response.ok, true);
  assert.equal(delRes.response.deletedChannelId, privateChannel.channel_id);
  assert.equal(
    delRes.db.Channels.some((c) => c.channel_id === privateChannel.channel_id),
    false
  );
  assert.equal(
    delRes.db.Messages.some((m) => m.channel_id === privateChannel.channel_id),
    false
  );
});

