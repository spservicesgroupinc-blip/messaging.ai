import type { GasRequestPayload, GasResponse } from '../src/utils/sheetsProtocol.ts';

const APPS_SCRIPT_WEBAPP_URL =
  process.env.APPS_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbyOYvQtigsO62ckL2jCgKBp_qt6y8xbcgd57CSeS9_5eRLVQ2zbxxteQVx5hxw06BIq4A/exec';

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
    console.error('Remote Apps Script request error:', err);
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: GasRequestPayload = await req.json();
    const remoteResponse = await callRemoteAppsScript(body);
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
