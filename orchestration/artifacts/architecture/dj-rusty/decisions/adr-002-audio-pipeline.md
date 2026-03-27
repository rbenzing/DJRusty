# ADR-002: Audio Pipeline Design

**Date**: 2026-03-21
**Status**: Accepted
**Deciders**: Architecture Agent

---

## Context

DJRusty plays audio via two YouTube IFrame embeds. A key product requirement is DJ mixing: crossfading between two tracks, per-deck volume control, pitch adjustment, and (aspirationally) EQ and effects.

### The CORS Constraint

YouTube IFrame players are rendered in a cross-origin iframe (`https://www.youtube.com`). The Web Audio API's `createMediaElementSource()` requires the media element to be same-origin, or for the server to send appropriate CORS headers. YouTube does not send CORS headers permitting cross-origin audio capture from an iframe.

**Consequence**: The Web Audio API cannot be used to process YouTube IFrame audio. No `AudioContext`, `GainNode`, `BiquadFilterNode`, `ConvolverNode`, or `AnalyserNode` can be applied to YouTube audio.

---

## Decision

### v1 Audio Pipeline — IFrame API methods only

| Feature | Implementation |
|---|---|
| Volume control | `player.setVolume(0–100)` |
| Crossfade | Constant-power curve → two `setVolume()` calls |
| Pitch/speed | `player.setPlaybackRate(rate)` — discrete values only |
| EQ (Low/Mid/High) | **Visual only in v1** — labelled clearly in UI |
| Effects | **Not available in v1** |
| Waveform/beat analysis | **Not possible** without audio stream access |

### Crossfade Curve

Constant-power (equal-power) crossfade curve avoids the volume drop at centre that linear crossfade produces:

```
Given crossfader position x ∈ [0.0, 1.0]:

deckAVolume = round(cos(x * π/2) * 100)
deckBVolume = round(cos((1 - x) * π/2) * 100)
```

At `x = 0.0`: Deck A = 100, Deck B = 0
At `x = 0.5`: Deck A ≈ 71, Deck B ≈ 71 (equal power)
At `x = 1.0`: Deck A = 0, Deck B = 100

Per-deck channel faders compose multiplicatively:

```
finalVolumeA = crossfaderVolumeA * (channelFaderA / 100)
finalVolumeB = crossfaderVolumeB * (channelFaderB / 100)
```

Both clamped to `[0, 100]` before `setVolume()`.

---

## Rationale

### Why not attempt Web Audio anyway?
Some projects attempt to route YouTube audio through Web Audio by capturing the `<video>` element. This relies on implementation details that vary by browser, break silently, are not part of any standard, and may be removed in future browser versions.

### Why not a backend audio proxy?
Would technically solve the CORS constraint but:
- Significant infrastructure complexity
- May violate YouTube ToS by proxying streams
- Out of scope for v1

Documented path for v2 if EQ/effects become required.

### Why constant-power crossfade?
Human hearing is logarithmic. Linear crossfade produces a perceived volume dip at the midpoint. Constant-power maintains perceived loudness through the transition — the standard used in all professional DJ equipment.

---

## Consequences

- EQ knobs in UI are decorative in v1. Must be labelled "Visual Only".
- Pitch is stepped, not continuous. UI should use stepped slider or increment/decrement buttons.
- BPM sync cannot be computed automatically — tap-tempo only.
- Future EQ/effects implementation requires a backend audio proxy and separate ADR.

---

## Alternatives Not Chosen

| Option | Reason Rejected |
|---|---|
| Web Audio API via MediaElementSource | CORS-blocked on cross-origin iframe |
| Backend audio proxy (v1) | Out of scope; ToS concerns; infrastructure complexity |
| Linear crossfade | Produces perceived volume dip at midpoint |
