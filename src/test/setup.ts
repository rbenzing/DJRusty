import '@testing-library/jest-dom';

/**
 * DataTransfer polyfill for jsdom.
 *
 * jsdom does not implement the DataTransfer API used by drag-and-drop tests.
 * This minimal polyfill is sufficient for fireEvent.drop / fireEvent.dragOver tests.
 */
if (typeof DataTransfer === 'undefined') {
  class DataTransferItemList {
    private _items: File[] = [];

    add(file: File): void {
      this._items.push(file);
    }

    get length(): number {
      return this._items.length;
    }

    [Symbol.iterator](): Iterator<File> {
      return this._items[Symbol.iterator]();
    }
  }

  class DataTransferFilesProxy {
    private _items: File[];

    constructor(items: File[]) {
      this._items = items;
      items.forEach((file, i) => {
        (this as unknown as Record<number, File>)[i] = file;
      });
    }

    get length(): number {
      return this._items.length;
    }

    item(index: number): File | null {
      return this._items[index] ?? null;
    }

    [Symbol.iterator](): Iterator<File> {
      return this._items[Symbol.iterator]();
    }
  }

  class DataTransferPolyfill {
    items: DataTransferItemList;
    dropEffect: string = 'none';
    effectAllowed: string = 'all';

    constructor() {
      this.items = new DataTransferItemList();
    }

    get files(): DataTransferFilesProxy {
      return new DataTransferFilesProxy(Array.from(this.items as unknown as Iterable<File>));
    }
  }

  (globalThis as unknown as Record<string, unknown>).DataTransfer = DataTransferPolyfill;
}

/**
 * Mock the YouTube IFrame API global (window.YT).
 *
 * The YT global is injected by the YouTube IFrame API script, which is loaded
 * dynamically in production. In the test environment we mock it here so tests
 * can run without network access or a real browser.
 */
window.YT = {
  Player: vi.fn().mockImplementation(() => ({
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    stopVideo: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 100),
    mute: vi.fn(),
    unMute: vi.fn(),
    isMuted: vi.fn(() => false),
    setPlaybackRate: vi.fn(),
    getPlaybackRate: vi.fn(() => 1),
    getAvailablePlaybackRates: vi.fn(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    cueVideoById: vi.fn(),
    loadVideoById: vi.fn(),
    getPlayerState: vi.fn(() => -1),
    destroy: vi.fn(),
  })),
  PlayerState: {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  },
} as unknown as typeof YT;

/**
 * Reset all mocks between tests to prevent state leaking across test cases.
 */
beforeEach(() => {
  vi.clearAllMocks();
});
