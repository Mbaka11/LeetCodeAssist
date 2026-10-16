import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutcomeForm } from './OutcomeForm';

const noop = (): void => undefined;

function render(hintsUsed?: number): string {
  return renderToStaticMarkup(
    <OutcomeForm initialMinutes={20} hintsUsed={hintsUsed} onSubmit={noop} onCancel={noop} />,
  );
}

/** The radio `value` that is checked, or null. */
function checkedOutcome(html: string): string | null {
  return /<input type="radio"[^>]*value="(\w+)"[^>]*checked=""|<input type="radio"[^>]*checked=""[^>]*value="(\w+)"/.exec(html)
    ?.slice(1)
    .find(Boolean) ?? null;
}

describe('OutcomeForm hint pre-selection', () => {
  it('pre-selects "Hint" and explains why when hints were revealed', () => {
    for (const hints of [1, 2, 3]) {
      const html = render(hints);
      expect(checkedOutcome(html)).toBe('hint');
      expect(html).toContain(`You revealed ${hints} ${hints === 1 ? 'hint' : 'hints'} during this attempt`);
      expect(html).toContain('pre-selected');
    }
  });

  it('keeps the other outcomes selectable (the pre-selection is only a default)', () => {
    const html = render(2);
    for (const value of ['solo', 'hint', 'solution', 'stuck']) expect(html).toContain(`value="${value}"`);
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it('selects nothing and shows no note without hints', () => {
    for (const hints of [undefined, 0]) {
      const html = render(hints);
      expect(checkedOutcome(html)).toBeNull();
      expect(html).not.toContain('You revealed');
    }
  });
});
