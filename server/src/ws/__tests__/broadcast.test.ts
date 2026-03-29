/**
 * broadcast.test.ts — Unit tests for WebSocket broadcast module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockClients = new Set<{ readyState: number; send: ReturnType<typeof vi.fn> }>();
const mockOn = vi.fn();

vi.mock('ws', () => {
  function MockWss() {
    return { clients: mockClients, on: mockOn };
  }
  return {
    WebSocketServer: MockWss,
    WebSocket: { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 },
  };
});

const { createWss, broadcast } = await import('../broadcast.js');

const fakeServer = { listen: vi.fn() } as unknown as import('http').Server;

beforeEach(() => {
  mockClients.clear();
  vi.clearAllMocks();
  createWss(fakeServer);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('broadcast', () => {
  it('sends JSON message to OPEN clients', () => {
    const client = { readyState: 1 /* OPEN */, send: vi.fn() };
    mockClients.add(client);

    const msg = { type: 'download_progress' as const, videoId: 'abc', percent: 42 };
    broadcast(msg);

    expect(client.send).toHaveBeenCalledWith(JSON.stringify(msg));
  });

  it('does not send to CLOSED clients', () => {
    const client = { readyState: 3 /* CLOSED */, send: vi.fn() };
    mockClients.add(client);

    broadcast({ type: 'status_update', videoId: 'x', status: 'downloading' });

    expect(client.send).not.toHaveBeenCalled();
  });

  it('sends to multiple OPEN clients', () => {
    const c1 = { readyState: 1, send: vi.fn() };
    const c2 = { readyState: 1, send: vi.fn() };
    mockClients.add(c1);
    mockClients.add(c2);

    broadcast({ type: 'download_complete', videoId: 'y', audioUrl: '/api/audio/y' });

    expect(c1.send).toHaveBeenCalledTimes(1);
    expect(c2.send).toHaveBeenCalledTimes(1);
  });

  it('does not throw when client set is empty', () => {
    expect(() => broadcast({ type: 'download_error', videoId: 'z', error: 'oops' })).not.toThrow();
  });
});
