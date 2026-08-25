import { useCallback, useRef, useState } from 'react';

/** Severity, which drives both the colour and the icon. */
export type ToastTone = 'error' | 'success' | 'info';

/** One message queued for display. */
export interface Toast {
  id: number;
  tone: ToastTone;
  /** One line. What happened. */
  title: string;
  /** Optional second line: what to do about it. */
  detail?: string;
}

/** How long a toast stays before dismissing itself. Errors linger. */
const DISMISS_MS: Record<ToastTone, number> = {
  error: 8000,
  success: 4000,
  info: 5000,
};

/** What {@link useToasts} hands back. */
export interface ToastController {
  toasts: Toast[];
  push: (tone: ToastTone, title: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

/**
 * A tiny toast queue.
 *
 * Deliberately not a library: this is a list, a timer, and a remove. Errors
 * stay twice as long as confirmations because a failure usually needs reading.
 *
 * @returns the current toasts plus push and dismiss
 */
export function useToasts(): ToastController {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = nextId.current++;
      setToasts((current) => {
        // Repeating the same failure every poll would bury the screen.
        if (current.some((t) => t.title === title && t.tone === tone)) return current;
        return [...current, { id, tone, ...(detail === undefined ? {} : { detail }), title }];
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS[tone])
      );
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}
