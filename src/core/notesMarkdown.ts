import { getProblem } from '../data/neetcode150';
import type { AppState } from './types';

function text(value: string): string {
  return value.replace(/([\\`*_[\]<>#])/g, '\\$1');
}

/** Original user notes only; unknown problem slugs from older backups remain exportable. */
export function notesMarkdown(state: Pick<AppState, 'notes'>): string {
  const notes = Object.entries(state.notes).sort(([a], [b]) => a.localeCompare(b));
  if (notes.length === 0) return '# LeetCode Assist notes\n\nNo notes saved yet.\n';
  const sections = notes.map(([slug, note]) => {
    const problem = getProblem(slug);
    const fields = [
      `## ${text(problem?.title ?? slug)}`,
      `Category: ${text(problem?.category ?? 'Unknown')}  \nDifficulty: ${problem?.difficulty ?? 'Unknown'}`,
      ...(['trigger', 'principle', 'pitfall', 'complexity'] as const).map((key) =>
        `### ${key[0]!.toUpperCase()}${key.slice(1)}\n\n${text(note[key]) || '(empty)'}`),
    ];
    if (note.code) {
      const fence = '`'.repeat(Math.max(3, ...Array.from(note.code.matchAll(/`+/g), (match) => match[0].length + 1)));
      fields.push(`### Code\n\n${fence}python\n${note.code}\n${fence}`);
    } else fields.push('### Code\n\n(empty)');
    return fields.join('\n\n');
  });
  return `# LeetCode Assist notes\n\n${sections.join('\n\n---\n\n')}\n`;
}
