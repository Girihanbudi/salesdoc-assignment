import type { CallStatus, CrmSyncStatus } from '@salesdoc/shared';
import { cn } from '@/lib/utils.js';

/**
 * Visual treatment per call status.
 *
 * Every entry carries a text label as well as a colour: colour alone must
 * never be the only signal for state.
 */
export const CALL_STATUS_STYLES: Record<CallStatus, { label: string; className: string }> = {
  DIALING: { label: 'Dialing', className: 'bg-ink/5 text-ink' },
  CONNECTED: { label: 'Connected', className: 'bg-accent text-accent-ink' },
  NO_ANSWER: { label: 'No answer', className: 'bg-ink/5 text-muted' },
  BUSY: { label: 'Busy', className: 'bg-neg/10 text-neg' },
  VOICEMAIL: { label: 'Voicemail', className: 'bg-ink/5 text-muted' },
  CANCELED_BY_DIALER: { label: 'Canceled by dialer', className: 'bg-ink/5 text-muted' },
};

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  status: CallStatus;
  className?: string;
}

/**
 * Labels a call's current status.
 *
 * @param props the status to render
 * @returns the badge element
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = CALL_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        style.className,
        className
      )}
    >
      {status === 'DIALING' && (
        <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-ink" aria-hidden />
      )}
      {style.label}
    </span>
  );
}

const CRM_SYNC_LABELS: Record<CrmSyncStatus, string> = {
  pending: 'Writing to CRM…',
  synced: 'CRM activity created',
  failed: 'CRM write failed',
};

const CRM_SYNC_STYLES: Record<CrmSyncStatus, string> = {
  pending: 'text-muted',
  synced: 'text-pos',
  failed: 'text-neg',
};

/** Props for {@link CrmSyncBadge}. */
export interface CrmSyncBadgeProps {
  status: CrmSyncStatus | null;
}

/**
 * Shows whether a call's CRM activity has been written yet.
 *
 * @param props the sync status, or null before a call terminates
 * @returns the badge element, or null when there is nothing to report
 */
export function CrmSyncBadge({ status }: CrmSyncBadgeProps) {
  if (status === null) return null;
  return (
    <span className={cn('flex items-center gap-1.5 text-xs', CRM_SYNC_STYLES[status])}>
      <span
        className={cn(
          'size-1.5 rounded-full bg-current',
          status === 'pending' && 'animate-pulse'
        )}
        aria-hidden
      />
      {CRM_SYNC_LABELS[status]}
    </span>
  );
}
