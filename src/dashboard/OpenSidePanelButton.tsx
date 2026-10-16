import { useState } from 'react';
import { Button } from '../components/Button';
import { openSidePanelInWindow } from '../lib/sidePanel';

/** Opens the global side panel in this window. Chrome only allows this from a user gesture, so it lives behind a click. */
export function OpenSidePanelButton() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="row">
      {message ? <span className="muted">{message}</span> : null}
      <Button
        onClick={() => {
          setMessage(null);
          openSidePanelInWindow().catch((e: unknown) =>
            setMessage(e instanceof Error ? e.message : String(e)),
          );
        }}
      >
        Open side panel
      </Button>
    </span>
  );
}
