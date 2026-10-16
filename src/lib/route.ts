export type Route =
  | { view: 'today' }
  | { view: 'calendar' }
  | { view: 'roadmap' }
  | { view: 'problem'; slug: string }
  | { view: 'settings' };

function safeDecode(part: string | undefined): string | null {
  if (!part) return null;
  try {
    return decodeURIComponent(part);
  } catch {
    return null; // malformed percent escape, e.g. #/problem/%
  }
}

/** Parses a location hash such as `#/problem/two-sum`. Unknown hashes fall back to Today. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter((part) => part !== '');
  switch (parts[0]) {
    case 'calendar':
      return { view: 'calendar' };
    case 'roadmap':
      return { view: 'roadmap' };
    case 'settings':
      return { view: 'settings' };
    case 'problem': {
      const slug = safeDecode(parts[1]);
      return slug ? { view: 'problem', slug } : { view: 'roadmap' };
    }
    default:
      return { view: 'today' };
  }
}

export function problemHref(slug: string): string {
  return `#/problem/${encodeURIComponent(slug)}`;
}
