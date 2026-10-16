/** Helpers for recognising LeetCode tabs and problem pages. */

const LEETCODE_HOSTS = ['leetcode.com', 'www.leetcode.com'];

function parse(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isLeetCodeUrl(url: string | undefined): boolean {
  const parsed = parse(url);
  return parsed !== null && parsed.protocol === 'https:' && LEETCODE_HOSTS.includes(parsed.hostname);
}

/** The slug of `https://leetcode.com/problems/<slug>/...`, or null for any other page. */
export function problemSlugFromUrl(url: string | undefined): string | null {
  const parsed = parse(url);
  if (parsed === null || !isLeetCodeUrl(url)) return null;
  const match = /(?:^|\/)problems\/([^/]+)/.exec(parsed.pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null; // malformed percent escape, e.g. /problems/%
  }
}
