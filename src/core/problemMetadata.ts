import { getCompanyEvidence, type CompanyEvidenceCoverage } from '../data/companies';
import { PROBLEM_TAGS, type MetadataProblemSlug, type ProblemTags } from '../data/problemMetadata';
import { SIMILAR_PROBLEMS, type SimilarProblem } from '../data/similarProblems';

export { COMPANIES, COMPANY_EVIDENCE, COMPANY_EVIDENCE_DISCLAIMER, getCompanyEvidence } from '../data/companies';
export type { CompanyDefinition, CompanyId, CompanyEvidence, CompanyEvidenceCoverage, MetadataDate } from '../data/companies';
export { DATA_STRUCTURE_TAGS, TECHNIQUE_TAGS } from '../data/problemMetadata';
export type { DataStructureTag, TechniqueTag, MetadataProblemSlug, ProblemTags } from '../data/problemMetadata';
export { SIMILAR_RELATIONS } from '../data/similarProblems';
export type { SimilarRelation, SimilarProblem } from '../data/similarProblems';

export interface ProblemMetadata extends ProblemTags {
  readonly slug: MetadataProblemSlug;
  readonly similarProblems: readonly SimilarProblem[];
  readonly companyEvidence: CompanyEvidenceCoverage;
}

const METADATA: ReadonlyMap<string, ProblemMetadata> = new Map(
  (Object.keys(PROBLEM_TAGS) as MetadataProblemSlug[]).map((slug) => [slug, {
    slug,
    ...PROBLEM_TAGS[slug],
    similarProblems: SIMILAR_PROBLEMS[slug],
    companyEvidence: getCompanyEvidence(slug),
  }]),
);

/** Static enrichment only: never reads history or changes catalogs, practice queues or review timing. */
export function getProblemMetadata(slug: string): ProblemMetadata | undefined {
  return METADATA.get(slug);
}
