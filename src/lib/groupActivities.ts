import type { Activity } from '../core/types';

/** Presentation only: preserve the first problem's list priority and every distinct activity/ID. */
export function groupActivities<T extends { activity: Activity }>(
  items: readonly T[],
  history: readonly Activity[] = [],
): Array<{ slug: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  const order = new Map(history.map((activity, index) => [activity.id, index]));
  for (const item of items) {
    const group = groups.get(item.activity.slug);
    if (group) group.push(item);
    else groups.set(item.activity.slug, [item]);
  }
  return [...groups].map(([slug, entries]) => ({
    slug,
    items: entries.sort((a, b) =>
      (order.get(a.activity.id) ?? history.length) - (order.get(b.activity.id) ?? history.length)),
  }));
}
