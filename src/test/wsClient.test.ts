/**
 * wsClient.test.ts — Unit tests for the WebSocket singleton client.
 *
 * Covers:
 *   (a) registered handler receives a parsed incoming message
 *   (b) the unsubscribe function stops further delivery
 *   (c) a socket close schedules a reconnect after the backoff delay
 *
 * Isolation strategy: vi.resetModules() before each test so the singleton's
 * module-level state (ws, retryMs, retryTimer, handlers) is reset between
 * tests. Each test does a fresh dynamic import of the module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------
class MockWS {
  static instances: MockWS[] = [];
  // Static constants used by wsClient.ts's guard condition
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  readyState = 0; // CONNECTING

  constructor(public url: string) {
    MockWS.instances.push(this);
  }

  send = vi.fn();

  close = vi.fn(() => {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  });

  /** Simulate the server accepting the connection. */
  open(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  /** Simulate an incoming JSON message from the server. */
  message(obj: unknown): void {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------
beforeEach(() => {
  MockWS.instances = [];
  vi.stubGlobal('WebSocket', MockWS as unknown as typeof WebSocket);
  // Reset module registry so the singleton's internal state is fresh
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('wsClient', () => {
  it('delivers parsed messages to subscribed handlers', async () => {
    const { wsClient } = await import('../services/wsClient');

    const handler = vi.fn();
    wsClient.addHandler(handler);

    wsClient.connect();
    // Simulate the server accepting the connection
    MockWS.instances[0]!.open();

    // Simulate a download_progress message
    MockWS.instances[0]!.message({ type: 'download_progress', videoId: 'abc', percent: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'download_progress', videoId: 'abc', percent: 42 });

    wsClient.disconnect();
  });

  it('stops delivering messages after the unsubscribe function is called', async () => {
    const { wsClient } = await import('../services/wsClient');

    const handler = vi.fn();
    const off = wsClient.addHandler(handler);

    wsClient.connect();
    MockWS.instances[0]!.open();

    // First message — handler is still subscribed
    MockWS.instances[0]!.message({ type: 'download_progress', videoId: 'x', percent: 10 });
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    off();

    // Second message — handler must NOT be called again
    MockWS.instances[0]!.message({ type: 'download_progress', videoId: 'x', percent: 50 });
    expect(handler).toHaveBeenCalledTimes(1); // still 1, not 2

    wsClient.disconnect();
  });

  it('forwards download_complete messages with the correct shape', async () => {
    const { wsClient } = await import('../services/wsClient');

    const handler = vi.fn();
    wsClient.addHandler(handler);

    wsClient.connect();
    MockWS.instances[0]!.open();

    MockWS.instances[0]!.message({
      type: 'download_complete',
      videoId: 'vid123',
      audioUrl: '/api/audio/vid123',
    });

    expect(handler).toHaveBeenCalledWith({
      type: 'download_complete',
      videoId: 'vid123',
      audioUrl: '/api/audio/vid123',
    });

    wsClient.disconnect();
  });

  it('silently ignores malformed (non-JSON) messages', async () => {
    const { wsClient } = await import('../services/wsClient');

    const handler = vi.fn();
    wsClient.addHandler(handler);

    wsClient.connect();
    const sock = MockWS.instances[0]!;
    sock.open();

    // Fire a raw non-JSON message directly
    sock.onmessage?.({ data: 'not-json{{' });

    // Handler must NOT have been called
    expect(handler).not.toHaveBeenCalled();

    wsClient.disconnect();
  });

  it('schedules a reconnect after the socket closes (1 000 ms first-retry backoff)', async () => {
    vi.useFakeTimers();
    const { wsClient } = await import('../services/wsClient');

    wsClient.connect();
    const first = MockWS.instances[0]!;
    first.open(); // retryMs resets to 1_000 on open

    // Close triggers scheduleRetry()
    first.close();

    // Before the backoff elapses, no second socket should exist
    expect(MockWS.instances.length).toBe(1);

    // Advance exactly the first-retry delay (1 000 ms)
    vi.advanceTimersByTime(1_000);

    // A new WebSocket should have been constructed
    expect(MockWS.instances.length).toBe(2);
    expect(MockWS.instances[1]!.url).toBe('ws://localhost:3001/ws');

    wsClient.disconnect();
  });

  it('does not open a second socket if connect() is called while already connecting', async () => {
    const { wsClient } = await import('../services/wsClient');

    wsClient.connect();
    // At this point readyState is CONNECTING (0) — a second call should be ignored
    wsClient.connect();

    expect(MockWS.instances.length).toBe(1);

    wsClient.disconnect();
  });

  it('disconnect() closes the underlying socket', async () => {
    const { wsClient } = await import('../services/wsClient');

    wsClient.connect();
    const sock = MockWS.instances[0]!;
    sock.open();

    // The socket should have been constructed and be in OPEN state
    expect(sock.readyState).toBe(1);

    // disconnect() must call close() on the socket
    wsClient.disconnect();
    expect(sock.close).toHaveBeenCalledTimes(1);
  });
});
