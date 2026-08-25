import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Snackbar } from './snackbar.js';
import type { Toast } from '@/hooks/useToasts.js';

/**
 * Builds a toast.
 *
 * @param tone the severity
 * @returns a toast for that tone
 */
function toast(tone: Toast['tone']): Toast {
  return { id: 1, tone, title: `${tone} happened`, detail: 'some detail' };
}

describe('Snackbar', () => {
  it('gives each severity its own surface', () => {
    /**
     * The classes on the toast body.
     *
     * @param root the rendered container
     * @returns the class string
     */
    const surface = (root: HTMLElement): string => root.innerHTML;

    const { container, rerender } = render(
      <Snackbar toasts={[toast('error')]} onDismiss={vi.fn()} />
    );
    expect(surface(container)).toContain('--color-toast-error');

    rerender(<Snackbar toasts={[toast('warning')]} onDismiss={vi.fn()} />);
    expect(surface(container)).toContain('--color-toast-warning');

    rerender(<Snackbar toasts={[toast('success')]} onDismiss={vi.fn()} />);
    expect(surface(container)).toContain('--color-toast-success');

    // Info is the only tone on the page's own white card — the default should
    // carry no alarm, and reserving colour keeps the others readable.
    rerender(<Snackbar toasts={[toast('info')]} onDismiss={vi.fn()} />);
    expect(surface(container)).toContain('bg-card');
    expect(surface(container)).not.toContain('--color-toast');
  });

  it('names the severity in text, so colour is not the only signal', () => {
    render(<Snackbar toasts={[toast('error')]} onDismiss={vi.fn()} />);
    expect(screen.getByText('Error:')).toBeInTheDocument();
  });

  it('announces politely rather than interrupting', () => {
    const { container } = render(<Snackbar toasts={[toast('error')]} onDismiss={vi.fn()} />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('dismisses the toast it was asked to', async () => {
    const onDismiss = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Snackbar toasts={[toast('warning')]} onDismiss={onDismiss} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
