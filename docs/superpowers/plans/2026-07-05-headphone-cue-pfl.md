# Headphone CUE / PFL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-deck headphone CUE (pre-fader listen), a headphone MIX knob blending cue vs. the main program mix, and an output-device picker so cue audio can be routed to a real second device (e.g. USB headphones) while the main mix keeps playing on the default output.

**Architecture:** A new `src/services/cueEngine.ts` module owns a lazily-created shared Web Audio bus graph (cue bus + program bus + MIX crossfade) bridged to a `MediaStreamAudioDestinationNode` + hidden `<audio>` element so `HTMLMediaElement.setSinkId()` can route it to a chosen device. Each deck's `AudioEngineImpl` gains one new `cueSendGain` node tapped from `trimGain` (pre-fader). Registration from `useAudioEngine.ts` is pure bookkeeping (no Web Audio calls) so it's safe on every deck mount; real node creation is deferred until the first actual CUE/MIX/device action.

**Tech Stack:** Native Web Audio API (`GainNode`, `MediaStreamAudioDestinationNode`), `HTMLMediaElement.setSinkId()`, `navigator.mediaDevices` (`getUserMedia`, `enumerateDevices`) — no new npm dependency.

## Global Constraints

- Strict TS: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on — indexed access (`Map.get`, array index) is `T | undefined`; handle explicitly.
- `npm run lint` must pass with zero warnings (`--max-warnings 0`).
- CSS Modules (`*.module.css`) co-located per component.
- Single Web Audio backend rule: the engine instance lives in a `useRef` inside `useAudioEngine`, never in Zustand. `cueEngine.ts` follows the same plain-module-singleton pattern as the existing `playerRegistry.ts`/`audioContext.ts` — not a Zustand store.
- Layout must fit the 1366×768 viewport floor established in the previous phase (`--min-viewport-width` in `src/index.css`) — new controls are small (a button, a slider, a `<select>`) and must not reopen that layout work.
- Cue audio is a pre-fader, pre-EQ tap (taps `trimGain`'s output, before the fader/crossfader/EQ/filter/FX) — this is a deliberate, accepted limitation from the design spec, not a bug to "fix" mid-plan.
- **Critical implementation constraint discovered during planning:** jsdom has no global `AudioContext`. Seven existing test files locally mock `AudioEngineImpl` and are exercised by every Deck-mounting test; `cueEngine.ts` must never touch `getAudioContext()` except lazily, inside `ensureInitialized()`, triggered only by an actual CUE toggle / MIX change / device change — never merely by registering a deck on mount. Every task below that touches registration must preserve this.

---

### Task 1: Per-deck cue-send tap in `AudioEngineImpl`

**Files:**
- Modify: `src/services/audioEngine.ts`
- Modify: `src/test/audioEngine.test.ts`
- Modify: `src/test/useAudioEngine.test.ts`
- Modify: `src/test/decode-error.test.ts`
- Modify: `src/test/mp3-003-transport.test.ts`
- Modify: `src/test/mp3-004-eq-volume.test.ts`
- Modify: `src/test/mp3-005-pitch.test.ts`
- Modify: `src/test/mp3-006-waveform.test.ts`
- Modify: `src/test/mp3-008-bpm.test.ts`

**Interfaces:**
- Produces: `AudioEngine.getCueSendNode(): GainNode` — a `GainNode` tapped from `trimGain`'s output, in parallel with `trimGain`'s existing connection to `gainNode`. Consumed by Task 3.

- [ ] **Step 1: Update `audioEngine.test.ts`'s constructor mocks and assertions (RED)**

In `src/test/audioEngine.test.ts`, find the named-mock declarations (near the top, after `mockContext`):

```ts
let mockTrimGain: ReturnType<typeof makeMockGain>;
let mockGainNode: ReturnType<typeof makeMockGain>;
let mockLowKillGain: ReturnType<typeof makeMockGain>;
let mockMidKillGain: ReturnType<typeof makeMockGain>;
let mockHighKillGain: ReturnType<typeof makeMockGain>;
let mockDryGain: ReturnType<typeof makeMockGain>;
let mockWetGain: ReturnType<typeof makeMockGain>;
let mockLowFilter: ReturnType<typeof makeMockFilter>;
let mockMidFilter: ReturnType<typeof makeMockFilter>;
let mockHighFilter: ReturnType<typeof makeMockFilter>;
let mockSweepFilter: ReturnType<typeof makeMockFilter>;
```

Add one more declaration right after `mockWetGain`:

```ts
let mockCueSendGain: ReturnType<typeof makeMockGain>;
```

Then find `setupConstructorMocks()`:

```ts
function setupConstructorMocks() {
  mockTrimGain     = makeMockGain();
  mockGainNode     = makeMockGain();
  mockLowKillGain  = makeMockGain();
  mockMidKillGain  = makeMockGain();
  mockHighKillGain = makeMockGain();
  mockDryGain      = makeMockGain();
  mockWetGain      = makeMockGain();
  mockLowFilter    = makeMockFilter('lowshelf',  320);
  mockMidFilter    = makeMockFilter('peaking',  1000);
  mockHighFilter   = makeMockFilter('highshelf', 3200);
  mockSweepFilter  = makeMockFilter('allpass',  20000);

  // createGain order: trimGain, gainNode, lowKill, midKill, highKill, dryGain, wetGain
  mockContext.createGain
    .mockReturnValueOnce(mockTrimGain)
    .mockReturnValueOnce(mockGainNode)
    .mockReturnValueOnce(mockLowKillGain)
    .mockReturnValueOnce(mockMidKillGain)
    .mockReturnValueOnce(mockHighKillGain)
    .mockReturnValueOnce(mockDryGain)
    .mockReturnValueOnce(mockWetGain);

  // createBiquadFilter order: low, mid, high, sweep
  mockContext.createBiquadFilter
    .mockReturnValueOnce(mockLowFilter)
    .mockReturnValueOnce(mockMidFilter)
    .mockReturnValueOnce(mockHighFilter)
    .mockReturnValueOnce(mockSweepFilter);

  mockContext.createAnalyser.mockReturnValue(mockAnalyser);
  mockContext.createBufferSource.mockReturnValue(mockSourceNode);
}
```

Replace it with:

```ts
function setupConstructorMocks() {
  mockTrimGain     = makeMockGain();
  mockGainNode     = makeMockGain();
  mockLowKillGain  = makeMockGain();
  mockMidKillGain  = makeMockGain();
  mockHighKillGain = makeMockGain();
  mockDryGain      = makeMockGain();
  mockWetGain      = makeMockGain();
  mockCueSendGain  = makeMockGain();
  mockLowFilter    = makeMockFilter('lowshelf',  320);
  mockMidFilter    = makeMockFilter('peaking',  1000);
  mockHighFilter   = makeMockFilter('highshelf', 3200);
  mockSweepFilter  = makeMockFilter('allpass',  20000);

  // createGain order: trimGain, gainNode, lowKill, midKill, highKill, dryGain, wetGain, cueSendGain
  mockContext.createGain
    .mockReturnValueOnce(mockTrimGain)
    .mockReturnValueOnce(mockGainNode)
    .mockReturnValueOnce(mockLowKillGain)
    .mockReturnValueOnce(mockMidKillGain)
    .mockReturnValueOnce(mockHighKillGain)
    .mockReturnValueOnce(mockDryGain)
    .mockReturnValueOnce(mockWetGain)
    .mockReturnValueOnce(mockCueSendGain);

  // createBiquadFilter order: low, mid, high, sweep
  mockContext.createBiquadFilter
    .mockReturnValueOnce(mockLowFilter)
    .mockReturnValueOnce(mockMidFilter)
    .mockReturnValueOnce(mockHighFilter)
    .mockReturnValueOnce(mockSweepFilter);

  mockContext.createAnalyser.mockReturnValue(mockAnalyser);
  mockContext.createBufferSource.mockReturnValue(mockSourceNode);
}
```

Then find the `'creates the signal chain correctly'` test:

```ts
    it('creates the signal chain correctly', () => {
      expect(mockContext.createGain).toHaveBeenCalledTimes(7);        // trim + gain + 3 kills + dry + wet
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(4); // low + mid + high + sweep
      expect(mockContext.createAnalyser).toHaveBeenCalled();

      // Key connections
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockLowFilter);
      expect(mockLowFilter.connect).toHaveBeenCalledWith(mockLowKillGain);
      expect(mockLowKillGain.connect).toHaveBeenCalledWith(mockMidFilter);
      expect(mockMidFilter.connect).toHaveBeenCalledWith(mockMidKillGain);
      expect(mockMidKillGain.connect).toHaveBeenCalledWith(mockHighFilter);
      expect(mockHighFilter.connect).toHaveBeenCalledWith(mockHighKillGain);
      expect(mockHighKillGain.connect).toHaveBeenCalledWith(mockSweepFilter);
      expect(mockSweepFilter.connect).toHaveBeenCalledWith(mockDryGain);
      expect(mockDryGain.connect).toHaveBeenCalledWith(mockAnalyser);
      expect(mockAnalyser.connect).toHaveBeenCalledWith(mockContext.destination);
    });
```

Replace it with:

```ts
    it('creates the signal chain correctly', () => {
      expect(mockContext.createGain).toHaveBeenCalledTimes(8);        // trim + gain + 3 kills + dry + wet + cueSend
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(4); // low + mid + high + sweep
      expect(mockContext.createAnalyser).toHaveBeenCalled();

      // Key connections
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockCueSendGain);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockLowFilter);
      expect(mockLowFilter.connect).toHaveBeenCalledWith(mockLowKillGain);
      expect(mockLowKillGain.connect).toHaveBeenCalledWith(mockMidFilter);
      expect(mockMidFilter.connect).toHaveBeenCalledWith(mockMidKillGain);
      expect(mockMidKillGain.connect).toHaveBeenCalledWith(mockHighFilter);
      expect(mockHighFilter.connect).toHaveBeenCalledWith(mockHighKillGain);
      expect(mockHighKillGain.connect).toHaveBeenCalledWith(mockSweepFilter);
      expect(mockSweepFilter.connect).toHaveBeenCalledWith(mockDryGain);
      expect(mockDryGain.connect).toHaveBeenCalledWith(mockAnalyser);
      expect(mockAnalyser.connect).toHaveBeenCalledWith(mockContext.destination);
    });

    it('getCueSendNode returns the node tapped from trimGain, independent of the fader', () => {
      expect(engine.getCueSendNode()).toBe(mockCueSendGain);
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockCueSendGain);
    });
```

Then find the `'disconnects all nodes'` test (inside the effects/destroy describe block):

```ts
    it('disconnects all nodes', () => {
      engine.destroy();

      expect(mockGainNode.disconnect).toHaveBeenCalled();
      expect(mockLowFilter.disconnect).toHaveBeenCalled();
      expect(mockMidFilter.disconnect).toHaveBeenCalled();
      expect(mockHighFilter.disconnect).toHaveBeenCalled();
      expect(mockAnalyser.disconnect).toHaveBeenCalled();
      expect(mockDryGain.disconnect).toHaveBeenCalled();
    });
```

Replace it with:

```ts
    it('disconnects all nodes', () => {
      engine.destroy();

      expect(mockGainNode.disconnect).toHaveBeenCalled();
      expect(mockLowFilter.disconnect).toHaveBeenCalled();
      expect(mockMidFilter.disconnect).toHaveBeenCalled();
      expect(mockHighFilter.disconnect).toHaveBeenCalled();
      expect(mockAnalyser.disconnect).toHaveBeenCalled();
      expect(mockDryGain.disconnect).toHaveBeenCalled();
      expect(mockCueSendGain.disconnect).toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: FAIL — `engine.getCueSendNode is not a function`, and the `createGain` call-count/connection assertions fail against the current (7-call) implementation.

- [ ] **Step 3: Implement the cue-send tap in `audioEngine.ts`**

In the `AudioEngine` interface, find:

```ts
  /** Get the AnalyserNode for visualization. */
  getAnalyser(): AnalyserNode;

  /** Check if the engine is ready for playback. */
  isReady(): boolean;
```

Replace with:

```ts
  /** Get the AnalyserNode for visualization. */
  getAnalyser(): AnalyserNode;

  /**
   * Get the per-deck headphone-cue send node: a tap of the trimmed
   * (GAIN-adjusted) signal taken BEFORE the fader/crossfader, EQ, filter,
   * and FX — the literal "pre-fader listen" point. Always full-strength
   * regardless of the channel fader/crossfader position. Registered with
   * cueEngine on deck creation (see useAudioEngine.ts).
   */
  getCueSendNode(): GainNode;

  /** Check if the engine is ready for playback. */
  isReady(): boolean;
```

In the `AudioEngineImpl` class, find the signal-chain node fields:

```ts
  private dryGain: GainNode;
  private wetGain: GainNode;
  private effectNodes: AudioNode[] = [];
  private analyser: AnalyserNode;
```

Replace with:

```ts
  private dryGain: GainNode;
  private wetGain: GainNode;
  private effectNodes: AudioNode[] = [];
  private analyser: AnalyserNode;
  // Headphone-cue send: tapped from trimGain, pre-fader/pre-EQ/pre-FX.
  private cueSendGain: GainNode;
```

In the constructor, find:

```ts
    this.dryGain = this.context.createGain();
    this.wetGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
```

Replace with:

```ts
    this.dryGain = this.context.createGain();
    this.wetGain = this.context.createGain();
    this.cueSendGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
```

Find the signal-chain wiring comment block:

```ts
    // Signal chain head: source → trimGain → gainNode(volume) → EQ…
    // Gain → LowFilter → LowKillGain → MidFilter → MidKillGain → HighFilter → HighKillGain
    //      → SweepFilter → DryGain → Analyser → Destination
    //                    ↘ WetGain → [effectNode] → Analyser
    this.trimGain.connect(this.gainNode);
    this.gainNode.connect(this.lowFilter);
```

Replace with:

```ts
    // Signal chain head: source → trimGain → gainNode(volume) → EQ…
    // Gain → LowFilter → LowKillGain → MidFilter → MidKillGain → HighFilter → HighKillGain
    //      → SweepFilter → DryGain → Analyser → Destination
    //                    ↘ WetGain → [effectNode] → Analyser
    //      ↘ (trimGain also feeds) CueSendGain → cueEngine's shared cue bus (pre-fader listen)
    this.trimGain.connect(this.gainNode);
    this.trimGain.connect(this.cueSendGain);
    this.gainNode.connect(this.lowFilter);
```

Find `getAnalyser()`:

```ts
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }
```

Replace with:

```ts
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  getCueSendNode(): GainNode {
    return this.cueSendGain;
  }
```

Find `destroy()`'s disconnect-all array:

```ts
    [
      this.trimGain, this.gainNode, this.lowFilter, this.lowKillGain,
      this.midFilter, this.midKillGain, this.highFilter, this.highKillGain,
      this.sweepFilter, this.dryGain, this.wetGain, this.analyser,
    ].forEach((n) => { try { n.disconnect(); } catch { /* ok */ } });
```

Replace with:

```ts
    [
      this.trimGain, this.gainNode, this.lowFilter, this.lowKillGain,
      this.midFilter, this.midKillGain, this.highFilter, this.highKillGain,
      this.sweepFilter, this.dryGain, this.wetGain, this.cueSendGain, this.analyser,
    ].forEach((n) => { try { n.disconnect(); } catch { /* ok */ } });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: PASS (all tests in the file, including the 2 new/updated ones).

- [ ] **Step 5: Add a bare `getCueSendNode` mock to the 7 dependent test files**

`useAudioEngine.ts`'s engine-creation effect (wired in Task 3) will call `engine.getCueSendNode()` unconditionally on every deck mount. Every test file that locally mocks `AudioEngineImpl` must add this method to its mock object, or that call throws `TypeError: engine.getCueSendNode is not a function` and breaks every test in the file — even ones unrelated to this feature.

In **`src/test/useAudioEngine.test.ts`**, find:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  primeScratch: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setGain: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

Replace with:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  primeScratch: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setGain: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  getCueSendNode: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

And find:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

Replace with:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    getCueSendNode: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

In **`src/test/decode-error.test.ts`**, find:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  setEQKill: ReturnType<typeof vi.fn>;
  setFilterSweep: ReturnType<typeof vi.fn>;
  setEffect: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

Replace with:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  setEQKill: ReturnType<typeof vi.fn>;
  setFilterSweep: ReturnType<typeof vi.fn>;
  setEffect: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  getCueSendNode: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

And find:

```ts
    setEffect: vi.fn(),
    getAnalyser: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

Replace with:

```ts
    setEffect: vi.fn(),
    getAnalyser: vi.fn(),
    getCueSendNode: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

In **`src/test/mp3-003-transport.test.ts`**, find:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  primeScratch: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setGain: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

Replace with:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  primeScratch: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setGain: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  getCueSendNode: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

And find:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

Replace with:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    getCueSendNode: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

In **`src/test/mp3-005-pitch.test.ts`**, find:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

Replace with:

```ts
interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  getCueSendNode: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
```

And find:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

Replace with:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    getCueSendNode: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

In **`src/test/mp3-004-eq-volume.test.ts`**, find:

```ts
type MockEngine = { setVolume: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; loadBuffer: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      setVolume: vi.fn(), setEQ: vi.fn(), loadBuffer: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), seekTo: vi.fn(),
      setPlaybackRate: vi.fn(), stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

Replace with:

```ts
type MockEngine = { setVolume: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; loadBuffer: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; getCueSendNode: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      setVolume: vi.fn(), setEQ: vi.fn(), loadBuffer: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), seekTo: vi.fn(),
      setPlaybackRate: vi.fn(), stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(), getCueSendNode: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

In **`src/test/mp3-006-waveform.test.ts`**, find:

```ts
type MockEngine = { loadBuffer: ReturnType<typeof vi.fn>; primeScratch: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; setGain: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      loadBuffer: vi.fn(), primeScratch: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      seekTo: vi.fn(), setVolume: vi.fn(), setGain: vi.fn(), setEQ: vi.fn(), setPlaybackRate: vi.fn(),
      stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

Replace with:

```ts
type MockEngine = { loadBuffer: ReturnType<typeof vi.fn>; primeScratch: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; setGain: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; getCueSendNode: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      loadBuffer: vi.fn(), primeScratch: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      seekTo: vi.fn(), setVolume: vi.fn(), setGain: vi.fn(), setEQ: vi.fn(), setPlaybackRate: vi.fn(),
      stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(), getCueSendNode: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

In **`src/test/mp3-008-bpm.test.ts`**, find:

```ts
type MockEngine = { loadBuffer: ReturnType<typeof vi.fn>; primeScratch: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; setGain: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      loadBuffer: vi.fn(), primeScratch: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      seekTo: vi.fn(), setVolume: vi.fn(), setGain: vi.fn(), setEQ: vi.fn(), setPlaybackRate: vi.fn(),
      stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

Replace with:

```ts
type MockEngine = { loadBuffer: ReturnType<typeof vi.fn>; primeScratch: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; setGain: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; getCueSendNode: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      loadBuffer: vi.fn(), primeScratch: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      seekTo: vi.fn(), setVolume: vi.fn(), setGain: vi.fn(), setEQ: vi.fn(), setPlaybackRate: vi.fn(),
      stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(), getCueSendNode: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
```

- [ ] **Step 6: Run the full test suite to verify nothing else broke**

Run: `npm run test`
Expected: All test files pass (787+ tests). This confirms the 7 mock-file updates were sufficient and no other file needs the same treatment.

- [ ] **Step 7: Commit**

```bash
git add src/services/audioEngine.ts src/test/audioEngine.test.ts src/test/useAudioEngine.test.ts src/test/decode-error.test.ts src/test/mp3-003-transport.test.ts src/test/mp3-004-eq-volume.test.ts src/test/mp3-005-pitch.test.ts src/test/mp3-006-waveform.test.ts src/test/mp3-008-bpm.test.ts
git commit -m "feat: add per-deck headphone-cue send tap to AudioEngineImpl"
```

---

### Task 2: `cueEngine.ts` — lazily-initialized cue/program bus service

**Files:**
- Create: `src/services/cueEngine.ts`
- Test: `src/test/cueEngine.test.ts`

**Interfaces:**
- Consumes: `GainNode`/`AnalyserNode` instances (from Task 1's `AudioEngine.getCueSendNode()`/existing `getAnalyser()`), `getAudioContext()` from `src/services/audioContext.ts`.
- Produces: `cueEngine` object with `registerDeckCueSend(deckId, cueSendGain)`, `registerDeckProgramTap(deckId, analyser)`, `unregisterDeck(deckId)`, `setDeckCueEnabled(deckId, enabled)`, `setHeadphoneMix(mix)`, `setHeadphoneDeviceId(deviceId): Promise<void>`, `isOutputDeviceSelectionSupported(): boolean` — consumed by Tasks 3, 4, 5. Also exports `__resetCueEngineForTests()` (test-only).

- [ ] **Step 1: Write the failing test**

Create `src/test/cueEngine.test.ts`:

```ts
/**
 * cueEngine.test.ts — Unit tests for the headphone CUE/PFL routing service.
 *
 * registerDeckCueSend/registerDeckProgramTap/unregisterDeck are pure
 * bookkeeping and must never touch the AudioContext — every Deck-mounting
 * test in this codebase calls the register path unconditionally, so if it
 * touched getAudioContext() eagerly, it would break in jsdom (no real
 * AudioContext) for dozens of unrelated test files. Only setDeckCueEnabled /
 * setHeadphoneMix / setHeadphoneDeviceId — real user actions — trigger the
 * lazy graph creation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockContext = {
  createGain: vi.fn(),
  createMediaStreamDestination: vi.fn(),
  currentTime: 0,
};

function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn() } };
}

let mockCueBusGain: ReturnType<typeof makeMockGain>;
let mockProgramBusGain: ReturnType<typeof makeMockGain>;
let mockCueMixGain: ReturnType<typeof makeMockGain>;
let mockProgramMixGain: ReturnType<typeof makeMockGain>;
let mockHeadphoneOutGain: ReturnType<typeof makeMockGain>;
const mockMediaStreamDestination = { stream: {} };

function setupAudioContextMocks() {
  mockCueBusGain = makeMockGain();
  mockProgramBusGain = makeMockGain();
  mockCueMixGain = makeMockGain();
  mockProgramMixGain = makeMockGain();
  mockHeadphoneOutGain = makeMockGain();

  // createGain order inside ensureInitialized(): cueBus, programBus, cueMix, programMix, headphoneOut
  mockContext.createGain
    .mockReturnValueOnce(mockCueBusGain)
    .mockReturnValueOnce(mockProgramBusGain)
    .mockReturnValueOnce(mockCueMixGain)
    .mockReturnValueOnce(mockProgramMixGain)
    .mockReturnValueOnce(mockHeadphoneOutGain);

  mockContext.createMediaStreamDestination.mockReturnValue(mockMediaStreamDestination);
}

vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
}));

import { cueEngine, __resetCueEngineForTests } from '../services/cueEngine';

function makeFakeGainNode() {
  return { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
}
function makeFakeAnalyser() {
  return { connect: vi.fn(), disconnect: vi.fn() } as unknown as AnalyserNode;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetCueEngineForTests();
  mockContext.currentTime = 0;
  setupAudioContextMocks();
});

afterEach(() => {
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId;
});

describe('cueEngine — registration is pure bookkeeping', () => {
  it('registerDeckCueSend does not touch the AudioContext', () => {
    cueEngine.registerDeckCueSend('A', makeFakeGainNode());
    expect(mockContext.createGain).not.toHaveBeenCalled();
  });

  it('registerDeckProgramTap does not touch the AudioContext', () => {
    cueEngine.registerDeckProgramTap('A', makeFakeAnalyser());
    expect(mockContext.createGain).not.toHaveBeenCalled();
  });

  it('unregisterDeck is safe to call for a deck that was never registered', () => {
    expect(() => cueEngine.unregisterDeck('A')).not.toThrow();
  });
});

describe('cueEngine — setDeckCueEnabled', () => {
  it('lazily creates the bus graph on first call', () => {
    cueEngine.setDeckCueEnabled('A', true);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
    expect(mockContext.createMediaStreamDestination).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — does not recreate the graph on a second call', () => {
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('B', true);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
  });

  it('connects a registered deck send to the cue bus when enabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    expect(send.connect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('disconnects the deck send from the cue bus when disabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('A', false);
    expect(send.disconnect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('supports both decks cued simultaneously (summed into one bus)', () => {
    const sendA = makeFakeGainNode();
    const sendB = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', sendA);
    cueEngine.registerDeckCueSend('B', sendB);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('B', true);
    expect(sendA.connect).toHaveBeenCalledWith(mockCueBusGain);
    expect(sendB.connect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('does nothing (no throw) when the deck was never registered', () => {
    expect(() => cueEngine.setDeckCueEnabled('A', true)).not.toThrow();
  });
});

describe('cueEngine — registerDeckProgramTap catch-up on lazy init', () => {
  it('connects a program tap registered BEFORE init once any deck triggers init', () => {
    const analyser = makeFakeAnalyser();
    cueEngine.registerDeckProgramTap('A', analyser);
    expect(analyser.connect).not.toHaveBeenCalled();

    cueEngine.setDeckCueEnabled('B', true); // triggers lazy init via any deck's toggle
    expect(analyser.connect).toHaveBeenCalledWith(mockProgramBusGain);
  });

  it('connects a program tap registered AFTER init immediately', () => {
    cueEngine.setDeckCueEnabled('A', true); // triggers lazy init
    const analyser = makeFakeAnalyser();
    cueEngine.registerDeckProgramTap('B', analyser);
    expect(analyser.connect).toHaveBeenCalledWith(mockProgramBusGain);
  });

  it('does not auto-connect a cue send for a deck registered but never toggled on', () => {
    const sendA = makeFakeGainNode();
    const sendB = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', sendA);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.registerDeckCueSend('B', sendB);
    expect(sendB.connect).not.toHaveBeenCalled();
  });
});

describe('cueEngine — unregisterDeck', () => {
  it('disconnects a currently cue-enabled deck and forgets it', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.unregisterDeck('A');
    expect(send.disconnect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('is a no-op disconnect for a deck that was registered but never enabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    expect(() => cueEngine.unregisterDeck('A')).not.toThrow();
    expect(send.disconnect).not.toHaveBeenCalled();
  });
});

describe('cueEngine — setHeadphoneMix', () => {
  it('sets cueMixGain to (1 - mix) and programMixGain to mix', () => {
    cueEngine.setHeadphoneMix(0.3);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, 0, 0.01);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.3, 0, 0.01);
  });

  it('clamps values below 0 to 0', () => {
    cueEngine.setHeadphoneMix(-1);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
  });

  it('clamps values above 1 to 1', () => {
    cueEngine.setHeadphoneMix(2);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
  });

  it('triggers lazy init if called before any deck is cued', () => {
    cueEngine.setHeadphoneMix(0.5);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
  });
});

describe('cueEngine — setHeadphoneDeviceId', () => {
  it('calls setSinkId on the hidden audio element when supported', async () => {
    const mockSetSinkId = vi.fn().mockResolvedValue(undefined);
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = mockSetSinkId;

    await cueEngine.setHeadphoneDeviceId('device-123');

    expect(mockSetSinkId).toHaveBeenCalledWith('device-123');
  });

  it('passes an empty string to reset to the default device', async () => {
    const mockSetSinkId = vi.fn().mockResolvedValue(undefined);
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = mockSetSinkId;

    await cueEngine.setHeadphoneDeviceId(null);

    expect(mockSetSinkId).toHaveBeenCalledWith('');
  });

  it('does nothing when setSinkId is unsupported (jsdom default)', async () => {
    await expect(cueEngine.setHeadphoneDeviceId('device-123')).resolves.toBeUndefined();
  });
});

describe('cueEngine — isOutputDeviceSelectionSupported', () => {
  it('returns false when HTMLMediaElement.prototype has no setSinkId (jsdom default)', () => {
    expect(cueEngine.isOutputDeviceSelectionSupported()).toBe(false);
  });

  it('returns true when setSinkId exists on HTMLMediaElement.prototype', () => {
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = vi.fn();
    expect(cueEngine.isOutputDeviceSelectionSupported()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/cueEngine.test.ts`
Expected: FAIL — `Cannot find module '../services/cueEngine'`.

- [ ] **Step 3: Implement `src/services/cueEngine.ts`**

```ts
/**
 * cueEngine.ts — Headphone CUE/PFL routing service.
 *
 * Owns a single, lazily-created shared Web Audio node graph that lets a DJ
 * monitor cued deck(s) and/or the main program mix through headphones,
 * routed to a chosen output device via MediaStreamAudioDestinationNode +
 * HTMLMediaElement.setSinkId() (AudioContext.destination itself cannot be
 * redirected to a specific device — only a media element's stream can be).
 *
 * Lazy by design: nothing here touches AudioContext until a real cue-related
 * action happens (a deck's CUE toggled on, the MIX knob moved, or a device
 * picked). registerDeckCueSend/registerDeckProgramTap/unregisterDeck are pure
 * bookkeeping, so they're safe to call unconditionally from every deck's
 * mount/unmount effect — including in test environments with no real
 * AudioContext.
 */
import { getAudioContext } from './audioContext';

type DeckId = 'A' | 'B';

let initialized = false;
let cueBusGain: GainNode;
let programBusGain: GainNode;
let cueMixGain: GainNode;
let programMixGain: GainNode;
let headphoneOutGain: GainNode;
let audioEl: HTMLAudioElement;

const deckCueSends = new Map<DeckId, GainNode>();
const deckAnalysers = new Map<DeckId, AnalyserNode>();
const deckCueEnabled = new Map<DeckId, boolean>();

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  const context = getAudioContext();
  cueBusGain = context.createGain();
  programBusGain = context.createGain();
  cueMixGain = context.createGain();
  programMixGain = context.createGain();
  headphoneOutGain = context.createGain();

  cueBusGain.connect(cueMixGain);
  programBusGain.connect(programMixGain);
  cueMixGain.connect(headphoneOutGain);
  programMixGain.connect(headphoneOutGain);

  const mediaStreamDestination = context.createMediaStreamDestination();
  headphoneOutGain.connect(mediaStreamDestination);

  audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.srcObject = mediaStreamDestination.stream;

  // Connect anything registered before this lazy init fired.
  for (const analyser of deckAnalysers.values()) {
    analyser.connect(programBusGain);
  }
  for (const [deckId, enabled] of deckCueEnabled) {
    if (!enabled) continue;
    const send = deckCueSends.get(deckId);
    if (send) send.connect(cueBusGain);
  }
}

/** Feature-detect setSinkId support (absent in Firefox/Safari as of this writing). */
function isOutputDeviceSelectionSupported(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

export const cueEngine = {
  /** Register a deck's pre-fader cue-send node. Pure bookkeeping — safe on every deck mount. */
  registerDeckCueSend(deckId: DeckId, cueSendGain: GainNode): void {
    deckCueSends.set(deckId, cueSendGain);
  },

  /** Register a deck's final analyser node as a program-bus tap. Pure bookkeeping — safe on every deck mount. */
  registerDeckProgramTap(deckId: DeckId, analyser: AnalyserNode): void {
    deckAnalysers.set(deckId, analyser);
    if (initialized) analyser.connect(programBusGain);
  },

  /** Unregister a deck on unmount — disconnects its cue send if currently live, then forgets it. */
  unregisterDeck(deckId: DeckId): void {
    const send = deckCueSends.get(deckId);
    if (initialized && send && deckCueEnabled.get(deckId)) {
      try { send.disconnect(cueBusGain); } catch { /* already disconnected */ }
    }
    deckCueSends.delete(deckId);
    deckAnalysers.delete(deckId);
    deckCueEnabled.delete(deckId);
  },

  /** Enable/disable a deck's CUE send into the shared cue bus. Triggers lazy init. */
  setDeckCueEnabled(deckId: DeckId, enabled: boolean): void {
    ensureInitialized();
    deckCueEnabled.set(deckId, enabled);
    const send = deckCueSends.get(deckId);
    if (!send) return;
    if (enabled) {
      send.connect(cueBusGain);
    } else {
      try { send.disconnect(cueBusGain); } catch { /* already disconnected */ }
    }
  },

  /** Set the headphone MIX blend: 0 = full cue, 1 = full program. Triggers lazy init. */
  setHeadphoneMix(mix: number): void {
    ensureInitialized();
    const clamped = Math.max(0, Math.min(1, mix));
    const now = getAudioContext().currentTime;
    cueMixGain.gain.setTargetAtTime(1 - clamped, now, 0.01);
    programMixGain.gain.setTargetAtTime(clamped, now, 0.01);
  },

  /** Route the cue/program blend to a specific output device (setSinkId), or the default if deviceId is null. Triggers lazy init. */
  async setHeadphoneDeviceId(deviceId: string | null): Promise<void> {
    ensureInitialized();
    if (!isOutputDeviceSelectionSupported()) return;
    await (audioEl as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId ?? '');
  },

  isOutputDeviceSelectionSupported,
};

/** Test-only: resets all module-level state between test cases. Never called by production code. */
export function __resetCueEngineForTests(): void {
  initialized = false;
  deckCueSends.clear();
  deckAnalysers.clear();
  deckCueEnabled.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/cueEngine.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/cueEngine.ts src/test/cueEngine.test.ts
git commit -m "feat: add cueEngine — lazily-initialized headphone CUE/program bus"
```

---

### Task 3: Wire `cueEngine` registration into `useAudioEngine.ts`

**Files:**
- Modify: `src/hooks/useAudioEngine.ts`
- Modify: `src/test/useAudioEngine.test.ts`

**Interfaces:**
- Consumes: `cueEngine.registerDeckCueSend`, `cueEngine.registerDeckProgramTap`, `cueEngine.unregisterDeck` (Task 2), `engine.getCueSendNode()` (Task 1), `engine.getAnalyser()` (existing).
- Produces: nothing new — this task only wires existing pieces together.

- [ ] **Step 1: Write the failing test**

In `src/test/useAudioEngine.test.ts`, find the mock declarations near the top (after the `MockAudioEngine` interface/`makeMockEngine` block from Task 1) and the `playerRegistry` mock:

```ts
vi.mock('../services/playerRegistry', () => ({
  playerRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
  },
}));
```

Add a new mock right after it:

```ts
vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    registerDeckCueSend: vi.fn(),
    registerDeckProgramTap: vi.fn(),
    unregisterDeck: vi.fn(),
    setDeckCueEnabled: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
    isOutputDeviceSelectionSupported: vi.fn(),
  },
}));
```

Then, in `makeMockEngine()`, upgrade the two node-returning methods to return stable, distinguishable fake nodes so the wiring can be asserted by reference (not just "both are undefined"). Find:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    getCueSendNode: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
```

Replace with:

```ts
    setEQ: vi.fn(),
    getAnalyser: vi.fn().mockReturnValue({} as AnalyserNode),
    getCueSendNode: vi.fn().mockReturnValue({} as GainNode),
    isReady: vi.fn().mockReturnValue(true),
```

Add the import (after the other late-import comment, alongside the hook import):

```ts
import { useAudioEngine } from '../hooks/useAudioEngine';
import { cueEngine } from '../services/cueEngine';
```

Add a new describe block anywhere after the existing lifecycle tests:

```ts
describe('useAudioEngine — cue engine registration', () => {
  it('registers the deck cue-send node and program tap on mount', () => {
    renderHook(() => useAudioEngine('A'));
    const engine = mockEngineInstances[0]!;

    expect(cueEngine.registerDeckCueSend).toHaveBeenCalledWith('A', engine.getCueSendNode());
    expect(cueEngine.registerDeckProgramTap).toHaveBeenCalledWith('A', engine.getAnalyser());
  });

  it('unregisters the deck from cueEngine on unmount', () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    unmount();
    expect(cueEngine.unregisterDeck).toHaveBeenCalledWith('A');
  });

  it('registers independently per deck', () => {
    renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));
    expect(cueEngine.registerDeckCueSend).toHaveBeenCalledWith('A', expect.anything());
    expect(cueEngine.registerDeckCueSend).toHaveBeenCalledWith('B', expect.anything());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/useAudioEngine.test.ts`
Expected: FAIL — `cueEngine.registerDeckCueSend` was not called (the hook doesn't wire it up yet).

- [ ] **Step 3: Wire `cueEngine` into `useAudioEngine.ts`'s engine-creation effect**

Find the imports at the top of `src/hooks/useAudioEngine.ts`:

```ts
import { useRef, useEffect } from 'react';
import { AudioEngineImpl } from '../services/audioEngine';
import { decodeAudioFile } from '../services/audioDecoder';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';
```

Replace with:

```ts
import { useRef, useEffect } from 'react';
import { AudioEngineImpl } from '../services/audioEngine';
import { decodeAudioFile } from '../services/audioDecoder';
import { playerRegistry } from '../services/playerRegistry';
import { cueEngine } from '../services/cueEngine';
import { useDeckStore } from '../store/deckStore';
```

Find the engine-creation effect:

```ts
  // ── 1. Create / Destroy ───────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const engine = new AudioEngineImpl();
    engineRef.current = engine;
    playerRegistry.register(deckId, engine);

    engine.onEnded(() => {
      if (!isMountedRef.current) return;
      useDeckStore.getState().setPlaybackState(deckId, 'ended');
      const { playlists, currentIndex, skipToNext } = usePlaylistStore.getState();
      if (currentIndex[deckId] < playlists[deckId].length - 1) skipToNext(deckId);
    });

    return () => {
      isMountedRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      playerRegistry.unregister(deckId);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Replace with:

```ts
  // ── 1. Create / Destroy ───────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const engine = new AudioEngineImpl();
    engineRef.current = engine;
    playerRegistry.register(deckId, engine);
    cueEngine.registerDeckCueSend(deckId, engine.getCueSendNode());
    cueEngine.registerDeckProgramTap(deckId, engine.getAnalyser());

    engine.onEnded(() => {
      if (!isMountedRef.current) return;
      useDeckStore.getState().setPlaybackState(deckId, 'ended');
      const { playlists, currentIndex, skipToNext } = usePlaylistStore.getState();
      if (currentIndex[deckId] < playlists[deckId].length - 1) skipToNext(deckId);
    });

    return () => {
      isMountedRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      cueEngine.unregisterDeck(deckId);
      playerRegistry.unregister(deckId);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/useAudioEngine.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAudioEngine.ts src/test/useAudioEngine.test.ts
git commit -m "feat: register each deck's cue-send/program-tap with cueEngine on mount"
```

---

### Task 4: `deckStore` — per-deck `cueEnabled` + `toggleCue`

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-cue.test.ts` (new)

**Interfaces:**
- Consumes: `cueEngine.setDeckCueEnabled(deckId, enabled)` (Task 2).
- Produces: `DeckState.cueEnabled: boolean`, `useDeckActions().toggleCue(deckId): void` — consumed by Task 6 (EQPanel CUE button).

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-cue.test.ts`:

```ts
/**
 * deck-cue.test.ts — Phase 4: per-deck headphone CUE toggle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setDeckCueEnabled: vi.fn(),
    registerDeckCueSend: vi.fn(),
    registerDeckProgramTap: vi.fn(),
    unregisterDeck: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
    isOutputDeviceSelectionSupported: vi.fn(),
  },
}));

import { cueEngine } from '../services/cueEngine';

beforeEach(() => {
  vi.clearAllMocks();
  useDeckStore.getState().clearTrack('A');
  useDeckStore.getState().clearTrack('B');
});

describe('deckStore — cueEnabled default', () => {
  it('defaults to false for both decks', () => {
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
    expect(useDeckStore.getState().decks.B.cueEnabled).toBe(false);
  });
});

describe('deckStore — toggleCue', () => {
  it('flips cueEnabled from false to true', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);
  });

  it('flips cueEnabled from true back to false', () => {
    useDeckStore.getState().toggleCue('A');
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });

  it('calls cueEngine.setDeckCueEnabled with the new value', () => {
    useDeckStore.getState().toggleCue('A');
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', true);
    useDeckStore.getState().toggleCue('A');
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', false);
  });

  it('does not affect the other deck', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.B.cueEnabled).toBe(false);
  });
});

describe('deckStore — cueEnabled resets on loadTrack/clearTrack', () => {
  it('resets to false on loadTrack when it was previously true', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);

    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });

  it('does NOT call cueEngine.setDeckCueEnabled on loadTrack when cueEnabled was already false', () => {
    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(cueEngine.setDeckCueEnabled).not.toHaveBeenCalled();
  });

  it('calls cueEngine.setDeckCueEnabled(false) on loadTrack when cueEnabled was true', () => {
    useDeckStore.getState().toggleCue('A');
    vi.clearAllMocks();
    useDeckStore.getState().loadTrack('A', 't2', { title: 'T2', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', false);
  });

  it('resets to false on clearTrack when it was previously true', () => {
    useDeckStore.getState().toggleCue('A');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/deck-cue.test.ts`
Expected: FAIL — `useDeckStore.getState().toggleCue is not a function`, and `cueEnabled` is `undefined`.

- [ ] **Step 3: Add the `cueEnabled` field to `DeckState`**

In `src/types/deck.ts`, find:

```ts
  /**
   * True while a jog-wheel scratch gesture is in progress. Reset to false
   * on loadTrack/clearTrack (unlike vinylMode, which persists).
   */
  scratching: boolean;
```

Replace with:

```ts
  /**
   * True while a jog-wheel scratch gesture is in progress. Reset to false
   * on loadTrack/clearTrack (unlike vinylMode, which persists).
   */
  scratching: boolean;

  /**
   * True while this deck's audio is routed into the shared headphone CUE
   * bus (pre-fader listen, independent of the channel fader/crossfader/EQ).
   * Resets to false on loadTrack/clearTrack, like scratching — a per-session
   * monitoring toggle, not a persisted hardware-style setting like vinylMode.
   */
  cueEnabled: boolean;
```

- [ ] **Step 4: Implement `toggleCue` and the resets in `deckStore.ts`**

Find the import block at the top:

```ts
import { transition, type TransportEvent } from '../utils/transport';
import { consumePendingGrid, consumePendingLoop } from '../services/sessionStore';
```

Replace with:

```ts
import { transition, type TransportEvent } from '../utils/transport';
import { consumePendingGrid, consumePendingLoop } from '../services/sessionStore';
import { cueEngine } from '../services/cueEngine';
```

In `createInitialDeckState`, find:

```ts
    vinylMode: true,
    scratching: false,
    eqKillLow: false,
```

Replace with:

```ts
    vinylMode: true,
    scratching: false,
    cueEnabled: false,
    eqKillLow: false,
```

In the `DeckStoreActions` interface, find:

```ts
  /** Enable or disable VINYL scratch mode for the specified deck's jog wheel. Persists across track loads (like padMode); forces any in-progress scratch to end when disabled. */
  setVinylMode: (deckId: 'A' | 'B', enabled: boolean) => void;
```

Replace with:

```ts
  /** Enable or disable VINYL scratch mode for the specified deck's jog wheel. Persists across track loads (like padMode); forces any in-progress scratch to end when disabled. */
  setVinylMode: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Toggle headphone CUE (pre-fader listen) for the specified deck. Both decks can be cued simultaneously. */
  toggleCue: (deckId: 'A' | 'B') => void;
```

In the `loadTrack` action, find:

```ts
  loadTrack: (deckId, trackId, { title, artist, duration, thumbnailUrl }, autoPlay = false) => {
    updateDeck(set, deckId, {
      trackId,
      title,
      artist,
      duration,
      thumbnailUrl,
      currentTime: 0,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      // Hot cues are keyed by trackId, persisted in localStorage.
      hotCues: getHotCues(trackId),
      error: null,
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: autoPlay,
      scratching: false,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
```

Replace with:

```ts
  loadTrack: (deckId, trackId, { title, artist, duration, thumbnailUrl }, autoPlay = false) => {
    if (get().decks[deckId].cueEnabled) {
      cueEngine.setDeckCueEnabled(deckId, false);
    }
    updateDeck(set, deckId, {
      trackId,
      title,
      artist,
      duration,
      thumbnailUrl,
      currentTime: 0,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      // Hot cues are keyed by trackId, persisted in localStorage.
      hotCues: getHotCues(trackId),
      error: null,
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: autoPlay,
      scratching: false,
      cueEnabled: false,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
```

In the `clearTrack` action, find:

```ts
  clearTrack: (deckId) => {
    updateDeck(set, deckId, {
      trackId: null,
      title: '',
      artist: '',
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      duration: 0,
      currentTime: 0,
      thumbnailUrl: null,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
      sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
      hotCues: {},
      error: null,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: false,
      scratching: false,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
  },
```

Replace with:

```ts
  clearTrack: (deckId) => {
    if (get().decks[deckId].cueEnabled) {
      cueEngine.setDeckCueEnabled(deckId, false);
    }
    updateDeck(set, deckId, {
      trackId: null,
      title: '',
      artist: '',
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      duration: 0,
      currentTime: 0,
      thumbnailUrl: null,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
      sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
      hotCues: {},
      error: null,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: false,
      scratching: false,
      cueEnabled: false,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
  },
```

Find the `setVinylMode` implementation:

```ts
  setVinylMode: (deckId, enabled) => {
    if (!enabled && get().decks[deckId].scratching) {
      get().endScratch(deckId);
    }
    updateDeck(set, deckId, { vinylMode: enabled });
  },
```

Replace with:

```ts
  setVinylMode: (deckId, enabled) => {
    if (!enabled && get().decks[deckId].scratching) {
      get().endScratch(deckId);
    }
    updateDeck(set, deckId, { vinylMode: enabled });
  },

  toggleCue: (deckId) => {
    const enabled = !get().decks[deckId].cueEnabled;
    cueEngine.setDeckCueEnabled(deckId, enabled);
    updateDeck(set, deckId, { cueEnabled: enabled });
  },
```

In `useDeckActions()`, find:

```ts
      setVinylMode: s.setVinylMode, beginScratch: s.beginScratch, endScratch: s.endScratch,
      dispatchTransport: s.dispatchTransport, syncToDeck: s.syncToDeck, beatJump: s.beatJump,
```

Replace with:

```ts
      setVinylMode: s.setVinylMode, beginScratch: s.beginScratch, endScratch: s.endScratch,
      dispatchTransport: s.dispatchTransport, syncToDeck: s.syncToDeck, beatJump: s.beatJump,
      toggleCue: s.toggleCue,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/deck-cue.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: All tests pass — the `get().decks[deckId].cueEnabled` guard means `loadTrack`/`clearTrack` never call `cueEngine` for any pre-existing test (none of them ever set `cueEnabled` to `true`).

- [ ] **Step 7: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-cue.test.ts
git commit -m "feat: add deckStore cueEnabled state + toggleCue action"
```

---

### Task 5: `settingsStore` — headphone MIX, device, and label-unlock state

**Files:**
- Modify: `src/store/settingsStore.ts`
- Modify: `src/test/settings-store.test.ts`

**Interfaces:**
- Consumes: `cueEngine.setHeadphoneMix(mix)`, `cueEngine.setHeadphoneDeviceId(deviceId)` (Task 2).
- Produces: `settingsStore.headphoneMix`, `.headphoneDeviceId`, `.availableOutputDevices`, `.outputDeviceLabelsUnlocked` + their setter actions — consumed by Task 7 (HeadphoneMixKnob) and Task 8 (device picker).

- [ ] **Step 1: Write the failing tests**

In `src/test/settings-store.test.ts`, find the imports:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
```

Replace with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn().mockResolvedValue(undefined),
  },
}));
```

Find the `beforeEach`:

```ts
beforeEach(() => {
  localStorage.clear();

  // Reset the module-singleton store to known state without re-importing
  // (avoids import() overhead for non-hydration tests)
  import('../store/settingsStore').then(({ useSettingsStore }) => {
    useSettingsStore.setState({ masterVolume: 100, isSettingsOpen: false });
  });
});
```

Replace with:

```ts
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();

  // Reset the module-singleton store to known state without re-importing
  // (avoids import() overhead for non-hydration tests)
  import('../store/settingsStore').then(({ useSettingsStore }) => {
    useSettingsStore.setState({
      masterVolume: 100,
      isSettingsOpen: false,
      headphoneMix: 0.5,
      headphoneDeviceId: null,
      availableOutputDevices: [],
      outputDeviceLabelsUnlocked: false,
    });
  });
});
```

Add these new describe blocks anywhere after the existing `'settingsStore — initial state'` block:

```ts
describe('settingsStore — initial state (Phase 4 fields)', () => {
  it('defaults headphoneMix to 0.5', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().headphoneMix).toBe(0.5);
  });

  it('defaults headphoneDeviceId to null', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().headphoneDeviceId).toBeNull();
  });

  it('defaults availableOutputDevices to an empty array', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().availableOutputDevices).toEqual([]);
  });

  it('defaults outputDeviceLabelsUnlocked to false', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(false);
  });
});

describe('settingsStore — setHeadphoneMix', () => {
  it('updates headphoneMix to the given value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneMix(0.8); });
    expect(useSettingsStore.getState().headphoneMix).toBe(0.8);
  });

  it('clamps values above 1 to 1', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneMix(1.5); });
    expect(useSettingsStore.getState().headphoneMix).toBe(1);
  });

  it('clamps values below 0 to 0', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneMix(-0.5); });
    expect(useSettingsStore.getState().headphoneMix).toBe(0);
  });

  it('calls cueEngine.setHeadphoneMix with the clamped value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    const { cueEngine } = await import('../services/cueEngine');
    act(() => { useSettingsStore.getState().setHeadphoneMix(1.5); });
    expect(cueEngine.setHeadphoneMix).toHaveBeenCalledWith(1);
  });

  it('persists headphoneMix to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneMix(0.25); });
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { headphoneMix: number };
    expect(parsed.headphoneMix).toBe(0.25);
  });

  it('does not clobber masterVolume when persisting', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setMasterVolume(42); });
    act(() => { useSettingsStore.getState().setHeadphoneMix(0.9); });
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { masterVolume: number; headphoneMix: number };
    expect(parsed.masterVolume).toBe(42);
    expect(parsed.headphoneMix).toBe(0.9);
  });
});

describe('settingsStore — setHeadphoneDeviceId', () => {
  it('updates headphoneDeviceId to the given value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneDeviceId('device-abc'); });
    expect(useSettingsStore.getState().headphoneDeviceId).toBe('device-abc');
  });

  it('accepts null to reset to the default device', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneDeviceId('device-abc'); });
    act(() => { useSettingsStore.getState().setHeadphoneDeviceId(null); });
    expect(useSettingsStore.getState().headphoneDeviceId).toBeNull();
  });

  it('calls cueEngine.setHeadphoneDeviceId with the given id', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    const { cueEngine } = await import('../services/cueEngine');
    act(() => { useSettingsStore.getState().setHeadphoneDeviceId('device-xyz'); });
    expect(cueEngine.setHeadphoneDeviceId).toHaveBeenCalledWith('device-xyz');
  });

  it('persists headphoneDeviceId to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setHeadphoneDeviceId('device-abc'); });
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { headphoneDeviceId: string | null };
    expect(parsed.headphoneDeviceId).toBe('device-abc');
  });
});

describe('settingsStore — setAvailableOutputDevices', () => {
  it('updates availableOutputDevices', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    const devices = [{ deviceId: 'd1', label: 'Speakers', kind: 'audiooutput', groupId: 'g1' }] as MediaDeviceInfo[];
    act(() => { useSettingsStore.getState().setAvailableOutputDevices(devices); });
    expect(useSettingsStore.getState().availableOutputDevices).toEqual(devices);
  });

  it('does not persist availableOutputDevices to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    const devices = [{ deviceId: 'd1', label: 'Speakers', kind: 'audiooutput', groupId: 'g1' }] as MediaDeviceInfo[];
    act(() => { useSettingsStore.getState().setAvailableOutputDevices(devices); });
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect('availableOutputDevices' in parsed).toBe(false);
    }
  });
});

describe('settingsStore — setOutputDeviceLabelsUnlocked', () => {
  it('updates outputDeviceLabelsUnlocked to true', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setOutputDeviceLabelsUnlocked(true); });
    expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(true);
  });

  it('persists outputDeviceLabelsUnlocked to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    act(() => { useSettingsStore.getState().setOutputDeviceLabelsUnlocked(true); });
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { outputDeviceLabelsUnlocked: boolean };
    expect(parsed.outputDeviceLabelsUnlocked).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/settings-store.test.ts`
Expected: FAIL — `useSettingsStore.getState().setHeadphoneMix is not a function`, etc.

- [ ] **Step 3: Implement the new state/actions in `settingsStore.ts`**

Replace the entire contents of `src/store/settingsStore.ts` with:

```ts
/**
 * settingsStore.ts — Zustand store for app-level settings.
 *
 * STORY-013 implementation; extended in Phase 4 for headphone CUE settings.
 *
 * State:
 *   - masterVolume (0–100, default 100) — scales effective output of both decks
 *   - isSettingsOpen — controls Settings Modal visibility
 *   - headphoneMix (0–1, default 0.5) — headphone CUE/program blend (0 = full cue, 1 = full program)
 *   - headphoneDeviceId — selected headphone output device, or null for the browser default
 *   - availableOutputDevices — audiooutput devices, re-enumerated each time the picker opens (not persisted)
 *   - outputDeviceLabelsUnlocked — whether mic permission has been granted, unlocking real device labels
 *
 * masterVolume/headphoneMix/headphoneDeviceId/outputDeviceLabelsUnlocked are
 * persisted to localStorage under the key 'dj-rusty-settings'. isSettingsOpen
 * and availableOutputDevices are ephemeral (not persisted).
 */
import { create } from 'zustand';
import { cueEngine } from '../services/cueEngine';

const STORAGE_KEY = 'dj-rusty-settings';

/** Shape persisted to localStorage. */
interface PersistedSettings {
  masterVolume: number;
  headphoneMix: number;
  headphoneDeviceId: string | null;
  outputDeviceLabelsUnlocked: boolean;
}

interface SettingsState {
  /** Master output volume scalar (0–100). Default: 100. */
  masterVolume: number;
  /** Whether the Settings Modal is currently visible. */
  isSettingsOpen: boolean;
  /** Headphone CUE/program blend: 0 = full cue, 1 = full program. Default: 0.5. */
  headphoneMix: number;
  /** Selected headphone output device ID, or null for the browser default. */
  headphoneDeviceId: string | null;
  /** Available audio output devices — re-enumerated each time the picker opens. Not persisted. */
  availableOutputDevices: MediaDeviceInfo[];
  /** Whether mic permission has been granted, unlocking real output-device labels. */
  outputDeviceLabelsUnlocked: boolean;
}

interface SettingsStoreActions {
  /** Set master volume (clamped to 0–100) and persist to localStorage. */
  setMasterVolume: (vol: number) => void;
  /** Open the Settings Modal. */
  openSettings: () => void;
  /** Close the Settings Modal. */
  closeSettings: () => void;
  /** Set the headphone CUE/program blend (clamped to 0–1), apply it via cueEngine, and persist it. */
  setHeadphoneMix: (mix: number) => void;
  /** Set the selected headphone output device, apply it via cueEngine, and persist it. */
  setHeadphoneDeviceId: (deviceId: string | null) => void;
  /** Set the list of available audio output devices (not persisted). */
  setAvailableOutputDevices: (devices: MediaDeviceInfo[]) => void;
  /** Record whether mic permission has been granted, unlocking device labels, and persist it. */
  setOutputDeviceLabelsUnlocked: (unlocked: boolean) => void;
}

type SettingsStore = SettingsState & SettingsStoreActions;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadPersistedSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function savePersistedSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors — settings will just reset on next load
  }
}

// ---------------------------------------------------------------------------
// Initial state — hydrate from localStorage if available
// ---------------------------------------------------------------------------

const persisted = loadPersistedSettings();

const INITIAL_STATE: SettingsState = {
  masterVolume: typeof persisted.masterVolume === 'number'
    ? Math.max(0, Math.min(100, persisted.masterVolume))
    : 100,
  isSettingsOpen: false,
  headphoneMix: typeof persisted.headphoneMix === 'number'
    ? Math.max(0, Math.min(1, persisted.headphoneMix))
    : 0.5,
  headphoneDeviceId: typeof persisted.headphoneDeviceId === 'string' ? persisted.headphoneDeviceId : null,
  availableOutputDevices: [],
  outputDeviceLabelsUnlocked: persisted.outputDeviceLabelsUnlocked === true,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...INITIAL_STATE,

  setMasterVolume: (vol) => {
    const clamped = Math.max(0, Math.min(100, vol));
    savePersistedSettings({
      masterVolume: clamped,
      headphoneMix: get().headphoneMix,
      headphoneDeviceId: get().headphoneDeviceId,
      outputDeviceLabelsUnlocked: get().outputDeviceLabelsUnlocked,
    });
    set({ masterVolume: clamped });
  },

  openSettings: () => {
    set({ isSettingsOpen: true });
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },

  setHeadphoneMix: (mix) => {
    const clamped = Math.max(0, Math.min(1, mix));
    cueEngine.setHeadphoneMix(clamped);
    savePersistedSettings({
      masterVolume: get().masterVolume,
      headphoneMix: clamped,
      headphoneDeviceId: get().headphoneDeviceId,
      outputDeviceLabelsUnlocked: get().outputDeviceLabelsUnlocked,
    });
    set({ headphoneMix: clamped });
  },

  setHeadphoneDeviceId: (deviceId) => {
    void cueEngine.setHeadphoneDeviceId(deviceId);
    savePersistedSettings({
      masterVolume: get().masterVolume,
      headphoneMix: get().headphoneMix,
      headphoneDeviceId: deviceId,
      outputDeviceLabelsUnlocked: get().outputDeviceLabelsUnlocked,
    });
    set({ headphoneDeviceId: deviceId });
  },

  setAvailableOutputDevices: (devices) => {
    set({ availableOutputDevices: devices });
  },

  setOutputDeviceLabelsUnlocked: (unlocked) => {
    savePersistedSettings({
      masterVolume: get().masterVolume,
      headphoneMix: get().headphoneMix,
      headphoneDeviceId: get().headphoneDeviceId,
      outputDeviceLabelsUnlocked: unlocked,
    });
    set({ outputDeviceLabelsUnlocked: unlocked });
  },
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/settings-store.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/settingsStore.ts src/test/settings-store.test.ts
git commit -m "feat: add settingsStore headphone MIX/device/label-unlock state"
```

---

### Task 6: CUE toggle button in `EQPanel`

**Files:**
- Modify: `src/components/Mixer/EQPanel.tsx`
- Modify: `src/components/Mixer/EQPanel.module.css`
- Modify: `src/test/EQPanel.test.tsx`

**Interfaces:**
- Consumes: `useDeckActions().toggleCue` and `DeckState.cueEnabled` (Task 4).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/test/EQPanel.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EQPanel } from '../components/Mixer/EQPanel';
import { useDeckStore } from '../store/deckStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setDeckCueEnabled: vi.fn(),
    registerDeckCueSend: vi.fn(),
    registerDeckProgramTap: vi.fn(),
    unregisterDeck: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
    isOutputDeviceSelectionSupported: vi.fn(),
  },
}));

beforeEach(() => {
  useDeckStore.setState({
    decks: {
      ...useDeckStore.getState().decks,
      A: { ...useDeckStore.getState().decks['A'], eqLow: 0, eqMid: 0, eqHigh: 0, eqKillLow: false, eqKillMid: false, eqKillHigh: false, filterSweep: 0, cueEnabled: false },
    },
  });
});

describe('EQPanel (Mixer-hosted)', () => {
  it('renders BASS, MID, TREBLE, and FILTER controls for the given deck', () => {
    render(<EQPanel deckId="A" />);
    expect(screen.getByLabelText('Deck A BASS EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A MID EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A TREBLE EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A filter sweep: FLAT')).toBeInTheDocument();
  });

  it('renders independently for deck B without cross-talk', () => {
    render(<EQPanel deckId="B" />);
    expect(screen.getByLabelText('Deck B BASS EQ: 0 dB')).toBeInTheDocument();
    expect(screen.queryByLabelText('Deck A BASS EQ: 0 dB')).not.toBeInTheDocument();
  });
});

describe('EQPanel — CUE toggle', () => {
  it('renders the CUE button unpressed by default', () => {
    render(<EQPanel deckId="A" />);
    expect(screen.getByRole('button', { name: /headphone cue for deck a/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles cueEnabled in the store when clicked', () => {
    render(<EQPanel deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /headphone cue for deck a/i }));
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);
  });

  it('reflects aria-pressed after toggling on', () => {
    render(<EQPanel deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /headphone cue for deck a/i }));
    expect(screen.getByRole('button', { name: /headphone cue for deck a/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/EQPanel.test.tsx`
Expected: FAIL — no element with accessible name matching `/headphone cue for deck a/i`.

- [ ] **Step 3: Add the CUE button to `EQPanel.tsx`**

Find:

```tsx
export function EQPanel({ deckId }: EQPanelProps) {
  const { setEq, setEqKill, setFilterSweep } = useDeckActions();
  const { eqLow, eqMid, eqHigh, eqKillLow, eqKillMid, eqKillHigh, filterSweep } =
    useDeckStore(
      useShallow((s) => {
        const d = s.decks[deckId];
        return {
          eqLow: d.eqLow,
          eqMid: d.eqMid,
          eqHigh: d.eqHigh,
          eqKillLow: d.eqKillLow,
          eqKillMid: d.eqKillMid,
          eqKillHigh: d.eqKillHigh,
          filterSweep: d.filterSweep,
        };
      }),
    );
```

Replace with:

```tsx
export function EQPanel({ deckId }: EQPanelProps) {
  const { setEq, setEqKill, setFilterSweep, toggleCue } = useDeckActions();
  const { eqLow, eqMid, eqHigh, eqKillLow, eqKillMid, eqKillHigh, filterSweep, cueEnabled } =
    useDeckStore(
      useShallow((s) => {
        const d = s.decks[deckId];
        return {
          eqLow: d.eqLow,
          eqMid: d.eqMid,
          eqHigh: d.eqHigh,
          eqKillLow: d.eqKillLow,
          eqKillMid: d.eqKillMid,
          eqKillHigh: d.eqKillHigh,
          filterSweep: d.filterSweep,
          cueEnabled: d.cueEnabled,
        };
      }),
    );
```

Find the closing of the component's JSX:

```tsx
        <FilterSweepKnob
          deckId={deckId}
          value={filterSweep}
          onChange={handleFilterSweep}
        />
      </div>
    </div>
  );
}
```

Replace with:

```tsx
        <FilterSweepKnob
          deckId={deckId}
          value={filterSweep}
          onChange={handleFilterSweep}
        />
      </div>
      <button
        type="button"
        className={`${styles.cueBtn} ${cueEnabled ? styles.cueBtnActive : ''}`}
        aria-label={`Headphone cue for Deck ${deckId}`}
        aria-pressed={cueEnabled}
        onClick={() => toggleCue(deckId)}
        title="CUE — monitor this deck in headphones (pre-fader listen)"
      >
        CUE
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add CUE button styles to `EQPanel.module.css`**

Append to the end of `src/components/Mixer/EQPanel.module.css`:

```css

/* CUE toggle — headphone pre-fader listen (Phase 4) */
.cueBtn {
  margin-top: var(--space-2);
  width: 100%;
  height: 24px;
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: var(--radius-md);
  color: #888888;
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-primary);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.cueBtn:hover {
  background: #242424;
  border-color: #555555;
  color: #aaaaaa;
}

.cueBtn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.cueBtnActive {
  background: #0a2a2a;
  border: 1px solid #2a8a8a;
  color: #4ad4d4;
}

.cueBtnActive:hover {
  background: #0f3535;
  border-color: #3a9a9a;
  color: #5ae4e4;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/EQPanel.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Mixer/EQPanel.tsx src/components/Mixer/EQPanel.module.css src/test/EQPanel.test.tsx
git commit -m "feat: add CUE toggle button to EQPanel"
```

---

### Task 7: `HeadphoneMixKnob` component + `Mixer.tsx` wiring

**Files:**
- Create: `src/components/Mixer/HeadphoneMixKnob.tsx`
- Create: `src/components/Mixer/HeadphoneMixKnob.module.css`
- Test: `src/test/HeadphoneMixKnob.test.tsx` (new)
- Modify: `src/components/Mixer/Mixer.tsx`

**Interfaces:**
- Consumes: `settingsStore.headphoneMix` / `.setHeadphoneMix` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `src/test/HeadphoneMixKnob.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeadphoneMixKnob } from '../components/Mixer/HeadphoneMixKnob';
import { useSettingsStore } from '../store/settingsStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
  },
}));

describe('HeadphoneMixKnob', () => {
  beforeEach(() => {
    useSettingsStore.setState({ headphoneMix: 0.5 });
  });

  it('renders the current headphoneMix value as a slider', () => {
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuenow', '0.5');
  });

  it('calls setHeadphoneMix when dragged', () => {
    render(<HeadphoneMixKnob />);
    const slider = screen.getByRole('slider', { name: /cue\/mix/i });
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(useSettingsStore.getState().headphoneMix).toBe(0.8);
  });

  it('shows "Full CUE" label near 0', () => {
    useSettingsStore.setState({ headphoneMix: 0 });
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuetext', 'Full CUE');
  });

  it('shows "Full program" label near 1', () => {
    useSettingsStore.setState({ headphoneMix: 1 });
    render(<HeadphoneMixKnob />);
    expect(screen.getByRole('slider', { name: /cue\/mix/i })).toHaveAttribute('aria-valuetext', 'Full program');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/HeadphoneMixKnob.test.tsx`
Expected: FAIL — `Cannot find module '../components/Mixer/HeadphoneMixKnob'`.

- [ ] **Step 3: Create `HeadphoneMixKnob.tsx`**

```tsx
/**
 * HeadphoneMixKnob — slider control blending headphone CUE vs. program mix.
 *
 * Reads headphoneMix from settingsStore and calls setHeadphoneMix on change.
 * 0 = full CUE (cued deck(s) only), 1 = full program (main mix only).
 */
import { useSettingsStore } from '../../store/settingsStore';
import styles from './HeadphoneMixKnob.module.css';

export function HeadphoneMixKnob() {
  const headphoneMix = useSettingsStore((s) => s.headphoneMix);
  const setHeadphoneMix = useSettingsStore((s) => s.setHeadphoneMix);

  const valueText =
    headphoneMix <= 0.05 ? 'Full CUE'
    : headphoneMix >= 0.95 ? 'Full program'
    : `${Math.round(headphoneMix * 100)}% program`;

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="headphone-mix-knob">
        CUE / MIX
      </label>
      <input
        id="headphone-mix-knob"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={headphoneMix}
        onChange={(e) => setHeadphoneMix(Number(e.target.value))}
        className={styles.slider}
        aria-label="Headphone CUE/MIX blend"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={headphoneMix}
        aria-valuetext={valueText}
      />
    </div>
  );
}

export default HeadphoneMixKnob;
```

- [ ] **Step 4: Create `HeadphoneMixKnob.module.css`**

```css
/* HeadphoneMixKnob.module.css */

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
}

.label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-widest);
  color: var(--color-text-muted);
  text-transform: uppercase;
  text-align: center;
  cursor: default;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border-muted);
  outline: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.slider:hover {
  background: var(--color-border-default);
}

.slider:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ad4d4;
  cursor: pointer;
  border: 2px solid var(--color-bg-surface);
  transition: background var(--transition-fast);
}

.slider::-webkit-slider-thumb:hover {
  background: #5ae4e4;
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ad4d4;
  cursor: pointer;
  border: 2px solid var(--color-bg-surface);
}

.slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border-muted);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/HeadphoneMixKnob.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 6: Wire `HeadphoneMixKnob` into `Mixer.tsx`**

Find the imports:

```tsx
import { VUMeter } from './VUMeter';
import { Crossfader } from './Crossfader';
import { ChannelFader } from './ChannelFader';
import { CrossfaderCurveSelector } from './CrossfaderCurveSelector';
import { MasterVolumeKnob } from './MasterVolumeKnob';
import { GainKnob } from './GainKnob';
import { BeatmatchGuide } from './BeatmatchGuide';
import { EQPanel } from './EQPanel';
import styles from './Mixer.module.css';
```

Replace with:

```tsx
import { VUMeter } from './VUMeter';
import { Crossfader } from './Crossfader';
import { ChannelFader } from './ChannelFader';
import { CrossfaderCurveSelector } from './CrossfaderCurveSelector';
import { MasterVolumeKnob } from './MasterVolumeKnob';
import { HeadphoneMixKnob } from './HeadphoneMixKnob';
import { GainKnob } from './GainKnob';
import { BeatmatchGuide } from './BeatmatchGuide';
import { EQPanel } from './EQPanel';
import styles from './Mixer.module.css';
```

Find the docstring's layout description:

```tsx
 * Layout: EQPanel (Deck A) | vertical mixer stack | EQPanel (Deck B).
 * The vertical stack itself contains (top to bottom):
 *   - "MIXER" section label
 *   - Master volume control
 *   - Per-deck channel input trim (GAIN)
 *   - Per-deck channel volume faders (CH A / CH B)
 *   - VU meters (visual-only, animated from volume level)
 *   - Beatmatch guide (tempo + phase alignment between decks)
 *   - Crossfader (with crossfader curve selector)
```

Replace with:

```tsx
 * Layout: EQPanel (Deck A) | vertical mixer stack | EQPanel (Deck B).
 * The vertical stack itself contains (top to bottom):
 *   - "MIXER" section label
 *   - Master volume control
 *   - Headphone CUE/MIX blend (Phase 4)
 *   - Per-deck channel input trim (GAIN)
 *   - Per-deck channel volume faders (CH A / CH B)
 *   - VU meters (visual-only, animated from volume level)
 *   - Beatmatch guide (tempo + phase alignment between decks)
 *   - Crossfader (with crossfader curve selector)
```

Find the Master volume section:

```tsx
        {/* Master volume — global output level above channel faders */}
        <section className={styles.section} aria-label="Master volume">
          <MasterVolumeKnob />
        </section>

        {/* Channel input trim (GAIN) — top of the controller's mixer column */}
```

Replace with:

```tsx
        {/* Master volume — global output level above channel faders */}
        <section className={styles.section} aria-label="Master volume">
          <MasterVolumeKnob />
        </section>

        {/* Headphone CUE/MIX blend — Phase 4 */}
        <section className={styles.section} aria-label="Headphone mix">
          <HeadphoneMixKnob />
        </section>

        {/* Channel input trim (GAIN) — top of the controller's mixer column */}
```

- [ ] **Step 7: Run the full suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/Mixer/HeadphoneMixKnob.tsx src/components/Mixer/HeadphoneMixKnob.module.css src/test/HeadphoneMixKnob.test.tsx src/components/Mixer/Mixer.tsx
git commit -m "feat: add HeadphoneMixKnob and wire it into Mixer"
```

---

### Task 8: Output-device picker in `SettingsModal`

**Files:**
- Modify: `src/components/Auth/SettingsModal.tsx`
- Modify: `src/components/Auth/SettingsModal.module.css`
- Test: `src/test/SettingsModal.test.tsx` (new)

**Interfaces:**
- Consumes: `cueEngine.isOutputDeviceSelectionSupported()` (Task 2); `settingsStore.headphoneDeviceId`/`.availableOutputDevices`/`.outputDeviceLabelsUnlocked` + their setters (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `src/test/SettingsModal.test.tsx`:

```tsx
/**
 * SettingsModal.test.tsx — Phase 4: headphone output-device picker.
 *
 * Focused on the NEW device-picker behavior only; the modal's pre-existing
 * Master Volume / crossfader-curve / About sections are not covered here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsModal } from '../components/Auth/SettingsModal';
import { useSettingsStore } from '../store/settingsStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    isOutputDeviceSelectionSupported: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
  },
}));

import { cueEngine } from '../services/cueEngine';

const mockGetUserMedia = vi.fn();
const mockEnumerateDevices = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({
    isSettingsOpen: false,
    headphoneDeviceId: null,
    availableOutputDevices: [],
    outputDeviceLabelsUnlocked: false,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia, enumerateDevices: mockEnumerateDevices },
    configurable: true,
  });
  mockEnumerateDevices.mockResolvedValue([
    { deviceId: 'd1', label: 'Speakers', kind: 'audiooutput', groupId: 'g1' },
    { deviceId: 'd2', label: 'Headphones', kind: 'audiooutput', groupId: 'g2' },
    { deviceId: 'm1', label: 'Microphone', kind: 'audioinput', groupId: 'g3' },
  ]);
  mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
});

describe('SettingsModal — device picker (supported browser)', () => {
  beforeEach(() => {
    vi.mocked(cueEngine.isOutputDeviceSelectionSupported).mockReturnValue(true);
  });

  it('shows the device select populated with audiooutput devices only, once open', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => {
      expect(screen.getByLabelText('Headphone Output')).toBeInTheDocument();
    });
    expect(screen.getByText('Speakers')).toBeInTheDocument();
    expect(screen.getByText('Headphones')).toBeInTheDocument();
    expect(screen.queryByText('Microphone')).not.toBeInTheDocument();
  });

  it('requests mic permission once to unlock labels, then marks it unlocked', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(true));
  });

  it('falls back to enumerating without persisting a permission denial', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('denied'));
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => {
      expect(screen.getByText('Speakers')).toBeInTheDocument();
    });
    expect(useSettingsStore.getState().outputDeviceLabelsUnlocked).toBe(false);
  });

  it('calls setHeadphoneDeviceId when a device is selected', async () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    await waitFor(() => screen.getByLabelText('Headphone Output'));
    fireEvent.change(screen.getByLabelText('Headphone Output'), { target: { value: 'd2' } });
    expect(useSettingsStore.getState().headphoneDeviceId).toBe('d2');
  });
});

describe('SettingsModal — device picker (unsupported browser)', () => {
  beforeEach(() => {
    vi.mocked(cueEngine.isOutputDeviceSelectionSupported).mockReturnValue(false);
  });

  it('shows the fallback note instead of a select', () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);

    expect(screen.queryByLabelText('Headphone Output')).not.toBeInTheDocument();
    expect(screen.getByText(/not supported in this browser/i)).toBeInTheDocument();
  });

  it('never calls getUserMedia when unsupported', () => {
    useSettingsStore.setState({ isSettingsOpen: true });
    render(<SettingsModal />);
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/SettingsModal.test.tsx`
Expected: FAIL — no element with label `Headphone Output`, no fallback note text found.

- [ ] **Step 3: Add the device picker to `SettingsModal.tsx`**

Find the imports:

```tsx
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './SettingsModal.module.css';
```

Replace with:

```tsx
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { cueEngine } from '../../services/cueEngine';
import styles from './SettingsModal.module.css';
```

Find the top of the component:

```tsx
export function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isSettingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);

  const dialogRef = useRef<HTMLDivElement>(null);
```

Replace with:

```tsx
export function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isSettingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const headphoneDeviceId = useSettingsStore((s) => s.headphoneDeviceId);
  const setHeadphoneDeviceId = useSettingsStore((s) => s.setHeadphoneDeviceId);
  const availableOutputDevices = useSettingsStore((s) => s.availableOutputDevices);
  const setAvailableOutputDevices = useSettingsStore((s) => s.setAvailableOutputDevices);
  const outputDeviceLabelsUnlocked = useSettingsStore((s) => s.outputDeviceLabelsUnlocked);
  const setOutputDeviceLabelsUnlocked = useSettingsStore((s) => s.setOutputDeviceLabelsUnlocked);

  const dialogRef = useRef<HTMLDivElement>(null);
  const labelsUnlockAttemptedRef = useRef(false);
```

Find the end of the "Focus trap" effect block (right before "Backdrop click"):

```tsx
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // ── Backdrop click ───────────────────────────────────────────────────────
```

Replace with:

```tsx
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // ── Headphone output devices: enumerate when the modal opens ────────────
  useEffect(() => {
    if (!isOpen || !cueEngine.isOutputDeviceSelectionSupported()) return;

    async function refreshOutputDevices(): Promise<void> {
      if (!outputDeviceLabelsUnlocked && !labelsUnlockAttemptedRef.current) {
        labelsUnlockAttemptedRef.current = true;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setOutputDeviceLabelsUnlocked(true);
        } catch {
          // Permission denied — fall through and enumerate without labels.
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
    }

    void refreshOutputDevices();
  }, [isOpen, outputDeviceLabelsUnlocked, setAvailableOutputDevices, setOutputDeviceLabelsUnlocked]);

  // ── Backdrop click ───────────────────────────────────────────────────────
```

Find the crossfader curve toggle block's closing and the Audio section's closing tag:

```tsx
          {/* Crossfader curve toggle */}
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Crossfader Curve</span>
            <div className={styles.toggleGroup} role="group" aria-label="Crossfader curve">
              <button
                type="button"
                className={`${styles.toggleButton} ${styles.toggleButtonActive}`}
                aria-pressed="true"
              >
                Constant Power
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${styles.toggleButtonDisabled}`}
                disabled
                title="Linear crossfader curve coming in v2"
                aria-pressed="false"
                aria-disabled="true"
              >
                Linear (v2)
              </button>
            </div>
          </div>
        </section>
```

Replace with:

```tsx
          {/* Crossfader curve toggle */}
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Crossfader Curve</span>
            <div className={styles.toggleGroup} role="group" aria-label="Crossfader curve">
              <button
                type="button"
                className={`${styles.toggleButton} ${styles.toggleButtonActive}`}
                aria-pressed="true"
              >
                Constant Power
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${styles.toggleButtonDisabled}`}
                disabled
                title="Linear crossfader curve coming in v2"
                aria-pressed="false"
                aria-disabled="true"
              >
                Linear (v2)
              </button>
            </div>
          </div>

          {/* Headphone output device (Phase 4) */}
          {cueEngine.isOutputDeviceSelectionSupported() ? (
            <div className={styles.controlRow}>
              <label htmlFor="headphone-device" className={styles.controlLabel}>
                Headphone Output
              </label>
              <select
                id="headphone-device"
                className={styles.deviceSelect}
                value={headphoneDeviceId ?? ''}
                onChange={(e) => setHeadphoneDeviceId(e.target.value || null)}
              >
                <option value="">Default</option>
                {availableOutputDevices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Output ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className={styles.deviceUnsupportedNote}>
              Output device selection isn&apos;t supported in this browser.
            </p>
          )}
        </section>
```

- [ ] **Step 4: Add device-picker styles to `SettingsModal.module.css`**

Append to the end of `src/components/Auth/SettingsModal.module.css`:

```css

/* ── Headphone device picker (Phase 4) ──────────────────────────────────── */

.deviceSelect {
  flex: 1;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-md);
  padding: 4px var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
}

.deviceSelect:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.deviceUnsupportedNote {
  font-size: var(--text-sm);
  color: var(--color-text-disabled);
  font-style: italic;
  margin: 0 0 var(--space-3) 0;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/SettingsModal.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Auth/SettingsModal.tsx src/components/Auth/SettingsModal.module.css src/test/SettingsModal.test.tsx
git commit -m "feat: add headphone output-device picker to Settings modal"
```

---

### Task 9: Full verification + Playwright visual check

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: All test files pass (roughly 96+ test files, 800+ tests — the pre-existing 787 plus this phase's additions across Tasks 2, 4, 6, 7, 8).

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no type errors and a clean bundle.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: Zero warnings (`--max-warnings 0`).

- [ ] **Step 4: Live browser check at 1366×768**

Start the dev server (`npm run dev`) and use Playwright (already a project dependency — `node_modules/playwright`) to load `http://localhost:5173/` at a 1366×768 viewport. Write a throwaway driver script inside the repo root (not the OS scratch/temp directory, so `require('playwright')`/`import 'playwright'` resolves), take a full-page screenshot, and confirm:

- Each deck's EQ column (in the Mixer) shows a "CUE" button below the FILTER knob, that toggles an active (teal) state on click.
- The Mixer center column shows a "CUE / MIX" slider directly below "MASTER".
- Opening Settings (gear icon, top right) shows either a "Headphone Output" dropdown or the "not supported" fallback note in the Audio section, without any console errors or a crashed render either way.

Delete the throwaway driver script and any screenshot files afterward — this is a manual verification step, not a committed test.

This is a **best-effort, manually-verified check** — real dual-device audio routing (confirming sound plays out of a second physical device) cannot be verified in this environment, matching the accepted limitation from the design spec.

- [ ] **Step 5: Report**

No commit for this task (verification only). If any step fails, fix the root cause in the relevant earlier task's files and re-run all of Task 9's steps before considering the phase complete.
