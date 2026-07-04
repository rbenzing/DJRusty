# DJ Rusty — Jog Wheel + Scratch Audio (Phase 3)

**Date:** 2026-07-04
**Status:** Approved for planning
**Parent spec:** `docs/superpowers/specs/2026-07-02-serato-controller-parity-design.md` §3, §6 ("Phase 3")
**Prior phases:** Phase 1 (channel-strip & FX), Phase 2a/2b/2c (unified PadGrid: HOT CUE/LOOP/SLICER/SAMPLER) — all merged to main.
**Goal:** Turn the currently decorative `VinylPlatter` into an interactive jog wheel with two modes — real scratch audio (VINYL on) and temporary pitch-bend (VINYL off) — matching how real DJ controllers (including the Inpulse 300 MK2 reference) behave.

---

## 1. Decisions made

- **VINYL mode toggle, per deck, default ON.** A compact button (sized like the existing SHIFT/Q buttons) switches the jog wheel between two behaviors:
  - **VINYL ON (scratch):** dragging the platter stops the track and scrubs it directly — real position control, needle-drop feel.
  - **VINYL OFF (bend):** dragging never stops the track; it only applies a temporary pitch nudge that snaps back to the normal rate on release.
- **One drag zone.** The whole platter's behavior is fully determined by the VINYL toggle — no separate inner-scratch/outer-bend split (rejected as unnecessary complexity for a mouse/touch UI with an explicit mode button already available).
- **SLIP-aware resume.** If `slipMode` is on, releasing the platter after a scratch resumes playback from the SLIP shadow position (as if the track had kept playing invisibly the whole time), matching SLIP's existing behavior for loops/rolls. If SLIP is off, resume from wherever the scratch left the audible playhead.
- **Snap to normal speed on release** (no decelerate/coast simulation) — matches how most modern controllers actually behave in practice, and avoids an extra tunable decay curve.
- **Works on paused/cued decks too**, not just while playing — supports the needle-drop/cueing workflow (finding a mix point before pressing play).
- **Loop trapping:** if a loop is active, scratch position is clamped within `[loopStart, loopEnd]`, mirroring the existing `seekTo` behavior (`audioEngine.ts:243-247`). Dragging past a loop boundary holds at the edge rather than escaping the loop.
- **Quantize has no effect on scratch** — matches the existing scope of `quantize` (hot-cue-set and manual-loop-IN snapping only).
- **Scratch never touches `transportState`/`playbackState`.** `transport.ts`'s state machine (`CUED`/`PLAYING`/`PAUSED`/`PREVIEW`) is driven only by `PLAY`/`CUE_PRESS`/`CUE_RELEASE` events; scratch is a drag gesture with different release semantics than `PREVIEW` (which seeks back to the cue point on release) and does not map onto it. Scratching a paused deck leaves it `PAUSED`/`CUED` — only the instantaneous audio output and `currentTime` change while dragging.
- **Native negative `playbackRate` is not a viable implementation path.** Verified against MDN/spec and browser bug trackers: Firefox's negative-`playbackRate` support (bug 1308438) and WebKit's (bug 69725) are both unresolved/unimplemented despite being contemplated by the spec. Reverse playback must be implemented via manual sample-index stepping inside a custom `AudioWorkletProcessor`, not by relying on a native negative rate.

## 2. Architecture

### BEND mode (VINYL off) — no worklet needed

A new `setBendMultiplier(multiplier)` method on `AudioEngineImpl` temporarily scales the existing `AudioBufferSourceNode.playbackRate` on top of the deck's normal `pitchRate`: effective rate = `pitchRate × bendMultiplier`. Dragging maps to a multiplier in a small range (±8%, tunable during implementation). Releasing snaps `bendMultiplier` back to `1.0` immediately. The stored `pitchRate` field is never touched, so SYNC/pitch-fader state stays clean.

### SCRATCH mode (VINYL on) — custom AudioWorkletProcessor

A new `src/services/scratchProcessor.ts` module defines an `AudioWorkletProcessor` subclass, registered via `registerProcessor(...)` and loaded with `audioContext.audioWorklet.addModule(new URL('./scratchProcessor.ts', import.meta.url))` — the same Vite `new URL(..., import.meta.url)` pattern this repo already uses for `bpmDetector.worker`.

- **Channel data:** a **copy** (not a transfer) of the track's PCM data, obtained via `AudioBuffer.getChannelData(channel)` and sent to the worklet with `port.postMessage` (structured-clone, no transfer list) once when the track loads via `loadBuffer` — priming the worklet ahead of time so the first scratch has zero setup latency. Transferring (rather than copying) would detach the array from the original `AudioBuffer`, corrupting it for normal playback — confirmed via MDN's Transferable Objects docs.
- **Control signal:** a custom a-rate `AudioParam` named `readRate` (signed), defined via `static get parameterDescriptors()`, automated from the main thread with `setValueAtTime`/`linearRampToValueAtTime` as the pointer moves. A-rate params arrive as a full 128-value-per-sample array inside `process()`, giving sample-accurate control without the message-passing jitter or structured-clone overhead of driving position via `port.postMessage` every frame.
- **DSP:** inside `process()`, the processor advances a fractional read-position by `readRate` per sample and writes linearly-interpolated output samples — this is what makes both arbitrary scratch speeds and reverse playback possible. The interpolation and rate-conversion math itself lives in `src/utils/scratchMath.ts` (pure functions, imported by the worklet module) so it can be unit-tested outside the worklet's global scope.
- **Position feedback:** the worklet throttles a `port.postMessage` back to the main thread (~30-60Hz) reporting its current read-position. `AudioEngineImpl.getCurrentTime()` returns this reported position while `scratching` is true, instead of the normal analytic formula (`seekOffset + elapsed × playbackRate`), since scratch position is drag-driven, not time-driven.
- **Node graph:** the worklet node connects to the same `trimGain` head-of-chain node the normal `AudioBufferSourceNode` uses, so scratched audio still passes through EQ/filter/gain like normal playback (unlike the Sampler's dedicated bus, which intentionally bypasses the mixer).
  - **Begin scratch:** stop/disconnect the current source; connect the (already-primed) worklet node to `trimGain`.
  - **End scratch:** disconnect the worklet; create a fresh `AudioBufferSourceNode` at the reported exit position (or the SLIP shadow position, per the SLIP-aware resume decision) via the existing `play(offset)` semantics — mirroring how `seekTo` already does stop-and-restart.

### Pointer math

On each `pointermove`: compute the angle from the platter center to the pointer, diff against the previous angle for Δrotation, convert to Δseconds via the existing `1.8s per rotation` constant already used by `VinylPlatter.tsx`'s CSS spin-duration formula, and divide by the wall-clock Δt between events to get an instantaneous rate. That rate is smoothed with a short `linearRampToValueAtTime` into `readRate` to avoid stair-stepping between ~60-120Hz pointer events and the audio thread's per-sample clock.

### Error handling

- If `audioWorklet.addModule(...)` rejects (rare — e.g. a serving hiccup), VINYL mode is force-disabled for that deck, falling back to bend-only behavior rather than throwing — matching this project's convention of graceful degradation (e.g., Sampler's decode-error slots stay usable, just empty).
- If a new track loads mid-scratch, the in-progress scratch is force-ended before the new track's channel data replaces the worklet's buffer, using a generation-counter guard mirroring the one already established in `samplerStore.ts` (Phase 2c) to prevent a stale scratch session from writing into the wrong buffer.

## 3. Components & files

**New:**
- `src/utils/scratchMath.ts` — pure functions: pointer-angle-to-seconds conversion, velocity-from-consecutive-positions, and the fractional-index linear-interpolation formula.
- `src/services/scratchProcessor.ts` — the `AudioWorkletProcessor` subclass + `registerProcessor` call; imports `scratchMath.ts`.
- `src/components/Deck/JogWheel.tsx` (+ `.module.css`) — Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`, unifying mouse and touch) wrapping the existing `<VinylPlatter>`; renders the VINYL toggle button; computes drag angle/velocity and calls either `setBendMultiplier` (VINYL off) or `beginScratch`/`updateScratchRate`/`endScratch` (VINYL on).

**Modified:**
- `src/services/audioEngine.ts` — new methods `beginScratch()`, `updateScratchRate(rate)`, `endScratch()`, `setBendMultiplier(multiplier)`; `loadBuffer` primes the worklet's channel-data copy; `getCurrentTime()` becomes scratch-aware.
- `src/services/playerRegistry.ts` — the above added as **optional** `DeckPlayer` methods (`beginScratch?()`, `updateScratchRate?()`, `endScratch?()`, `setBendMultiplier?()`), mirroring the existing `setLoop?`/`clearLoop?` pattern.
- `src/components/Deck/VinylPlatter.tsx` — new optional `rotationOverrideDeg?: number` prop; when set (during an active drag), used instead of the CSS keyframe spin so visual rotation and audio position stay locked together while scratching.
- `src/store/deckStore.ts` / `src/types/deck.ts` — new per-deck fields `vinylMode: boolean` (default `true`, survives `loadTrack`) and `scratching: boolean` (drives UI state and suppresses the normal position poll while a scratch is live).
- `src/components/Deck/Deck.tsx` — renders `<JogWheel>` in place of the current bare `<VinylPlatter>` render.

## 4. Testing

- `scratchMath.test.ts` — pure functions tested directly, no mocking.
- `audioEngine.test.ts` — extended with a mocked `audioContext.audioWorklet.addModule` (resolves immediately) and a hand-built mock `AudioWorkletNode` (`.port.postMessage`/`.port.onmessage`, `.parameters.get(name)` returning a mock `AudioParam` with `setValueAtTime`/`linearRampToValueAtTime`, `.connect`/`.disconnect`), extending the existing `mockContext` pattern. Covers: `beginScratch` connects the worklet and disconnects the source; `updateScratchRate` automates `readRate`; `endScratch` disconnects the worklet and creates a fresh source at the reported exit position; `setBendMultiplier` scales `playbackRate` without touching stored `pitchRate`.
- The real `AudioWorkletProcessor` subclass cannot be unit-tested in jsdom (no worklet global scope) — its DSP logic stays thin, delegating to the already-tested `scratchMath.ts` functions; end-to-end correctness is verified via a Playwright smoke test at the end of implementation, as with every prior phase.
- `JogWheel.test.tsx` — simulated `pointerdown`/`pointermove`/`pointerup` sequences assert the correct engine calls fire per mode, and that the VINYL toggle flips `vinylMode` in the store.
- `deckStore.test.ts` — `vinylMode` defaults to `true` and survives `loadTrack`; `scratching` toggles correctly.
- After implementation: `npm run build` and `npm run lint` (zero-warnings), per project CLAUDE.md.

## 5. Non-goals (Phase 3)

- No multi-touch scratching (single pointer/mouse only, matching every prior phase's click/tap-only scope).
- No keyboard equivalent for scratch — a continuous drag gesture has no meaningful keyboard mapping; accepted limitation, same category as Sampler's "no MIDI/keyboard triggering."
- No coast/decelerate-on-release physics — confirmed snap-to-normal-speed only.
- No outer-ring always-bend zone — confirmed one zone, mode-determined by the VINYL toggle.
- No changes to `transport.ts`'s state machine.
- No live waveform-scrubbing visual sync beyond the platter's own rotation (e.g., a live-updating center-waveform position indicator during a scratch) — can follow in a later phase if wanted.
- No viewport/responsive layout changes — tracked as a separate, upcoming phase (see project follow-up).
