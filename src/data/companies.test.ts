import { describe, expect, it } from 'vitest';
import { getProblem } from './neetcode150';
import { COMPANIES, COMPANY_EVIDENCE, COMPANY_EVIDENCE_DISCLAIMER, companyInterviewEnabled, companyInterviewSlugs, getCompanyEvidence } from './companies';

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
      expect(['leetcode.com', 'interviewexperiences.in', 'www.geeksforgeeks.org', 'www.jointaro.com']).toContain(new URL(evidence.source.url).hostname);
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
      expect(['exact', 'related-variant']).toContain(evidence.association);
      const key = `${evidence.companyId}:${evidence.slug}:${evidence.source.url}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(COMPANY_EVIDENCE_DISCLAIMER).toContain('self-report');
    expect(COMPANY_EVIDENCE_DISCLAIMER).toContain('unknown');
  });

  it('retains the previously approved Amazon variation independently of new exact evidence and unknown dates', () => {
    expect(COMPANY_EVIDENCE).toHaveLength(66);
    const evidence = COMPANY_EVIDENCE[0]!;
    expect(evidence.companyId).toBe('amazon');
    expect(evidence.slug).toBe('lru-cache');
    expect(evidence.label).toContain('variation');
    expect(evidence.qualification).toContain('not verified');
    expect(evidence.source.reportedDate).toBeUndefined();
    expect(evidence.source.interviewDate).toEqual({ month: 12, day: 13 });
  });

  it('represents absent evidence as unknown, including a company filter on an otherwise reported topic', () => {
    expect(getCompanyEvidence('binary-search')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('lru-cache', 'google')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('unknown-slug')).toEqual({ status: 'unknown', evidence: [] });
    expect(getCompanyEvidence('lru-cache', 'amazon')).toEqual({ status: 'reported', evidence: COMPANY_EVIDENCE.filter((e) => e.slug === 'lru-cache' && e.companyId === 'amazon') });
    expect(getCompanyEvidence('lru-cache').evidence.length).toBeGreaterThan(2);
  });

  it('requires five distinct documented slugs and does not double-count the retained LRU report', () => {
    const counts = { google: 6, amazon: 14, microsoft: 6, meta: 9, apple: 8, shopify: 0, stripe: 0, uber: 5, bloomberg: 7, datadog: 0, snowflake: 0, nvidia: 9 };
    for (const company of COMPANIES) {
      expect(companyInterviewSlugs(company.id)).toHaveLength(counts[company.id]);
      expect(companyInterviewEnabled(company.id)).toBe(counts[company.id] >= 5);
    }
    expect(companyInterviewSlugs('bloomberg')).not.toContain('lru-cache');
    for (const row of COMPANY_EVIDENCE.slice(1)) {
      expect(row.confidence).toMatch(/high|medium/);
      expect(row.source.caveat).toBeTruthy();
      expect(row.source.snapshotDate).toBe('2026-10-23');
    }
  });

  it('keeps the Bloomberg design-discussion row as qualified provenance only, outside the coding pool and threshold', () => {
    const row = COMPANY_EVIDENCE.find((e) => e.companyId === 'bloomberg' && e.slug === 'lru-cache')!;
    expect(row.codingReported).toBe(false);
    expect(row.label).toContain('no coding reported');
    expect(row.qualification).toContain('no coding was reported');
    // Still visible as evidence, but not counted: Bloomberg has 8 evidence slugs and 7 coding slugs, above the threshold of 5.
    expect(new Set(COMPANY_EVIDENCE.filter((e) => e.companyId === 'bloomberg').map((e) => e.slug)).size).toBe(8);
    expect(companyInterviewSlugs('bloomberg')).toHaveLength(7);
    expect(companyInterviewEnabled('bloomberg')).toBe(true);
    expect(getCompanyEvidence('lru-cache', 'bloomberg').status).toBe('reported');
    // No other row is exempt: only rows that explicitly report no coding may carry the flag.
    expect(COMPANY_EVIDENCE.filter((e) => e.codingReported === false)).toEqual([row]);
  });
});
