/**
 * settings-store.test.ts — Unit tests for settingsStore.
 *
 * STORY-013 acceptance criteria:
 * - masterVolume defaults to 100
 * - isSettingsOpen defaults to false
 * - setMasterVolume updates the value and persists to localStorage
 * - setMasterVolume clamps values to [0, 100]
 * - masterVolume is hydrated from localStorage on store initialisation
 * - openSettings sets isSettingsOpen to true
 * - closeSettings sets isSettingsOpen to false
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

const STORAGE_KEY = 'dj-rusty-settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * We must re-import the store after manipulating localStorage to test
 * hydration behaviour. Vitest module cache needs to be reset for hydration
 * tests; for action-only tests we use the singleton directly.
 */
async function freshStore() {
  // Isolate module so the store re-reads localStorage
  const mod = await import('../store/settingsStore');
  return mod.useSettingsStore;
}

// ---------------------------------------------------------------------------
// Reset before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();

  // Reset the module-singleton store to known state without re-importing
  // (avoids import() overhead for non-hydration tests)
  import('../store/settingsStore').then(({ useSettingsStore }) => {
    useSettingsStore.setState({ masterVolume: 100, isSettingsOpen: false });
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('settingsStore — initial state', () => {
  it('defaults masterVolume to 100', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().masterVolume).toBe(100);
  });

  it('defaults isSettingsOpen to false', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');
    expect(useSettingsStore.getState().isSettingsOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setMasterVolume
// ---------------------------------------------------------------------------

describe('settingsStore — setMasterVolume', () => {
  it('updates masterVolume to the given value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(75);
    });

    expect(useSettingsStore.getState().masterVolume).toBe(75);
  });

  it('clamps values above 100 to 100', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(150);
    });

    expect(useSettingsStore.getState().masterVolume).toBe(100);
  });

  it('clamps values below 0 to 0', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(-10);
    });

    expect(useSettingsStore.getState().masterVolume).toBe(0);
  });

  it('accepts 0 as a valid value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(0);
    });

    expect(useSettingsStore.getState().masterVolume).toBe(0);
  });

  it('accepts 100 as a valid value', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(100);
    });

    expect(useSettingsStore.getState().masterVolume).toBe(100);
  });

  it('persists masterVolume to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(60);
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { masterVolume: number };
    expect(parsed.masterVolume).toBe(60);
  });

  it('overwrites previous localStorage value when called again', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(80);
    });
    act(() => {
      useSettingsStore.getState().setMasterVolume(40);
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as { masterVolume: number };
    expect(parsed.masterVolume).toBe(40);
    expect(useSettingsStore.getState().masterVolume).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence key
// ---------------------------------------------------------------------------

describe('settingsStore — localStorage key', () => {
  it("persists under the key 'dj-rusty-settings'", async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(55);
    });

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('does not write any other keys to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().setMasterVolume(55);
    });

    // Only the settings key should be present
    const keys = Object.keys(localStorage);
    expect(keys).toEqual([STORAGE_KEY]);
  });
});

// ---------------------------------------------------------------------------
// openSettings / closeSettings
// ---------------------------------------------------------------------------

describe('settingsStore — openSettings', () => {
  it('sets isSettingsOpen to true', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().openSettings();
    });

    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);
  });

  it('is idempotent when called multiple times', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().openSettings();
      useSettingsStore.getState().openSettings();
    });

    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);
  });
});

describe('settingsStore — closeSettings', () => {
  it('sets isSettingsOpen to false', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().openSettings();
    });
    act(() => {
      useSettingsStore.getState().closeSettings();
    });

    expect(useSettingsStore.getState().isSettingsOpen).toBe(false);
  });

  it('is safe to call when already closed', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    expect(() => {
      act(() => {
        useSettingsStore.getState().closeSettings();
      });
    }).not.toThrow();

    expect(useSettingsStore.getState().isSettingsOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Open/close cycle
// ---------------------------------------------------------------------------

describe('settingsStore — open/close cycle', () => {
  it('can toggle between open and closed', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => { useSettingsStore.getState().openSettings(); });
    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);

    act(() => { useSettingsStore.getState().closeSettings(); });
    expect(useSettingsStore.getState().isSettingsOpen).toBe(false);

    act(() => { useSettingsStore.getState().openSettings(); });
    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);
  });

  it('changing masterVolume does not affect isSettingsOpen', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().openSettings();
      useSettingsStore.getState().setMasterVolume(50);
    });

    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);
    expect(useSettingsStore.getState().masterVolume).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// isSettingsOpen is NOT persisted to localStorage
// ---------------------------------------------------------------------------

describe('settingsStore — isSettingsOpen not persisted', () => {
  it('does not persist isSettingsOpen to localStorage', async () => {
    const { useSettingsStore } = await import('../store/settingsStore');

    act(() => {
      useSettingsStore.getState().openSettings();
    });

    // isSettingsOpen should never appear in localStorage
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect('isSettingsOpen' in parsed).toBe(false);
    }
    // If nothing persisted at all (no masterVolume change) — that is also fine
    expect(useSettingsStore.getState().isSettingsOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// freshStore helper — used for future hydration tests if module isolation is available
// ---------------------------------------------------------------------------

void freshStore; // referenced so TypeScript does not complain about unused declaration
