# Implementation Specification

> Project: `dj-rusty`
> Date: 2026-03-21

---

## 1. Project Bootstrap

```bash
npm create vite@latest dj-rusty -- --template react-ts
cd dj-rusty
npm install zustand
npm install --save-dev @types/youtube vitest @testing-library/react @testing-library/jest-dom jsdom
```

**`.env` file** (gitignored):
```
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_YOUTUBE_API_KEY=your_api_key
```

---

## 2. YouTube IFrame API Singleton Loader

The IFrame API must be loaded once. Use a module-level promise pattern:

```typescript
// src/services/youtubeIframeApi.ts
let apiReadyPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    if (window.YT?.Player) { resolve(); return; }

    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });

  return apiReadyPromise;
}
```

Call `loadYouTubeIframeApi()` in `App.tsx` `useEffect` on mount.

---

## 3. useYouTubePlayer Hook

```typescript
// src/hooks/useYouTubePlayer.ts
export function useYouTubePlayer(deckId: 'A' | 'B', containerRef: RefObject<HTMLDivElement>) {
  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    loadYouTubeIframeApi().then(() => {
      playerRef.current = new YT.Player(containerRef.current!, {
        width: '1', height: '1',  // hidden; audio only via volume control
        playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
        events: {
          onReady: () => setDeckPlayerReady(deckId, true),
          onStateChange: (e) => handleStateChange(deckId, e.data),
          onError: (e) => handlePlayerError(deckId, e.data),
        }
      });
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      playerRef.current?.destroy();
    };
  }, []);

  // Poll currentTime while playing
  // Start/stop poll based on playbackState from store
  // Expose playerRef for direct API calls from store actions
  return playerRef;
}
```

**Key rule**: `YT.Player` instances live in `useRef`, never in Zustand.

---

## 4. Constant-Power Crossfader

```typescript
// src/utils/volumeMap.ts
export function crossfaderToVolumes(position: number): { a: number; b: number } {
  // position: 0.0 = full A, 1.0 = full B
  const a = Math.round(Math.cos(position * (Math.PI / 2)) * 100);
  const b = Math.round(Math.cos((1 - position) * (Math.PI / 2)) * 100);
  return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
}

export function compositeVolume(crossfaderVol: number, channelFader: number): number {
  return clamp(Math.round(crossfaderVol * (channelFader / 100)), 0, 100);
}
```

Call `playerA.setVolume(compositeVolume(volumes.a, channelFaderA))` on every crossfader or channel fader change.

---

## 5. Vinyl Platter Animation

```css
/* src/components/Deck/Deck.module.css */
@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.platter {
  animation: vinyl-spin var(--platter-duration, 1.8s) linear infinite;
  animation-play-state: var(--platter-state, paused);
}
```

In the component, set CSS custom properties via inline style:

```tsx
<div
  className={styles.platter}
  style={{
    '--platter-state': isPlaying ? 'running' : 'paused',
    '--platter-duration': `${(1.8 / pitchRate).toFixed(3)}s`,
  } as React.CSSProperties}
/>
```

At 33⅓ RPM (1× speed): 1.8s per revolution. Scale by `1 / pitchRate`.

---

## 6. Tap-Tempo BPM Calculation

```typescript
// src/utils/tapTempo.ts
const MAX_TAPS = 8;
const RESET_THRESHOLD_MS = 3000;

export class TapTempoCalculator {
  private taps: number[] = [];

  tap(): number | null {
    const now = Date.now();
    if (this.taps.length > 0 && now - this.taps[this.taps.length - 1] > RESET_THRESHOLD_MS) {
      this.taps = [];
    }
    this.taps.push(now);
    if (this.taps.length > MAX_TAPS) this.taps.shift();
    if (this.taps.length < 2) return null;

    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round(60000 / avg);
  }

  reset() { this.taps = []; }
}
```

---

## 7. Loop Implementation

Loops are implemented by monitoring `currentTime` and calling `seekTo()`:

```typescript
// In deckStore.ts action:
function activateLoop(deckId: 'A' | 'B', beatCount: number) {
  const { currentTime, bpm } = getDeckState(deckId);
  if (!bpm) return; // loop buttons disabled if no BPM
  const loopLengthSeconds = (beatCount / bpm) * 60;
  setDeckState(deckId, {
    loopActive: true,
    loopStart: currentTime,
    loopEnd: currentTime + loopLengthSeconds,
  });
}
```

In the `currentTime` poll (250ms interval), check loop boundary:

```typescript
if (loopActive && loopEnd && currentTime >= loopEnd) {
  player.seekTo(loopStart!, true);
}
```

---

## 8. Hot Cues — localStorage Persistence

```typescript
// src/utils/hotCues.ts
const STORAGE_KEY = 'dj-rusty-hot-cues';

interface HotCueMap {
  [videoId: string]: { [cueIndex: number]: number }; // cueIndex → timestamp seconds
}

export function getHotCues(videoId: string): Record<number, number> {
  const data: HotCueMap = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  return data[videoId] || {};
}

export function setHotCue(videoId: string, index: number, timestamp: number) {
  const data: HotCueMap = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data[videoId] = { ...(data[videoId] || {}), [index]: timestamp };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

Load hot cues for the current video into deck state when a track loads.

---

## 9. Google Identity Services — Token Initialization

```typescript
// src/services/authService.ts
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

export function initAuth(callback: (token: string, expiresIn: number) => void) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    callback: (response) => {
      if (response.error) { handleAuthError(response.error); return; }
      callback(response.access_token, response.expires_in);
    },
  });
}

export function requestToken(silent = false) {
  tokenClient?.requestAccessToken({ prompt: silent ? '' : 'consent' });
}
```

Load the GIS script in `index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## 10. YouTube Data API — Two-Step Search

```typescript
// src/services/youtubeDataApi.ts
const BASE = 'https://www.googleapis.com/youtube/v3';

export async function searchVideos(query: string, token: string, pageToken?: string) {
  // Step 1: search.list (100 quota units)
  const searchRes = await apiFetch(`${BASE}/search`, token, {
    part: 'snippet', q: query, type: 'video',
    maxResults: '20', videoCategoryId: '10',
    ...(pageToken ? { pageToken } : {}),
  });

  const videoIds = searchRes.items.map((i: any) => i.id.videoId).join(',');

  // Step 2: videos.list for durations (1 quota unit)
  const detailsRes = await apiFetch(`${BASE}/videos`, token, {
    part: 'contentDetails,snippet', id: videoIds,
  });

  return mergeSearchResults(searchRes, detailsRes);
}
```

---

## 11. ISO 8601 Duration Parsing

```typescript
// src/utils/formatTime.ts
export function parseDuration(iso: string): number {
  // PT1H23M45S → 5025 seconds
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h = '0', m = '0', s = '0'] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

---

## 12. Autoplay Policy — Muted Init Pattern

YouTube IFrame players initialized with `mute: 1` can load and buffer without requiring a user gesture:

```typescript
playerVars: {
  autoplay: 0,
  mute: 1,  // allow load/buffer without gesture
  controls: 0,
}
```

When user presses Play for the first time on a deck:
1. Call `player.unMute()`
2. Call `player.setVolume(currentVolume)`
3. Call `player.playVideo()`

This ensures the first play action is always user-initiated, satisfying browser autoplay policies.

---

## 13. Pitch Rate Constants

```typescript
// src/constants/pitchRates.ts
export const PITCH_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PitchRate = typeof PITCH_RATES[number];

export function nearestPitchRate(value: number): PitchRate {
  return PITCH_RATES.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}
```

The pitch slider maps its 0–100% range to an index into `PITCH_RATES` (or snaps to nearest). Center position (50%) = rate 1 (normal speed).

---

## 14. Unembeddable Video Handling

Some YouTube videos cannot be embedded (error codes 101, 150). Handle in `onError`:

```typescript
onError: (event) => {
  if (event.data === 101 || event.data === 150) {
    // Show toast: "This video cannot be played in external players"
    // Clear the deck: setDeckState(deckId, { videoId: null, title: '' })
  }
}
```

---

## 15. Environment & Dev Setup

**`vite.config.ts`**:
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

**`src/test/setup.ts`** — mock `YT` global:
```typescript
import '@testing-library/jest-dom';

window.YT = {
  Player: vi.fn().mockImplementation(() => ({
    playVideo: vi.fn(), pauseVideo: vi.fn(),
    setVolume: vi.fn(), setPlaybackRate: vi.fn(),
    seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0), destroy: vi.fn(),
  })),
  PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3, CUED: 5 },
} as any;
```
