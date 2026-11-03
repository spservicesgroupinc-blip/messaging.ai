import type { IncomingMessage, ServerResponse } from 'node:http';

const APPS_SCRIPT_WEBAPP_URL =
  process.env.APPS_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbxbX8d3Rdd6GJaprM4fi9YbUlVX5VBYZb3Od7397NCHpd4C27OxoJu3zfWESt8wr4ocEw/exec';

interface SheetChannel {
  channel_id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  dm_participants: string;
}

interface GasRequestPayload {
  action: string;
  userId?: string;
  channelId?: string;
  targetUserId?: string;
  email?: string;
  password?: string;
  fullName?: string;
  roleTitle?: string;
  name?: string;
  description?: string;
  isPrivate?: boolean;
  memberEmails?: string[];
  content?: string;
  parentMessageId?: string;
  messageId?: string;
  emoji?: string;
  statusText?: string;
}

interface GasResponse {
  ok: boolean;
  error?: string;
  timestamp?: string;
  channel?: SheetChannel;
  channels?: SheetChannel[];
  memberships?: unknown[];
  deletedChannelId?: string;
  [key: string]: unknown;
}

type VercelNodeReq = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type VercelNodeRes = ServerResponse & {
  status?: (code: number) => VercelNodeRes;
  json?: (data: unknown) => void;
};

const memoryOverlay: {
  editedChannels: Record<string, { name: string; description: string; is_private: boolean }>;
  deletedChannelIds: Set<string>;
} = {
  editedChannels: {},
  deletedChannelIds: new Set<string>(),
};

function normalizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function applyOverlay(channels?: SheetChannel[]): SheetChannel[] | undefined {
  if (!Array.isArray(channels)) return channels;
  return channels
    .filter((ch) => !memoryOverlay.deletedChannelIds.has(ch.channel_id))
    .map((ch) => {
      const edit = memoryOverlay.editedChannels[ch.channel_id];
      if (!edit) return ch;
      return {
        ...ch,
        name: edit.name,
        description: edit.description,
        is_private: edit.is_private,
      };
    });
}

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
      if (typeof parsed.error === 'string') {
        parsed.error = parsed.error
          .replace(/ in the Users sheet/gi, '')
          .replace(/ in Users sheet/gi, '')
          .replace(/ in the Channels sheet/gi, '');
      }
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Remote Apps Script request error:', err);
    return null;
  }
}

async function executeWithOverlay(body: GasRequestPayload): Promise<GasResponse | null> {
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
    const baseChannels = applyOverlay(bootstrapRes?.channels || []) || [];

    if (body.action === 'editChannel') {
      const channelId = body.channelId || '';
      const normalizedName = normalizeChannelName(body.name || '');
      if (!normalizedName || normalizedName.length < 2) {
        return {
          ok: false,
          error: 'Channel name must be at least 2 alphanumeric characters.',
        };
      }
      const target = baseChannels.find((c) => c.channel_id === channelId);
      if (!target) return { ok: false, error: 'Channel not found.' };
      const dup = baseChannels.some(
        (c) =>
          c.channel_id !== channelId &&
          !c.dm_participants &&
          c.name.toLowerCase() === normalizedName
      );
      if (dup) {
        return { ok: false, error: `Channel #${normalizedName} already exists.` };
      }
      const nextPrivate =
        body.isPrivate !== undefined ? Boolean(body.isPrivate) : target.is_private;
      const nextDescription =
        body.description !== undefined ? body.description.trim() : target.description;
      const finalDescription =
        nextDescription || (nextPrivate ? 'Private team channel' : 'Team discussion channel');

      memoryOverlay.editedChannels[channelId] = {
        name: normalizedName,
        description: finalDescription,
        is_private: nextPrivate,
      };
      return {
        ok: true,
        channel: {
          ...target,
          name: normalizedName,
          description: finalDescription,
          is_private: nextPrivate,
        },
        channels: applyOverlay(bootstrapRes?.channels || []) || [],
        memberships: bootstrapRes?.memberships || [],
        timestamp: new Date().toISOString(),
      };
    }

    if (body.action === 'deleteChannel') {
      const channelId = body.channelId || '';
      const target = baseChannels.find((c) => c.channel_id === channelId);
      if (!target) return { ok: false, error: 'Channel not found.' };
      const nonDmCount = baseChannels.filter((c) => !c.dm_participants).length;
      if (!target.dm_participants && nonDmCount <= 1) {
        return {
          ok: false,
          error: 'Cannot delete the last remaining channel in the workspace.',
        };
      }
      memoryOverlay.deletedChannelIds.add(channelId);
      delete memoryOverlay.editedChannels[channelId];
      return {
        ok: true,
        deletedChannelId: channelId,
        channels: applyOverlay(bootstrapRes?.channels || []) || [],
        memberships: bootstrapRes?.memberships || [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  if (remoteResponse && remoteResponse.channels) {
    remoteResponse.channels = applyOverlay(remoteResponse.channels);
  }
  return remoteResponse;
}

async function readNodeRequestBody(req: VercelNodeReq): Promise<GasRequestPayload> {
  if (req.body && typeof req.body === 'object') {
    return req.body as GasRequestPayload;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as GasRequestPayload;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as GasRequestPayload) : { action: 'ping' };
}

function sendNodeJson(res: VercelNodeRes, statusCode: number, payload: unknown): void {
  if (typeof res.status === 'function') {
    const statusRes = res.status(statusCode);
    if (statusRes && typeof statusRes.json === 'function') {
      statusRes.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(
  req: Request | VercelNodeReq,
  res?: VercelNodeRes
): Promise<Response | void> {
  if (typeof Request !== 'undefined' && req instanceof Request) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const rawText = await req.text();
      const body = JSON.parse(rawText) as GasRequestPayload;
      const remoteResponse = await executeWithOverlay(body);
      if (remoteResponse) {
        return new Response(JSON.stringify(remoteResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Remote endpoint unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request payload';
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const nodeReq = req as VercelNodeReq;
  const nodeRes = res as VercelNodeRes;

  if (nodeReq.method !== 'POST') {
    sendNodeJson(nodeRes, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readNodeRequestBody(nodeReq);
    const remoteResponse = await executeWithOverlay(body);
    if (remoteResponse) {
      sendNodeJson(nodeRes, 200, remoteResponse);
      return;
    }
    sendNodeJson(nodeRes, 502, { ok: false, error: 'Remote endpoint unavailable' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request payload';
    sendNodeJson(nodeRes, 400, { ok: false, error: message });
  }
}
