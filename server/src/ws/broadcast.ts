import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

let wss: WebSocketServer | null = null;

export type WsMessage =
  | { type: 'download_progress'; videoId: string; percent: number }
  | { type: 'download_complete'; videoId: string; audioUrl: string }
  | { type: 'download_error'; videoId: string; error: string }
  | { type: 'status_update'; videoId: string; status: string };

export function createWss(server: import('http').Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    ws.on('error', (err) => console.error('[ws] client error:', err.message));
  });
  return wss;
}

export function broadcast(msg: WsMessage): void {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
