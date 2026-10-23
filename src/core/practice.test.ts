import { describe, expect, it } from 'vitest';
import { DRILL_ALSO_VALID, RELATED_TAG_GROUPS } from '../data/drillAmbiguity';
import { DRILL_CONTENT } from '../data/drills';
import { getProblem, NEETCODE_150 } from '../data/neetcode150';
import { DATA_STRUCTURE_TAGS, PROBLEM_TAGS, TECHNIQUE_TAGS, type MetadataProblemSlug } from '../data/problemMetadata';
import { PROGRAM_QUEUE } from '../data/program';
import { defaultState } from './state';
import { drawSimulation, drillQuestions, simulationPool, tagsNeverOfferedAsWrong, workedSlugs } from './practice';

describe('practice pools (separate from scheduled work)', () => {
  it('unlocks only checked, learned, started or completed problems, not plans/skips/favorites/notes', () => {
    const state = defaultState('2025-01-01');
    state.checked = { 'two-sum': true, 'valid-anagram': false };
    state.problemStatus = { 'group-anagrams': 'learning', 'min-stack': 'untouched' };
    state.favorites = { 'min-stack': true };
    state.activities = (['planned', 'skipped', 'in_progress', 'done'] as const).map((status, index) => ({ id: String(index), slug: ['binary-search', 'same-tree', 'coin-change', 'subsets'][index]!, status, type: 'new', dueDate: '2025-01-01', createdAt: '2025-01-01', timer: { startedAt: null, running: false, accumulatedMs: 0 } }));
    expect([...workedSlugs(state)].sort()).toEqual(['coin-change', 'group-anagrams', 'subsets', 'two-sum']);
    expect(simulationPool(state, { includeUnworked: false, difficulty: '', category: '' }).map((p) => p.slug).sort()).toEqual([...workedSlugs(state)].sort());
  });
  it('supports explicit full-catalog, difficulty/category filters and honest empty pools', () => {
    const state = defaultState('2025-01-01');
    expect(simulationPool(state, { includeUnworked: false, difficulty: '', category: '' })).toEqual([]);
    expect(simulationPool(state, { includeUnworked: true, difficulty: '', category: '' })).toHaveLength(150);
    const selected = simulationPool(state, { includeUnworked: true, difficulty: 'Easy', category: 'Arrays & Hashing' });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((p) => p.difficulty === 'Easy' && p.category === 'Arrays & Hashing')).toBe(true);
  });
  it('company pools contain documented slugs only, no fallback and no threshold bypass', () => {
    const state = defaultState('2025-01-01');
    const options = { includeUnworked: true, difficulty: '', category: '' };
    expect(simulationPool(state, { ...options, companyId: 'stripe' })).toEqual([]);
    expect(simulationPool(state, { ...options, companyId: 'google' })).toHaveLength(6);
    expect(simulationPool(state, { ...options, companyId: 'amazon' })).toHaveLength(14);
    // Bloomberg's LRU Cache source reports a design discussion with no coding: it is not a mock coding interview problem.
    const bloomberg = simulationPool(state, { ...options, companyId: 'bloomberg' }).map((p) => p.slug);
    expect(bloomberg).toHaveLength(7);
    expect(bloomberg).not.toContain('lru-cache');
    expect(simulationPool(state, { ...options, companyId: 'google', category: 'not-a-category' })).toEqual([]);
  });
  it('weights distinct exact topics 3:1 over variants without double-weighting sources', () => {
    const pool = [getProblem('two-sum')!, getProblem('number-of-islands')!];
    expect(drawSimulation(pool, 'google', () => 0.749)?.slug).toBe('two-sum');
    expect(drawSimulation(pool, 'google', () => 0.75)?.slug).toBe('number-of-islands');
    expect(drawSimulation(pool, undefined, () => 0.5)?.slug).toBe('number-of-islands');
    expect(drawSimulation([], undefined, () => 0)).toBeUndefined();
  });
});

describe('original pattern drill bank', () => {
  it('covers exactly the mandatory 50 with distinct original correct/wrong outlines and explanations', () => {
    expect(Object.keys(DRILL_CONTENT).sort()).toEqual([...PROGRAM_QUEUE].sort());
    for (const [slug, content] of Object.entries(DRILL_CONTENT)) {
      expect(NEETCODE_150.some((p) => p.slug === slug)).toBe(true);
      expect(content).toHaveLength(7);
      expect(content.every((part) => part.trim().length > 15)).toBe(true);
      expect(new Set([content[1], content[3], content[5]]).size).toBe(3);
    }
  });
  it('defaults to worked-only, allows opt-in technique/structure spoilers, never unworked outlines', () => {
    const state = defaultState('2025-01-01');
    expect(drillQuestions(state, { includeUnworked: false, kind: 'mixed', count: 20 })).toEqual([]);
    expect(drillQuestions(state, { includeUnworked: true, kind: 'outline', count: 20 })).toEqual([]);
    const unworked = drillQuestions(state, { includeUnworked: true, kind: 'mixed', count: 20 });
    expect(unworked).toHaveLength(20);
    expect(unworked.every((q) => q.kind !== 'outline')).toBe(true);
    state.checked['two-sum'] = true;
    expect(drillQuestions(state, { includeUnworked: false, kind: 'mixed', count: 20 })).toHaveLength(3);
    expect(drillQuestions(state, { includeUnworked: false, kind: 'outline', count: 5 })[0]?.slug).toBe('two-sum');
  });
  it('uses tag-vocabulary distractors excluding all other registered valid tags; has one correct answer', () => {
    const state = defaultState('2025-01-01');
    state.checked = Object.fromEntries(PROGRAM_QUEUE.map((slug) => [slug, true]));
    for (const kind of ['technique', 'structure', 'outline'] as const) {
      // Several deterministic permutations exercise all 50 bank records.
      const seen = new Set<string>();
      for (const random of [() => 0, () => 0.5, () => 0.9999]) {
        for (const q of drillQuestions(state, { includeUnworked: false, kind, count: 20 }, random)) {
          seen.add(q.slug);
          expect(q.choices.filter((c) => c.correct)).toHaveLength(1);
          expect(new Set(q.choices.map((c) => c.text)).size).toBe(q.choices.length);
          expect(q.choices.every((c) => c.explanation.length > 15)).toBe(true);
          if (kind === 'outline') continue;
          const tags = PROBLEM_TAGS[q.slug as MetadataProblemSlug];
          const valid: readonly string[] = kind === 'technique' ? tags.techniques : tags.dataStructures;
          const vocab: readonly string[] = kind === 'technique' ? TECHNIQUE_TAGS : DATA_STRUCTURE_TAGS;
          for (const c of q.choices) {
            expect(vocab).toContain(c.text);
            expect(valid.includes(c.text)).toBe(c.correct);
          }
        }
      }
      expect(seen.size).toBeGreaterThan(20);
    }
  });
  it('does not mutate state, catalogs or mandatory program ordering when generating practice', () => {
    const state = defaultState('2025-01-01');
    const before = structuredClone(state);
    const program = [...PROGRAM_QUEUE];
    drillQuestions(state, { includeUnworked: true, kind: 'mixed', count: 20 });
    simulationPool(state, { includeUnworked: true, difficulty: '', category: '' });
    expect(state).toEqual(before);
    expect(PROGRAM_QUEUE).toEqual(program);
  });
});

function seeded(seed: number): () => number {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}
const RANDOMS: readonly (() => number)[] = Array.from({ length: 150 }, (_, seed) => seeded(seed + 1));
const allWorked = () => { const state = defaultState('2025-01-01'); state.checked = Object.fromEntries(PROGRAM_QUEUE.map((slug) => [slug, true])); return state; };
const optionsSeen = (state = allWorked()) => {
  const seen = new Map<string, Set<string>>();
  for (const kind of ['technique', 'structure'] as const) for (const random of RANDOMS) {
    for (const q of drillQuestions(state, { includeUnworked: true, kind, count: 20 }, random)) {
      const wrong = seen.get(`${q.slug}:${kind}`) ?? new Set<string>();
      for (const c of q.choices) if (!c.correct) wrong.add(c.text);
      seen.set(`${q.slug}:${kind}`, wrong);
    }
  }
  return seen;
};

describe('drill spoiler boundary for unworked problems', () => {
  it('uses only tag-level feedback for unworked technique/structure questions, never outline text or rationale', () => {
    const questions = drillQuestions(defaultState('2025-01-01'), { includeUnworked: true, kind: 'mixed', count: 20 }, () => 0.3);
    expect(questions).toHaveLength(20);
    for (const q of drillQuestions(defaultState('2025-01-01'), { includeUnworked: true, kind: 'mixed', count: 20 }, () => 0.7).concat(questions)) {
      const content = DRILL_CONTENT[q.slug as keyof typeof DRILL_CONTENT];
      for (const choice of q.choices) {
        for (const part of content.slice(1)) expect(choice.explanation).not.toContain(part);
        expect(choice.explanation).toContain(q.choices.find((c) => c.correct)!.text);
      }
    }
    // The rationale is shown only after the problem has actually been worked.
    const worked = defaultState('2025-01-01');
    worked.checked['single-number'] = true;
    const q = drillQuestions(worked, { includeUnworked: false, kind: 'technique', count: 5 })[0]!;
    expect(q.slug).toBe('single-number');
    expect(q.choices.find((c) => c.correct)!.explanation).toContain(DRILL_CONTENT['single-number'][2]);
  });
});

describe('drill answer keys with several sound answers', () => {
  it('has a curated also-valid entry for every one of the 50 problems, with known tags that exclude the key', () => {
    expect(Object.keys(DRILL_ALSO_VALID).sort()).toEqual([...PROGRAM_QUEUE].sort());
    const vocab: readonly string[] = [...TECHNIQUE_TAGS, ...DATA_STRUCTURE_TAGS];
    for (const [slug, extra] of Object.entries(DRILL_ALSO_VALID)) {
      expect(extra.every((tag) => vocab.includes(tag)), slug).toBe(true);
      const tags = PROBLEM_TAGS[slug as MetadataProblemSlug];
      expect(extra.some((tag) => (tags.techniques as readonly string[]).concat(tags.dataStructures).includes(tag)), `${slug} lists a registered tag`).toBe(false);
    }
  });
  it('never offers an also-valid, related, registered or generic tag as a wrong answer, and always has three distractors', () => {
    for (const [id, wrong] of optionsSeen()) {
      const slug = id.split(':')[0]!;
      const never = tagsNeverOfferedAsWrong(slug);
      for (const tag of wrong) expect(never.has(tag), `${id} offered ${tag}`).toBe(false);
      expect(wrong.size, id).toBeGreaterThanOrEqual(3);
    }
    for (const slug of PROGRAM_QUEUE) {
      const never = tagsNeverOfferedAsWrong(slug);
      expect(TECHNIQUE_TAGS.filter((t) => !never.has(t)).length).toBeGreaterThanOrEqual(3);
      expect(DATA_STRUCTURE_TAGS.filter((t) => !never.has(t)).length).toBeGreaterThanOrEqual(3);
    }
  });
  it.each([
    ['valid-anagram', 'structure', ['Array', 'Hash Set']],
    ['valid-anagram', 'technique', ['Sorting', 'Hashing']],
    ['longest-consecutive-sequence', 'structure', ['Hash Table']],
    ['binary-tree-level-order-traversal', 'structure', ['Deque']],
    ['merge-intervals', 'technique', ['Sweep Line', 'Greedy']],
    ['last-stone-weight', 'structure', ['Queue', 'Array']],
    ['best-time-to-buy-and-sell-stock', 'technique', ['Dynamic Programming']],
    ['two-sum-ii-input-array-is-sorted', 'technique', ['Binary Search']],
    ['two-sum', 'structure', ['Hash Set']],
    ['group-anagrams', 'technique', ['Hashing']],
    ['number-of-islands', 'technique', ['Recursion']],
    ['coin-change', 'technique', ['Breadth-First Search']],
  ] as const)('%s %s: plausible alternatives %j are never marked wrong', (slug, kind, alternatives) => {
    const wrong = optionsSeen().get(`${slug}:${kind}`);
    expect(wrong).toBeDefined();
    for (const tag of alternatives) expect(wrong!.has(tag), tag).toBe(false);
  });
  it('asks no technique question when the only technique is the vague "Simulation", and never offers Simulation as wrong', () => {
    const state = allWorked();
    const asked = new Set(drillQuestions(state, { includeUnworked: true, kind: 'technique', count: 20 }, () => 0).map((q) => q.slug));
    const all = new Set<string>();
    for (const random of RANDOMS) for (const q of drillQuestions(state, { includeUnworked: true, kind: 'technique', count: 20 }, random)) all.add(q.slug);
    for (const slug of ['valid-parentheses', 'min-stack', 'kth-largest-element-in-a-stream', 'last-stone-weight']) {
      expect(all.has(slug) || asked.has(slug), slug).toBe(false);
      expect(drillQuestions(state, { includeUnworked: true, kind: 'structure', count: 20 }, () => 0).length).toBeGreaterThan(0);
    }
    expect([...optionsSeen().values()].every((wrong) => !wrong.has('Simulation'))).toBe(true);
    expect(RELATED_TAG_GROUPS.some((g) => g.includes('Greedy') && g.includes('Dynamic Programming'))).toBe(true);
  });
});

describe('outline answer-length tell', () => {
  it('does not make the correct outline systematically the longest or the shortest', () => {
    let longest = 0, shortest = 0;
    const entries = Object.values(DRILL_CONTENT);
    for (const content of entries) {
      const [correct, a, b] = [content[1].length, content[3].length, content[5].length];
      if (correct > Math.max(a, b)) longest++;
      if (correct < Math.min(a, b)) shortest++;
    }
    expect(longest / entries.length).toBeLessThanOrEqual(0.4);
    expect(shortest / entries.length).toBeLessThanOrEqual(0.4);
  });
  it('keeps every outline within a comparable length band', () => {
    for (const [slug, content] of Object.entries(DRILL_CONTENT)) {
      const lengths = [content[1].length, content[3].length, content[5].length];
      expect(Math.max(...lengths) / Math.min(...lengths), slug).toBeLessThanOrEqual(3.2);
    }
  });
});
