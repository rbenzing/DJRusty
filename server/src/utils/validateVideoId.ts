import { resolve, sep } from 'path';

/** Canonical YouTube video id: exactly 11 chars of [A-Za-z0-9_-]. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** True only for a well-formed YouTube video id. Rejects traversal, wrong length, non-strings. */
export function isValidVideoId(id: unknown): id is string {
  return typeof id === 'string' && VIDEO_ID_RE.test(id);
}

/** True when `child` resolves to `parent` itself or a path strictly inside it. */
export function isPathInside(child: string, parent: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}
