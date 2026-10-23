import { COMPANIES, COMPANY_EVIDENCE, companyInterviewEnabled, companyInterviewSlugs, type CompanyId } from '../data/companies';
import { DRILL_ALSO_VALID, NEVER_OFFERED_AS_WRONG, RELATED_TAG_GROUPS } from '../data/drillAmbiguity';
import { DRILL_CONTENT, type DrillContent } from '../data/drills';
import { NEETCODE_150 } from '../data/neetcode150';
import { DATA_STRUCTURE_TAGS, PROBLEM_TAGS, TECHNIQUE_TAGS, type MetadataProblemSlug } from '../data/problemMetadata';
import { INTERVIEW_STEPS, type DrillKind, type InterviewChecklist } from './practiceTypes';
import type { AppState, Problem } from './types';

/** Only actual started/completed work, imported learned status, or an explicit solved check qualifies.
 * Planned/skipped work, notes, favorites and these practice sessions never unlock spoiler content.
 */
export function workedSlugs(state: AppState): Set<string> {
  return new Set([
    ...state.activities.filter((a) => a.status === 'done' || a.status === 'in_progress').map((a) => a.slug),
    ...Object.entries(state.checked).filter(([, flag]) => flag).map(([slug]) => slug),
    ...Object.entries(state.problemStatus).filter(([, status]) => status !== 'untouched').map(([slug]) => slug),
  ]);
}

export interface SimulationPool {
  includeUnworked: boolean;
  difficulty: string;
  category: string;
  companyId?: CompanyId;
}
export function simulationPool(state: AppState, options: SimulationPool): Problem[] {
  const worked = workedSlugs(state);
  if (options.companyId && !companyInterviewEnabled(options.companyId)) return [];
  return NEETCODE_150.filter((p) =>
    (!options.companyId ? options.includeUnworked || worked.has(p.slug) :
      companyInterviewSlugs(options.companyId).includes(p.slug)) &&
    (!options.difficulty || p.difficulty === options.difficulty) &&
    (!options.category || p.category === options.category));
}

/** Each distinct exact topic gets weight 3, each variant-only topic weight 1. This is an editorial
 * sampling choice, NEVER an estimate of interview frequency/probability. Duplicate sources add no weight.
 */
export function drawSimulation(pool: readonly Problem[], companyId?: CompanyId, random = Math.random): Problem | undefined {
  const weights = pool.map((p) => companyId && COMPANY_EVIDENCE.some((e) => e.companyId === companyId && e.slug === p.slug && e.association === 'exact') ? 3 : 1);
  let cursor = random() * weights.reduce((sum, n) => sum + n, 0);
  return pool.find((_, index) => { cursor -= weights[index]!; return cursor < 0; });
}
export function emptyChecklist(): InterviewChecklist {
  return Object.fromEntries(Object.keys(INTERVIEW_STEPS).map((key) => [key, false])) as InterviewChecklist;
}
export function companyName(id: CompanyId): string {
  return COMPANIES.find((c) => c.id === id)!.name;
}

export interface DrillChoice { text: string; correct: boolean; explanation: string }
export interface DrillQuestion {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: DrillKind;
  choices: DrillChoice[];
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Tags that must never be offered as a wrong answer for a problem: its registered tags, curated also-valid
 * alternatives, generic tags, and every member of a related group that any registered tag belongs to.
 */
export function tagsNeverOfferedAsWrong(slug: string): ReadonlySet<string> {
  const registered: readonly string[] = [...PROBLEM_TAGS[slug as MetadataProblemSlug].techniques, ...PROBLEM_TAGS[slug as MetadataProblemSlug].dataStructures];
  const excluded = new Set<string>([...registered, ...NEVER_OFFERED_AS_WRONG, ...(DRILL_ALSO_VALID[slug as keyof typeof DRILL_ALSO_VALID] ?? [])]);
  for (const group of RELATED_TAG_GROUPS) if (group.some((tag) => registered.includes(tag))) for (const tag of group) excluded.add(tag);
  return excluded;
}

/** Technique key: the first registered technique that is not the vague "Simulation". No key means no question. */
function techniqueKey(techniques: readonly string[]): string | undefined {
  return techniques.find((tag) => tag !== 'Simulation');
}

export function drillQuestions(state: AppState, options: { includeUnworked: boolean; kind: DrillKind | 'mixed'; count: number }, random = Math.random): DrillQuestion[] {
  const worked = workedSlugs(state);
  const questions: DrillQuestion[] = [];
  for (const [slug, raw] of Object.entries(DRILL_CONTENT)) {
    const content: DrillContent = raw;
    const isWorked = worked.has(slug);
    if (!isWorked && !options.includeUnworked) continue;
    const problem = NEETCODE_150.find((p) => p.slug === slug)!;
    const tags = PROBLEM_TAGS[slug as MetadataProblemSlug];
    for (const kind of ['technique', 'structure', 'outline'] as const) {
      if (options.kind !== 'mixed' && options.kind !== kind) continue;
      if (kind === 'outline' && !isWorked) continue;
      let choices: DrillChoice[];
      if (kind === 'outline') {
        choices = [
          { text: content[1], correct: true, explanation: content[2] },
          { text: content[3], correct: false, explanation: content[4] },
          { text: content[5], correct: false, explanation: content[6] },
        ];
      } else {
        // Prefer the specialized structure over generic Array/String where multiple tags exist.
        const correct = kind === 'structure' ? tags.dataStructures.at(-1) : techniqueKey(tags.techniques);
        // A generic Array/String key against Trie/Graph distractors is trivial: skip it like a Simulation-only technique.
        if (!correct || (kind === 'structure' && (correct === 'Array' || correct === 'String'))) continue;
        const vocab = kind === 'technique' ? TECHNIQUE_TAGS : DATA_STRUCTURE_TAGS;
        const never = tagsNeverOfferedAsWrong(slug);
        const distractors = shuffled(vocab.filter((tag) => !never.has(tag)), random).slice(0, 3);
        // The outline rationale is the problem's core insight: only worked problems may show it. Others get tag-level wording.
        const correctExplanation = isWorked ? `${content[2]} ${correct} is one useful editorial choice here; it is not the only possible approach.` : `${correct} is one useful editorial choice for this problem; other approaches can also work.`;
        const wrongExplanation = isWorked ? `The intended choice among these options is ${correct}. ${content[2]}` : `The choice this drill intends among these options is ${correct}; this one is not it.`;
        choices = [{ text: correct, correct: true, explanation: correctExplanation },
          ...distractors.map((text) => ({ text, correct: false, explanation: wrongExplanation }))];
      }
      questions.push({ id: `${slug}:${kind}`, slug, title: problem.title, summary: content[0], kind, choices: shuffled(choices, random) });
    }
  }
  return shuffled(questions, random).slice(0, Math.max(0, Math.min(20, Math.floor(options.count))));
}
