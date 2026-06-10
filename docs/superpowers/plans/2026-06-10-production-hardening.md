# Production Hardening & Dual-Mode Player Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dual-mode regression where imperative deck commands (CUE, restart, skip, hot-cues, loop-exit, slip/roll, keyboard seeks, beat-jump) hit the wrong audio backend, add source-aware capability gating, and harden the project for production (lint gate, README, stale files).

**Architecture:** Replace the single-slot `playerRegistry` with a per-deck/per-backend registry plus a `getActivePlayer(deckId)` resolver that reads `sourceType` from the deck store and returns the matching backend (YouTube IFrame adapter or Web Audio engine). Migrate every imperative call site to the resolver (clean cut — no compatibility alias). Centralize dual-mode feature gating in a pure `capabilities()` map. Drive every change with a failing test first.

**Tech Stack:** TypeScript 5, React 18, Zustand 4, Vite 5, Vitest + Testing Library, Web Audio API, YouTube IFrame API.

**Reference spec:** `docs/superpowers/specs/2026-06-10-production-hardening-design.md`

---

## Background the implementer needs

- **`sourceType`** is `'mp3' | 'youtube'` (`src/types/playlist.ts`). WAV files decode through the same Web Audio path and are stored as `'mp3'` — there is no separate `'wav'` type. So "the local-audio backend" == the `'mp3'` branch.
- **Two backends register per deck.** `useYouTubePlayer` (mounted in `App.tsx`) registers a `YouTubePlayerAdapter`. `useAudioEngine` (called in `Deck.tsx` for every deck) registers an `AudioEngineImpl`. Today both call `playerRegistry.register(deckId, player)` into ONE slot — last writer wins. This is the bug.
- **Imperative seek call sites** (verified by grep) that must route to the correct backend:
  - `src/components/Deck/DeckControls.tsx` — lines 67, 75, 83, 92
  - `src/components/Deck/HotCues.tsx` — line 70
  - `src/components/Deck/BeatJump.tsx` — lines 38, 45
  - `src/hooks/useKeyboardShortcuts.ts` — lines 46, 83, 91, 153, 168
  - `src/store/deckStore.ts` — lines 366 (`deactivateLoop`), 536 (`endRoll`)
- **Tests asserting the OLD registry signature** will need updating when the signature changes: `src/test/keyboardShortcuts.test.ts`, `src/test/useAudioEngine.test.ts`, `src/test/story-011-hot-cues.test.ts`, `src/test/mp3-003-transport.test.ts`. This is expected TDD churn.
- **Server is consistent** (verified): `downloadService` produces `${videoId}.mp3`, the audio route serves `${videoId}.mp3`, `manifest.json` is `[]`. The `.webm` files in `server/downloads/` are stale pre-mp3 leftovers — cleanup only, not a code bug.
- **PowerShell rules:** Run commands via `npm run ...`. No `npx`, no `&&` chaining, no `cmd /c`. Use `npm run test` (vitest run). To run a single test file: `npm run test -- src/test/<file>`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/services/playerRegistry.ts` | Per-deck/per-backend storage + `getActivePlayer` resolver | Modify |
| `src/constants/capabilities.ts` | Pure source→capabilities map | Create |
| `src/hooks/useYouTubePlayer.ts` | Register/unregister under `'youtube'` key | Modify |
| `src/hooks/useAudioEngine.ts` | Register/unregister under `'audio'` key | Modify |
| `src/components/Deck/DeckControls.tsx` | Seek via `getActivePlayer` | Modify |
| `src/components/Deck/HotCues.tsx` | Seek via `getActivePlayer` | Modify |
| `src/components/Deck/BeatJump.tsx` | Seek via `getActivePlayer` | Modify |
| `src/hooks/useKeyboardShortcuts.ts` | Seek via `getActivePlayer` | Modify |
| `src/store/deckStore.ts` | slip/roll/loop-exit seek via `getActivePlayer` | Modify |
| `src/components/Deck/EQPanel.tsx` | Gate from `capabilities()` | Modify |
| `src/components/Deck/PitchSlider.tsx` | Gate from `capabilities()` | Modify |
| `src/components/Deck/EffectsPanel.tsx` | Gate from `capabilities()` | Modify |
| `eslint.config.js` + `package.json` | Working lint gate | Create/Modify |
| `README.md` | Reflect real dual-mode architecture | Modify |
| Test files listed above | Updated to new registry signature + new behavior | Modify |

---

## Task 1: Source-aware player registry

**Files:**
- Modify: `src/services/playerRegistry.ts`
- Test: `src/test/playerRegistry.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/test/playerRegistry.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playerRegistry, getActivePlayer } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

function makePlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 0) };
}

describe('playerRegistry — per-backend resolution', () => {
  beforeEach(() => {
    playerRegistry.unregister('A', 'youtube');
    playerRegistry.unregister('A', 'audio');
    useDeckStore.getState().clearTrack('A');
  });

  it('stores youtube and audio backends side by side without clobbering', () => {
    const yt = makePlayer();
    const audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
    expect(playerRegistry.peek('A', 'youtube')).toBe(yt);
    expect(playerRegistry.peek('A', 'audio')).toBe(audio);
  });

  it('getActivePlayer returns the youtube backend when sourceType is youtube', () => {
    const yt = makePlayer();
    const audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
    useDeckStore.getState().loadTrack('A', 'vid123', {
      sourceType: 'youtube', title: 't', artist: 'a', duration: 0, thumbnailUrl: null,
    });
    expect(getActivePlayer('A')).toBe(yt);
  });

  it('getActivePlayer returns the audio backend when sourceType is mp3', () => {
    const yt = makePlayer();
    const audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
    useDeckStore.getState().loadTrack('A', 'entry1', {
      sourceType: 'mp3', title: 't', artist: 'a', duration: 0, thumbnailUrl: null,
    });
    expect(getActivePlayer('A')).toBe(audio);
  });

  it('getActivePlayer returns undefined when no track / no matching backend', () => {
    expect(getActivePlayer('A')).toBeUndefined();
  });

  it('unregister removes only the named backend', () => {
    const yt = makePlayer();
    const audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
    playerRegistry.unregister('A', 'youtube');
    expect(playerRegistry.peek('A', 'youtube')).toBeUndefined();
    expect(playerRegistry.peek('A', 'audio')).toBe(audio);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/test/playerRegistry.test.ts`
Expected: FAIL — `getActivePlayer` is not exported / `register` arity wrong / `peek` undefined.

- [ ] **Step 3: Rewrite the registry**

Replace the body of `src/services/playerRegistry.ts` below the `YouTubePlayerAdapter` class (keep the `DeckPlayer` interface and `YouTubePlayerAdapter` class exactly as-is). Replace from `const registry = new Map...` to the end of file with:

```ts
type BackendKind = 'youtube' | 'audio';

interface DeckBackends {
  youtube?: DeckPlayer;
  audio?: DeckPlayer;
}

const registry = new Map<DeckId, DeckBackends>();

/** Lazy import to avoid a circular import at module-eval time. */
function readSourceType(deckId: DeckId): 'mp3' | 'youtube' | null {
  // Imported lazily inside the function so the store module is fully
  // initialised before we read from it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useDeckStore } = require('../store/deckStore') as typeof import('../store/deckStore');
  return useDeckStore.getState().decks[deckId].sourceType;
}

export const playerRegistry = {
  /** Register a backend for a deck under its kind. Additive — never clobbers the other kind. */
  register(deckId: DeckId, kind: BackendKind, player: DeckPlayer): void {
    const existing = registry.get(deckId) ?? {};
    existing[kind] = player;
    registry.set(deckId, existing);
  },

  /** Remove a single backend for a deck. */
  unregister(deckId: DeckId, kind: BackendKind): void {
    const existing = registry.get(deckId);
    if (!existing) return;
    delete existing[kind];
    registry.set(deckId, existing);
  },

  /** Direct backend lookup by kind, ignoring the active sourceType. For tests/diagnostics. */
  peek(deckId: DeckId, kind: BackendKind): DeckPlayer | undefined {
    return registry.get(deckId)?.[kind];
  },
};

/**
 * Resolve the backend that should receive imperative commands for this deck,
 * based on the deck's currently active sourceType. Returns undefined when no
 * track is loaded or the matching backend has not registered yet.
 */
export function getActivePlayer(deckId: DeckId): DeckPlayer | undefined {
  const sourceType = readSourceType(deckId);
  if (sourceType === null) return undefined;
  const backends = registry.get(deckId);
  if (!backends) return undefined;
  return sourceType === 'youtube' ? backends.youtube : backends.audio;
}
```

Note: `require` is used for the lazy store read to dodge a circular import (`deckStore` imports `playerRegistry`). Vitest + Vite support `require` in this CJS-interop context. If the build complains under ESM, replace with a setter-injection: add `let storeRef` and an exported `__setStoreForRegistry` — but try `require` first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/test/playerRegistry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/playerRegistry.ts src/test/playerRegistry.test.ts
git commit -m "feat: source-aware player registry with getActivePlayer resolver"
```

---

## Task 2: Migrate useYouTubePlayer + useAudioEngine to keyed registration

**Files:**
- Modify: `src/hooks/useYouTubePlayer.ts:265,272`
- Modify: `src/hooks/useAudioEngine.ts:50,62`
- Modify: `src/test/useAudioEngine.test.ts` (registry assertions)

- [ ] **Step 1: Update the failing tests first**

In `src/test/useAudioEngine.test.ts`, update the registry assertions to the new signature. Change every:
- `expect(playerRegistry.register).toHaveBeenCalledWith('A', mockEngineInstances[0])`
  → `expect(playerRegistry.register).toHaveBeenCalledWith('A', 'audio', mockEngineInstances[0])`
- `expect(playerRegistry.register).toHaveBeenCalledWith('B', mockEngineInstances[1]!)`
  → `expect(playerRegistry.register).toHaveBeenCalledWith('B', 'audio', mockEngineInstances[1]!)`
- `expect(playerRegistry.unregister).toHaveBeenCalledWith('A')`
  → `expect(playerRegistry.unregister).toHaveBeenCalledWith('A', 'audio')`
- `expect(playerRegistry.unregister).toHaveBeenCalledWith('B')`
  → `expect(playerRegistry.unregister).toHaveBeenCalledWith('B', 'audio')`
- `expect(playerRegistry.unregister).not.toHaveBeenCalledWith('B')`
  → `expect(playerRegistry.unregister).not.toHaveBeenCalledWith('B', 'audio')`

(Lines ~239, 244, 275, 281, 818, 819, 840, 841 — match by content.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/test/useAudioEngine.test.ts`
Expected: FAIL — implementation still calls 2-arg `register`.

- [ ] **Step 3: Update the hooks**

`src/hooks/useAudioEngine.ts` line 50: `playerRegistry.register(deckId, engine);` → `playerRegistry.register(deckId, 'audio', engine);`
`src/hooks/useAudioEngine.ts` line 62: `playerRegistry.unregister(deckId);` → `playerRegistry.unregister(deckId, 'audio');`

`src/hooks/useYouTubePlayer.ts` line 265: `playerRegistry.register(deckId, new YouTubePlayerAdapter(playerRef.current));` → `playerRegistry.register(deckId, 'youtube', new YouTubePlayerAdapter(playerRef.current));`
`src/hooks/useYouTubePlayer.ts` line 272: `playerRegistry.unregister(deckId);` → `playerRegistry.unregister(deckId, 'youtube');`

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/test/useAudioEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useYouTubePlayer.ts src/hooks/useAudioEngine.ts src/test/useAudioEngine.test.ts
git commit -m "feat: register YT adapter and audio engine under distinct backend keys"
```

---

## Task 3: Route DeckControls seeks through getActivePlayer (fixes CUE bug)

**Files:**
- Modify: `src/components/Deck/DeckControls.tsx`
- Test: `src/test/deckControls-seek-routing.test.tsx` (create)

- [ ] **Step 1: Write the failing integration test**

Create `src/test/deckControls-seek-routing.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeckControls } from '../components/Deck/DeckControls';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

function makePlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 180) };
}

describe('DeckControls — seek routes to the active backend', () => {
  let yt: DeckPlayer;
  let audio: DeckPlayer;

  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'youtube');
    playerRegistry.unregister('A', 'audio');
    yt = makePlayer();
    audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
  });

  it('CUE on a YouTube track seeks the YouTube backend, not the audio engine', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'vid123', { sourceType: 'youtube', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    store.setHotCue('A', 0, 42);
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByLabelText('Jump to cue point on Deck A'));
    expect(yt.seekTo).toHaveBeenCalledWith(42, true);
    expect(audio.seekTo).not.toHaveBeenCalled();
  });

  it('Restart on an MP3 track seeks the audio engine, not the YouTube backend', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { sourceType: 'mp3', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByLabelText('Restart Deck A'));
    expect(audio.seekTo).toHaveBeenCalledWith(0, true);
    expect(yt.seekTo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/test/deckControls-seek-routing.test.tsx`
Expected: FAIL — current code calls `playerRegistry.get(deckId)` which no longer exists (TypeError) or returns undefined.

- [ ] **Step 3: Migrate DeckControls**

In `src/components/Deck/DeckControls.tsx`:
- Change the import on line 18 from `import { playerRegistry } from '../../services/playerRegistry';` to `import { getActivePlayer } from '../../services/playerRegistry';`
- Replace each `const player = playerRegistry.get(deckId);` (lines 67, 75, 83, 92) with `const player = getActivePlayer(deckId);`

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/test/deckControls-seek-routing.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/DeckControls.tsx src/test/deckControls-seek-routing.test.tsx
git commit -m "fix: route DeckControls seeks to active backend (fixes CUE on YouTube tracks)"
```

---

## Task 4: Migrate HotCues, BeatJump, useKeyboardShortcuts, deckStore seeks

**Files:**
- Modify: `src/components/Deck/HotCues.tsx:34,70`
- Modify: `src/components/Deck/BeatJump.tsx:38,45`
- Modify: `src/hooks/useKeyboardShortcuts.ts:46,83,91,153,168`
- Modify: `src/store/deckStore.ts:7,366,536`
- Test: `src/test/hotcues-seek-routing.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/test/hotcues-seek-routing.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotCues } from '../components/Deck/HotCues';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

function makePlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 180) };
}

describe('HotCues — jump routes to the active backend', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'youtube');
    playerRegistry.unregister('A', 'audio');
  });

  it('hot cue jump on a YouTube track seeks the YouTube backend', () => {
    const yt = makePlayer();
    const audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
    const store = useDeckStore.getState();
    store.loadTrack('A', 'vid123', { sourceType: 'youtube', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    store.setHotCue('A', 2, 88);
    render(<HotCues deckId="A" />);
    // HotCueButton for a SET cue triggers onJump on normal click.
    fireEvent.click(screen.getByLabelText(/hot cue 3/i));
    expect(yt.seekTo).toHaveBeenCalledWith(88, true);
    expect(audio.seekTo).not.toHaveBeenCalled();
  });
});
```

Note: confirm the `HotCueButton` aria-label format (e.g. "Hot cue 3") by reading `src/components/Deck/HotCueButton.tsx`; adjust the `getByLabelText` matcher to the real label. If a set cue requires a specific click type, follow `HotCueButton`'s interaction model.

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/test/hotcues-seek-routing.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Migrate all four files**

`src/components/Deck/HotCues.tsx`:
- Line 34 import: `import { playerRegistry } from '../../services/playerRegistry';` → `import { getActivePlayer } from '../../services/playerRegistry';`
- Line 70: `const player = playerRegistry.get(deckId);` → `const player = getActivePlayer(deckId);`

`src/components/Deck/BeatJump.tsx`:
- Change its `playerRegistry` import to `getActivePlayer`.
- Lines 38, 45: `playerRegistry.get(deckId)?.seekTo(newTime, true);` → `getActivePlayer(deckId)?.seekTo(newTime, true);`

`src/hooks/useKeyboardShortcuts.ts`:
- Change its `playerRegistry` import to `getActivePlayer`.
- Line 46: `playerRegistry.get(deckId)?.seekTo(clamped, true);` → `getActivePlayer(deckId)?.seekTo(clamped, true);`
- Line 83: `playerRegistry.get('A')?.seekTo(cueA, true);` → `getActivePlayer('A')?.seekTo(cueA, true);`
- Line 91: `playerRegistry.get('B')?.seekTo(cueB, true);` → `getActivePlayer('B')?.seekTo(cueB, true);`
- Line 153: `playerRegistry.get('A')?.seekTo(timestampA, true);` → `getActivePlayer('A')?.seekTo(timestampA, true);`
- Line 168: `playerRegistry.get('B')?.seekTo(timestampB, true);` → `getActivePlayer('B')?.seekTo(timestampB, true);`

`src/store/deckStore.ts`:
- Line 7 import: `import { playerRegistry } from '../services/playerRegistry';` → `import { getActivePlayer } from '../services/playerRegistry';`
- Line 366: `playerRegistry.get(deckId)?.seekTo(deck.slipPosition, true);` → `getActivePlayer(deckId)?.seekTo(deck.slipPosition, true);`
- Line 536: `playerRegistry.get(deckId)?.seekTo(seekTarget, true);` → `getActivePlayer(deckId)?.seekTo(seekTarget, true);`

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/test/hotcues-seek-routing.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/HotCues.tsx src/components/Deck/BeatJump.tsx src/hooks/useKeyboardShortcuts.ts src/store/deckStore.ts src/test/hotcues-seek-routing.test.tsx
git commit -m "fix: route hot-cue, beat-jump, keyboard, slip/roll seeks to active backend"
```

---

## Task 5: Update legacy registry tests to the new signature

**Files:**
- Modify: `src/test/keyboardShortcuts.test.ts`
- Modify: `src/test/story-011-hot-cues.test.ts`
- Modify: `src/test/mp3-003-transport.test.ts`

- [ ] **Step 1: Run the full suite to see what the signature change broke**

Run: `npm run test`
Expected: FAILs in `keyboardShortcuts.test.ts`, `story-011-hot-cues.test.ts`, possibly `mp3-003-transport.test.ts` — they call `playerRegistry.register('A', mockPlayer)` / `playerRegistry.get('A')` (old 2-arg / get API).

- [ ] **Step 2: Update each legacy test**

For `src/test/keyboardShortcuts.test.ts`:
- `playerRegistry.register('A', mockPlayerA)` → `playerRegistry.register('A', 'youtube', mockPlayerA)`
- `playerRegistry.register('B', mockPlayerB)` → `playerRegistry.register('B', 'youtube', mockPlayerB)`
- `playerRegistry.unregister('A')` → `playerRegistry.unregister('A', 'youtube')`
- `playerRegistry.unregister('B')` → `playerRegistry.unregister('B', 'youtube')`
- Ensure each test loads a track with `sourceType: 'youtube'` into the deck store before asserting seeks (so `getActivePlayer` resolves to the registered `'youtube'` backend). If the test relied on `get()` returning the only registered player regardless of sourceType, add `useDeckStore.getState().loadTrack(deckId, 'vid', { sourceType: 'youtube', title:'', artist:'', duration:0, thumbnailUrl:null })` in setup.

For `src/test/story-011-hot-cues.test.ts`:
- Replace all `playerRegistry.register('X', mockPlayer)` → `playerRegistry.register('X', 'youtube', mockPlayer)`.
- Replace all `playerRegistry.unregister('X')` → `playerRegistry.unregister('X', 'youtube')`.
- Replace `playerRegistry.get('X')` assertions with `playerRegistry.peek('X', 'youtube')` (direct, sourceType-independent lookup) — this preserves the original intent of those unit tests (registry mechanics, not resolution).
- The test at line ~448-451 asserting "second register replaces first" now asserts replacement WITHIN the same kind: `register('A','youtube',p1); register('A','youtube',p2); expect(peek('A','youtube')).toBe(p2)`.

For `src/test/mp3-003-transport.test.ts`:
- The comment at line 521 references `playerRegistry.get(deckId).seekTo()`. If the test mocks/asserts against `playerRegistry.get`, switch to mocking `getActivePlayer` from the same module, or load an `'mp3'` track and assert on the registered `'audio'` backend via `peek`. Update only what fails — leave passing assertions alone.

- [ ] **Step 3: Run the full suite**

Run: `npm run test`
Expected: PASS — all test files green (original 665 + new tests).

- [ ] **Step 4: Commit**

```bash
git add src/test/keyboardShortcuts.test.ts src/test/story-011-hot-cues.test.ts src/test/mp3-003-transport.test.ts
git commit -m "test: update legacy registry tests to per-backend signature"
```

---

## Task 6: Capability map + dual-mode UI gating

**Files:**
- Create: `src/constants/capabilities.ts`
- Test: `src/test/capabilities.test.ts` (create)
- Modify: `src/components/Deck/EffectsPanel.tsx`, `src/components/Deck/EQPanel.tsx`, `src/components/Deck/PitchSlider.tsx`
- Test: `src/test/capability-gating.test.tsx` (create)

- [ ] **Step 1: Write the failing capability-map test**

Create `src/test/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { capabilities } from '../constants/capabilities';

describe('capabilities', () => {
  it('mp3 unlocks the full Web Audio chain', () => {
    expect(capabilities('mp3')).toEqual({
      continuousPitch: true, realEq: true, effects: true, filterSweep: true, waveform: true,
    });
  });
  it('youtube gates out real-audio features', () => {
    expect(capabilities('youtube')).toEqual({
      continuousPitch: false, realEq: false, effects: false, filterSweep: false, waveform: false,
    });
  });
  it('null source is fully ungated (no track loaded)', () => {
    const c = capabilities(null);
    expect(c.realEq).toBe(false);
    expect(c.effects).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/test/capabilities.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the capability map**

Create `src/constants/capabilities.ts`:

```ts
import type { TrackSourceType } from '../types/playlist';

/**
 * What a given audio source can actually do. The dual-mode source of truth:
 * the Web Audio engine (sourceType 'mp3', covering local MP3 + WAV + downloaded
 * YouTube audio) supports the full signal chain; the YouTube IFrame player
 * (sourceType 'youtube') only supports discrete playback rate + volume.
 */
export interface SourceCapabilities {
  /** Any playback rate (true) vs. discrete YouTube rates only (false). */
  continuousPitch: boolean;
  /** BiquadFilter EQ (true) vs. no real EQ over the IFrame (false). */
  realEq: boolean;
  /** Echo/reverb via Web Audio (true) vs. none (false). */
  effects: boolean;
  /** HPF/LPF filter sweep (true) vs. none (false). */
  filterSweep: boolean;
  /** Decoded waveform peaks (true) vs. none — IFrame audio is cross-origin (false). */
  waveform: boolean;
}

const MP3_CAPS: SourceCapabilities = {
  continuousPitch: true, realEq: true, effects: true, filterSweep: true, waveform: true,
};

const YOUTUBE_CAPS: SourceCapabilities = {
  continuousPitch: false, realEq: false, effects: false, filterSweep: false, waveform: false,
};

export function capabilities(sourceType: TrackSourceType | null): SourceCapabilities {
  return sourceType === 'mp3' ? MP3_CAPS : YOUTUBE_CAPS;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/test/capabilities.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing gating integration test**

Create `src/test/capability-gating.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EffectsPanel } from '../components/Deck/EffectsPanel';
import { EQPanel } from '../components/Deck/EQPanel';
import { useDeckStore } from '../store/deckStore';

function loadSource(deckId: 'A', sourceType: 'mp3' | 'youtube') {
  useDeckStore.getState().loadTrack(deckId, 'x', { sourceType, title: 't', artist: 'a', duration: 1, thumbnailUrl: null });
}

describe('capability gating', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); });

  it('EffectsPanel buttons are disabled for a YouTube track', () => {
    loadSource('A', 'youtube');
    render(<EffectsPanel deckId="A" />);
    expect(screen.getByRole('button', { name: 'ECHO' })).toBeDisabled();
  });

  it('EffectsPanel buttons are enabled for an MP3 track', () => {
    loadSource('A', 'mp3');
    render(<EffectsPanel deckId="A" />);
    expect(screen.getByRole('button', { name: 'ECHO' })).not.toBeDisabled();
  });

  it('EQPanel filter-sweep control is gated off for a YouTube track', () => {
    loadSource('A', 'youtube');
    render(<EQPanel deckId="A" />);
    // The filter-sweep knob exposes aria-disabled when capabilities().filterSweep is false.
    const sweep = screen.getByRole('slider', { name: /filter sweep/i });
    expect(sweep).toHaveAttribute('aria-disabled', 'true');
  });
});
```

Note: confirm the filter-sweep knob's accessible name in `EQPanel.tsx` and align the matcher. If the knob has no role/name yet, add `role="slider"` + `aria-label="Filter sweep"` + `aria-disabled` as part of Step 6.

- [ ] **Step 6: Run to verify failure, then gate the panels**

Run: `npm run test -- src/test/capability-gating.test.tsx`
Expected: FAIL.

Then update the three panels to consume `capabilities(deck.sourceType)`:

`src/components/Deck/EffectsPanel.tsx`:
- Add import: `import { capabilities } from '../../constants/capabilities';`
- Replace `const isMp3 = deck.sourceType === 'mp3';` with `const caps = capabilities(deck.sourceType); const fxEnabled = caps.effects;`
- Replace every use of `isMp3` with `fxEnabled` (the `disabled={!isMp3}` on buttons, the `panelInactive` class, the "MP3 only" note condition).

`src/components/Deck/EQPanel.tsx`:
- Add import: `import { capabilities } from '../../constants/capabilities';`
- Inside the `EQPanel` component body, compute `const caps = capabilities(deck.sourceType);`
- Disable the EQ knobs and kill buttons when `!caps.realEq` (add `disabled`/`aria-disabled` to the controls), and the filter-sweep knob when `!caps.filterSweep`. Ensure the filter-sweep knob has `role="slider"`, `aria-label="Filter sweep"`, and `aria-disabled={!caps.filterSweep}`.
- Add a small "MP3 only" annotation when `!caps.realEq`, mirroring EffectsPanel's pattern.

`src/components/Deck/PitchSlider.tsx`:
- Add import: `import { capabilities } from '../../constants/capabilities';`
- Read `const caps = capabilities(deck.sourceType);`. The slider is already locked via `pitchRateLocked`; additionally reflect `caps.continuousPitch` in the control's title/aria so YouTube's discrete-only nature is communicated (do not remove existing `pitchRateLocked` behavior — it handles the per-video 1x restriction).

- [ ] **Step 7: Run to verify pass**

Run: `npm run test -- src/test/capability-gating.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/constants/capabilities.ts src/components/Deck/EffectsPanel.tsx src/components/Deck/EQPanel.tsx src/components/Deck/PitchSlider.tsx src/test/capabilities.test.ts src/test/capability-gating.test.tsx
git commit -m "feat: centralize dual-mode capability gating across EQ/FX/pitch panels"
```

---

## Task 7: Deck↔mixer↔crossfader volume wiring integration test

**Files:**
- Test: `src/test/mixer-volume-wiring.test.tsx` (create)
- Modify (only if test reveals a defect): `src/components/Mixer/*` or `src/hooks/useCrossfade.ts`

- [ ] **Step 1: Write the integration test**

Create `src/test/mixer-volume-wiring.test.tsx`. First read `src/hooks/useCrossfade.ts` and `src/store/mixerStore.ts` to learn how channel-fader/crossfader map to `deckStore.setVolume`. Then assert that moving the crossfader toward a deck and changing its channel fader results in the expected `deck.volume` (the value the backend's `setVolume` receives). Example skeleton (adapt selectors to real store API):

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { useMixerStore } from '../store/mixerStore';
import { useDeckStore } from '../store/deckStore';

describe('mixer → deck volume wiring', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    useDeckStore.getState().clearTrack('B');
  });

  it('crossfader hard to A gives deck A full computed volume and deck B near zero', () => {
    const mixer = useMixerStore.getState();
    mixer.setChannelFaderA(100);
    mixer.setChannelFaderB(100);
    mixer.setCrossfaderPosition(-1); // full A (confirm sign convention in mixerStore)
    expect(useDeckStore.getState().decks.A.volume).toBeGreaterThan(useDeckStore.getState().decks.B.volume);
  });
});
```

Confirm the crossfader sign/curve convention and how computed volume reaches `deckStore` (it may flow through `useCrossfade`, which must be mounted, or directly via a mixer action). If the wiring requires a mounted hook/component, render a minimal harness that mounts it.

- [ ] **Step 2: Run the test**

Run: `npm run test -- src/test/mixer-volume-wiring.test.tsx`
Expected: PASS if wiring is correct; FAIL reveals a real defect.

- [ ] **Step 3: Fix only if it failed**

If FAIL, apply systematic-debugging: find where the crossfade/fader value should write `deck.volume` and repair the broken link. Keep the fix minimal.

- [ ] **Step 4: Re-run to verify pass**

Run: `npm run test -- src/test/mixer-volume-wiring.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/mixer-volume-wiring.test.tsx
git commit -m "test: lock in deck/mixer/crossfader volume wiring"
```

---

## Task 8: Repair the lint gate

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (devDependencies; the `lint` script already exists)

- [ ] **Step 1: Confirm the gate is broken**

Run: `npm run lint`
Expected: FAIL — `'eslint' is not recognized` (binary absent).

- [ ] **Step 2: Install ESLint toolchain**

Run:
```
npm install -D eslint@^9 @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```
(ESLint 9 flat config matches the existing `lint` script which uses `--ext` — if `--ext` is rejected by ESLint 9, update the script in `package.json` to `"lint": "eslint . --report-unused-disable-directives --max-warnings 0"` and rely on flat-config file matching.)

- [ ] **Step 3: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'server', 'coverage', '**/*.tsbuildinfo'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

- [ ] **Step 4: Run lint and resolve findings**

Run: `npm run lint`
Expected initially: some warnings/errors. Fix each real issue. For the `require` in `playerRegistry.ts` (Task 1), keep the existing inline `eslint-disable` comment, or convert to setter-injection if the rule cannot be satisfied. Drive to ZERO warnings (the `--max-warnings 0` gate).

- [ ] **Step 5: Verify zero-warning pass + full test suite still green**

Run: `npm run lint`
Expected: PASS, no output errors.
Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "build: restore working ESLint zero-warning gate"
```

---

## Task 9: Clean up stale download artifacts + verify server format consistency

**Files:**
- Delete: `server/downloads/*.webm` (stale pre-mp3 leftovers)
- Test: `server/src/services/__tests__/downloadFormat.test.ts` (create)

- [ ] **Step 1: Write a test asserting download/serve format agreement**

Create `server/src/services/__tests__/downloadFormat.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('download/serve format agreement', () => {
  it('downloadService writes .mp3 and the audio route serves .mp3', () => {
    const dl = readFileSync(join(__dirname, '../downloadService.ts'), 'utf8');
    const route = readFileSync(join(process.cwd(), 'src/routes/library.ts'), 'utf8');
    // Both sides must agree on the .mp3 extension.
    expect(dl).toMatch(/--audio-format', 'mp3'/);
    expect(dl).toMatch(/\$\{videoId\}\.mp3/);
    expect(route).toMatch(/\$\{videoId\}\.mp3/);
  });
});
```

Adjust the route path if `library.ts` lives elsewhere; the audio handler is in `server/src/routes/library.ts`.

- [ ] **Step 2: Run the test**

Run: `npm run test --prefix server -- downloadFormat`
Expected: PASS (server is already consistent — this locks it in).

- [ ] **Step 3: Remove stale .webm files**

Run (PowerShell): `.claude\skills\dev-tools\scripts\remove-files.ps1 -Path "server\downloads\-lzHszPWkgM.webm"` and `... -Path "server\downloads\yMghLSvZ9-I.webm"`
(Or `Remove-Item server\downloads\*.webm -Force` if the toolkit script is unavailable.)
These predate the `-x --audio-format mp3` flag and are never served.

- [ ] **Step 4: Verify server suite green**

Run: `npm run test --prefix server`
Expected: PASS (22 + 1 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/__tests__/downloadFormat.test.ts
git rm server/downloads/-lzHszPWkgM.webm server/downloads/yMghLSvZ9-I.webm
git commit -m "chore: lock download/serve format agreement; remove stale .webm artifacts"
```

---

## Task 10: Refresh README for the real dual-mode architecture

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the description and features**

Rewrite the intro and Features sections of `README.md` to describe the actual app:
- Two-deck DJ mixer supporting **both** live YouTube (IFrame) playback **and** local/downloaded WAV/MP3 via a real Web Audio engine.
- WAV/MP3 (and downloaded YouTube audio) unlock the full signal chain: real BiquadFilter EQ, kill switches, HPF/LPF filter sweep, echo/reverb effects, continuous pitch, decoded waveform display, and BPM detection.
- YouTube live mode is feature-gated (discrete pitch, volume-only — no real EQ/effects/waveform), with an optional server-side `yt-dlp` download-to-MP3 path that promotes a track to full features.
- Update the Tech Stack table to include the Express + better-sqlite3 + WebSocket server and the Web Audio engine.
- Replace the "Limitations" section: clarify limitations apply to **YouTube live mode only**, and are lifted by downloading to MP3.
- Update Project Structure to include `server/`, `src/services/audioEngine.ts`, `src/constants/capabilities.ts`, and the workers.

- [ ] **Step 2: Verify scripts in README match package.json**

Confirm the documented scripts (`dev`, `build`, `test`, `lint`, `preview`) match the real `package.json` (note `dev` now runs server + UI concurrently).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for real dual-mode (YouTube + WAV/MP3) architecture"
```

---

## Task 11: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Frontend build**

Run: `npm run build`
Expected: PASS — `tsc -b` clean, `vite build` succeeds.

- [ ] **Step 2: Server build**

Run: `npm run build --prefix server`
Expected: PASS.

- [ ] **Step 3: Full frontend test suite**

Run: `npm run test`
Expected: PASS — all original + new tests green.

- [ ] **Step 4: Full server test suite**

Run: `npm run test --prefix server`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS, zero warnings.

- [ ] **Step 6: Manual smoke (browser) — the original bug**

Run: `npm run dev`. In the browser: sign in, load a YouTube track from search/history, press CUE → confirm the playhead seeks. Load a WAV and an MP3 file → confirm EQ/filter/effects audibly work and YouTube-only controls are disabled on the YouTube deck. Document the result in the PR description.

- [ ] **Step 7: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore: production verification gate — builds, tests, lint, manual smoke"
```

---

## Self-Review Notes

- **Spec coverage:** §5.1 registry → Tasks 1–2; imperative-seam migration → Tasks 3–5 (incl. the extra keyboard/beat-jump sites found by grep); §5.2 capability map → Task 6; §7 #4 mixer wiring → Task 7; §8 lint → Task 8; §7 #5 + §4 server format → Task 9 (resolved as cleanup, server already consistent); README → Task 10; §9 acceptance → Task 11.
- **Clean cut confirmed:** no `get()` alias; all call sites migrated; legacy tests updated (Task 5).
- **Type consistency:** `register(deckId, kind, player)`, `unregister(deckId, kind)`, `peek(deckId, kind)`, `getActivePlayer(deckId)`, `capabilities(sourceType)` / `SourceCapabilities` used consistently across tasks.
- **WAV note:** WAV maps to `sourceType: 'mp3'` — no new type; capability map keys on `'mp3' | 'youtube'`.
