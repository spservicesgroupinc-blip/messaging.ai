import test from 'node:test';
import assert from 'node:assert/strict';
import { OptimisticWorkspace } from './optimisticWorkspace';
import { createEmptySheetsDatabase, executeSheetAction } from './sheetsProtocol';

function setup(storage?: Storage) {
  const seeded = executeSheetAction(createEmptySheetsDatabase(), { action: 'signup', fullName: 'Quick User', email: 'quick@example.test', password: 'secret123' });
  const user = seeded.response.user!;
  const model = new OptimisticWorkspace(user, storage);
  model.applyResponse(seeded.response);
  return { model, user, response: seeded.response };
}

test('send appears immediately, survives an older response, and settles without a duplicate', () => {
  const { model, user } = setup();
  const submitted = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Fast message' });
  assert.equal(submitted.response.ok, true);
  assert.equal(model.getSnapshot().byChannel.ch_general[0].delivery, 'sending');
  model.applyResponse({ ok: true, messages: [] }, 'ch_general');
  assert.equal(model.getSnapshot().byChannel.ch_general[0].content, 'Fast message');
  model.confirm(submitted.operation!, { ok: true, messages: [{ ...submitted.response.message!, message_id: 'server-message' }] });
  assert.equal(model.getSnapshot().byChannel.ch_general.length, 1);
  assert.equal(model.getSnapshot().byChannel.ch_general[0].message_id, 'server-message');
  assert.equal(model.getSnapshot().byChannel.ch_general[0].delivery, undefined);
});

test('failed reaction rolls back without losing a later pending edit', () => {
  const { model, user } = setup();
  const send = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Original' });
  model.confirm(send.operation!, { ok: true, messages: [{ ...send.response.message!, message_id: 'm1' }] });
  const react = model.submit({ action: 'toggleReaction', userId: user.user_id, channelId: 'ch_general', messageId: 'm1', emoji: '👍' });
  const edit = model.submit({ action: 'editMessage', userId: user.user_id, channelId: 'ch_general', messageId: 'm1', content: 'New text' });
  assert.equal(model.getSnapshot().byChannel.ch_general[0].reactions['👍'][0], user.user_id);
  model.fail(react.operation!, 'Reaction failed');
  assert.equal(model.getSnapshot().byChannel.ch_general[0].content, 'New text');
  assert.deepEqual(model.getSnapshot().byChannel.ch_general[0].reactions, {});
  model.fail(edit.operation!, 'Edit failed');
  assert.equal(model.getSnapshot().byChannel.ch_general[0].content, 'Original');
});

test('created channels open immediately and queued sends resolve their server ID', () => {
  const { model, user } = setup();
  const create = model.submit({ action: 'createChannel', userId: user.user_id, name: 'quick-channel', isPrivate: false });
  const channel = create.response.channel!;
  const send = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: channel.channel_id, content: 'Hello' });
  assert.equal(send.response.ok, true);
  model.confirm(create.operation!, { ok: true, channel: { ...channel, channel_id: 'server-channel' }, channels: [{ ...channel, channel_id: 'server-channel' }] });
  assert.equal(model.request(send.operation!).channelId, 'server-channel');
  assert.equal(model.getSnapshot().channels[0].channel_id, channel.channel_id);
  assert.equal(model.getSnapshot().byChannel[channel.channel_id][0].content, 'Hello');
});

test('failed sends remain recoverable after reload and never automatically replay', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } as Storage;
  const { model, user, response } = setup(storage);
  model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Keep this text' });
  const restored = new OptimisticWorkspace(user, storage);
  restored.applyResponse(response);
  assert.equal(restored.getSnapshot().pendingCount, 0);
  assert.equal(restored.getSnapshot().failures[0].payload.content, 'Keep this text');
  assert.equal(restored.getSnapshot().byChannel.ch_general[0].delivery, 'failed');
  restored.clear();
  assert.equal(values.size, 0);
});

test('unconfirmed message actions are rejected locally and failed channel dependencies never send', () => {
  const { model, user } = setup();
  const send = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Pending' });
  assert.equal(model.submit({ action: 'deleteMessage', userId: user.user_id, channelId: 'ch_general', messageId: send.response.message!.message_id }).response.ok, false);
  const create = model.submit({ action: 'createChannel', userId: user.user_id, name: 'new-channel' });
  const dependent = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: create.response.channel!.channel_id, content: 'Keep me' });
  model.fail(create.operation!, 'Could not create');
  assert.throws(() => model.request(dependent.operation!), /conversation/i);
});

test('channel edits, deletion, member changes, and status update immediately with independent rollback', () => {
  const { model, user } = setup();
  const peer = { ...user, user_id: 'peer', email: 'peer@example.test', full_name: 'Other User' };
  const privateChannel = { ...model.getSnapshot().channels[0], channel_id: 'private', name: 'private', created_by: user.user_id, is_private: true };
  model.applyResponse({ ok: true, users: [user, peer], channels: [...model.getSnapshot().channels, privateChannel] });
  const edit = model.submit({ action: 'editChannel', userId: user.user_id, channelId: 'private', name: 'renamed', isPrivate: true });
  assert.equal(model.getSnapshot().channels.find(item => item.channel_id === 'private')!.name, 'renamed');
  const member = model.submit({ action: 'addChannelMember', userId: user.user_id, channelId: 'private', email: peer.email });
  assert.equal(model.getSnapshot().memberships.some(item => item.user_id === 'peer'), true);
  const remove = model.submit({ action: 'removeChannelMember', userId: user.user_id, channelId: 'private', targetUserId: 'peer' });
  assert.equal(model.getSnapshot().memberships.some(item => item.user_id === 'peer'), false);
  model.fail(remove.operation!, 'Remove failed');
  assert.equal(model.getSnapshot().memberships.some(item => item.user_id === 'peer'), true);
  model.fail(member.operation!, 'Add failed');
  model.fail(edit.operation!, 'Edit failed');
  assert.equal(model.getSnapshot().channels.find(item => item.channel_id === 'private')!.name, 'private');
  const deleted = model.submit({ action: 'deleteChannel', userId: user.user_id, channelId: 'private' });
  assert.equal(model.getSnapshot().channels.some(item => item.channel_id === 'private'), false);
  model.fail(deleted.operation!, 'Delete failed');
  assert.equal(model.getSnapshot().channels.some(item => item.channel_id === 'private'), true);
  const status = model.submit({ action: 'updateUserStatus', userId: user.user_id, statusText: 'Busy' });
  assert.equal(model.getSnapshot().users.find(item => item.user_id === user.user_id)!.status_text, 'Busy');
  model.fail(status.operation!, 'Status failed');
  assert.equal(model.getSnapshot().users.find(item => item.user_id === user.user_id)!.status_text, user.status_text);
});

test('known direct messages open immediately and server channel aliases survive reload', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } as Storage;
  const { model, user, response } = setup(storage);
  const peer = { ...user, user_id: 'peer', email: 'peer@example.test' };
  model.applyResponse({ ok: true, users: [user, peer] });
  const opened = model.submit({ action: 'openDirectMessage', userId: user.user_id, targetUserId: 'peer', channelId: '' });
  const localChannel = opened.response.channel!;
  assert.equal(model.getSnapshot().channels.some(item => item.channel_id === localChannel.channel_id), true);
  model.confirm(opened.operation!, { ok: true, channel: { ...localChannel, channel_id: 'remote-dm' } });
  const restored = new OptimisticWorkspace(user, storage);
  restored.applyResponse({ ...response, channels: [{ ...localChannel, channel_id: 'remote-dm' }] });
  assert.equal(restored.resolve(localChannel.channel_id), 'remote-dm');
  assert.equal(restored.getSnapshot().channels[0].channel_id, localChannel.channel_id);
});

test('malformed backups and other users cannot create recoverable actions, and passwords are never persisted', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } as Storage;
  const { model, user } = setup(storage);
  model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Text', password: 'must-not-persist' });
  const key = [...values.keys()][0];
  assert.equal(values.get(key)!.includes('must-not-persist'), false);
  values.set(key, JSON.stringify({ operations: [
    { id: 'bad', createdAt: new Date().toISOString(), payload: { action: 'sendMessage', userId: user.user_id, content: { unsafe: true } } },
    { id: 'other', createdAt: new Date().toISOString(), payload: { action: 'sendMessage', userId: 'someone-else', content: 'Private text' } },
  ] }));
  assert.equal(new OptimisticWorkspace(user, storage).getSnapshot().failures.length, 0);
});

test('an unrelated channel creation or status update does not depend on a failed active conversation', () => {
  const { model, user } = setup();
  const first = model.submit({ action: 'createChannel', userId: user.user_id, name: 'first-channel' });
  const localId = first.response.channel!.channel_id;
  const second = model.submit({ action: 'createChannel', userId: user.user_id, channelId: localId, name: 'second-channel' });
  const status = model.submit({ action: 'updateUserStatus', userId: user.user_id, channelId: localId, statusText: 'Busy' });
  model.fail(first.operation!, 'First creation failed');
  assert.equal(model.request(second.operation!).channelId, undefined);
  assert.equal(model.request(status.operation!).channelId, undefined);
});

test('queued messages keep submission order when the first server timestamp is later than the next local send', () => {
  const { model, user } = setup();
  const first = model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'First send' });
  model.submit({ action: 'sendMessage', userId: user.user_id, channelId: 'ch_general', content: 'Second send' });
  model.confirm(first.operation!, { ok: true, messages: [{ ...first.response.message!, message_id: 'confirmed-first', created_at: new Date(Date.now() + 60000).toISOString() }] });
  assert.deepEqual(model.getSnapshot().byChannel.ch_general.map(message => message.content), ['First send', 'Second send']);
});
