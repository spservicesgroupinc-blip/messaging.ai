import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  createEmptySheetsDatabase,
  executeSheetAction,
  normalizeChannelName,
  type GasRequestPayload,
  type GasResponse,
  type SheetChannel,
  type SheetsDatabase,
} from './src/utils/sheetsProtocol.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'sheets-db.json');
const OVERLAY_FILE = path.join(DATA_DIR, 'channel-overlay.json');

// Hardcoded production Google Apps Script Web App endpoint provided by user
const APPS_SCRIPT_WEBAPP_URL =
  process.env.APPS_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbxbX8d3Rdd6GJaprM4fi9YbUlVX5VBYZb3Od7397NCHpd4C27OxoJu3zfWESt8wr4ocEw/exec';

interface ChannelOverlayState {
  editedChannels: Record<
    string,
    { name: string; description: string; is_private: boolean }
  >;
  deletedChannelIds: string[];
}

function loadDatabase(): SheetsDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as SheetsDatabase;
      if (
        parsed &&
        Array.isArray(parsed.Users) &&
        Array.isArray(parsed.Channels) &&
        Array.isArray(parsed.ChannelMembers) &&
        Array.isArray(parsed.Messages)
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read local cache, initializing clean schema:', err);
  }
  const initial = createEmptySheetsDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: SheetsDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist local cache:', err);
  }
}

function loadChannelOverlay(): ChannelOverlayState {
  try {
    if (fs.existsSync(OVERLAY_FILE)) {
      const raw = fs.readFileSync(OVERLAY_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ChannelOverlayState;
      if (parsed && parsed.editedChannels && Array.isArray(parsed.deletedChannelIds)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { editedChannels: {}, deletedChannelIds: [] };
}

function saveChannelOverlay(overlay: ChannelOverlayState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(OVERLAY_FILE, JSON.stringify(overlay, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function applyOverlayToChannels(
  channels: SheetChannel[] | undefined,
  overlay: ChannelOverlayState
): SheetChannel[] | undefined {
  if (!Array.isArray(channels)) return channels;
  const deletedSet = new Set(overlay.deletedChannelIds);
  return channels
    .filter((ch) => !deletedSet.has(ch.channel_id))
    .map((ch) => {
      const edit = overlay.editedChannels[ch.channel_id];
      if (!edit) return ch;
      return {
        ...ch,
        name: edit.name,
        description: edit.description,
        is_private: edit.is_private,
      };
    });
}

/**
 * Calls the deployed Google Apps Script Web App following 302 redirects cleanly.
 */
async function callRemoteAppsScript(payload: GasRequestPayload): Promise<GasResponse | null> {
  try {
    const initialRes = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
    });

    let responseText = '';
    if (
      initialRes.status >= 300 &&
      initialRes.status < 400 &&
      initialRes.headers.get('location')
    ) {
      const redirectUrl = initialRes.headers.get('location')!;
      const followRes = await fetch(redirectUrl, {
        method: 'GET',
        redirect: 'follow',
      });
      responseText = await followRes.text();
    } else {
      responseText = await initialRes.text();
    }

    const parsed = JSON.parse(responseText) as GasResponse;
    if (parsed && typeof parsed.ok === 'boolean') {
      if (parsed.error) {
        parsed.error = parsed.error
          .replace(/ in the Users sheet/gi, '')
          .replace(/ in Users sheet/gi, '')
          .replace(/ in the Channels sheet/gi, '');
      }
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Remote Apps Script request error, using fallback store:', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.text({ type: 'text/plain', limit: '2mb' }));

  let db = loadDatabase();
  let overlay = loadChannelOverlay();
  const sseClients = new Set<express.Response>();

  function broadcastSync(eventType: string, channelId?: string) {
    const payload = JSON.stringify({
      type: eventType,
      channelId: channelId || '',
      timestamp: new Date().toISOString(),
    });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  }

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.post('/api/push-subscribe', (_req, res) => {
    res.json({ ok: true, subscribed: true, timestamp: new Date().toISOString() });
  });

  app.post('/api/gas', async (req, res) => {
    try {
      const body: GasRequestPayload =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const mutatingActions = new Set([
        'signup',
        'login',
        'sendMessage',
        'editMessage',
        'deleteMessage',
        'toggleReaction',
        'createChannel',
        'editChannel',
        'deleteChannel',
        'addChannelMember',
        'removeChannelMember',
        'openDirectMessage',
        'updateUserStatus',
      ]);

      // Primary: Execute against the live Google Apps Script Web App
      const remoteResponse = await callRemoteAppsScript(body);

      if (
        remoteResponse &&
        !remoteResponse.ok &&
        typeof remoteResponse.error === 'string' &&
        remoteResponse.error.includes('Unsupported action:') &&
        (body.action === 'editChannel' || body.action === 'deleteChannel')
      ) {
        const bootstrapRes = await callRemoteAppsScript({
          action: 'getBootstrap',
          userId: body.userId,
        });
        const baseChannels = applyOverlayToChannels(bootstrapRes?.channels || [], overlay) || [];

        if (body.action === 'editChannel') {
          const channelId = body.channelId || '';
          const normalizedName = normalizeChannelName(body.name || '');
          if (!normalizedName || normalizedName.length < 2) {
            res.json({
              ok: false,
              error: 'Channel name must be at least 2 alphanumeric characters.',
            });
            return;
          }
          const target = baseChannels.find((c) => c.channel_id === channelId);
          if (!target) {
            res.json({ ok: false, error: 'Channel not found.' });
            return;
          }
          const dup = baseChannels.some(
            (c) =>
              c.channel_id !== channelId &&
              !c.dm_participants &&
              c.name.toLowerCase() === normalizedName
          );
          if (dup) {
            res.json({
              ok: false,
              error: `Channel #${normalizedName} already exists.`,
            });
            return;
          }
          const nextPrivate =
            body.isPrivate !== undefined ? Boolean(body.isPrivate) : target.is_private;
          const nextDescription =
            body.description !== undefined
              ? body.description.trim()
              : target.description;
          const finalDescription =
            nextDescription || (nextPrivate ? 'Private team channel' : 'Team discussion channel');

          overlay.editedChannels[channelId] = {
            name: normalizedName,
            description: finalDescription,
            is_private: nextPrivate,
          };
          saveChannelOverlay(overlay);

          const updatedChannel: SheetChannel = {
            ...target,
            name: normalizedName,
            description: finalDescription,
            is_private: nextPrivate,
          };
          const updatedChannels = applyOverlayToChannels(bootstrapRes?.channels || [], overlay) || [];
          broadcastSync('editChannel', channelId);
          res.json({
            ok: true,
            channel: updatedChannel,
            channels: updatedChannels,
            memberships: bootstrapRes?.memberships || [],
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (body.action === 'deleteChannel') {
          const channelId = body.channelId || '';
          const target = baseChannels.find((c) => c.channel_id === channelId);
          if (!target) {
            res.json({ ok: false, error: 'Channel not found.' });
            return;
          }
          const nonDmCount = baseChannels.filter((c) => !c.dm_participants).length;
          if (!target.dm_participants && nonDmCount <= 1) {
            res.json({
              ok: false,
              error: 'Cannot delete the last remaining channel in the workspace.',
            });
            return;
          }
          if (!overlay.deletedChannelIds.includes(channelId)) {
            overlay.deletedChannelIds.push(channelId);
          }
          delete overlay.editedChannels[channelId];
          saveChannelOverlay(overlay);

          const updatedChannels = applyOverlayToChannels(bootstrapRes?.channels || [], overlay) || [];
          broadcastSync('deleteChannel', channelId);
          res.json({
            ok: true,
            deletedChannelId: channelId,
            channels: updatedChannels,
            memberships: bootstrapRes?.memberships || [],
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      if (remoteResponse) {
        if (remoteResponse.ok && body.action === 'editChannel' && body.channelId) {
          delete overlay.editedChannels[body.channelId];
          saveChannelOverlay(overlay);
        }
        if (remoteResponse.ok && body.action === 'deleteChannel' && body.channelId) {
          overlay.deletedChannelIds = overlay.deletedChannelIds.filter(
            (id) => id !== body.channelId
          );
          delete overlay.editedChannels[body.channelId];
          saveChannelOverlay(overlay);
        }

        if (remoteResponse.channels) {
          remoteResponse.channels = applyOverlayToChannels(remoteResponse.channels, overlay);
        }
        if (remoteResponse.channel && overlay.editedChannels[remoteResponse.channel.channel_id]) {
          const edit = overlay.editedChannels[remoteResponse.channel.channel_id];
          remoteResponse.channel = {
            ...remoteResponse.channel,
            name: edit.name,
            description: edit.description,
            is_private: edit.is_private,
          };
        }

        if (remoteResponse.ok && mutatingActions.has(body.action)) {
          broadcastSync(body.action, body.channelId);
        }
        res.json(remoteResponse);
        return;
      }

      // Fallback if remote endpoint is temporarily unreachable
      const result = executeSheetAction(db, body);
      db = result.db;

      if (result.response.ok && mutatingActions.has(body.action)) {
        saveDatabase(db);
        broadcastSync(body.action, body.channelId);
      }

      res.json(result.response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request payload';
      res.status(400).json({ ok: false, error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Relay Workspace server running at http://localhost:${PORT}`);
  });
}

startServer();
