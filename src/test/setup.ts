import '@testing-library/jest-dom';

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
