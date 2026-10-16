import { describe, expect, it } from 'vitest';
import { isLeetCodeUrl, problemSlugFromUrl } from './leetcodeUrl';

describe('isLeetCodeUrl', () => {
  it('accepts leetcode.com over https only', () => {
    expect(isLeetCodeUrl('https://leetcode.com/problemset/')).toBe(true);
    expect(isLeetCodeUrl('https://www.leetcode.com/')).toBe(true);
    expect(isLeetCodeUrl('http://leetcode.com/')).toBe(false);
    expect(isLeetCodeUrl('https://leetcode.cn/problems/two-sum/')).toBe(false);
    expect(isLeetCodeUrl('https://evil.example/leetcode.com/')).toBe(false);
    expect(isLeetCodeUrl('https://notleetcode.com/')).toBe(false);
    expect(isLeetCodeUrl(undefined)).toBe(false);
    expect(isLeetCodeUrl('not a url')).toBe(false);
  });
});

describe('problemSlugFromUrl', () => {
  it('extracts the slug from problem pages and their sub-pages', () => {
    expect(problemSlugFromUrl('https://leetcode.com/problems/two-sum/')).toBe('two-sum');
    expect(problemSlugFromUrl('https://leetcode.com/problems/two-sum')).toBe('two-sum');
    expect(problemSlugFromUrl('https://leetcode.com/problems/two-sum/description/?envType=x')).toBe('two-sum');
    expect(problemSlugFromUrl('https://leetcode.com/problems/3sum/submissions/')).toBe('3sum');
    expect(problemSlugFromUrl('https://leetcode.com/contest/weekly-contest-1/problems/two-sum/')).toBe('two-sum');
  });

  it('returns null away from problem pages', () => {
    expect(problemSlugFromUrl('https://leetcode.com/problemset/')).toBeNull();
    expect(problemSlugFromUrl('https://leetcode.com/problems/')).toBeNull();
    expect(problemSlugFromUrl('https://example.com/problems/two-sum/')).toBeNull();
    expect(problemSlugFromUrl(undefined)).toBeNull();
  });

  it('returns null instead of throwing on a malformed percent escape', () => {
    expect(problemSlugFromUrl('https://leetcode.com/problems/%')).toBeNull();
  });
});
