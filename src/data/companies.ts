import type { MetadataProblemSlug } from './problemMetadata';

/** Plain-text names only: no logo asset permissions have been established. */
export const COMPANIES = [
  { id: 'google', name: 'Google' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'meta', name: 'Meta' },
  { id: 'apple', name: 'Apple' },
  { id: 'shopify', name: 'Shopify' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'uber', name: 'Uber' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'datadog', name: 'Datadog' },
  { id: 'snowflake', name: 'Snowflake' },
  { id: 'nvidia', name: 'NVIDIA' },
] as const;

export type CompanyDefinition = (typeof COMPANIES)[number];
export type CompanyId = CompanyDefinition['id'];
export type MetadataDate = `${number}-${number}-${number}`;

export interface CompanyEvidence {
  readonly companyId: CompanyId;
  readonly slug: MetadataProblemSlug;
  readonly association: 'exact' | 'related-variant';
  /** Confidence in the topic mapping, not independent confirmation of the interview claim. */
  readonly confidence?: 'high' | 'medium';
  /** Display this qualified label, not an unqualified "asked" badge. */
  readonly label: string;
  readonly qualification: string;
  /**
   * `false`: the source reports no coding question (for example a system-design discussion). The row stays as
   * provenance in the Roadmap but never feeds a mock coding interview or the five-problem threshold.
   */
  readonly codingReported?: false;
  readonly source: {
    readonly kind: 'self-reported-interview';
    readonly url: `https://${string}`;
    readonly title: string;
    /** Date this research snapshot was integrated; not a fresh source fetch or interview date. */
    readonly snapshotDate: MetadataDate;
    /** Publication date, only when known. Absent means unknown. */
    readonly reportedDate?: MetadataDate;
    readonly reportedDateBasis?: 'page' | 'company-listing';
    /** Partial/qualified date as reported; never expand it into an inferred full date. */
    readonly interviewPeriod?: string;
    readonly caveat?: string;
    /** A source may give month/day without a year; never infer that year. */
    readonly interviewDate?: { readonly month: number; readonly day: number; readonly year?: number };
  };
}

export const COMPANY_EVIDENCE_DISCLAIMER =
  'Reported at a company in a public candidate self-report, not independently confirmed or employer-endorsed. A related variant is not a verified canonical LeetCode question. Missing evidence means unknown, not never asked.';

/** Public research snapshot: factual associations only, never report prose or company-tag exports. */
export const COMPANY_EVIDENCE: readonly CompanyEvidence[] = [
  {
    companyId: 'amazon',
    slug: 'lru-cache',
    association: 'related-variant',
    label: 'Reported at Amazon — LRU Cache variation',
    qualification: 'A candidate report describes an LRU Cache variation. The mapping to this roadmap topic is editorial; the exact canonical question is not verified.',
    source: {
      kind: 'self-reported-interview',
      url: 'https://leetcode.com/discuss/post/6304191/Amazon-India-or-SDE-1-or-University-Grad/',
      title: 'Amazon India | SDE-1 | University Grad',
      snapshotDate: '2026-10-20',
      interviewDate: { month: 12, day: 13 },
    },
  },
  {
    "companyId": "google",
    "slug": "two-sum",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Google — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-l4-software-engineer-india-aug-2026-reject",
      "title": "Google | L4 | Software Engineer | India | Aug 2026 | Reject",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "August 2026 (title only)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "google",
    "slug": "number-of-islands",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Google — related variant",
    "qualification": "A satellite-grid connectivity task with a lakes follow-up is mapped to this grid-traversal topic; not the canonical question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-l4-interview-experience-date-october-5th-2026",
      "title": "Google L4 Interview Experience Date October 5th 2026",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "October 5, 2026",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "google",
    "slug": "find-median-from-data-stream",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Google — related variant",
    "qualification": "The report concerns medians over subarrays, not the canonical streaming interface.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-swe-internship-interview-experience",
      "title": "Google SWE Internship Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "google",
    "slug": "merge-intervals",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Google — related variant",
    "qualification": "The candidate explicitly describes a twist on interval merging; its exact specification is not verified.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-l4-swe-iii-phone-screen-zurich",
      "title": "Google - L4 SWE III - phone screen - Zurich",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "google",
    "slug": "course-schedule-ii",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Google — related variant",
    "qualification": "The candidate explicitly links a variation of the ordering problem, not the canonical specification.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-l3-interview-experience-onsite",
      "title": "Google L3 interview Experience (onsite)",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "google",
    "slug": "coin-change",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Google — related variant",
    "qualification": "The candidate describes a coin-change variation, not the canonical specification.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/google/google-interview-experience-google-university-graduate-2026",
      "title": "Google Interview Experience – Google University Graduate 2026",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "reverse-nodes-in-k-group",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback",
      "title": "Amazon SDE II Interview Experience + Need Honest Feedback",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "number-of-islands",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback",
      "title": "Amazon SDE II Interview Experience + Need Honest Feedback",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "longest-substring-without-repeating-characters",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback",
      "title": "Amazon SDE II Interview Experience + Need Honest Feedback",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "serialize-and-deserialize-binary-tree",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback",
      "title": "Amazon SDE II Interview Experience + Need Honest Feedback",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "house-robber",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026",
      "title": "Amazon SDE 1 Interview Experience 2026",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February 4 (narrative year unspecified; title says 2026)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "lru-cache",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026",
      "title": "Amazon SDE 1 Interview Experience 2026",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February 4 (narrative year unspecified; title says 2026)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "course-schedule-ii",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026",
      "title": "Amazon SDE 1 Interview Experience 2026",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "largest-rectangle-in-histogram",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Amazon — related variant",
    "qualification": "The candidate describes a similar histogram task, not a verified canonical question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026",
      "title": "Amazon SDE 1 Interview Experience 2026",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February 24 (year unspecified)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "search-in-rotated-sorted-array",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-offer-received",
      "title": "Amazon SDE-1 Interview Experience | Offer Received",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "May 8, 2026 (narrative heading)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "rotting-oranges",
    "association": "related-variant",
    "confidence": "high",
    "label": "Reported at Amazon — related variant",
    "qualification": "The candidate explicitly describes a variation of the grid-spread problem.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-offer-received",
      "title": "Amazon SDE-1 Interview Experience | Offer Received",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "May 8, 2026 (narrative heading)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "merge-intervals",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-2-l5-bangalore-interview-experience",
      "title": "Amazon SDE 2 (L5) | Bangalore | Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "product-of-array-except-self",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Amazon — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-2-l5-bangalore-interview-experience",
      "title": "Amazon SDE 2 (L5) | Bangalore | Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "koko-eating-bananas",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Amazon — related variant",
    "qualification": "A rate-search task is described as similar; the mapping to this canonical topic is editorial.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-2-experience",
      "title": "Amazon SDE-2 Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "amazon",
    "slug": "find-median-from-data-stream",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Amazon — related variant",
    "qualification": "The candidate describes a related median task, not a verified canonical streaming interface.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/amazon/amazon-sde-2-experience",
      "title": "Amazon SDE-2 Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "meeting-rooms-ii",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Microsoft — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/microsoft-sde-ii-interview-experience",
      "title": "Microsoft - SDE II Interview experience",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February 27, 2026",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "letter-combinations-of-a-phone-number",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Microsoft — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/microsoft-sde-2-interview-experience-hyderabad-rejected",
      "title": "Microsoft | SDE 2 | Interview Experience | Hyderabad | Rejected",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "December 2025",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "number-of-islands",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Microsoft — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/microsoft-sde-2-interview-experience-hyderabad-rejected",
      "title": "Microsoft | SDE 2 | Interview Experience | Hyderabad | Rejected",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "December 2025",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "gas-station",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Microsoft — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/microsoft-swe-internship-march-2025",
      "title": "Microsoft | SWE internship | March 2025",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "March 2025",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "word-search",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Microsoft — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/my-microsoft-on-campus-internship-interview-experience",
      "title": "My Microsoft On-Campus Internship Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "microsoft",
    "slug": "longest-repeating-character-replacement",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Microsoft — related variant",
    "qualification": "The candidate explicitly describes a variation, not the canonical specification.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/microsoft/sde-2-microsoft-interview-experience",
      "title": "SDE 2 Microsoft Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "lru-cache",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1",
      "title": "Meta E4 | Onsite | Reject",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "word-ladder",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1",
      "title": "Meta E4 | Onsite | Reject",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "daily-temperatures",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Meta — related variant",
    "qualification": "The candidate describes a very similar task; the canonical specification is not verified.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1",
      "title": "Meta E4 | Onsite | Reject",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "binary-tree-right-side-view",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-onsite-e5-infra",
      "title": "Meta Onsite E5 Infra",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "diameter-of-binary-tree",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e5-full-loop",
      "title": "Meta E5 Full Loop",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "k-closest-points-to-origin",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e6-ml-swe-downlevel",
      "title": "Meta E6 ML-SWE / Downlevel",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "kth-largest-element-in-an-array",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Meta — related variant",
    "qualification": "The reported selection variant returns an index rather than just a value.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e6-ml-swe-downlevel",
      "title": "Meta E6 ML-SWE / Downlevel",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "minimum-window-substring",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e5-prod-onsite-us-rejected",
      "title": "Meta | E5 (Prod) Onsite | U.S. | Rejected",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "meta",
    "slug": "powx-n",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Meta — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/meta/meta-e5-prod-onsite-us-rejected",
      "title": "Meta | E5 (Prod) Onsite | U.S. | Rejected",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "valid-sudoku",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Apple — related variant",
    "qualification": "The report concerns checking a completed board; this is related to, not identical with, the canonical validation task.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-interview-experience-full-stack-software-engineer",
      "title": "Apple interview experience - Full Stack Software engineer",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "merge-intervals",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-interview-experience-full-stack-software-engineer",
      "title": "Apple interview experience - Full Stack Software engineer",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "spiral-matrix",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-full-stack-developer-interview",
      "title": "Apple Full Stack Developer Interview",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "rotate-image",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-interview-experience",
      "title": "Apple Interview Experience (Reliability Eng. IS&T Intern)",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "merge-k-sorted-lists",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-interview-experience",
      "title": "Apple Interview Experience (Reliability Eng. IS&T Intern)",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "lru-cache",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-interview-experience",
      "title": "Apple Interview Experience (Reliability Eng. IS&T Intern)",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "coin-change",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-junior-software-engineer-ict-2-offcampus",
      "title": "Apple | Junior Software Engineer (ICT-2) | Offcampus",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "apple",
    "slug": "coin-change-ii",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Apple — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/apple/apple-junior-software-engineer-ict-2-offcampus",
      "title": "Apple | Junior Software Engineer (ICT-2) | Offcampus",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "uber",
    "slug": "alien-dictionary",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Uber — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/uber/uber-sde-2-l4-interview-2026-pending-results",
      "title": "Uber | SDE-2 (L4) | Interview | 2026 | Pending Results",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February–March 2026",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "uber",
    "slug": "design-twitter",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Uber — related variant",
    "qualification": "The report concerns an in-memory microblog machine-coding exercise; scope may differ from the canonical data-structure problem.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/uber/uber-sde-2-l4-interview-2026-pending-results",
      "title": "Uber | SDE-2 (L4) | Interview | 2026 | Pending Results",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "February–March 2026",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "uber",
    "slug": "cheapest-flights-within-k-stops",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Uber — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/uber/uber-software-engineer-ii-se-2-bangalore-interview-experience",
      "title": "Uber | Software Engineer II (SE-2) | Bangalore | Interview Experience",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "uber",
    "slug": "find-median-from-data-stream",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Uber — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/uber/uber-sde-ii-interview-experience-2",
      "title": "Uber SDE-II Interview Experience",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "April 2026",
      "reportedDate": "2026-08-22",
      "reportedDateBasis": "company-listing",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "uber",
    "slug": "reverse-nodes-in-k-group",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at Uber — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/uber/uber-l4-interview-experience-ongoing",
      "title": "Uber L4 Interview Experience Ongoing",
      "snapshotDate": "2026-10-23",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "rotting-oranges",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-interview-sse-bquant-sf-2026-reject",
      "title": "Bloomberg Interview SSE - Bquant | SF | 2026 | Reject",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2026-02-08",
      "reportedDateBasis": "company-listing",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "validate-binary-search-tree",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-sse-screen-round",
      "title": "Bloomberg SSE screen round",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2026-02-26",
      "reportedDateBasis": "company-listing",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "implement-trie-prefix-tree",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Bloomberg — related variant",
    "qualification": "The report concerns prefix-based word retrieval; the mapping to the canonical trie interface is editorial.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-sse-screen-round",
      "title": "Bloomberg SSE screen round",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2026-02-26",
      "reportedDateBasis": "company-listing",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "longest-substring-without-repeating-characters",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted",
      "title": "Bloomberg | July 2022 | Offer Accepted",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "July 2022 (title)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "subsets",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted",
      "title": "Bloomberg | July 2022 | Offer Accepted",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "July 2022 (title)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "subsets-ii",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted",
      "title": "Bloomberg | July 2022 | Offer Accepted",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "July 2022 (title)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "lru-cache",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at Bloomberg — related variant (no coding reported)",
    "qualification": "The report describes a design discussion and no coding was reported, so this is not a coding-question claim. It is shown as provenance only and is never used for mock coding interviews or the five-problem threshold.",
    "codingReported": false,
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted",
      "title": "Bloomberg | July 2022 | Offer Accepted",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "July 2022 (title)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "bloomberg",
    "slug": "two-sum",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at Bloomberg — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted",
      "title": "Bloomberg | July 2022 | Offer Accepted",
      "snapshotDate": "2026-10-23",
      "interviewPeriod": "July 2022 (title)",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "serialize-and-deserialize-binary-tree",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://interviewexperiences.in/experience/nvidia/nvidia-interview-experiencerejection",
      "title": "NVIDIA interview experience(rejection)",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2025-06-04",
      "reportedDateBasis": "company-listing",
      "caveat": "User-submitted narrative; this host may mirror or rewrite other reports. Authorship and employer confirmation were not independently established."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "two-sum",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.jointaro.com/interviews/companies/nvidia/experiences/software-engineer-israel-tx-july-18-2024-no-offer-positive-e25051dd/",
      "title": "Nvidia Software Engineer Interview Experience - Israel, Texas",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2024-07-18",
      "reportedDateBasis": "page",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "set-matrix-zeroes",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at NVIDIA — related variant",
    "qualification": "The report starts from ones in a binary matrix and clears their rows/columns; the canonical zero-trigger rule differs.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.jointaro.com/interviews/companies/nvidia/experiences/asic-verification-engineer-israel-december-20-2023-no-offer-neutral-dab62e25/",
      "title": "Nvidia ASIC Verification Engineer Interview Experience - Israel",
      "snapshotDate": "2026-10-23",
      "reportedDate": "2023-12-20",
      "reportedDateBasis": "page",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "reverse-linked-list",
    "association": "exact",
    "confidence": "high",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-fw-developer/",
      "title": "Nvidia Interview Experience For FW developer - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "number-of-1-bits",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-fw-developer/",
      "title": "Nvidia Interview Experience For FW developer - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "reverse-nodes-in-k-group",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at NVIDIA — related variant",
    "qualification": "The report extends pairwise linked-list swaps to larger groups; canonical group-reversal details are not verified.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/",
      "title": "Nvidia Interview Experience for SDE-2 - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "search-in-rotated-sorted-array",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/",
      "title": "Nvidia Interview Experience for SDE-2 - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "min-stack",
    "association": "related-variant",
    "confidence": "medium",
    "label": "Reported at NVIDIA — related variant",
    "qualification": "The report adds constant extra-space constraints; this is a qualified variant of the minimum-stack topic.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/",
      "title": "Nvidia Interview Experience for SDE-2 - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
  {
    "companyId": "nvidia",
    "slug": "add-two-numbers",
    "association": "exact",
    "confidence": "medium",
    "label": "Reported at NVIDIA — canonical topic",
    "qualification": "The candidate narrative names, links or clearly describes this canonical topic without a stated twist. This remains an uncorroborated self-report, not an employer-confirmed question.",
    "source": {
      "kind": "self-reported-interview",
      "url": "https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-software-engineer/",
      "title": "Nvidia Interview Experience for Software Engineer - GeeksforGeeks",
      "snapshotDate": "2026-10-23",
      "caveat": "Public candidate account; identity and employer confirmation were not independently established. Systems/firmware role context may not generalize to other roles."
    }
  },
];

export type CompanyEvidenceCoverage =
  | { readonly status: 'unknown'; readonly evidence: readonly [] }
  | { readonly status: 'reported'; readonly evidence: readonly CompanyEvidence[] };

/** Optional company filter; an empty research result is explicitly unknown, never a negative claim. */
export function getCompanyEvidence(slug: string, companyId?: CompanyId): CompanyEvidenceCoverage {
  const evidence = COMPANY_EVIDENCE.filter(
    (row) => row.slug === slug && (companyId === undefined || row.companyId === companyId),
  );
  return evidence.length === 0 ? { status: 'unknown', evidence: [] } : { status: 'reported', evidence };
}

/** Distinct documented exact and qualified-variant coding slugs, not number of mentions. Rows reporting no coding are excluded. */
export function companyInterviewSlugs(companyId: CompanyId): string[] {
  return [...new Set(COMPANY_EVIDENCE.filter((row) => row.companyId === companyId && row.codingReported !== false).map((row) => row.slug))];
}
export const COMPANY_INTERVIEW_MIN_PROBLEMS = 5;
export function companyInterviewEnabled(companyId: CompanyId): boolean {
  return companyInterviewSlugs(companyId).length >= COMPANY_INTERVIEW_MIN_PROBLEMS;
}
