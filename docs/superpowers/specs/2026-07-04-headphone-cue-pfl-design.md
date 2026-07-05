# Headphone CUE / PFL — Design Spec

This is Phase 4 of the Serato-controller-parity roadmap
(`docs/superpowers/specs/2026-07-02-serato-controller-parity-design.md`,
row 11 of the gap analysis / §6 "Later phases"). It adds per-deck
headphone cueing (pre-fader listen), a headphone MIX knob, and an
output-device picker so cue audio can be routed to a real second
device (e.g. USB headphones) while the main mix keeps playing on the
default output (e.g. speakers).

## 1. Current signal chain (for reference)

Each deck (`AudioEngineImpl` in `src/services/audioEngine.ts`) builds
its own independent Web Audio node chain on the **shared app-wide
`AudioContext`** singleton (`src/services/audioContext.ts`):

```
source → trimGain → gainNode → lowFilter → lowKillGain → midFilter → midKillGain
       → highFilter → highKillGain → sweepFilter → dryGain → analyser → context.destination
                                                  ↘ wetGain → [echo|reverb] → analyser
```

- `trimGain` = the GAIN knob (input trim, dB).
- `gainNode` = the composite fader/crossfader/master volume, written by
  `mixerStore`'s `applyVolumesToDecks()` into `deckStore.decks[id].volume`,
  picked up by `useAudioEngine`'s volume-subscription effect, applied via
  `engine.setVolume()`.
- `analyser.connect(context.destination)` is where each deck's chain
  terminates today — there is no master/summing bus node; the two decks'
  outputs combine implicitly inside the browser's destination node.
- `src/services/samplerEngine.ts` runs a **separate**, parallel path
  (one `GainNode` bus per deck) straight to `context.destination`,
  bypassing the deck chain entirely, for one-shot SAMPLER pad playback.

There is no existing "PFL"/"headphone"/"monitor"/dual-output concept
anywhere in the codebase. The existing `cuePoint`/`CUE` transport
button (`src/utils/transport.ts`, `src/types/deck.ts`) is an unrelated
concept — a track cue-point marker, not audio routing — and this
feature must not collide with that naming.

There is no `setSinkId`/`enumerateDevices`/output-device-selection code
anywhere in the codebase today; this feature introduces it from
scratch, using only native browser APIs (no new npm dependency).

## 2. New audio routing

`AudioContext.destination` cannot be redirected to a specific output
device — only `HTMLMediaElement.setSinkId()` can select a device for a
given media stream. Dual simultaneous output (main mix → default
device, cue mix → a *different* device) therefore requires a second,
parallel signal path bridged through a `MediaStreamAudioDestinationNode`
and a hidden `<audio>` element, entirely separate from the existing
`context.destination` connection (which is untouched).

### 2.1 Per-deck cue send (in `AudioEngineImpl`)

- New node: `cueSendGain: GainNode`, connected from `trimGain`'s output
  **in addition to** `trimGain`'s existing connection to `gainNode`
  (`trimGain.connect(cueSendGain)` — a node can fan out to multiple
  destinations without disturbing its existing connections).
- This is the literal PFL tap point: trimmed (GAIN-adjusted) audio,
  taken **before** the fader/crossfader (`gainNode`), EQ, filter, and
  FX. Cue audio is always full-strength regardless of channel
  fader/crossfader position, and does not reflect EQ/filter/FX/kill
  switches — an accepted limitation (§7).
- New method on `AudioEngine`: `getCueSendNode(): GainNode` returning
  `cueSendGain`, so `useAudioEngine` can register it with the cue
  engine on deck-engine creation.
- `destroy()` must also disconnect `cueSendGain`, matching the existing
  teardown of every other persistent node.

### 2.2 Shared program bus

- New node, owned by the cue engine (§3): `programBusGain: GainNode`,
  a single app-wide instance (not per-deck).
- Each deck's existing `analyser` node gets a **second** `.connect()`
  into `programBusGain`, in addition to its existing connection to
  `context.destination`. This represents "what's currently playing on
  the main output" for both decks combined, always connected,
  independent of any deck's CUE toggle state.
- Sampler one-shot audio (`samplerEngine.ts`'s per-deck buses) is
  **not** tapped into the program bus — accepted non-goal (§7).

### 2.3 Shared cue bus

- New node, owned by the cue engine: `cueBusGain: GainNode`, a single
  app-wide instance.
- When a deck's `cueEnabled` turns on, its `cueSendGain` is connected
  into `cueBusGain` (`cueSendGain.connect(cueBusGain)`); turning off
  disconnects it (`cueSendGain.disconnect(cueBusGain)`). Both decks can
  be connected simultaneously — Web Audio sums multiple inputs into one
  `GainNode` automatically, so cueing both decks at once mixes them
  together in headphones (for beatmatching two cued tracks).

### 2.4 Headphone MIX knob crossfade

- Two new nodes: `cueMixGain: GainNode` and `programMixGain: GainNode`.
- `cueBusGain.connect(cueMixGain)`, `programBusGain.connect(programMixGain)`.
- `cueMixGain.gain.value = 1 - mix`, `programMixGain.gain.value = mix`,
  where `mix` is `settingsStore.headphoneMix` (0–1, default 0.5).
  `mix = 0` → full cue, `mix = 1` → full program, matching the existing
  MASTER/GAIN knob convention of continuous 0–1 ranges in this app.
- Both connect into a final `headphoneOutGain: GainNode` (fixed gain
  1.0 — a simple summing junction, no additional scaling).

### 2.5 Output-device bridge

- `headphoneOutGain.connect(mediaStreamDestination)` where
  `mediaStreamDestination` is a single app-wide
  `MediaStreamAudioDestinationNode` created on the shared `AudioContext`.
- A hidden, always-mounted `<audio autoplay>` element (rendered once,
  e.g. from a small `CueAudioSink` component mounted in `App.tsx` next
  to `SettingsModal`) has `.srcObject = mediaStreamDestination.stream`.
- Calling `.setSinkId(deviceId)` on that `<audio>` element is the only
  way to route this specific stream to a chosen physical output device.
- Feature detection: `isOutputDeviceSelectionSupported(): boolean` in
  the cue engine returns `typeof HTMLMediaElement !== 'undefined' &&
  'setSinkId' in HTMLMediaElement.prototype`. When `false` (Firefox,
  Safari), the device picker is hidden (§5.3) but the CUE toggle and
  MIX knob still function — both endpoints just play out of the
  browser's default output device, same as if no device were selected.

## 3. New service: `src/services/cueEngine.ts`

Owns the module-level singleton nodes from §2.2–2.5
(`programBusGain`, `cueBusGain`, `cueMixGain`, `programMixGain`,
`headphoneOutGain`, `mediaStreamDestination`) and the hidden `<audio>`
element reference, plus:

- `registerDeckProgramTap(deckId, analyserNode: AnalyserNode): void` —
  called once per deck on engine creation; connects that deck's
  analyser into `programBusGain`.
- `registerDeckCueSend(deckId, cueSendGain: GainNode): void` /
  `unregisterDeckCueSend(deckId): void` — called on deck engine
  creation/destruction; tracks the node so `setDeckCueEnabled` can
  connect/disconnect it later.
- `setDeckCueEnabled(deckId, enabled: boolean): void` — connects or
  disconnects that deck's registered `cueSendGain` from `cueBusGain`.
- `setHeadphoneMix(mix: number): void` — updates `cueMixGain.gain.value`
  / `programMixGain.gain.value` (via `setTargetAtTime`, matching the
  smoothing pattern already used by `setGain`/`setVolume` in
  `audioEngine.ts`, to avoid audible zipper noise).
- `setHeadphoneDeviceId(deviceId: string | null): Promise<void>` — calls
  `.setSinkId(deviceId ?? '')` on the hidden `<audio>` element (empty
  string resets to the system default per the Audio Output Devices
  spec).
- `isOutputDeviceSelectionSupported(): boolean` — feature detection
  from §2.5.

This module is created once and its nodes/element persist for the
app's lifetime (no teardown needed beyond what `destroy()` already does
per-deck for `cueSendGain`/the program-bus connection).

## 4. State changes

### 4.1 `deckStore`

- New per-deck field: `cueEnabled: boolean` (default `false`), added to
  `DeckState` alongside the existing per-deck booleans (`vinylMode`,
  `scratching`, `quantize`, `shift`).
- New action: `toggleCue(deckId): void` — flips `cueEnabled` and calls
  `cueEngine.setDeckCueEnabled(deckId, newValue)`.
- `cueEnabled` resets to `false` on `clearTrack`/eject, matching
  `scratching`'s reset convention (per-session toggle, not a
  hardware-style persisted setting like `vinylMode`).

### 4.2 `settingsStore`

- `headphoneMix: number` (0–1, default `0.5`), persisted to
  localStorage under the existing `dj-rusty-settings` key alongside
  `masterVolume`.
- `headphoneDeviceId: string | null` (default `null` = browser default
  output), persisted the same way.
- `availableOutputDevices: MediaDeviceInfo[]` (default `[]`) — **not**
  persisted; re-enumerated live each time the Settings modal's Audio
  section is opened, since device IDs are not stable across browser
  sessions.
- `outputDeviceLabelsUnlocked: boolean` (default `false`, persisted) —
  tracks whether mic permission has already been granted, so the app
  doesn't re-prompt every session once labels are unlocked.
- New actions: `setHeadphoneMix(mix)` (clamped 0–1, calls
  `cueEngine.setHeadphoneMix`), `setHeadphoneDeviceId(deviceId)`
  (calls `cueEngine.setHeadphoneDeviceId`), `setAvailableOutputDevices(devices)`,
  `setOutputDeviceLabelsUnlocked(unlocked)`.

## 5. UI changes

### 5.1 CUE toggle button

New button in each deck's column of `src/components/Mixer/EQPanel.tsx`
(which already renders per-deck, flanking the mixer center column),
placed below the existing BASS/MID/TREBLE/FILTER knobs. Labeled "CUE",
toggles `useDeckStore.getState().toggleCue(deckId)`, active-state
styling following the same on/off visual pattern as the existing
QUANTIZE/SHIFT buttons (`DeckModifiers.tsx`) — active state a distinct
accent color, inactive dim/gray, `aria-pressed` reflecting `cueEnabled`.

### 5.2 Headphone MIX knob

New component `src/components/Mixer/HeadphoneMixKnob.tsx` +
`.module.css`, rendered once (not per-deck) in `Mixer.tsx`'s
`mixerCenter` column, placed in a new section directly below the
existing "Master volume" section (same `.section`/`.sectionLabel`
pattern used throughout `Mixer.tsx`). Wired to
`settingsStore.headphoneMix` / `setHeadphoneMix`, rendered as a knob
control consistent with `MasterVolumeKnob`/`GainKnob`'s existing visual
style (continuous drag, 0–1 range, label "CUE ↔ MIX").

### 5.3 Output-device picker

New control block inside `SettingsModal.tsx`'s existing "Audio"
section, below the crossfader-curve toggle:

- If `!cueEngine.isOutputDeviceSelectionSupported()`: render a short
  note ("Output device selection isn't supported in this browser")
  instead of a picker. No further UI.
- Else: a `<select>` labeled "Headphone Output", populated from
  `settingsStore.availableOutputDevices` (filtered to
  `kind === 'audiooutput'`), `onChange` calls `setHeadphoneDeviceId`.
  - On the Settings modal's first open in a session, if
    `!outputDeviceLabelsUnlocked`, call
    `navigator.mediaDevices.getUserMedia({ audio: true })` to unlock
    real device labels (this triggers the browser's microphone
    permission prompt), then immediately stop all tracks on the
    returned stream (we only need it to unlock labels, not to record
    anything) and call `enumerateDevices()`.
    - On grant: call `settingsStore.setOutputDeviceLabelsUnlocked(true)`
      (persisted — future sessions skip the prompt), populate
      `availableOutputDevices` with real labels.
    - On denial: populate `availableOutputDevices` via
      `enumerateDevices()` anyway (devices still enumerate, just
      without labels — `label` is `''`); render generic fallback names
      ("Output 1", "Output 2", ...) by index. Do **not** call
      `setOutputDeviceLabelsUnlocked` (a denial must not be persisted
      as if it were a granted unlock — the user should be prompted
      again next session in case they change their mind). To avoid
      re-prompting again later in the *same* session after a denial,
      track that in a plain `useRef<boolean>` local to `SettingsModal`
      (session-only, resets on reload, never touches the store).
  - On subsequent opens where `outputDeviceLabelsUnlocked` is already
    `true`, skip the permission prompt and just re-run
    `enumerateDevices()` to refresh the list (labels stay available
    once granted for the origin, independent of this component's
    state).

## 6. Testing strategy

jsdom has no `MediaStreamAudioDestinationNode`, `HTMLMediaElement.setSinkId`,
or `navigator.mediaDevices` — unit tests mock these the same way
existing tests already mock `AudioContext`/`getContext('2d')` (see
`useAudioEngine.test.ts`, `DeckWaveform.test.tsx`): assert
`connect`/`disconnect` calls and gain-value/state transitions, not real
audio output.

Real dual-device audio routing (confirming sound actually comes out of
a second physical device) cannot be verified in CI or Playwright — no
real second output device exists in that environment. Per the
precedent set in the viewport-layout phase (vertical-scroll elimination
accepted as best-effort, not a hard gate), this is a **manually
verified, best-effort** result: the implementer/reviewer confirm the
UI renders, toggles, and the Web Audio graph wiring is correct via
mocked assertions and a live Playwright check of the controls
rendering/toggling, but do not claim to have heard audio out of a
physical second device.

## 7. Non-goals / accepted limitations

- Cue audio does not reflect EQ, filter sweep, band-kill, or FX state
  — it is a pre-fader, pre-EQ tap (§2.1). Revisiting this would require
  reordering the existing signal chain (fader currently precedes EQ in
  this codebase), a larger, riskier change out of scope for this phase.
- Sampler one-shot audio is not included in the program-bus tap (§2.2).
- No per-deck headphone-only gain trim beyond the single, shared MIX
  knob.
- Feature is "experimental" per the original roadmap wording:
  `setSinkId` browser support is inconsistent (solid in Chromium,
  absent/flagged in Firefox and Safari) — unsupported browsers get the
  picker hidden (§5.3), with CUE toggle and MIX knob still functioning
  (both routed to the default output device in that case).
- No mobile or multi-channel professional-audio-interface routing
  beyond what `enumerateDevices`/`setSinkId` naturally exposes.
