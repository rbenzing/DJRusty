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
    void cueEngine.setHeadphoneDeviceId(deviceId).catch(() => {
      // setSinkId can reject for an invalid/disconnected device id; nothing actionable here
    });
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
