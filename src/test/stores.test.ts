/**
 * Store unit tests for STORY-001 — verifies initial state and basic action behaviour.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { useAuthStore } from '../store/authStore';
import { useMixerStore } from '../store/mixerStore';

/**
 * Reset Zustand store state before each test.
 * Zustand stores are module singletons; we reset using setState.
 */
beforeEach(() => {
  useDeckStore.setState({
    decks: {
      A: {
        deckId: 'A',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
        decoding: false,
        bpmDetecting: false,
        duration: 0,
        currentTime: 0,
        thumbnailUrl: null,
        playbackState: 'unstarted',
        pitchRate: 1,
        bpm: null,
        volume: 80,
        loopActive: false,
        loopStart: null,
        loopEnd: null,
        loopBeatCount: null,
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
      },
      B: {
        deckId: 'B',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
        decoding: false,
        bpmDetecting: false,
        duration: 0,
        currentTime: 0,
        thumbnailUrl: null,
        playbackState: 'unstarted',
        pitchRate: 1,
        bpm: null,
        volume: 80,
        loopActive: false,
        loopStart: null,
        loopEnd: null,
        loopBeatCount: null,
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
      },
    },
  });

  useAuthStore.setState({
    accessToken: null,
    expiresAt: null,
    userInfo: null,
    signedIn: false,
  });

  useMixerStore.setState({
    crossfaderPosition: 0.5,
    channelFaderA: 100,
    channelFaderB: 100,
    deckAVolume: 71,
    deckBVolume: 71,
  });
});

describe('deckStore', () => {
  it('initialises Deck A with correct default state', () => {
    const deckA = useDeckStore.getState().decks['A'];

    expect(deckA.deckId).toBe('A');
    expect(deckA.trackId).toBeNull();
    expect(deckA.playbackState).toBe('unstarted');
    expect(deckA.pitchRate).toBe(1);
    expect(deckA.bpm).toBeNull();
    expect(deckA.loopActive).toBe(false);
    expect(deckA.playerReady).toBe(false);
    expect(deckA.hotCues).toEqual({});
    expect(deckA.eqLow).toBe(0);
    expect(deckA.eqMid).toBe(0);
    expect(deckA.eqHigh).toBe(0);
    expect(deckA.error).toBeNull();
  });

  it('initialises Deck B with deckId B', () => {
    const deckB = useDeckStore.getState().decks['B'];
    expect(deckB.deckId).toBe('B');
    expect(deckB.trackId).toBeNull();
  });

  it('loadTrack updates deck state correctly', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'dQw4w9WgXcQ', {
        sourceType: 'youtube',
        title: 'Test Track',
        artist: 'Test Channel',
        duration: 212,
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.trackId).toBe('dQw4w9WgXcQ');
    expect(deckA.title).toBe('Test Track');
    expect(deckA.artist).toBe('Test Channel');
    expect(deckA.duration).toBe(212);
    expect(deckA.thumbnailUrl).toBe('https://example.com/thumb.jpg');
    expect(deckA.currentTime).toBe(0);
    expect(deckA.loopActive).toBe(false);
    expect(deckA.bpm).toBeNull();
    expect(deckA.error).toBeNull();
  });

  it('setPlaybackState updates the playback state', () => {
    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
  });

  it('setPlaybackState does not affect the other deck', () => {
    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
    });

    expect(useDeckStore.getState().decks['B'].playbackState).toBe('unstarted');
  });

  it('setPitchRate updates the pitch rate', () => {
    act(() => {
      useDeckStore.getState().setPitchRate('B', 1.5);
    });

    expect(useDeckStore.getState().decks['B'].pitchRate).toBe(1.5);
  });

  it('setBpm updates the bpm value', () => {
    act(() => {
      useDeckStore.getState().setBpm('A', 128);
    });

    expect(useDeckStore.getState().decks['A'].bpm).toBe(128);
  });

  it('setBpm accepts null to clear BPM', () => {
    act(() => {
      useDeckStore.getState().setBpm('A', 128);
    });
    act(() => {
      useDeckStore.getState().setBpm('A', null);
    });

    expect(useDeckStore.getState().decks['A'].bpm).toBeNull();
  });

  it('setCurrentTime updates the current position', () => {
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 45.5);
    });

    expect(useDeckStore.getState().decks['A'].currentTime).toBe(45.5);
  });

  it('activateLoop sets loop state correctly', () => {
    act(() => {
      useDeckStore.getState().activateLoop('A', 10.5, 20.0);
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopActive).toBe(true);
    expect(deckA.loopStart).toBe(10.5);
    expect(deckA.loopEnd).toBe(20.0);
  });

  it('deactivateLoop clears loop state', () => {
    act(() => {
      useDeckStore.getState().activateLoop('A', 10.5, 20.0);
    });
    act(() => {
      useDeckStore.getState().deactivateLoop('A');
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopActive).toBe(false);
    expect(deckA.loopStart).toBeNull();
    expect(deckA.loopEnd).toBeNull();
    // STORY-014: deactivateLoop must also reset loopBeatCount to null
    expect(deckA.loopBeatCount).toBeNull();
  });

  // STORY-014: activateLoopBeat store-level test
  it('activateLoopBeat sets loop state from bpm and currentTime', () => {
    act(() => {
      // Set up the deck with a BPM and a current time so the formula can run.
      useDeckStore.getState().setBpm('A', 120);
      useDeckStore.getState().setCurrentTime('A', 10.0);
    });
    act(() => {
      useDeckStore.getState().activateLoopBeat('A', 4);
    });

    const deckA = useDeckStore.getState().decks['A'];
    // 4 beats at 120 BPM = (4 / 120) * 60 = 2 seconds
    expect(deckA.loopActive).toBe(true);
    expect(deckA.loopStart).toBe(10.0);
    expect(deckA.loopEnd).toBeCloseTo(12.0, 5);
    expect(deckA.loopBeatCount).toBe(4);
  });

  it('activateLoopBeat is a no-op when bpm is not set', () => {
    // bpm defaults to null in beforeEach reset
    act(() => {
      useDeckStore.getState().activateLoopBeat('A', 2);
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopActive).toBe(false);
    expect(deckA.loopStart).toBeNull();
    expect(deckA.loopEnd).toBeNull();
    expect(deckA.loopBeatCount).toBeNull();
  });

  it('activateLoopBeat clamps loopEnd to track duration when the loop would extend past the end', () => {
    // Track is 12 s long; currentTime is at 11 s; 8-beat loop at 120 BPM = 4 s
    // Without clamping: loopEnd would be 11 + 4 = 15 (past duration 12) → poll never fires.
    // With clamping:    loopEnd must be 12.
    act(() => {
      useDeckStore.getState().loadTrack('A', 'test-vid', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'C',
        duration: 12,
        thumbnailUrl: null,
      });
      useDeckStore.getState().setBpm('A', 120);
      useDeckStore.getState().setCurrentTime('A', 11.0);
    });
    act(() => {
      useDeckStore.getState().activateLoopBeat('A', 8); // (8/120)*60 = 4 s
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopActive).toBe(true);
    expect(deckA.loopStart).toBe(11.0);
    expect(deckA.loopEnd).toBe(12.0); // Clamped to duration
    expect(deckA.loopBeatCount).toBe(8);
  });

  it('activateLoopBeat does not clamp when the loop fits within the track duration', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'test-vid', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'C',
        duration: 30,
        thumbnailUrl: null,
      });
      useDeckStore.getState().setBpm('A', 120);
      useDeckStore.getState().setCurrentTime('A', 10.0);
    });
    act(() => {
      useDeckStore.getState().activateLoopBeat('A', 4); // (4/120)*60 = 2 s → loopEnd 12 < 30
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopEnd).toBeCloseTo(12.0, 5);
  });

  it('activateLoopBeat does not clamp when duration is unknown (0)', () => {
    // When duration is 0 (not yet known), no clamping should occur.
    act(() => {
      useDeckStore.getState().setBpm('A', 120);
      useDeckStore.getState().setCurrentTime('A', 5.0);
    });
    act(() => {
      useDeckStore.getState().activateLoopBeat('A', 4); // loopEnd = 7 s
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.loopEnd).toBeCloseTo(7.0, 5); // Not clamped
  });

  // STORY-014: setPitchRateLocked unit test
  it('setPitchRateLocked sets pitchRateLocked to true', () => {
    act(() => {
      useDeckStore.getState().setPitchRateLocked('A', true);
    });

    expect(useDeckStore.getState().decks['A'].pitchRateLocked).toBe(true);
  });

  it('setPitchRateLocked sets pitchRateLocked to false', () => {
    act(() => {
      useDeckStore.getState().setPitchRateLocked('A', true);
    });
    act(() => {
      useDeckStore.getState().setPitchRateLocked('A', false);
    });

    expect(useDeckStore.getState().decks['A'].pitchRateLocked).toBe(false);
  });

  it('setPitchRateLocked does not affect the other deck', () => {
    act(() => {
      useDeckStore.getState().setPitchRateLocked('A', true);
    });

    expect(useDeckStore.getState().decks['B'].pitchRateLocked).toBe(false);
  });

  it('setHotCue stores the timestamp at the given index', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 42.5);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(42.5);
  });

  it('setHotCue preserves existing cues at other indices', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 10.0);
      useDeckStore.getState().setHotCue('A', 2, 30.0);
    });

    const hotCues = useDeckStore.getState().decks['A'].hotCues;
    expect(hotCues[0]).toBe(10.0);
    expect(hotCues[2]).toBe(30.0);
  });

  it('clearHotCue removes the cue at the given index', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 1, 99.0);
    });
    act(() => {
      useDeckStore.getState().clearHotCue('A', 1);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[1]).toBeUndefined();
  });

  it('clearHotCue preserves cues at other indices', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 5.0);
      useDeckStore.getState().setHotCue('A', 1, 10.0);
      useDeckStore.getState().clearHotCue('A', 1);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(5.0);
    expect(useDeckStore.getState().decks['A'].hotCues[1]).toBeUndefined();
  });

  it('setError stores the error message', () => {
    act(() => {
      useDeckStore.getState().setError('A', 'Video cannot be embedded');
    });

    expect(useDeckStore.getState().decks['A'].error).toBe('Video cannot be embedded');
  });

  it('setError accepts null to clear errors', () => {
    act(() => {
      useDeckStore.getState().setError('A', 'Some error');
    });
    act(() => {
      useDeckStore.getState().setError('A', null);
    });

    expect(useDeckStore.getState().decks['A'].error).toBeNull();
  });

  it('clearTrack resets all deck state', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'dQw4w9WgXcQ', {
        sourceType: 'youtube',
        title: 'Test',
        artist: 'Channel',
        duration: 100,
        thumbnailUrl: null,
      });
      useDeckStore.getState().setPlaybackState('A', 'playing');
      useDeckStore.getState().setBpm('A', 128);
    });
    act(() => {
      useDeckStore.getState().clearTrack('A');
    });

    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.trackId).toBeNull();
    expect(deckA.title).toBe('');
    expect(deckA.playbackState).toBe('unstarted');
    expect(deckA.bpm).toBeNull();
  });
});

describe('authStore', () => {
  it('initialises with signed out state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.userInfo).toBeNull();
    expect(state.signedIn).toBe(false);
  });

  it('setToken stores token and marks signed in', () => {
    act(() => {
      useAuthStore.getState().setToken('ya29.test_token', 3600);
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('ya29.test_token');
    expect(state.signedIn).toBe(true);
    expect(state.expiresAt).toBeGreaterThan(Date.now());
  });

  it('setToken sets expiresAt approximately 1 hour from now', () => {
    const beforeCall = Date.now();
    act(() => {
      useAuthStore.getState().setToken('ya29.test', 3600);
    });
    const afterCall = Date.now();

    const { expiresAt } = useAuthStore.getState();
    expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + 3600 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(afterCall + 3600 * 1000);
  });

  it('setUserInfo stores user profile', () => {
    act(() => {
      useAuthStore.getState().setUserInfo({
        sub: '12345',
        name: 'DJ Rusty',
        email: 'rusty@example.com',
        picture: 'https://example.com/avatar.jpg',
      });
    });

    const { userInfo } = useAuthStore.getState();
    expect(userInfo?.name).toBe('DJ Rusty');
    expect(userInfo?.email).toBe('rusty@example.com');
  });

  it('clearAuth resets all state to initial values', () => {
    act(() => {
      useAuthStore.getState().setToken('ya29.test', 3600);
      useAuthStore.getState().setUserInfo({
        sub: '12345',
        name: 'DJ Rusty',
        email: 'rusty@example.com',
        picture: 'https://example.com/avatar.jpg',
      });
    });
    act(() => {
      useAuthStore.getState().clearAuth();
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.userInfo).toBeNull();
    expect(state.signedIn).toBe(false);
  });

  it('clearAuth does not retain any token data', () => {
    act(() => {
      useAuthStore.getState().setToken('ya29.secret_token', 3600);
      useAuthStore.getState().clearAuth();
    });

    // Token must not be recoverable after sign-out
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('mixerStore', () => {
  it('initialises with crossfader at centre position', () => {
    expect(useMixerStore.getState().crossfaderPosition).toBe(0.5);
  });

  it('initialises with both channel faders at 100', () => {
    const state = useMixerStore.getState();
    expect(state.channelFaderA).toBe(100);
    expect(state.channelFaderB).toBe(100);
  });

  it('setCrossfaderPosition updates the crossfader value', () => {
    act(() => {
      useMixerStore.getState().setCrossfaderPosition(0.75);
    });

    expect(useMixerStore.getState().crossfaderPosition).toBe(0.75);
  });

  it('setCrossfaderPosition accepts 0 (full Deck A)', () => {
    act(() => {
      useMixerStore.getState().setCrossfaderPosition(0);
    });

    expect(useMixerStore.getState().crossfaderPosition).toBe(0);
  });

  it('setCrossfaderPosition accepts 1 (full Deck B)', () => {
    act(() => {
      useMixerStore.getState().setCrossfaderPosition(1);
    });

    expect(useMixerStore.getState().crossfaderPosition).toBe(1);
  });

  it('setChannelFaderA updates Deck A channel fader', () => {
    act(() => {
      useMixerStore.getState().setChannelFaderA(50);
    });

    expect(useMixerStore.getState().channelFaderA).toBe(50);
  });

  it('setDeckVolumes updates computed volumes', () => {
    act(() => {
      useMixerStore.getState().setDeckVolumes(85, 30);
    });

    const state = useMixerStore.getState();
    expect(state.deckAVolume).toBe(85);
    expect(state.deckBVolume).toBe(30);
  });
});
