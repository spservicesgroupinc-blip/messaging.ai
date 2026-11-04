import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse
): Response | void {
  const payload = `data: ${JSON.stringify({
    type: 'connected',
    mode: 'serverless-polling',
    timestamp: new Date().toISOString(),
  })}\n\n`;

  if (typeof Request !== 'undefined' && req instanceof Request) {
    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'close',
      },
    });
  }

  if (res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'close');
    res.end(payload);
  }
}
