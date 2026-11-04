// @ts-nocheck
/**
 * ============================================================================
 * RELAY WORKSPACE — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * Copy and paste this entire file directly into Extensions -> Apps Script
 * inside your Google Sheet, click Save, and Deploy -> Manage deployments ->
 * Edit -> New version -> Deploy as Web App (Execute as: Me, Access: Anyone).
 */

var SHEET_SCHEMAS = {
  Users: [
    'user_id',
    'email',
    'password_hash',
    'full_name',
    'display_name',
    'role_title',
    'status_text',
    'created_at',
    'last_seen_at'
  ],
  Channels: [
    'channel_id',
    'name',
    'description',
    'is_private',
    'created_by',
    'created_at',
    'dm_participants'
  ],
  ChannelMembers: [
    'membership_id',
    'channel_id',
    'user_id',
    'role',
    'joined_at'
  ],
  Messages: [
    'message_id',
    'channel_id',
    'user_id',
    'user_name',
    'user_role',
    'content',
    'parent_message_id',
    'reactions_json',
    'created_at',
    'updated_at'
  ]
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var payload = {
    action: params.action || 'ping',
    userId: params.userId || '',
    channelId: params.channelId || ''
  };
  return handleRequest(payload);
}

function doPost(e) {
  var payload = {};
  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Invalid JSON request body: ' + err.message });
  }
  return handleRequest(payload);
}

function handleRequest(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSchema(ss);
    var nowIso = new Date().toISOString();
    var action = payload.action || 'ping';

    if (action === 'ping' || action === 'initSheets') {
      return jsonResponse({
        ok: true,
        timestamp: nowIso,
        channels: readTable(ss, 'Channels')
      });
    }

    if (action === 'inspectSheets') {
      var rawUsers = readTable(ss, 'Users').map(stripPassword);
      return jsonResponse({
        ok: true,
        timestamp: nowIso,
        sheets: {
          Users: rawUsers,
          Channels: readTable(ss, 'Channels'),
          ChannelMembers: readTable(ss, 'ChannelMembers'),
          Messages: readTable(ss, 'Messages')
        }
      });
    }

    if (action === 'signup') {
      return handleSignup(ss, payload, nowIso);
    }

    if (action === 'login') {
      return handleLogin(ss, payload, nowIso);
    }

    if (action === 'getBootstrap') {
      return handleGetBootstrap(ss, payload, nowIso);
    }

    if (action === 'getMessages') {
      return handleGetMessages(ss, payload, nowIso);
    }

    if (action === 'sendMessage') {
      return handleSendMessage(ss, payload, nowIso);
    }

    if (action === 'editMessage') {
      return handleEditMessage(ss, payload, nowIso);
    }

    if (action === 'deleteMessage') {
      return handleDeleteMessage(ss, payload, nowIso);
    }

    if (action === 'toggleReaction') {
      return handleToggleReaction(ss, payload, nowIso);
    }

    if (action === 'createChannel') {
      return handleCreateChannel(ss, payload, nowIso);
    }

    if (action === 'editChannel') {
      return handleEditChannel(ss, payload, nowIso);
    }

    if (action === 'deleteChannel') {
      return handleDeleteChannel(ss, payload, nowIso);
    }

    if (action === 'addChannelMember') {
      return handleAddChannelMember(ss, payload, nowIso);
    }

    if (action === 'removeChannelMember') {
      return handleRemoveChannelMember(ss, payload, nowIso);
    }

    if (action === 'openDirectMessage') {
      return handleOpenDirectMessage(ss, payload, nowIso);
    }

    if (action === 'updateUserStatus') {
      return handleUpdateUserStatus(ss, payload, nowIso);
    }

    return jsonResponse({ ok: false, error: 'Unsupported action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function ensureSchema(ss) {
  var sheetNames = Object.keys(SHEET_SCHEMAS);
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var headers = SHEET_SCHEMAS[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    }
  }

  var channels = readTable(ss, 'Channels');
  if (channels.length === 0) {
    var nowIso = new Date().toISOString();
    appendObjectRow(ss, 'Channels', {
      channel_id: 'ch_general',
      name: 'general',
      description: 'Company-wide announcements and team-wide discussions',
      is_private: false,
      created_by: 'system',
      created_at: nowIso,
      dm_participants: ''
    });
    appendObjectRow(ss, 'Channels', {
      channel_id: 'ch_engineering',
      name: 'engineering',
      description: 'Architecture, deployments, and technical operations',
      is_private: false,
      created_by: 'system',
      created_at: nowIso,
      dm_participants: ''
    });
  }
}

function readTable(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var headers = SHEET_SCHEMAS[sheetName];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var rows = [];
  for (var r = 0; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      var val = values[r][c];
      if (key === 'is_private') {
        obj[key] = (val === true || String(val).toLowerCase() === 'true');
      } else {
        obj[key] = val === null || val === undefined ? '' : String(val);
      }
    }
    rows.push(obj);
  }
  return rows;
}

function appendObjectRow(ss, sheetName, obj) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = SHEET_SCHEMAS[sheetName];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    row.push(obj[key] !== undefined ? obj[key] : '');
  }
  sheet.appendRow(row);
}

function overwriteTable(ss, sheetName, objects) {
  var sheet = ss.getSheetByName(sheetName);
  var headers = SHEET_SCHEMAS[sheetName];
  sheet.clearContents();
  var matrix = [headers];
  for (var i = 0; i < objects.length; i++) {
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var k = headers[c];
      row.push(objects[i][k] !== undefined ? objects[i][k] : '');
    }
    matrix.push(row);
  }
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
}

function hashPassword(password, email) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  var input = 'relay_sheets_auth_v1:' + normalizedEmail + ':' + String(password || '');
  var h1 = 0xdeadbeef ^ input.length;
  var h2 = 0x41c6ce57 ^ input.length;
  for (var i = 0; i < input.length; i++) {
    var ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  var hex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  while (hex.length < 14) hex = '0' + hex;
  return hex;
}

function stripPassword(u) {
  return {
    user_id: u.user_id,
    email: u.email,
    full_name: u.full_name,
    display_name: u.display_name,
    role_title: u.role_title,
    status_text: u.status_text,
    created_at: u.created_at,
    last_seen_at: u.last_seen_at
  };
}

function canUserAccessChannel(channel, memberships, userId) {
  if (!userId) return false;
  if (channel.dm_participants) {
    var parts = String(channel.dm_participants).split(',');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].trim() === userId) return true;
    }
    return false;
  }
  if (!channel.is_private) return true;
  if (channel.created_by === userId) return true;
  for (var m = 0; m < memberships.length; m++) {
    if (memberships[m].channel_id === channel.channel_id && memberships[m].user_id === userId) {
      return true;
    }
  }
  return false;
}

function enrichMessages(allMessages, channelId) {
  var list = [];
  for (var i = 0; i < allMessages.length; i++) {
    if (allMessages[i].channel_id === channelId) {
      list.push(allMessages[i]);
    }
  }
  list.sort(function(a, b) {
    return String(a.created_at).localeCompare(String(b.created_at));
  });

  var replyMap = {};
  for (var j = 0; j < list.length; j++) {
    var pId = list[j].parent_message_id;
    if (pId) {
      if (!replyMap[pId]) {
        replyMap[pId] = { count: 0, lastReplyAt: list[j].created_at };
      }
      replyMap[pId].count += 1;
      if (list[j].created_at > replyMap[pId].lastReplyAt) {
        replyMap[pId].lastReplyAt = list[j].created_at;
      }
    }
  }

  var enriched = [];
  for (var k = 0; k < list.length; k++) {
    var msg = list[k];
    var reactions = {};
    try {
      reactions = msg.reactions_json ? JSON.parse(msg.reactions_json) : {};
    } catch (e) {
      reactions = {};
    }
    var stat = replyMap[msg.message_id];
    enriched.push({
      message_id: msg.message_id,
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      user_name: msg.user_name,
      user_role: msg.user_role,
      content: msg.content,
      parent_message_id: msg.parent_message_id,
      reactions_json: msg.reactions_json,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      reactions: reactions,
      reply_count: stat ? stat.count : 0,
      last_reply_at: stat ? stat.lastReplyAt : undefined
    });
  }
  return enriched;
}

function generateId(prefix) {
  return prefix + '_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function handleSignup(ss, payload, nowIso) {
  var fullName = String(payload.fullName || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();
  var password = String(payload.password || '');

  if (fullName.length < 2) return jsonResponse({ ok: false, error: 'Full name must be at least 2 characters.' });
  if (!email || email.indexOf('@') === -1) return jsonResponse({ ok: false, error: 'Valid email is required.' });
  if (password.length < 6) return jsonResponse({ ok: false, error: 'Password must be at least 6 characters.' });

  var users = readTable(ss, 'Users');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === email) {
      return jsonResponse({ ok: false, error: 'An account with this email already exists.' });
    }
  }

  var newUser = {
    user_id: generateId('usr'),
    email: email,
    password_hash: hashPassword(password, email),
    full_name: fullName,
    display_name: String(payload.displayName || fullName.split(' ')[0] || fullName).trim(),
    role_title: String(payload.roleTitle || 'Team Member').trim(),
    status_text: String(payload.statusText || 'Active').trim(),
    created_at: nowIso,
    last_seen_at: nowIso
  };
  appendObjectRow(ss, 'Users', newUser);
  users.push(newUser);

  var channels = readTable(ss, 'Channels');
  for (var c = 0; c < channels.length; c++) {
    if (!channels[c].is_private && !channels[c].dm_participants) {
      appendObjectRow(ss, 'ChannelMembers', {
        membership_id: generateId('mem'),
        channel_id: channels[c].channel_id,
        user_id: newUser.user_id,
        role: 'member',
        joined_at: nowIso
      });
    }
  }

  var memberships = readTable(ss, 'ChannelMembers');
  var accessible = channels.filter(function(ch) {
    return canUserAccessChannel(ch, memberships, newUser.user_id);
  });

  return jsonResponse({
    ok: true,
    user: stripPassword(newUser),
    users: users.map(stripPassword),
    channels: accessible,
    memberships: memberships,
    timestamp: nowIso
  });
}

function handleLogin(ss, payload, nowIso) {
  var email = String(payload.email || '').trim().toLowerCase();
  var password = String(payload.password || '');
  var users = readTable(ss, 'Users');
  var expectedHash = hashPassword(password, email);

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === email) {
      if (users[i].password_hash !== expectedHash) {
        return jsonResponse({ ok: false, error: 'Invalid password for this account.' });
      }
      users[i].last_seen_at = nowIso;
      overwriteTable(ss, 'Users', users);
      var channels = readTable(ss, 'Channels');
      var memberships = readTable(ss, 'ChannelMembers');
      var accessible = channels.filter(function(ch) {
        return canUserAccessChannel(ch, memberships, users[i].user_id);
      });
      return jsonResponse({
        ok: true,
        user: stripPassword(users[i]),
        users: users.map(stripPassword),
        channels: accessible,
        memberships: memberships,
        timestamp: nowIso
      });
    }
  }
  return jsonResponse({ ok: false, error: 'No account found with that email address. Please sign up first.' });
}

function handleGetBootstrap(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var users = readTable(ss, 'Users');
  var currentUser = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user_id === userId) {
      currentUser = users[i];
      break;
    }
  }
  if (!currentUser) return jsonResponse({ ok: false, error: 'Session user not found.' });

  var channels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var accessible = channels.filter(function(ch) {
    return canUserAccessChannel(ch, memberships, userId);
  });

  var activeChannelId = payload.channelId || (accessible[0] ? accessible[0].channel_id : '');
  var allMessages = readTable(ss, 'Messages');

  return jsonResponse({
    ok: true,
    user: stripPassword(currentUser),
    users: users.map(stripPassword),
    channels: accessible,
    memberships: memberships,
    messages: activeChannelId ? enrichMessages(allMessages, activeChannelId) : [],
    timestamp: nowIso
  });
}

function handleGetMessages(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var channels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var channel = null;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].channel_id === channelId) channel = channels[i];
  }
  if (!channel) return jsonResponse({ ok: false, error: 'Channel not found.' });
  if (!canUserAccessChannel(channel, memberships, userId)) {
    return jsonResponse({ ok: false, error: 'Access denied to this private channel.' });
  }
  var allMessages = readTable(ss, 'Messages');
  return jsonResponse({
    ok: true,
    messages: enrichMessages(allMessages, channelId),
    timestamp: nowIso
  });
}

function handleSendMessage(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var content = String(payload.content || '').trim();
  if (!content) return jsonResponse({ ok: false, error: 'Message content cannot be empty.' });

  var users = readTable(ss, 'Users');
  var sender = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user_id === userId) sender = users[i];
  }
  if (!sender) return jsonResponse({ ok: false, error: 'Authenticated user not found.' });

  var channels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var channel = null;
  for (var c = 0; c < channels.length; c++) {
    if (channels[c].channel_id === channelId) channel = channels[c];
  }
  if (!channel || !canUserAccessChannel(channel, memberships, userId)) {
    return jsonResponse({ ok: false, error: 'Access denied to target channel.' });
  }

  var newMsg = {
    message_id: generateId('msg'),
    channel_id: channelId,
    user_id: sender.user_id,
    user_name: sender.full_name,
    user_role: sender.role_title,
    content: content,
    parent_message_id: String(payload.parentMessageId || ''),
    reactions_json: '{}',
    created_at: nowIso,
    updated_at: nowIso
  };
  appendObjectRow(ss, 'Messages', newMsg);

  var allMessages = readTable(ss, 'Messages');
  var enriched = enrichMessages(allMessages, channelId);
  return jsonResponse({
    ok: true,
    messages: enriched,
    timestamp: nowIso
  });
}

function handleEditMessage(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var messageId = String(payload.messageId || '');
  var content = String(payload.content || '').trim();
  var allMessages = readTable(ss, 'Messages');
  var channelId = '';

  for (var i = 0; i < allMessages.length; i++) {
    if (allMessages[i].message_id === messageId) {
      if (allMessages[i].user_id !== userId) {
        return jsonResponse({ ok: false, error: 'You can only edit your own messages.' });
      }
      allMessages[i].content = content;
      allMessages[i].updated_at = nowIso;
      channelId = allMessages[i].channel_id;
      break;
    }
  }
  if (!channelId) return jsonResponse({ ok: false, error: 'Message not found.' });
  overwriteTable(ss, 'Messages', allMessages);
  return jsonResponse({
    ok: true,
    messages: enrichMessages(allMessages, channelId),
    timestamp: nowIso
  });
}

function handleDeleteMessage(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var messageId = String(payload.messageId || '');
  var allMessages = readTable(ss, 'Messages');
  var target = null;
  for (var i = 0; i < allMessages.length; i++) {
    if (allMessages[i].message_id === messageId) target = allMessages[i];
  }
  if (!target) return jsonResponse({ ok: false, error: 'Message not found.' });
  if (target.user_id !== userId) return jsonResponse({ ok: false, error: 'You can only delete your own messages.' });

  var remaining = allMessages.filter(function(m) {
    return m.message_id !== messageId && m.parent_message_id !== messageId;
  });
  overwriteTable(ss, 'Messages', remaining);
  return jsonResponse({
    ok: true,
    messages: enrichMessages(remaining, target.channel_id),
    timestamp: nowIso
  });
}

function handleToggleReaction(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var messageId = String(payload.messageId || '');
  var emoji = String(payload.emoji || '').trim();
  var allMessages = readTable(ss, 'Messages');
  var channelId = '';

  for (var i = 0; i < allMessages.length; i++) {
    if (allMessages[i].message_id === messageId) {
      var reactions = {};
      try {
        reactions = allMessages[i].reactions_json ? JSON.parse(allMessages[i].reactions_json) : {};
      } catch (e) {
        reactions = {};
      }
      var list = reactions[emoji] || [];
      var idx = list.indexOf(userId);
      if (idx >= 0) {
        list.splice(idx, 1);
        if (list.length === 0) delete reactions[emoji];
        else reactions[emoji] = list;
      } else {
        list.push(userId);
        reactions[emoji] = list;
      }
      allMessages[i].reactions_json = JSON.stringify(reactions);
      channelId = allMessages[i].channel_id;
      break;
    }
  }
  if (!channelId) return jsonResponse({ ok: false, error: 'Message not found.' });
  overwriteTable(ss, 'Messages', allMessages);
  return jsonResponse({
    ok: true,
    messages: enrichMessages(allMessages, channelId),
    timestamp: nowIso
  });
}

function handleCreateChannel(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var rawName = String(payload.name || '').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '');
  if (rawName.length < 2) return jsonResponse({ ok: false, error: 'Channel name must be at least 2 characters.' });

  var channels = readTable(ss, 'Channels');
  for (var i = 0; i < channels.length; i++) {
    if (!channels[i].dm_participants && channels[i].name.toLowerCase() === rawName) {
      return jsonResponse({ ok: false, error: 'Channel #' + rawName + ' already exists.' });
    }
  }

  var isPrivate = Boolean(payload.isPrivate);
  var newChannel = {
    channel_id: generateId('ch'),
    name: rawName,
    description: String(payload.description || '').trim() || (isPrivate ? 'Private team channel' : 'Team discussion channel'),
    is_private: isPrivate,
    created_by: userId,
    created_at: nowIso,
    dm_participants: ''
  };
  appendObjectRow(ss, 'Channels', newChannel);
  appendObjectRow(ss, 'ChannelMembers', {
    membership_id: generateId('mem'),
    channel_id: newChannel.channel_id,
    user_id: userId,
    role: 'owner',
    joined_at: nowIso
  });

  if (Array.isArray(payload.memberEmails)) {
    var users = readTable(ss, 'Users');
    for (var eIdx = 0; eIdx < payload.memberEmails.length; eIdx++) {
      var targetEmail = String(payload.memberEmails[eIdx] || '').trim().toLowerCase();
      for (var uIdx = 0; uIdx < users.length; uIdx++) {
        if (String(users[uIdx].email).toLowerCase() === targetEmail && users[uIdx].user_id !== userId) {
          appendObjectRow(ss, 'ChannelMembers', {
            membership_id: generateId('mem'),
            channel_id: newChannel.channel_id,
            user_id: users[uIdx].user_id,
            role: 'member',
            joined_at: nowIso
          });
        }
      }
    }
  }

  var updatedChannels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var accessible = updatedChannels.filter(function(ch) {
    return canUserAccessChannel(ch, memberships, userId);
  });

  return jsonResponse({
    ok: true,
    channel: newChannel,
    channels: accessible,
    memberships: memberships,
    timestamp: nowIso
  });
}

function handleEditChannel(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var rawName = String(payload.name || '').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-|-$/g, '');
  if (rawName.length < 2) {
    return jsonResponse({ ok: false, error: 'Channel name must be at least 2 characters.' });
  }

  var channels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var targetIndex = -1;

  for (var i = 0; i < channels.length; i++) {
    if (channels[i].channel_id === channelId) {
      targetIndex = i;
    } else if (!channels[i].dm_participants && String(channels[i].name).toLowerCase() === rawName) {
      return jsonResponse({ ok: false, error: 'Channel #' + rawName + ' already exists.' });
    }
  }

  if (targetIndex === -1) {
    return jsonResponse({ ok: false, error: 'Channel not found.' });
  }

  var targetChannel = channels[targetIndex];
  if (!canUserAccessChannel(targetChannel, memberships, userId)) {
    return jsonResponse({ ok: false, error: 'Access denied to edit this channel.' });
  }

  var nextPrivate = payload.isPrivate !== undefined ? Boolean(payload.isPrivate) : Boolean(targetChannel.is_private);
  var nextDescription = payload.description !== undefined
    ? String(payload.description).trim()
    : String(targetChannel.description || '');

  targetChannel.name = rawName;
  targetChannel.description = nextDescription || (nextPrivate ? 'Private team channel' : 'Team discussion channel');
  targetChannel.is_private = nextPrivate;
  channels[targetIndex] = targetChannel;
  overwriteTable(ss, 'Channels', channels);

  if (nextPrivate && userId) {
    var hasMembership = false;
    for (var m = 0; m < memberships.length; m++) {
      if (memberships[m].channel_id === channelId && memberships[m].user_id === userId) {
        hasMembership = true;
        break;
      }
    }
    if (!hasMembership) {
      var newMember = {
        membership_id: generateId('mem'),
        channel_id: channelId,
        user_id: userId,
        role: 'owner',
        joined_at: nowIso
      };
      appendObjectRow(ss, 'ChannelMembers', newMember);
      memberships.push(newMember);
    }
  }

  var accessible = channels.filter(function(ch) {
    return canUserAccessChannel(ch, memberships, userId);
  });

  return jsonResponse({
    ok: true,
    channel: targetChannel,
    channels: accessible,
    memberships: memberships,
    timestamp: nowIso
  });
}

function handleDeleteChannel(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var channels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');

  var targetChannel = null;
  var nonDmCount = 0;
  for (var i = 0; i < channels.length; i++) {
    if (!channels[i].dm_participants) nonDmCount++;
    if (channels[i].channel_id === channelId) {
      targetChannel = channels[i];
    }
  }

  if (!targetChannel) {
    return jsonResponse({ ok: false, error: 'Channel not found.' });
  }
  if (!canUserAccessChannel(targetChannel, memberships, userId)) {
    return jsonResponse({ ok: false, error: 'Access denied to delete this channel.' });
  }
  if (!targetChannel.dm_participants && nonDmCount <= 1) {
    return jsonResponse({ ok: false, error: 'Cannot delete the last remaining channel in the workspace.' });
  }

  var remainingChannels = channels.filter(function(ch) {
    return ch.channel_id !== channelId;
  });
  var remainingMemberships = memberships.filter(function(m) {
    return m.channel_id !== channelId;
  });
  var remainingMessages = readTable(ss, 'Messages').filter(function(msg) {
    return msg.channel_id !== channelId;
  });

  overwriteTable(ss, 'Channels', remainingChannels);
  overwriteTable(ss, 'ChannelMembers', remainingMemberships);
  overwriteTable(ss, 'Messages', remainingMessages);

  var accessible = remainingChannels.filter(function(ch) {
    return canUserAccessChannel(ch, remainingMemberships, userId);
  });

  return jsonResponse({
    ok: true,
    deletedChannelId: channelId,
    channels: accessible,
    memberships: remainingMemberships,
    timestamp: nowIso
  });
}

function handleAddChannelMember(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var users = readTable(ss, 'Users');
  var target = null;
  for (var i = 0; i < users.length; i++) {
    if (
      (payload.targetUserId && users[i].user_id === payload.targetUserId) ||
      (payload.email && String(users[i].email).toLowerCase() === String(payload.email).trim().toLowerCase())
    ) {
      target = users[i];
      break;
    }
  }
  if (!target) return jsonResponse({ ok: false, error: 'User not found.' });

  var memberships = readTable(ss, 'ChannelMembers');
  var exists = false;
  for (var m = 0; m < memberships.length; m++) {
    if (memberships[m].channel_id === channelId && memberships[m].user_id === target.user_id) {
      exists = true;
    }
  }
  if (!exists) {
    appendObjectRow(ss, 'ChannelMembers', {
      membership_id: generateId('mem'),
      channel_id: channelId,
      user_id: target.user_id,
      role: 'member',
      joined_at: nowIso
    });
  }

  var nextMemberships = readTable(ss, 'ChannelMembers');
  var channels = readTable(ss, 'Channels').filter(function(ch) {
    return canUserAccessChannel(ch, nextMemberships, userId);
  });
  return jsonResponse({
    ok: true,
    memberships: nextMemberships,
    channels: channels,
    timestamp: nowIso
  });
}

function handleRemoveChannelMember(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var channelId = String(payload.channelId || '');
  var targetUserId = String(payload.targetUserId || '');
  var memberships = readTable(ss, 'ChannelMembers').filter(function(m) {
    return !(m.channel_id === channelId && m.user_id === targetUserId);
  });
  overwriteTable(ss, 'ChannelMembers', memberships);
  var channels = readTable(ss, 'Channels').filter(function(ch) {
    return canUserAccessChannel(ch, memberships, userId);
  });
  return jsonResponse({
    ok: true,
    memberships: memberships,
    channels: channels,
    timestamp: nowIso
  });
}

function handleOpenDirectMessage(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var targetUserId = String(payload.targetUserId || '');
  var pair = [userId, targetUserId].sort();
  var dmKey = pair.join(',');

  var channels = readTable(ss, 'Channels');
  var dmChannel = null;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].dm_participants === dmKey) dmChannel = channels[i];
  }

  if (!dmChannel) {
    dmChannel = {
      channel_id: generateId('dm'),
      name: 'dm-' + pair[0].slice(-4) + '-' + pair[1].slice(-4),
      description: 'Direct message thread',
      is_private: true,
      created_by: userId,
      created_at: nowIso,
      dm_participants: dmKey
    };
    appendObjectRow(ss, 'Channels', dmChannel);
    appendObjectRow(ss, 'ChannelMembers', {
      membership_id: generateId('mem'),
      channel_id: dmChannel.channel_id,
      user_id: userId,
      role: 'member',
      joined_at: nowIso
    });
    if (targetUserId !== userId) {
      appendObjectRow(ss, 'ChannelMembers', {
        membership_id: generateId('mem'),
        channel_id: dmChannel.channel_id,
        user_id: targetUserId,
        role: 'member',
        joined_at: nowIso
      });
    }
  }

  var nextChannels = readTable(ss, 'Channels');
  var memberships = readTable(ss, 'ChannelMembers');
  var allMessages = readTable(ss, 'Messages');
  return jsonResponse({
    ok: true,
    channel: dmChannel,
    channels: nextChannels.filter(function(ch) {
      return canUserAccessChannel(ch, memberships, userId);
    }),
    memberships: memberships,
    messages: enrichMessages(allMessages, dmChannel.channel_id),
    timestamp: nowIso
  });
}

function handleUpdateUserStatus(ss, payload, nowIso) {
  var userId = String(payload.userId || '');
  var users = readTable(ss, 'Users');
  var updated = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user_id === userId) {
      if (payload.statusText !== undefined) users[i].status_text = String(payload.statusText).trim();
      if (payload.roleTitle !== undefined) users[i].role_title = String(payload.roleTitle).trim();
      users[i].last_seen_at = nowIso;
      updated = users[i];
      break;
    }
  }
  if (!updated) return jsonResponse({ ok: false, error: 'User not found.' });
  overwriteTable(ss, 'Users', users);
  return jsonResponse({
    ok: true,
    user: stripPassword(updated),
    users: users.map(stripPassword),
    timestamp: nowIso
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
