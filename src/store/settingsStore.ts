/**
 * settingsStore.ts — Zustand store for app-level settings.
 *
 * STORY-013 implementation.
 *
 * State:
 *   - masterVolume (0–100, default 100) — scales effective output of both decks
 *   - isSettingsOpen — controls Settings Modal visibility
 *
 * masterVolume is persisted to localStorage under the key 'dj-rusty-settings'.
 * isSettingsOpen is ephemeral (not persisted).
 */
import { create } from 'zustand';

const STORAGE_KEY = 'dj-rusty-settings';

/** Shape persisted to localStorage. */
interface PersistedSettings {
  masterVolume: number;
}

interface SettingsState {
  /** Master output volume scalar (0–100). Default: 100. */
  masterVolume: number;
  /** Whether the Settings Modal is currently visible. */
  isSettingsOpen: boolean;
}

interface SettingsStoreActions {
  /** Set master volume (clamped to 0–100) and persist to localStorage. */
  setMasterVolume: (vol: number) => void;
  /** Open the Settings Modal. */
  openSettings: () => void;
  /** Close the Settings Modal. */
  closeSettings: () => void;
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
    // Ignore storage quota errors — masterVolume will just reset on next load
  }
}

// ---------------------------------------------------------------------------
// Initial state — hydrate masterVolume from localStorage if available
// ---------------------------------------------------------------------------

const persisted = loadPersistedSettings();

const INITIAL_STATE: SettingsState = {
  masterVolume: typeof persisted.masterVolume === 'number'
    ? Math.max(0, Math.min(100, persisted.masterVolume))
    : 100,
  isSettingsOpen: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...INITIAL_STATE,

  setMasterVolume: (vol) => {
    const clamped = Math.max(0, Math.min(100, vol));
    savePersistedSettings({ masterVolume: clamped });
    set({ masterVolume: clamped });
  },

  openSettings: () => {
    set({ isSettingsOpen: true });
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },
}));
