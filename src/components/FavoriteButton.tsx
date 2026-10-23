import { useState } from 'react';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { Button } from './Button';

export function FavoriteButton({ slug, title, state, actions }: {
  slug: string; title: string; state: AppState; actions: AppActions;
}) {
  const [error, setError] = useState<string | null>(null);
  const favorite = state.favorites?.[slug] === true;
  return <>
    <Button aria-label={`Favorite ${title}`} aria-pressed={favorite}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={() => {
        setError(null);
        actions.toggleFavorite(slug).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
      }}><span aria-hidden="true">{favorite ? '★' : '☆'}</span></Button>
    {error ? <span className="error" role="alert">{error}</span> : null}
  </>;
}
