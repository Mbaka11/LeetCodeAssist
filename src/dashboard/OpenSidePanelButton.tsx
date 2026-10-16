import { useState } from 'react';
import { Button } from '../components/Button';
import { openSidePanelOnLeetCode } from '../lib/sidePanel';

/** Opens the side panel on a LeetCode tab. Chrome only allows this from a user gesture, so it lives behind a click. */
export function OpenSidePanelButton() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="row">
      {message ? <span className="muted">{message}</span> : null}
      <Button
        onClick={() => {
          setMessage(null);
          openSidePanelOnLeetCode().then(
            (result) => {
              if (result === 'no-leetcode-tab') setMessage('Open a leetcode.com tab first.');
            },
            (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)),
          );
        }}
      >
        Open side panel
      </Button>
    </span>
  );
}
