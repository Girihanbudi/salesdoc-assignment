import type { DialerSession } from '@salesdoc/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button.js';
import { Card } from '@/components/ui/card.js';
import { cn } from '@/lib/utils.js';
import { PATHS } from '@/routes/paths.js';

/** Props for {@link SessionsPage}. */
export interface SessionsPageProps {
  sessions: DialerSession[];
}

/**
 * Session history, newest first.
 *
 * @param props the sessions to list
 * @returns the history list
 */
export function SessionsPage({ sessions }: SessionsPageProps) {
  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center sm:p-12">
        <p className="text-muted">No sessions yet.</p>
        <Link to={PATHS.dial} className={`mt-5 inline-flex ${buttonVariants({ size: 'sm' })}`}>
          Start one
        </Link>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {sessions.map((session) => (
          <li key={session.id}>
            <Link
              to={PATHS.session(session.id)}
              className="flex items-center justify-between gap-4 px-5 py-5 sm:px-7 transition-colors hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <code className="truncate font-medium">{session.id}</code>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      session.status === 'RUNNING'
                        ? 'bg-accent text-accent-ink'
                        : 'bg-ink/5 text-muted'
                    )}
                  >
                    {session.status === 'RUNNING' ? 'Running' : 'Stopped'}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {session.metrics.attempted} attempted · {session.metrics.connected} connected ·{' '}
                  {session.metrics.failed} failed · {session.metrics.canceled} canceled
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
