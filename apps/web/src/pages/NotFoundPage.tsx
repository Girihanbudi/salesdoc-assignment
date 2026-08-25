import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button.js';
import { Card } from '@/components/ui/card.js';
import { useToast } from '@/hooks/useToasts.js';
import { PATHS } from '@/routes/paths.js';

/**
 * Shown for any unknown path.
 *
 * It does *not* auto-redirect. Bouncing instantly hides the fact that the URL
 * was wrong, which is worse when the link came from somewhere — a bookmark, a
 * teammate — and the person needs to know it is dead. The toast records it and
 * the way back is one obvious click.
 *
 * @returns the 404 page
 */
export function NotFoundPage() {
  const { push } = useToast();

  useEffect(() => {
    push('error', 'That page does not exist', `No route for ${window.location.pathname}`);
  }, [push]);

  return (
    <Card className="p-12 text-center">
      <p className="text-5xl font-bold tracking-tight">404</p>
      <p className="mt-3 text-muted">
        <code className="rounded bg-bg px-1.5 py-0.5 text-sm">{window.location.pathname}</code>{' '}
        is not a page in this app.
      </p>
      <Link
        to={PATHS.dashboard}
        className={`mt-6 inline-flex ${buttonVariants()}`}
      >
        Back to dashboard
      </Link>
    </Card>
  );
}
