/**
 * wsClient.ts — Singleton WebSocket client for real-time download progress.
 *
 * Connects on first call to connect(). Reconnects with exponential back-off
 * on disconnect. Dispatches incoming messages to registered handlers.
 */

type WsMessage =
  | { type: 'download_progress'; videoId: string; percent: number }
  | { type: 'download_complete'; videoId: string; audioUrl: string }
  | { type: 'download_error'; videoId: string; error: string }
  | { type: 'status_update'; videoId: string; status: string };

type MessageHandler = (msg: WsMessage) => void;

const WS_URL = 'ws://localhost:3001/ws';
const MAX_RETRY_MS = 30_000;

let ws: WebSocket | null = null;
let retryMs = 1_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<MessageHandler>();

function tryConnect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleRetry();
    return;
  }

  ws.onopen = () => { retryMs = 1_000; };

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data as string) as WsMessage;
      handlers.forEach((h) => h(msg));
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => scheduleRetry();
  ws.onerror = () => { /* onclose will fire after */ };
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    tryConnect();
  }, retryMs);
}

export const wsClient = {
  connect(): void { tryConnect(); },
  addHandler(fn: MessageHandler): () => void {
    handlers.add(fn);
    return () => handlers.delete(fn);
  },
  disconnect(): void {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    ws?.close();
    ws = null;
  },
};
