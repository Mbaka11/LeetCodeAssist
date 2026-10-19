import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutcomeForm } from './OutcomeForm';

const noop = (): void => undefined;
const note = 'Accepted was detected at 23:14, and you used no hints, so “Solo” is pre-selected.';

function render(props: { hintsUsed?: number; initialOutcome?: 'solo'; detectedNote?: string }): string {
  return renderToStaticMarkup(<OutcomeForm initialMinutes={12} today="2025-01-06" onSubmit={noop} onCancel={noop} {...props} />);
}

describe('OutcomeForm with a detected Accepted verdict', () => {
  it('pre-selects Solo with an explanation but keeps the logged time from the timer', () => {
    const html = render({ initialOutcome: 'solo', detectedNote: note });
    expect(html).toMatch(/checked="" value="solo"/);
    expect(html).toContain('Accepted was detected');
    expect(html).toContain('value="12"');
  });

  it('keeps Hint pre-selected when hints were used, ignoring the detected hint', () => {
    const html = render({ hintsUsed: 2, initialOutcome: 'solo', detectedNote: note });
    expect(html).toMatch(/checked="" value="hint"/);
    expect(html).not.toMatch(/checked="" value="solo"/);
    expect(html).not.toContain('Accepted was detected');
  });

  it('pre-selects nothing without detection', () => {
    expect(render({})).not.toContain('checked=""');
  });
});
