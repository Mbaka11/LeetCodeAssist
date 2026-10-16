import { useState, type ReactNode } from 'react';
import { Button } from './Button';

/** Two-step button: the first click asks for confirmation inline. */
export function ConfirmButton({
  children,
  prompt,
  confirmLabel = 'Yes, continue',
  onConfirm,
}: {
  children: ReactNode;
  prompt: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="danger" onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="confirm">
      <span>{prompt}</span>
      <Button
        variant="danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  );
}
