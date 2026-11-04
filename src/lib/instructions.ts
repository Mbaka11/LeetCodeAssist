import type { ActivityType, Difficulty, Outcome, ProblemStatus } from '../core/types';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  new: 'New',
  recall: 'Recall',
  rebuild: 'Rebuild',
  resolve: 'Re-solve',
  blind: 'Blind',
  retry: 'Retry',
  benchmark: 'Benchmark',
};

export const ACTIVITY_INSTRUCTIONS: Record<ActivityType, string> = {
  new: 'Search, code, understand, write notes. Help ladder: take a hint at 15–20 min without an approach; at 35–45 min read the solution, then re-code it from memory.',
  recall:
    'Retrieval only, no editor and no code: from memory, write 4–5 lines: the approach, why it works, the edge cases, and the time and space complexity. If you cannot, that is the finding: open your notes, then log Hint or Stuck.',
  rebuild:
    'Write the solution again from your own notes, not the old code: pseudocode first, then code, then run the edge cases. Stop at the budget and compare with your notes afterwards.',
  resolve:
    'Interview conditions: blank editor and a timer, no notes, no hints. Code it, test with your own cases and say the complexity out loud. Solved within the budget counts as Solo.',
  blind: 'Solve with the category hidden. Solved alone means mastered.',
  retry: 'Targeted redo of a review you failed yesterday.',
  benchmark:
    'Timed and unseen. Treat it like an interview: no hints, no notes. Budget about 30 min per problem.',
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  solo: 'Solo',
  hint: 'Hint',
  solution: 'Solution',
  stuck: 'Stuck',
};

export const OUTCOME_DESCRIPTIONS: Record<Outcome, string> = {
  solo: 'Solved on my own',
  hint: 'Needed a hint',
  solution: 'Read the solution',
  stuck: 'Could not finish',
};

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  untouched: 'Untouched',
  learning: 'Learning',
  consolidating: 'Consolidating',
  reviewed: 'Reviewed',
  mastered: 'Mastered',
};

export const STATUS_TONES: Record<ProblemStatus, 'neutral' | 'warn' | 'good'> = {
  untouched: 'neutral',
  learning: 'neutral',
  consolidating: 'warn',
  reviewed: 'good',
  mastered: 'good',
};

export function difficultyTone(difficulty: Difficulty): 'easy' | 'medium' | 'hard' {
  return difficulty === 'Easy' ? 'easy' : difficulty === 'Medium' ? 'medium' : 'hard';
}
