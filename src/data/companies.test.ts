import { describe, expect, it } from 'vitest';
import { getProblem } from './neetcode150';
import { COMPANIES, COMPANY_EVIDENCE, COMPANY_EVIDENCE_DISCLAIMER, getCompanyEvidence } from './companies';

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

describe('companies public evidence', () => {
  it('defines all 12 target companies once as text, without unlicensed logo assets', () => {
    expect(COMPANIES.map((company) => company.id)).toEqual([
      'google', 'amazon', 'microsoft', 'meta', 'apple', 'shopify',
      'stripe', 'uber', 'bloomberg', 'datadog', 'snowflake', 'nvidia',
    ]);
    expect(new Set(COMPANIES.map((company) => company.id)).size).toBe(12);
    for (const company of COMPANIES) {
      expect(company.name.trim()).not.toBe('');
      expect(Object.keys(company).sort()).toEqual(['id', 'name']);
    }
  });

  it('attributes only known slugs/companies with HTTPS source, valid known dates and qualification', () => {
    const knownCompanies = new Set<string>(COMPANIES.map((company) => company.id));
    const keys = new Set<string>();
    for (const evidence of COMPANY_EVIDENCE) {
      expect(getProblem(evidence.slug)).toBeDefined();
      expect(knownCompanies.has(evidence.companyId)).toBe(true);
      expect(evidence.source.kind).toBe('self-reported-interview');
      expect(new URL(evidence.source.url).protocol).toBe('https:');
      expect(new URL(evidence.source.url).hostname).toBe('leetcode.com');
      expect(evidence.source.title.trim()).not.toBe('');
      expect(validDate(evidence.source.snapshotDate)).toBe(true);
      if (evidence.source.reportedDate !== undefined) {
        expect(validDate(evidence.source.reportedDate)).toBe(true);
        expect(evidence.source.reportedDate <= evidence.source.snapshotDate).toBe(true);
      }
      const interview = evidence.source.interviewDate;
      if (interview !== undefined) {
        // Leap year permits any potentially valid month/day when the year is unknown.
        const year = interview.year ?? 2000;
        const date = `${year}-${String(interview.month).padStart(2, '0')}-${String(interview.day).padStart(2, '0')}`;
        expect(validDate(date)).toBe(true);
      }
      expect(evidence.label).toMatch(/^Reported at /);
      expect(evidence.qualification.trim().length).toBeGreaterThan(20);
      expect(evidence.association).toBe('related-variant');
      const key = `${evidence.companyId}:${evidence.slug}:${evidence.source.url}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(COMPANY_EVIDENCE_DISCLAIMER).toContain('self-report');
    expect(COMPANY_EVIDENCE_DISCLAIMER).toContain('unknown');
  });

  it('keeps the sole approved Amazon variation distinct from exact canonical evidence and unknown dates', () => {
    expect(COMPANY_EVIDENCE).toHaveLength(1);
    const evidence = COMPANY_EVIDENCE[0]!;
    expect(evidence.companyId).toBe('amazon');
    expect(evidence.slug).toBe('lru-cache');
    expect(evidence.label).toContain('variation');
    expect(evidence.qualification).toContain('not verified');
    expect(evidence.source.reportedDate).toBeUndefined();
    expect(evidence.source.interviewDate).toEqual({ month: 12, day: 13 });
  });

  it('represents absent evidence as unknown, including a company filter on an otherwise reported topic', () => {
    expect(getCompanyEvidence('two-sum')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('lru-cache', 'google')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('unknown-slug')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('lru-cache', 'amazon')).toEqual({ status: 'reported', evidence: COMPANY_EVIDENCE });
    expect(getCompanyEvidence('lru-cache')).toEqual({ status: 'reported', evidence: COMPANY_EVIDENCE });
  });
});
