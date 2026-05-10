import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface FieldProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, className, children }: FieldProps) {
  return (
    <label className={cn('field', className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}
