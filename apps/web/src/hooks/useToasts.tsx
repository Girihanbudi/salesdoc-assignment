import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Severity, which drives both the colour and the icon. */
export type ToastTone = 'error' | 'warning' | 'success' | 'info';

/** One message queued for display. */
export interface Toast {
  id: number;
  tone: ToastTone;
  /** One line. What happened. */
  title: string;
  /** Optional second line: what to do about it. */
  detail?: string;
}

/**
 * How long a toast stays before dismissing itself.
 *
 * Scaled by how much the reader loses by missing it: a failure needs reading,
 * a confirmation does not.
 */
const DISMISS_MS: Record<ToastTone, number> = {
  error: 8000,
  warning: 7000,
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
export function useToastQueue(): ToastController {
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

  return useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
}

const ToastContext = createContext<ToastController | null>(null);

/** Props for {@link ToastProvider}. */
export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Makes the toast queue reachable from anywhere.
 *
 * Context rather than props because every screen can fail, and threading a
 * controller through each page and route wrapper is how a screen ends up
 * quietly not reporting its errors.
 *
 * @param props the tree to provide to
 * @returns the provider
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const controller = useToastQueue();
  return <ToastContext.Provider value={controller}>{children}</ToastContext.Provider>;
}

/**
 * Reads the toast controller.
 *
 * @returns push and dismiss
 * @throws when used outside {@link ToastProvider}
 */
export function useToast(): ToastController {
  const controller = useContext(ToastContext);
  if (controller === null) throw new Error('useToast must be used inside ToastProvider');
  return controller;
}
