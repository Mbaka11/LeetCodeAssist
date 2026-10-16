import { describe, expect, it } from 'vitest';
import { parseRoute, problemHref } from './route';

describe('parseRoute', () => {
  it('maps the top-level views', () => {
    expect(parseRoute('#/today')).toEqual({ view: 'today' });
    expect(parseRoute('#/calendar')).toEqual({ view: 'calendar' });
    expect(parseRoute('#/roadmap')).toEqual({ view: 'roadmap' });
    expect(parseRoute('#/settings')).toEqual({ view: 'settings' });
  });

  it('defaults to Today for an empty or unknown hash', () => {
    expect(parseRoute('')).toEqual({ view: 'today' });
    expect(parseRoute('#')).toEqual({ view: 'today' });
    expect(parseRoute('#/nope')).toEqual({ view: 'today' });
  });

  it('parses the problem sheet slug', () => {
    expect(parseRoute('#/problem/two-sum')).toEqual({ view: 'problem', slug: 'two-sum' });
    expect(parseRoute(problemHref('3sum'))).toEqual({ view: 'problem', slug: '3sum' });
    expect(parseRoute('#/problem')).toEqual({ view: 'roadmap' });
  });
});
