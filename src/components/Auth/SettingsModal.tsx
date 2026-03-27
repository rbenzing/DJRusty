/**
 * SettingsModal.tsx — Full settings dialog implementation.
 *
 * STORY-013: Settings Modal
 *
 * Sections:
 *   - Account: avatar + name + email when signed in; Google Sign-In button when not
 *   - Audio: Master volume slider (0–100, persisted in settingsStore)
 *            Crossfader curve toggle (constant-power active; linear = coming v2)
 *   - About: App version, GitHub link, keyboard shortcuts list
 *
 * Accessibility:
 *   - role="dialog" aria-modal="true" aria-labelledby="settings-modal-title"
 *   - Focus trapped inside modal (Tab / Shift+Tab cycles within)
 *   - Closes on: × button, Escape key, backdrop click
 *
 * Rendered via React portal so it appears outside the root DOM hierarchy.
 */
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../hooks/useAuth';
import styles from './SettingsModal.module.css';

const APP_VERSION = 'v1.0.0';
const GITHUB_URL = '#';

// ---------------------------------------------------------------------------
// Keyboard shortcuts reference data
// ---------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  { key: 'Space', action: 'Play/Pause (active deck)', note: '' },
  { key: 'Q', action: 'Set Cue (Deck A)', note: '' },
  { key: 'W', action: 'Cue Jump (Deck A)', note: '' },
  { key: '1 / 2 / 3 / 4', action: 'Hot Cues', note: '' },
  { key: 'L', action: 'Loop', note: '' },
  { key: 'S', action: 'Swap decks', note: 'coming in v2' },
];

// ---------------------------------------------------------------------------
// Focus trap utility
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

// ---------------------------------------------------------------------------
// SettingsModal component
// ---------------------------------------------------------------------------

export function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isSettingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);

  const { signedIn, userInfo, signIn, signOut } = useAuth();
  const channelName = useAuthStore((s) => s.channelName);

  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Handle sign-out ──────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    signOut();
    closeSettings();
  }, [signOut, closeSettings]);

  // ── Close on Escape key ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeSettings]);

  // ── Focus trap ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusable = getFocusableElements(dialog);

    // Focus first element on open
    const firstOnOpen = focusable[0];
    if (firstOnOpen) {
      firstOnOpen.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const elements = getFocusableElements(dialog);
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (!first || !last) return;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // ── Backdrop click ───────────────────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if the backdrop itself was clicked (not the modal panel)
      if (e.target === e.currentTarget) {
        closeSettings();
      }
    },
    [closeSettings],
  );

  if (!isOpen) return null;

  const modal = (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={styles.modal}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={styles.modalHeader}>
          <h2 id="settings-modal-title" className={styles.title}>
            Settings
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeSettings}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* ── Section: Account ───────────────────────────────────────────── */}
        <section className={styles.section} aria-label="Account">
          <h3 className={styles.sectionTitle}>Account</h3>

          {signedIn && userInfo ? (
            <div className={styles.accountInfo}>
              <img
                src={userInfo.picture}
                alt={`${userInfo.name}'s profile picture`}
                className={styles.avatar}
                width={48}
                height={48}
                referrerPolicy="no-referrer"
              />
              <div className={styles.accountDetails}>
                <p className={styles.accountName}>{userInfo.name}</p>
                <p className={styles.accountEmail}>{userInfo.email}</p>
                {channelName && (
                  <p className={styles.channelName}>YouTube: {channelName}</p>
                )}
              </div>
            </div>
          ) : (
            <p className={styles.unauthMessage}>Not signed in</p>
          )}

          {signedIn ? (
            <button
              type="button"
              className={styles.signOutButton}
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              className={styles.signInButton}
              onClick={signIn}
              aria-label="Sign in with Google"
            >
              Sign in with Google
            </button>
          )}
        </section>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <hr className={styles.divider} />

        {/* ── Section: Audio ─────────────────────────────────────────────── */}
        <section className={styles.section} aria-label="Audio settings">
          <h3 className={styles.sectionTitle}>Audio</h3>

          {/* Master volume */}
          <div className={styles.controlRow}>
            <label htmlFor="master-volume" className={styles.controlLabel}>
              Master Volume
            </label>
            <div className={styles.sliderWrapper}>
              <input
                id="master-volume"
                type="range"
                min={0}
                max={100}
                step={1}
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className={styles.slider}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={masterVolume}
                aria-valuetext={`${masterVolume}%`}
              />
              <span className={styles.sliderValue}>{masterVolume}%</span>
            </div>
          </div>

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

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <hr className={styles.divider} />

        {/* ── Section: About ─────────────────────────────────────────────── */}
        <section className={styles.section} aria-label="About">
          <h3 className={styles.sectionTitle}>About</h3>

          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Version</span>
            <span className={styles.aboutValue}>{APP_VERSION}</span>
          </div>

          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Source</span>
            <a
              href={GITHUB_URL}
              className={styles.githubLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>

          {/* Keyboard shortcuts */}
          <div className={styles.shortcutsBlock}>
            <h4 className={styles.shortcutsTitle}>Keyboard Shortcuts</h4>
            <table className={styles.shortcutsTable} aria-label="Keyboard shortcuts reference">
              <thead className={styles.srOnly}>
                <tr>
                  <th>Key</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {KEYBOARD_SHORTCUTS.map(({ key, action, note }) => (
                  <tr key={key} className={styles.shortcutRow}>
                    <td className={styles.shortcutKey}>
                      <kbd>{key}</kbd>
                    </td>
                    <td className={styles.shortcutAction}>
                      {action}
                      {note && (
                        <span className={styles.shortcutNote}> — {note}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default SettingsModal;
