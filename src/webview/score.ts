import type { TaskCard } from '../shared/types';

export interface Score {
  done: number;
  total: number;
  pct: number;
}

export function computeScore(cards: TaskCard[]): Score {
  const total = cards.reduce((s, c) => s + (c.points ?? 1), 0);
  const done = cards
    .filter((c) => c.status === 'complete')
    .reduce((s, c) => s + (c.points ?? 1), 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}
