import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

let wss: WebSocketServer | null = null;
let heartbeat: NodeJS.Timeout | null = null;

/** Per-socket liveness flag (ws has no typed slot, so use a WeakMap). */
const alive = new WeakMap<WebSocket, boolean>();
const MAX_BUFFERED = 1 << 20; // 1 MiB — drop sends to a backed-up client

export type WsMessage =
  | { type: 'download_progress'; videoId: string; percent: number }
  | { type: 'download_complete'; videoId: string; audioUrl: string }
  | { type: 'download_error'; videoId: string; error: string }
  | { type: 'status_update'; videoId: string; status: string };

export function createWss(server: import('http').Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', (err) => console.error('[ws] client error:', err.message));
  });

  heartbeat = setInterval(() => {
    wss?.clients.forEach((ws) => {
      if (alive.get(ws) === false) { ws.terminate(); return; }
      alive.set(ws, false);
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => { if (heartbeat) clearInterval(heartbeat); });
  return wss;
}

export function broadcast(msg: WsMessage): void {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < MAX_BUFFERED) {
      client.send(data);
    }
  });
}
