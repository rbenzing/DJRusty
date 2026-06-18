import { useEffect, useState, useCallback } from 'react';
import { saveSession, loadSession, deleteSession, listSessions } from '../../services/sessionStore';
import styles from './SessionPanel.module.css';

interface SessionMeta { name: string; savedAt: number; trackCount: number }

export function SessionPanel() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [name, setName] = useState('');

  const refresh = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleSave() {
    const n = name.trim();
    if (!n) return;
    await saveSession(n);
    setName('');
    await refresh();
  }

  async function handleLoad(n: string) {
    await loadSession(n);
  }

  async function handleDelete(n: string) {
    await deleteSession(n);
    await refresh();
  }

  return (
    <div className={styles.panel}>
      <div className={styles.saveRow}>
        <input
          className={styles.nameInput}
          placeholder="Session name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Session name"
        />
        <button className={styles.saveBtn} onClick={() => void handleSave()} aria-label="Save session">
          Save
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className={styles.empty}>No saved sessions.</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((s) => (
            <li key={s.name} className={styles.row}>
              <span className={styles.meta}>{s.name} <small>({s.trackCount} tracks)</small></span>
              <button onClick={() => void handleLoad(s.name)} aria-label={`Load session ${s.name}`}>Load</button>
              <button onClick={() => void handleDelete(s.name)} aria-label={`Delete session ${s.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
