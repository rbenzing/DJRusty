/**
 * AuthButton.tsx — Authentication control in the app header.
 *
 * Unauthenticated: renders a "Sign in with Google" button.
 * Authenticated: renders the user's avatar + display name + chevron.
 *
 * Clicking the sign-in button calls signIn().
 * Clicking the authenticated state is handled by the parent (opens Settings Modal).
 */
import type { MouseEventHandler } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './AuthButton.module.css';

interface AuthButtonProps {
  /** Called when the authenticated user button is clicked (e.g. open Settings Modal). */
  onAuthenticatedClick?: MouseEventHandler<HTMLButtonElement>;
}

export function AuthButton({ onAuthenticatedClick }: AuthButtonProps) {
  const { signedIn, userInfo, signIn } = useAuth();

  if (!signedIn || !userInfo) {
    return (
      <button
        type="button"
        className={styles.signInButton}
        aria-label="Sign in with Google"
        onClick={signIn}
      >
        <GoogleLogo />
        <span>Sign in with Google</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.userButton}
      aria-label={`Signed in as ${userInfo.name}. Click to open settings.`}
      onClick={onAuthenticatedClick}
    >
      <img
        src={userInfo.picture}
        alt={`${userInfo.name}'s profile picture`}
        className={styles.avatar}
        width={32}
        height={32}
        referrerPolicy="no-referrer"
      />
      <span className={styles.userName}>{userInfo.name}</span>
      <ChevronIcon />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Official Google "G" logo mark as inline SVG (per Google branding guidelines). */
function GoogleLogo() {
  return (
    <svg
      className={styles.googleLogo}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Small down-chevron icon indicating the button opens a dropdown/modal. */
function ChevronIcon() {
  return (
    <svg
      className={styles.chevron}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default AuthButton;
