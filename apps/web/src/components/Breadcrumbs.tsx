import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** One step in the trail. The last has no `to` — it is where you are. */
export interface Crumb {
  label: string;
  to?: string;
}

/** Props for {@link Breadcrumbs}. */
export interface BreadcrumbsProps {
  trail: Crumb[];
}

/**
 * The path back out of a nested page.
 *
 * A detail page reached from a list has no other way back except the browser
 * button, which does not exist on a phone in standalone mode and is a guess
 * anywhere else. The last crumb is plain text and carries `aria-current`,
 * because a link to the page you are on is a dead control.
 *
 * @param props the trail, outermost first
 * @returns the breadcrumb nav
 */
export function Breadcrumbs({ trail }: BreadcrumbsProps) {
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={`${crumb.label}-${String(index)}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}

              {crumb.to !== undefined && !isLast ? (
                <Link
                  to={crumb.to}
                  className="rounded px-1 py-0.5 transition-colors hover:text-ink hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="truncate px-1 text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
