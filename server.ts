import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  createEmptySheetsDatabase,
  executeSheetAction,
  type GasRequestPayload,
  type GasResponse,
  type SheetsDatabase,
} from './src/utils/sheetsProtocol.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'sheets-db.json');

// Hardcoded production Google Apps Script Web App endpoint provided by user
const APPS_SCRIPT_WEBAPP_URL =
  process.env.APPS_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbyOYvQtigsO62ckL2jCgKBp_qt6y8xbcgd57CSeS9_5eRLVQ2zbxxteQVx5hxw06BIq4A/exec';

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
        'addChannelMember',
        'removeChannelMember',
        'openDirectMessage',
        'updateUserStatus',
      ]);

      // Primary: Execute against the live Google Apps Script Web App
      const remoteResponse = await callRemoteAppsScript(body);
      if (remoteResponse) {
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
