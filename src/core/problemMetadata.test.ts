import { describe, expect, it } from 'vitest';
import { NEETCODE_150 } from '../data/neetcode150';
import { PROGRAM_QUEUE } from '../data/program';
import { catalogProblems } from './catalog';
import { COMPANY_EVIDENCE, getCompanyEvidence, getProblemMetadata } from './problemMetadata';

describe('getProblemMetadata', () => {
  it('returns typed tags, curated links and explicit evidence coverage for every known problem', () => {
    for (const problem of NEETCODE_150) {
      const metadata = getProblemMetadata(problem.slug);
      expect(metadata?.slug).toBe(problem.slug);
      expect(metadata?.techniques.length).toBeGreaterThan(0);
      expect(metadata?.similarProblems.length).toBeGreaterThan(0);
      expect(metadata?.companyEvidence).toEqual(getCompanyEvidence(problem.slug));
      if (metadata?.companyEvidence.status === 'reported') {
        expect(metadata.companyEvidence.evidence.length).toBeGreaterThan(0);
        for (const evidence of metadata.companyEvidence.evidence) {
          expect(COMPANY_EVIDENCE).toContain(evidence);
          expect(evidence.slug).toBe(problem.slug);
        }
      } else {
        expect(metadata?.companyEvidence).toEqual({ status: 'unknown', evidence: [] });
      }
    }
    expect(getProblemMetadata('lru-cache')?.companyEvidence.status).toBe('reported');
    expect(getProblemMetadata('two-sum')?.companyEvidence.status).toBe('reported');
    expect(getProblemMetadata('binary-search')?.companyEvidence.status).toBe('unknown');
  });

  it('returns undefined for unknown and inherited object property names', () => {
    for (const slug of ['unknown-slug', '', '__proto__', 'constructor', 'toString']) {
      expect(getProblemMetadata(slug), slug).toBeUndefined();
    }
  });

  it('does not alter catalog membership/order, program order or base problem records', () => {
    const catalogBefore = JSON.stringify([catalogProblems('neetcode150'), catalogProblems('blind75')]);
    const programBefore = [...PROGRAM_QUEUE];
    for (const problem of NEETCODE_150) {
      getProblemMetadata(problem.slug);
      getCompanyEvidence(problem.slug);
      expect(Object.keys(problem).sort()).toEqual([
        'category', 'difficulty', 'neetcodeOrder', 'slug', 'title', 'url',
      ]);
    }
    expect(JSON.stringify([catalogProblems('neetcode150'), catalogProblems('blind75')])).toBe(catalogBefore);
    expect(PROGRAM_QUEUE).toEqual(programBefore);
    expect(NEETCODE_150.map((problem) => problem.neetcodeOrder)).toEqual(
      Array.from({ length: 150 }, (_, index) => index + 1),
    );
  });
});
