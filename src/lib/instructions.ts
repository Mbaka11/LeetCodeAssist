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
    'Without notes: state the approach, why it works, and the time and space complexity.',
  rebuild: 'Rebuild the algorithm in pseudocode or code, then check the edge cases.',
  resolve: 'Solve from a blank editor: no hints, no old solution.',
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
