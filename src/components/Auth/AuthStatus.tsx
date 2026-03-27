/**
 * AuthStatus.tsx — Displays the authenticated user's profile details.
 *
 * Shows avatar, display name, and email address.
 * Used inside the Settings Modal (STORY-013) and as a standalone display widget.
 * Renders nothing when the user is not signed in.
 */
import { useAuthStore } from '../../store/authStore';
import styles from './AuthStatus.module.css';

export function AuthStatus() {
  const { userInfo, signedIn } = useAuthStore();

  if (!signedIn || !userInfo) {
    return null;
  }

  return (
    <div className={styles.container}>
      <img
        src={userInfo.picture}
        alt={`${userInfo.name}'s profile picture`}
        className={styles.avatar}
        width={48}
        height={48}
        referrerPolicy="no-referrer"
      />
      <div className={styles.details}>
        <p className={styles.name}>{userInfo.name}</p>
        <p className={styles.email}>{userInfo.email}</p>
      </div>
    </div>
  );
}

export default AuthStatus;
