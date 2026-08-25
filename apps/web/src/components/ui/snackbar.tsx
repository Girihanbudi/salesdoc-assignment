import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { Toast, ToastTone } from '@/hooks/useToasts.js';
import { cn } from '@/lib/utils.js';

const TONE_ICON: Record<ToastTone, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

/** Colour carries tone, but the icon and wording carry it too — never colour alone. */
const TONE_STYLE: Record<ToastTone, string> = {
  error: 'text-neg',
  success: 'text-pos',
  info: 'text-muted',
};

/** Props for {@link Snackbar}. */
export interface SnackbarProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/**
 * Bottom-left stack of transient messages.
 *
 * `aria-live="polite"` so a screen reader announces a failure that the user
 * never looked at, without interrupting what they are doing.
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
              className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-tile)] bg-ink p-4 text-white shadow-[var(--shadow-card)]"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_STYLE[toast.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.detail !== undefined && (
                  <p className="mt-0.5 text-xs text-white/60">{toast.detail}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={`Dismiss: ${toast.title}`}
                className="-m-1 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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
