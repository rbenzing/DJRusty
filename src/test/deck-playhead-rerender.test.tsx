import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler } from 'react';
import { render, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { DeckControls } from '../components/Deck/DeckControls';

describe('control components do not re-render on the coarse currentTime tick', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));
  it('DeckControls stays put across coarse ticks', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'vid12345678', { sourceType: 'mp3', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    let commits = 0;
    render(<Profiler id="dc" onRender={() => { commits++; }}><DeckControls deckId="A" /></Profiler>);
    const base = commits;
    act(() => { for (let i = 1; i <= 5; i++) s.setCurrentTime('A', i); });
    expect(commits).toBe(base);
  });
});
