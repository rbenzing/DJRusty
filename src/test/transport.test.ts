import { describe, it, expect } from 'vitest';
import { transition } from '../utils/transport';

describe('transport state machine (Pioneer CDJ)', () => {
  it('PLAYING + PLAY → PAUSED (pause at position)', () => {
    const r = transition('PLAYING', { type: 'PLAY' }, { position: 30, cuePoint: 10 });
    expect(r.nextState).toBe('PAUSED');
    expect(r.intents).toEqual([{ kind: 'pause' }]);
  });
  it('PLAYING + CUE → seek to cue + pause → CUED (cue unchanged)', () => {
    const r = transition('PLAYING', { type: 'CUE_PRESS' }, { position: 30, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'seek', to: 10 }, { kind: 'pause' }]);
    expect(r.cuePoint).toBe(10);
  });
  it('CUED + PLAY → PLAYING', () => {
    const r = transition('CUED', { type: 'PLAY' }, { position: 10, cuePoint: 10 });
    expect(r.nextState).toBe('PLAYING');
    expect(r.intents).toEqual([{ kind: 'play' }]);
  });
  it('CUED + CUE_PRESS → PREVIEW (play from cue)', () => {
    const r = transition('CUED', { type: 'CUE_PRESS' }, { position: 10, cuePoint: 10 });
    expect(r.nextState).toBe('PREVIEW');
    expect(r.intents).toEqual([{ kind: 'play' }]);
  });
  it('PREVIEW + CUE_RELEASE → seek to cue + pause → CUED', () => {
    const r = transition('PREVIEW', { type: 'CUE_RELEASE' }, { position: 12, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'seek', to: 10 }, { kind: 'pause' }]);
  });
  it('PAUSED + CUE_PRESS → set cue at position + seek there → CUED', () => {
    const r = transition('PAUSED', { type: 'CUE_PRESS' }, { position: 25, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'setCue', at: 25 }, { kind: 'seek', to: 25 }]);
    expect(r.cuePoint).toBe(25);
  });
  it('null cuePoint: PLAYING + CUE sets cue at position first', () => {
    const r = transition('PLAYING', { type: 'CUE_PRESS' }, { position: 18, cuePoint: null });
    expect(r.cuePoint).toBe(18);
    expect(r.intents).toEqual([{ kind: 'setCue', at: 18 }, { kind: 'seek', to: 18 }, { kind: 'pause' }]);
    expect(r.nextState).toBe('CUED');
  });
  it('CUE_RELEASE outside PREVIEW is a no-op', () => {
    const r = transition('PLAYING', { type: 'CUE_RELEASE' }, { position: 5, cuePoint: 10 });
    expect(r.nextState).toBe('PLAYING');
    expect(r.intents).toEqual([]);
  });
});
