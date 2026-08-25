import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { Toast, ToastTone } from '@/hooks/useToasts.js';
import { cn } from '@/lib/utils.js';

const TONE_ICON: Record<ToastTone, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

/**
 * Surface per severity, so the colour itself says how bad this is.
 *
 * The three alarming tones are deep enough that white text clears WCAG AA at
 * body size. Info stays on the page's own white card: the default carries no
 * alarm, and reserving colour for the cases that need it is what keeps those
 * readable at a glance.
 */
const TONE_SURFACE: Record<ToastTone, string> = {
  error: 'bg-[var(--color-toast-error)] text-white',
  warning: 'bg-[var(--color-toast-warning)] text-white',
  success: 'bg-[var(--color-toast-success)] text-white',
  info: 'bg-card text-ink ring-1 ring-line',
};

/** Second line, dimmed against whichever surface it sits on. */
const TONE_DETAIL: Record<ToastTone, string> = {
  error: 'text-white/75',
  warning: 'text-white/75',
  success: 'text-white/75',
  info: 'text-muted',
};

/** Dismiss control, matched to the surface. */
const TONE_DISMISS: Record<ToastTone, string> = {
  error: 'text-white/60 hover:bg-white/15 hover:text-white',
  warning: 'text-white/60 hover:bg-white/15 hover:text-white',
  success: 'text-white/60 hover:bg-white/15 hover:text-white',
  info: 'text-muted hover:bg-black/5 hover:text-ink',
};

/** Spoken prefix, so severity survives with the colour stripped out. */
const TONE_LABEL: Record<ToastTone, string> = {
  error: 'Error',
  warning: 'Warning',
  success: 'Success',
  info: 'Info',
};

/** Props for {@link Snackbar}. */
export interface SnackbarProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/**
 * Bottom-left stack of transient messages.
 *
 * `aria-live="polite"` so a screen reader announces a failure the user never
 * looked at, without interrupting what they are doing.
 *
 * @param props the queued toasts and the dismiss handler
 * @returns the snackbar region
 */
export function Snackbar({ toasts, onDismiss }: SnackbarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, x: -16, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-[var(--radius-tile)] p-4 shadow-[var(--shadow-card)]',
                TONE_SURFACE[toast.tone]
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />

              <div className="min-w-0 flex-1">
                {/* Colour must never be the only signal for severity. */}
                <span className="sr-only">{TONE_LABEL[toast.tone]}: </span>
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.detail !== undefined && (
                  <p className={cn('mt-0.5 text-xs', TONE_DETAIL[toast.tone])}>{toast.detail}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={`Dismiss: ${toast.title}`}
                className={cn(
                  '-m-1 rounded-full p-1 transition-colors',
                  TONE_DISMISS[toast.tone]
                )}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
