import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT ?? 3111);
const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS ?? 25_000);
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const maxHistory = 100;

/** @type {Map<string, Set<import('node:http').ServerResponse>>} */
const clientsByChannel = new Map();
/** @type {Map<string, Array<{ id: string, event: string, data: object }>>} */
const historyByChannel = new Map();

function channelFromUrl(url) {
  const channel = url.searchParams.get('channel') ?? 'lobby';
  // Channel names are used as map keys only. Keep them bounded and predictable.
  return /^[a-zA-Z0-9_-]{1,80}$/.test(channel) ? channel : null;
}

function writeEvent(client, { id, event, data }) {
  client.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function publish(channel, event, data) {
  const message = {
    id: randomUUID(),
    event,
    data: { ...data, channel, sentAt: new Date().toISOString() },
  };
  const history = historyByChannel.get(channel) ?? [];
  history.push(message);
  if (history.length > maxHistory) history.shift();
  historyByChannel.set(channel, history);

  for (const client of clientsByChannel.get(channel) ?? []) writeEvent(client, message);
  return message;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error('Request body is too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  // Same-origin is the intended deployment. Allow a cross-origin frontend only
  // when its exact public origin is configured explicitly.
  if (origin && allowedOrigin === origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
    });
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      clients: [...clientsByChannel.values()].reduce((n, set) => n + set.size, 0),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    const channel = channelFromUrl(url);
    if (!channel) return sendJson(res, 400, { error: 'Invalid channel' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const clients = clientsByChannel.get(channel) ?? new Set();
    clients.add(res);
    clientsByChannel.set(channel, clients);

    const lastEventId = req.headers['last-event-id'];
    const history = historyByChannel.get(channel) ?? [];
    const start =
      typeof lastEventId === 'string'
        ? history.findIndex((item) => item.id === lastEventId) + 1
        : 0;
    for (const message of history.slice(Math.max(0, start))) writeEvent(res, message);
    writeEvent(res, {
      id: randomUUID(),
      event: 'connected',
      data: { channel, sentAt: new Date().toISOString() },
    });

    req.on('close', () => {
      clients.delete(res);
      if (clients.size === 0) clientsByChannel.delete(channel);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/events') {
    try {
      const body = await readJson(req);
      const channel =
        typeof body.channel === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(body.channel)
          ? body.channel
          : 'lobby';
      const event =
        typeof body.event === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(body.event)
          ? body.event
          : null;
      if (!event || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
        return sendJson(res, 400, { error: 'event and an object data payload are required' });
      }
      // Add auth/authorization here before exposing this endpoint publicly.
      return sendJson(res, 202, { ok: true, message: publish(channel, event, body.data) });
    } catch (error) {
      return sendJson(res, 400, {
        error: error instanceof Error ? error.message : 'Invalid request',
      });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

const heartbeat = setInterval(() => {
  for (const clients of clientsByChannel.values()) {
    for (const client of clients) client.write(`: heartbeat ${Date.now()}\n\n`);
  }
}, heartbeatMs);

server.listen(port, '0.0.0.0', () => {
  console.log(`SSE relay listening on http://0.0.0.0:${port}`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const clients of clientsByChannel.values()) for (const client of clients) client.end();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
