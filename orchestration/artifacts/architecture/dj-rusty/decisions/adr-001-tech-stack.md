# ADR-001: Technology Stack Selection

**Date**: 2026-03-21
**Status**: Accepted
**Deciders**: Architecture Agent

---

## Context

DJRusty is a browser-based DJ application with no backend. It needs a modern, type-safe frontend stack that supports reactive UI updates (knobs, sliders, crossfader moving in real time), is well-supported in 2026, and has a fast developer experience.

Key requirements:
- Reactive UI with fine-grained re-renders (multiple sliders, volume meters, transport controls updating at up to 60fps for visual elements and ~250ms for state polls)
- TypeScript throughout for safety and IDE support
- Fast build and hot-reload for development iteration
- Lightweight state management without Redux boilerplate
- No server-side rendering needed

---

## Decision

| Concern | Choice |
|---|---|
| Language | TypeScript 5.x |
| UI Framework | React 18.x |
| Build Tool | Vite 5.x |
| State Management | Zustand 4.x |
| Styling | CSS Modules + CSS custom properties |
| Testing | Vitest + React Testing Library |

---

## Rationale

### TypeScript
Non-negotiable for this complexity. YouTube IFrame API, GIS SDK, and Data API all have community type definitions. Strong typing catches parameter errors at compile time.

### React 18
Best ecosystem for interactive control-surface UI. Hooks model fits IFrame API lifecycle. Alternatives considered:
- **Vue 3**: Viable but weaker ecosystem for YouTube IFrame tooling.
- **Svelte**: Smaller ecosystem; fewer third-party SDK type definitions.
- **Vanilla JS**: Too low-level for dual-deck state synchronization.

### Vite
Near-instant dev server startup and HMR critical for iterating on UI controls. Webpack/CRA adds unnecessary configuration overhead.

### Zustand
- Fine-grained subscriptions prevent unnecessary re-renders across decks.
- Store accessible outside React trees — enables `setInterval` polling loop to call `setState` without React context.
- Minimal boilerplate vs Redux Toolkit.

Alternatives:
- **Redux Toolkit**: Too much boilerplate for this scale.
- **Jotai/Recoil**: Atom-based; more per-field definitions. Zustand slices fit domain boundaries better.
- **React Context + useReducer**: Triggers full subtree re-renders — unacceptable for real-time control surface.

### CSS Modules
Component-scoped styles with zero runtime overhead. CSS custom properties allow a global dark theme defined once. No CSS-in-JS runtime needed.

---

## Consequences

- All source files must use `.ts`/`.tsx` with strict TypeScript configuration.
- Zustand store slices must have clearly bounded domains.
- CSS Modules: `.module.css` files colocated with their component.
- Vitest must mock the browser-global `YT` object injected by the IFrame API.

---

## Alternatives Not Chosen

| Option | Reason Rejected |
|---|---|
| Next.js | SSR not needed; adds complexity |
| Angular | Heavy framework; not warranted |
| MobX | Heavier than Zustand for this use case |
| Redux Toolkit | Boilerplate overhead exceeds benefit |
