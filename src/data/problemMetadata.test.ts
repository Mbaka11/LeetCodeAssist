import { describe, expect, it } from 'vitest';
import { catalogProblems } from '../core/catalog';
import { NEETCODE_150 } from './neetcode150';
import { PROGRAM_QUEUE } from './program';
import { DATA_STRUCTURE_TAGS, PROBLEM_TAGS, TECHNIQUE_TAGS } from './problemMetadata';
import { SIMILAR_PROBLEMS, SIMILAR_RELATIONS } from './similarProblems';

describe('problemMetadata editorial registry', () => {
  it('covers exactly the existing 150 slugs and retains the 75 subset and fixed 50 program', () => {
    const slugs = NEETCODE_150.map((problem) => problem.slug);
    expect(Object.keys(PROBLEM_TAGS)).toEqual(slugs);
    expect(Object.keys(SIMILAR_PROBLEMS)).toEqual(slugs);
    expect(catalogProblems('neetcode150')).toBe(NEETCODE_150);
    expect(catalogProblems('neetcode150')).toHaveLength(150);
    expect(catalogProblems('blind75')).toHaveLength(75);
    expect(PROGRAM_QUEUE).toHaveLength(50);
    expect(catalogProblems('blind75').every((problem) => slugs.includes(problem.slug))).toBe(true);
    expect(PROGRAM_QUEUE.every((slug) => slugs.includes(slug))).toBe(true);
  });

  it('uses unique normalized vocabulary and meaningful per-problem technique selections', () => {
    const dataStructures = new Set<string>(DATA_STRUCTURE_TAGS);
    const techniques = new Set<string>(TECHNIQUE_TAGS);
    expect(dataStructures.size).toBe(DATA_STRUCTURE_TAGS.length);
    expect(techniques.size).toBe(TECHNIQUE_TAGS.length);
    for (const tag of [...DATA_STRUCTURE_TAGS, ...TECHNIQUE_TAGS]) {
      expect(tag).toBe(tag.trim());
      expect(tag).not.toMatch(/[/_]/);
    }
    for (const [slug, metadata] of Object.entries(PROBLEM_TAGS)) {
      expect(metadata.techniques.length, slug).toBeGreaterThan(0);
      expect(new Set(metadata.dataStructures).size, slug).toBe(metadata.dataStructures.length);
      expect(new Set(metadata.techniques).size, slug).toBe(metadata.techniques.length);
      for (const tag of metadata.dataStructures) expect(dataStructures.has(tag), `${slug}: ${tag}`).toBe(true);
      for (const tag of metadata.techniques) expect(techniques.has(tag), `${slug}: ${tag}`).toBe(true);
    }
  });

  it('distinguishes actual patterns instead of copying roadmap categories', () => {
    expect(PROBLEM_TAGS['generate-parentheses'].techniques).toContain('Backtracking');
    expect(PROBLEM_TAGS['find-the-duplicate-number'].techniques).toContain('Fast and Slow Pointers');
    expect(PROBLEM_TAGS['alien-dictionary'].techniques).toContain('Topological Sort');
    expect(PROBLEM_TAGS['product-of-array-except-self'].techniques).toContain('Prefix Product');
    expect(PROBLEM_TAGS['trapping-rain-water'].techniques).toContain('Prefix Maximum');
    expect(PROBLEM_TAGS['gas-station'].techniques).toContain('Prefix Sum');
    expect(PROBLEM_TAGS['powx-n'].dataStructures).toEqual([]);
    expect(PROBLEM_TAGS['number-of-1-bits'].dataStructures).toEqual([]);
    expect(PROBLEM_TAGS['lru-cache'].dataStructures).toEqual(['Hash Table', 'Doubly Linked List']);
  });

  it('has bounded, unique, known, non-self links with supported relations and original rationales', () => {
    const knownSlugs = new Set(NEETCODE_150.map((problem) => problem.slug));
    const relations = new Set<string>(SIMILAR_RELATIONS);
    const usedRelations = new Set<string>();
    for (const [slug, links] of Object.entries(SIMILAR_PROBLEMS)) {
      expect(links.length, slug).toBeGreaterThan(0);
      expect(links.length, slug).toBeLessThanOrEqual(5);
      expect(new Set(links.map((link) => link.slug)).size, slug).toBe(links.length);
      for (const link of links) {
        expect(knownSlugs.has(link.slug), `${slug} -> ${link.slug}`).toBe(true);
        expect(link.slug, slug).not.toBe(slug);
        expect(relations.has(link.relation), slug).toBe(true);
        expect(link.rationale.trim().length, `${slug} -> ${link.slug}`).toBeGreaterThan(10);
        usedRelations.add(link.relation);
      }
    }
    expect([...usedRelations].sort()).toEqual([...SIMILAR_RELATIONS].sort());
  });
});
