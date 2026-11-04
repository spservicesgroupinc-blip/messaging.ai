export interface SheetUser {
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  display_name: string;
  role_title: string;
  status_text: string;
  created_at: string;
  last_seen_at: string;
}

export type PublicUser = Omit<SheetUser, 'password_hash'>;

export interface SheetChannel {
  channel_id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  dm_participants: string; // comma-separated user_ids if DM, else empty
}

export interface SheetChannelMember {
  membership_id: string;
  channel_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export type ReactionMap = Record<string, string[]>; // emoji -> array of user_ids

export interface SheetMessage {
  message_id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  parent_message_id: string;
  reactions_json: string;
  created_at: string;
  updated_at: string;
}

export interface EnrichedMessage extends SheetMessage {
  delivery?: 'sending' | 'failed';
  reactions: ReactionMap;
  reply_count: number;
  last_reply_at?: string;
}

export interface SheetsDatabase {
  Users: SheetUser[];
  Channels: SheetChannel[];
  ChannelMembers: SheetChannelMember[];
  Messages: SheetMessage[];
}

export interface GasRequestPayload {
  action:
    | 'ping'
    | 'initSheets'
    | 'signup'
    | 'login'
    | 'getBootstrap'
    | 'getMessages'
    | 'sendMessage'
    | 'editMessage'
    | 'deleteMessage'
    | 'toggleReaction'
    | 'createChannel'
    | 'editChannel'
    | 'deleteChannel'
    | 'addChannelMember'
    | 'removeChannelMember'
    | 'openDirectMessage'
    | 'updateUserStatus'
    | 'inspectSheets';
  email?: string;
  password?: string;
  fullName?: string;
  displayName?: string;
  roleTitle?: string;
  statusText?: string;
  userId?: string;
  channelId?: string;
  name?: string;
  description?: string;
  isPrivate?: boolean;
  memberEmails?: string[];
  targetUserId?: string;
  content?: string;
  parentMessageId?: string;
  messageId?: string;
  emoji?: string;
  since?: string;
}

export interface GasResponse {
  ok: boolean;
  code?: string;
  error?: string;
  user?: PublicUser;
  users?: PublicUser[];
  channels?: SheetChannel[];
  memberships?: SheetChannelMember[];
  messages?: EnrichedMessage[];
  channel?: SheetChannel;
  deletedChannelId?: string;
  message?: EnrichedMessage;
  sheets?: {
    Users: PublicUser[];
    Channels: SheetChannel[];
    ChannelMembers: SheetChannelMember[];
    Messages: SheetMessage[];
  };
  timestamp?: string;
}

export function createEmptySheetsDatabase(nowIso = new Date().toISOString()): SheetsDatabase {
  return {
    Users: [],
    Channels: [
      {
        channel_id: 'ch_general',
        name: 'general',
        description: 'Company-wide announcements and team-wide discussions',
        is_private: false,
        created_by: 'system',
        created_at: nowIso,
        dm_participants: '',
      },
      {
        channel_id: 'ch_engineering',
        name: 'engineering',
        description: 'Architecture, deployments, and technical operations',
        is_private: false,
        created_by: 'system',
        created_at: nowIso,
        dm_participants: '',
      },
    ],
    ChannelMembers: [],
    Messages: [],
  };
}

/**
 * Portable deterministic password hash used in both local Sheets engine and Code.gs
 */
export function hashPassword(password: string, email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const input = `relay_sheets_auth_v1:${normalizedEmail}:${password}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function normalizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function validateSignupInput(input: {
  email?: string;
  password?: string;
  fullName?: string;
}): { valid: boolean; error?: string } {
  const fullName = (input.fullName || '').trim();
  const email = (input.email || '').trim().toLowerCase();
  const password = input.password || '';

  if (!fullName || fullName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Please enter a valid work email address.' };
  }
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.' };
  }
  return { valid: true };
}

export function validateLoginInput(input: {
  email?: string;
  password?: string;
}): { valid: boolean; error?: string } {
  const email = (input.email || '').trim().toLowerCase();
  const password = input.password || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { valid: false, error: 'Please enter your password.' };
  }
  return { valid: true };
}

export function toPublicUser(user: SheetUser): PublicUser {
  const { password_hash: _removed, ...rest } = user;
  return rest;
}

export function canUserAccessChannel(
  channel: SheetChannel,
  memberships: SheetChannelMember[],
  userId: string
): boolean {
  if (!userId) return false;
  if (channel.dm_participants) {
    const parts = channel.dm_participants.split(',').map((s) => s.trim());
    return parts.includes(userId);
  }
  if (!channel.is_private) {
    return true;
  }
  if (channel.created_by === userId) {
    return true;
  }
  return memberships.some(
    (m) => m.channel_id === channel.channel_id && m.user_id === userId
  );
}

export function parseReactions(reactionsJson: string): ReactionMap {
  if (!reactionsJson) return {};
  try {
    const parsed = JSON.parse(reactionsJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ReactionMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function enrichMessagesForChannel(
  allMessages: SheetMessage[],
  channelId: string
): EnrichedMessage[] {
  const channelMsgs = allMessages
    .filter((m) => m.channel_id === channelId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const replyStats = new Map<string, { count: number; lastReplyAt: string }>();
  for (const msg of channelMsgs) {
    if (msg.parent_message_id) {
      const prev = replyStats.get(msg.parent_message_id) || {
        count: 0,
        lastReplyAt: msg.created_at,
      };
      replyStats.set(msg.parent_message_id, {
        count: prev.count + 1,
        lastReplyAt: msg.created_at > prev.lastReplyAt ? msg.created_at : prev.lastReplyAt,
      });
    }
  }

  return channelMsgs.map((msg) => {
    const stats = replyStats.get(msg.message_id);
    return {
      ...msg,
      reactions: parseReactions(msg.reactions_json),
      reply_count: stats ? stats.count : 0,
      last_reply_at: stats ? stats.lastReplyAt : undefined,
    };
  });
}

function defaultGenerateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function executeSheetAction(
  currentDb: SheetsDatabase,
  payload: GasRequestPayload,
  nowIso = new Date().toISOString(),
  generateId: (prefix: string) => string = defaultGenerateId
): { db: SheetsDatabase; response: GasResponse } {
  const db: SheetsDatabase = {
    Users: [...currentDb.Users],
    Channels: [...currentDb.Channels],
    ChannelMembers: [...currentDb.ChannelMembers],
    Messages: [...currentDb.Messages],
  };

  if (db.Channels.length === 0) {
    const seeded = createEmptySheetsDatabase(nowIso);
    db.Channels = seeded.Channels;
  }

  switch (payload.action) {
    case 'ping':
    case 'initSheets': {
      return {
        db,
        response: {
          ok: true,
          timestamp: nowIso,
          channels: db.Channels,
        },
      };
    }

    case 'inspectSheets': {
      return {
        db,
        response: {
          ok: true,
          timestamp: nowIso,
          sheets: {
            Users: db.Users.map(toPublicUser),
            Channels: db.Channels,
            ChannelMembers: db.ChannelMembers,
            Messages: db.Messages,
          },
        },
      };
    }

    case 'signup': {
      const validation = validateSignupInput({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
      });
      if (!validation.valid) {
        return { db, response: { ok: false, error: validation.error } };
      }

      const normalizedEmail = payload.email!.trim().toLowerCase();
      const existing = db.Users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (existing) {
        return {
          db,
          response: {
            ok: false,
            error: 'An account with this email already exists.',
          },
        };
      }

      const fullName = payload.fullName!.trim();
      const displayName = (payload.displayName || fullName.split(' ')[0] || fullName).trim();
      const roleTitle = (payload.roleTitle || 'Team Member').trim();
      const newUser: SheetUser = {
        user_id: generateId('usr'),
        email: normalizedEmail,
        password_hash: hashPassword(payload.password!, normalizedEmail),
        full_name: fullName,
        display_name: displayName,
        role_title: roleTitle,
        status_text: payload.statusText?.trim() || 'Active',
        created_at: nowIso,
        last_seen_at: nowIso,
      };

      db.Users.push(newUser);

      // Add membership rows for default public channels
      for (const ch of db.Channels) {
        if (!ch.is_private && !ch.dm_participants) {
          db.ChannelMembers.push({
            membership_id: generateId('mem'),
            channel_id: ch.channel_id,
            user_id: newUser.user_id,
            role: 'member',
            joined_at: nowIso,
          });
        }
      }

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, newUser.user_id)
      );

      return {
        db,
        response: {
          ok: true,
          user: toPublicUser(newUser),
          users: db.Users.map(toPublicUser),
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          timestamp: nowIso,
        },
      };
    }

    case 'login': {
      const validation = validateLoginInput({
        email: payload.email,
        password: payload.password,
      });
      if (!validation.valid) {
        return { db, response: { ok: false, error: validation.error } };
      }

      const normalizedEmail = payload.email!.trim().toLowerCase();
      const expectedHash = hashPassword(payload.password!, normalizedEmail);
      const userIdx = db.Users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);

      if (userIdx === -1) {
        return {
          db,
          response: {
            ok: false,
            error: 'No account found with that email address. Please sign up first.',
          },
        };
      }

      const user = db.Users[userIdx];
      if (user.password_hash !== expectedHash) {
        return {
          db,
          response: {
            ok: false,
            error: 'Invalid password for this account.',
          },
        };
      }

      const updatedUser: SheetUser = {
        ...user,
        last_seen_at: nowIso,
      };
      db.Users[userIdx] = updatedUser;

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, updatedUser.user_id)
      );

      return {
        db,
        response: {
          ok: true,
          user: toPublicUser(updatedUser),
          users: db.Users.map(toPublicUser),
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          timestamp: nowIso,
        },
      };
    }

    case 'getBootstrap': {
      const userId = payload.userId || '';
      const userIdx = db.Users.findIndex((u) => u.user_id === userId);
      if (userIdx === -1) {
        return {
          db,
          response: { ok: false, error: 'Session expired. Please sign in again.' },
        };
      }

      db.Users[userIdx] = {
        ...db.Users[userIdx],
        last_seen_at: nowIso,
      };

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, userId)
      );

      const requestedChannelId =
        payload.channelId &&
        accessibleChannels.some((c) => c.channel_id === payload.channelId)
          ? payload.channelId
          : accessibleChannels[0]?.channel_id || '';

      const messages = requestedChannelId
        ? enrichMessagesForChannel(db.Messages, requestedChannelId)
        : [];

      return {
        db,
        response: {
          ok: true,
          user: toPublicUser(db.Users[userIdx]),
          users: db.Users.map(toPublicUser),
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          messages,
          timestamp: nowIso,
        },
      };
    }

    case 'getMessages': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const channel = db.Channels.find((c) => c.channel_id === channelId);
      if (!channel) {
        return { db, response: { ok: false, error: 'Channel not found.' } };
      }
      if (!canUserAccessChannel(channel, db.ChannelMembers, userId)) {
        return {
          db,
          response: { ok: false, error: 'Access denied to this private channel.' },
        };
      }

      return {
        db,
        response: {
          ok: true,
          messages: enrichMessagesForChannel(db.Messages, channelId),
          timestamp: nowIso,
        },
      };
    }

    case 'sendMessage': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const content = (payload.content || '').trim();

      if (!content) {
        return { db, response: { ok: false, error: 'Message content cannot be empty.' } };
      }

      const sender = db.Users.find((u) => u.user_id === userId);
      if (!sender) {
        return { db, response: { ok: false, error: 'Authenticated user not found.' } };
      }

      const channel = db.Channels.find((c) => c.channel_id === channelId);
      if (!channel) {
        return { db, response: { ok: false, error: 'Target channel not found.' } };
      }

      if (!canUserAccessChannel(channel, db.ChannelMembers, userId)) {
        return {
          db,
          response: { ok: false, error: 'You do not have permission to post in this private channel.' },
        };
      }

      const newMsg: SheetMessage = {
        message_id: generateId('msg'),
        channel_id: channelId,
        user_id: sender.user_id,
        user_name: sender.full_name,
        user_role: sender.role_title,
        content,
        parent_message_id: payload.parentMessageId || '',
        reactions_json: '{}',
        created_at: nowIso,
        updated_at: nowIso,
      };

      db.Messages.push(newMsg);

      const enriched = enrichMessagesForChannel(db.Messages, channelId);
      const createdEnriched = enriched.find((m) => m.message_id === newMsg.message_id);

      return {
        db,
        response: {
          ok: true,
          message: createdEnriched,
          messages: enriched,
          timestamp: nowIso,
        },
      };
    }

    case 'editMessage': {
      const userId = payload.userId || '';
      const messageId = payload.messageId || '';
      const content = (payload.content || '').trim();

      if (!content) {
        return { db, response: { ok: false, error: 'Updated message cannot be empty.' } };
      }

      const idx = db.Messages.findIndex((m) => m.message_id === messageId);
      if (idx === -1) {
        return { db, response: { ok: false, error: 'Message not found.' } };
      }

      if (db.Messages[idx].user_id !== userId) {
        return { db, response: { ok: false, error: 'You can only edit your own messages.' } };
      }

      db.Messages[idx] = {
        ...db.Messages[idx],
        content,
        updated_at: nowIso,
      };

      const channelId = db.Messages[idx].channel_id;
      return {
        db,
        response: {
          ok: true,
          messages: enrichMessagesForChannel(db.Messages, channelId),
          timestamp: nowIso,
        },
      };
    }

    case 'deleteMessage': {
      const userId = payload.userId || '';
      const messageId = payload.messageId || '';
      const target = db.Messages.find((m) => m.message_id === messageId);
      if (!target) {
        return { db, response: { ok: false, error: 'Message not found.' } };
      }
      if (target.user_id !== userId) {
        return { db, response: { ok: false, error: 'You can only delete your own messages.' } };
      }

      const channelId = target.channel_id;
      db.Messages = db.Messages.filter(
        (m) => m.message_id !== messageId && m.parent_message_id !== messageId
      );

      return {
        db,
        response: {
          ok: true,
          messages: enrichMessagesForChannel(db.Messages, channelId),
          timestamp: nowIso,
        },
      };
    }

    case 'toggleReaction': {
      const userId = payload.userId || '';
      const messageId = payload.messageId || '';
      const emoji = (payload.emoji || '').trim();
      if (!emoji || !userId) {
        return { db, response: { ok: false, error: 'Missing emoji or userId.' } };
      }

      const idx = db.Messages.findIndex((m) => m.message_id === messageId);
      if (idx === -1) {
        return { db, response: { ok: false, error: 'Message not found.' } };
      }

      const reactions = parseReactions(db.Messages[idx].reactions_json);
      const currentUsers = reactions[emoji] || [];
      if (currentUsers.includes(userId)) {
        const nextUsers = currentUsers.filter((id) => id !== userId);
        if (nextUsers.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = nextUsers;
        }
      } else {
        reactions[emoji] = [...currentUsers, userId];
      }

      db.Messages[idx] = {
        ...db.Messages[idx],
        reactions_json: JSON.stringify(reactions),
      };

      const channelId = db.Messages[idx].channel_id;
      return {
        db,
        response: {
          ok: true,
          messages: enrichMessagesForChannel(db.Messages, channelId),
          timestamp: nowIso,
        },
      };
    }

    case 'createChannel': {
      const userId = payload.userId || '';
      const creator = db.Users.find((u) => u.user_id === userId);
      if (!creator) {
        return { db, response: { ok: false, error: 'User not found.' } };
      }

      const normalizedName = normalizeChannelName(payload.name || '');
      if (!normalizedName || normalizedName.length < 2) {
        return {
          db,
          response: {
            ok: false,
            error: 'Channel name must be at least 2 alphanumeric characters.',
          },
        };
      }

      const exists = db.Channels.some(
        (c) => !c.dm_participants && c.name.toLowerCase() === normalizedName
      );
      if (exists) {
        return {
          db,
          response: {
            ok: false,
            error: `Channel #${normalizedName} already exists.`,
          },
        };
      }

      const isPrivate = Boolean(payload.isPrivate);
      const newChannel: SheetChannel = {
        channel_id: generateId('ch'),
        name: normalizedName,
        description: (payload.description || '').trim() || (isPrivate ? 'Private team channel' : 'Team discussion channel'),
        is_private: isPrivate,
        created_by: userId,
        created_at: nowIso,
        dm_participants: '',
      };

      db.Channels.push(newChannel);
      db.ChannelMembers.push({
        membership_id: generateId('mem'),
        channel_id: newChannel.channel_id,
        user_id: userId,
        role: 'owner',
        joined_at: nowIso,
      });

      if (Array.isArray(payload.memberEmails)) {
        for (const rawEmail of payload.memberEmails) {
          const email = rawEmail.trim().toLowerCase();
          const invitedUser = db.Users.find((u) => u.email.toLowerCase() === email);
          if (invitedUser && invitedUser.user_id !== userId) {
            db.ChannelMembers.push({
              membership_id: generateId('mem'),
              channel_id: newChannel.channel_id,
              user_id: invitedUser.user_id,
              role: 'member',
              joined_at: nowIso,
            });
          }
        }
      }

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, userId)
      );

      return {
        db,
        response: {
          ok: true,
          channel: newChannel,
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          timestamp: nowIso,
        },
      };
    }

    case 'editChannel': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const normalizedName = normalizeChannelName(payload.name || '');

      if (!normalizedName || normalizedName.length < 2) {
        return {
          db,
          response: {
            ok: false,
            error: 'Channel name must be at least 2 alphanumeric characters.',
          },
        };
      }

      const targetIdx = db.Channels.findIndex((c) => c.channel_id === channelId);
      if (targetIdx === -1) {
        return { db, response: { ok: false, error: 'Channel not found.' } };
      }

      const targetChannel = db.Channels[targetIdx];
      if (!canUserAccessChannel(targetChannel, db.ChannelMembers, userId)) {
        return { db, response: { ok: false, error: 'Access denied to edit this channel.' } };
      }

      const duplicate = db.Channels.some(
        (c, idx) =>
          idx !== targetIdx &&
          !c.dm_participants &&
          c.name.toLowerCase() === normalizedName
      );
      if (duplicate) {
        return {
          db,
          response: {
            ok: false,
            error: `Channel #${normalizedName} already exists.`,
          },
        };
      }

      const nextPrivate =
        payload.isPrivate !== undefined ? Boolean(payload.isPrivate) : targetChannel.is_private;
      const nextDescription =
        payload.description !== undefined
          ? payload.description.trim()
          : targetChannel.description;

      const updatedChannel: SheetChannel = {
        ...targetChannel,
        name: normalizedName,
        description:
          nextDescription || (nextPrivate ? 'Private team channel' : 'Team discussion channel'),
        is_private: nextPrivate,
      };
      db.Channels[targetIdx] = updatedChannel;

      if (nextPrivate && userId) {
        const hasMembership = db.ChannelMembers.some(
          (m) => m.channel_id === channelId && m.user_id === userId
        );
        if (!hasMembership) {
          db.ChannelMembers.push({
            membership_id: generateId('mem'),
            channel_id: channelId,
            user_id: userId,
            role: 'owner',
            joined_at: nowIso,
          });
        }
      }

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, userId)
      );

      return {
        db,
        response: {
          ok: true,
          channel: updatedChannel,
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          timestamp: nowIso,
        },
      };
    }

    case 'deleteChannel': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const targetChannel = db.Channels.find((c) => c.channel_id === channelId);
      if (!targetChannel) {
        return { db, response: { ok: false, error: 'Channel not found.' } };
      }
      if (!canUserAccessChannel(targetChannel, db.ChannelMembers, userId)) {
        return { db, response: { ok: false, error: 'Access denied to delete this channel.' } };
      }

      const nonDmChannels = db.Channels.filter((c) => !c.dm_participants);
      if (!targetChannel.dm_participants && nonDmChannels.length <= 1) {
        return {
          db,
          response: {
            ok: false,
            error: 'Cannot delete the last remaining channel in the workspace.',
          },
        };
      }

      db.Channels = db.Channels.filter((c) => c.channel_id !== channelId);
      db.ChannelMembers = db.ChannelMembers.filter((m) => m.channel_id !== channelId);
      db.Messages = db.Messages.filter((m) => m.channel_id !== channelId);

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, userId)
      );

      return {
        db,
        response: {
          ok: true,
          deletedChannelId: channelId,
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          timestamp: nowIso,
        },
      };
    }

    case 'addChannelMember': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const channel = db.Channels.find((c) => c.channel_id === channelId);
      if (!channel) {
        return { db, response: { ok: false, error: 'Channel not found.' } };
      }
      if (!canUserAccessChannel(channel, db.ChannelMembers, userId)) {
        return { db, response: { ok: false, error: 'Access denied.' } };
      }

      let targetUser: SheetUser | undefined;
      if (payload.targetUserId) {
        targetUser = db.Users.find((u) => u.user_id === payload.targetUserId);
      } else if (payload.email) {
        const cleanEmail = payload.email.trim().toLowerCase();
        targetUser = db.Users.find((u) => u.email.toLowerCase() === cleanEmail);
      }

      if (!targetUser) {
        return {
          db,
          response: { ok: false, error: 'No workspace user found with that email or ID.' },
        };
      }

      const alreadyMember = db.ChannelMembers.some(
        (m) => m.channel_id === channelId && m.user_id === targetUser!.user_id
      );
      if (!alreadyMember) {
        db.ChannelMembers.push({
          membership_id: generateId('mem'),
          channel_id: channelId,
          user_id: targetUser.user_id,
          role: 'member',
          joined_at: nowIso,
        });
      }

      return {
        db,
        response: {
          ok: true,
          memberships: db.ChannelMembers,
          channels: db.Channels.filter((c) =>
            canUserAccessChannel(c, db.ChannelMembers, userId)
          ),
          timestamp: nowIso,
        },
      };
    }

    case 'removeChannelMember': {
      const userId = payload.userId || '';
      const channelId = payload.channelId || '';
      const targetUserId = payload.targetUserId || '';
      const channel = db.Channels.find((c) => c.channel_id === channelId);
      if (!channel) {
        return { db, response: { ok: false, error: 'Channel not found.' } };
      }
      if (!canUserAccessChannel(channel, db.ChannelMembers, userId)) {
        return { db, response: { ok: false, error: 'Access denied.' } };
      }

      db.ChannelMembers = db.ChannelMembers.filter(
        (m) => !(m.channel_id === channelId && m.user_id === targetUserId)
      );

      return {
        db,
        response: {
          ok: true,
          memberships: db.ChannelMembers,
          channels: db.Channels.filter((c) =>
            canUserAccessChannel(c, db.ChannelMembers, userId)
          ),
          timestamp: nowIso,
        },
      };
    }

    case 'openDirectMessage': {
      const userId = payload.userId || '';
      const targetUserId = payload.targetUserId || '';
      const userA = db.Users.find((u) => u.user_id === userId);
      const userB = db.Users.find((u) => u.user_id === targetUserId);
      if (!userA || !userB) {
        return { db, response: { ok: false, error: 'Direct message user not found.' } };
      }

      const sortedIds = [userId, targetUserId].sort();
      const dmKey = sortedIds.join(',');

      let dmChannel = db.Channels.find((c) => c.dm_participants === dmKey);
      if (!dmChannel) {
        dmChannel = {
          channel_id: generateId('dm'),
          name: `dm-${sortedIds[0].slice(-4)}-${sortedIds[1].slice(-4)}`,
          description: `Direct message between ${userA.full_name} and ${userB.full_name}`,
          is_private: true,
          created_by: userId,
          created_at: nowIso,
          dm_participants: dmKey,
        };
        db.Channels.push(dmChannel);
        for (const uid of new Set(sortedIds)) {
          db.ChannelMembers.push({
            membership_id: generateId('mem'),
            channel_id: dmChannel.channel_id,
            user_id: uid,
            role: 'member',
            joined_at: nowIso,
          });
        }
      }

      const accessibleChannels = db.Channels.filter((c) =>
        canUserAccessChannel(c, db.ChannelMembers, userId)
      );

      return {
        db,
        response: {
          ok: true,
          channel: dmChannel,
          channels: accessibleChannels,
          memberships: db.ChannelMembers,
          messages: enrichMessagesForChannel(db.Messages, dmChannel.channel_id),
          timestamp: nowIso,
        },
      };
    }

    case 'updateUserStatus': {
      const userId = payload.userId || '';
      const idx = db.Users.findIndex((u) => u.user_id === userId);
      if (idx === -1) {
        return { db, response: { ok: false, error: 'User not found.' } };
      }
      db.Users[idx] = {
        ...db.Users[idx],
        status_text: (payload.statusText ?? db.Users[idx].status_text).trim(),
        role_title: (payload.roleTitle ?? db.Users[idx].role_title).trim(),
        last_seen_at: nowIso,
      };
      return {
        db,
        response: {
          ok: true,
          user: toPublicUser(db.Users[idx]),
          users: db.Users.map(toPublicUser),
          timestamp: nowIso,
        },
      };
    }

    default:
      return {
        db,
        response: { ok: false, error: 'Unsupported Google Apps Script action.' },
      };
  }
}

export function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatTimeShort(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateHeader(iso: string): string {
  if (!iso) return 'Recent';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
