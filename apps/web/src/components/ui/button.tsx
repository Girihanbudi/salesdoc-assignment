import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        // Lime is reserved for the primary action on a screen.
        primary: 'bg-accent text-accent-ink hover:brightness-95',
        dark: 'bg-ink text-white hover:bg-ink/90',
        ghost: 'bg-transparent text-ink hover:bg-black/5',
        outline: 'border border-line bg-card text-ink hover:bg-black/5',
      },
      size: {
        sm: 'h-9 px-4',
        md: 'h-11 px-6',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

/** Props for {@link Button}. */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

/**
 * A native button. Never a div — this must stay keyboard-operable.
 *
 * @param props standard button attributes plus variant and size
 * @returns the button element
 */
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
