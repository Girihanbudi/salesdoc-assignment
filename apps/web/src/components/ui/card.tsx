import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

/**
 * The white rounded surface every panel sits on.
 *
 * @param props standard div attributes
 * @returns the card element
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]', className)}
      {...props}
    />
  );
}

/**
 * Small muted label used above a card's value.
 *
 * @param props standard div attributes
 * @returns the label element
 */
export function CardLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm font-medium text-muted', className)} {...props} />;
}
