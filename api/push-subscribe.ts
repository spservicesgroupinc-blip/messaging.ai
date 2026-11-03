import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse & { status?: (code: number) => { json: (data: unknown) => void } }
): Response | void {
  const body = { ok: true, subscribed: true, timestamp: new Date().toISOString() };

  if (typeof Request !== 'undefined' && req instanceof Request) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (res) {
    if (typeof res.status === 'function') {
      res.status(200).json(body);
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  }
}
