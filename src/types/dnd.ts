export const DND_KEY = 'application/dj-rusty';

export type DragPayload =
  | { source: 'library'; trackId: string }
  | { source: 'playlist'; fromDeck: 'A' | 'B'; trackId: string };
