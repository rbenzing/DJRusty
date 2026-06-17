import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler } from 'react';
import { render, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { DeckControls } from '../components/Deck/DeckControls';

describe('DeckControls does not re-render on currentTime ticks', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); });

  it('stays put across 10 playhead ticks', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'vid12345678', { title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    let commits = 0;
    render(
      <Profiler id="deck-controls" onRender={() => { commits++; }}>
        <DeckControls deckId="A" />
      </Profiler>,
    );
    const baseline = commits;
    act(() => { for (let i = 1; i <= 10; i++) store.setCurrentTime('A', i); });
    expect(commits).toBe(baseline);
  });
});
