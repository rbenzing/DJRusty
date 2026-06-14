// src/utils/transport.ts — Pioneer-CDJ transport state machine (extended in a later task).
export type TransportState = 'CUED' | 'PLAYING' | 'PAUSED' | 'PREVIEW';

export type TransportEvent = { type: 'PLAY' } | { type: 'CUE_PRESS' } | { type: 'CUE_RELEASE' };
export interface TransportContext { position: number; cuePoint: number | null; }
export type TransportIntent =
  | { kind: 'play' } | { kind: 'pause' }
  | { kind: 'seek'; to: number } | { kind: 'setCue'; at: number };
export interface TransportResult { nextState: TransportState; intents: TransportIntent[]; cuePoint: number | null; }

export function transition(state: TransportState, event: TransportEvent, ctx: TransportContext): TransportResult {
  const cue = ctx.cuePoint;
  switch (event.type) {
    case 'PLAY':
      if (state === 'PLAYING') return { nextState: 'PAUSED', intents: [{ kind: 'pause' }], cuePoint: cue };
      return { nextState: 'PLAYING', intents: [{ kind: 'play' }], cuePoint: cue };
    case 'CUE_PRESS': {
      if (state === 'CUED') return { nextState: 'PREVIEW', intents: [{ kind: 'play' }], cuePoint: cue };
      if (state === 'PAUSED')
        return { nextState: 'CUED', intents: [{ kind: 'setCue', at: ctx.position }, { kind: 'seek', to: ctx.position }], cuePoint: ctx.position };
      // PLAYING or PREVIEW: return to cue & pause; if no cue yet, set it at the current position first
      if (cue === null)
        return { nextState: 'CUED', intents: [{ kind: 'setCue', at: ctx.position }, { kind: 'seek', to: ctx.position }, { kind: 'pause' }], cuePoint: ctx.position };
      return { nextState: 'CUED', intents: [{ kind: 'seek', to: cue }, { kind: 'pause' }], cuePoint: cue };
    }
    case 'CUE_RELEASE':
      if (state === 'PREVIEW' && cue !== null)
        return { nextState: 'CUED', intents: [{ kind: 'seek', to: cue }, { kind: 'pause' }], cuePoint: cue };
      return { nextState: state, intents: [], cuePoint: cue };
  }
}
