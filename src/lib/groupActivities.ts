import type { Activity } from '../core/types';

/** Presentation only: preserve the first problem's list priority and every distinct activity/ID. */
export function groupActivities<T extends { activity: Activity }>(
  items: readonly T[],
  history: readonly Activity[] = [],
  unfinishedFirst = false,
): Array<{ slug: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  const order = new Map(history.map((activity, index) => [activity.id, index]));
  for (const item of items) {
    const group = groups.get(item.activity.slug);
    if (group) group.push(item);
    else groups.set(item.activity.slug, [item]);
  }
  const result = [...groups].map(([slug, entries]) => ({
    slug,
    items: entries.sort((a, b) =>
      (order.get(a.activity.id) ?? history.length) - (order.get(b.activity.id) ?? history.length)),
  }));
  const closed = (group: typeof result[number]): number => Number(!group.items.some((item) =>
    item.activity.status === 'planned' || item.activity.status === 'in_progress'));
  return unfinishedFirst ? result.sort((a, b) => closed(a) - closed(b)) : result;
}
