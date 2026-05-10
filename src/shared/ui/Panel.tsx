import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../lib/cn';

interface PanelProps extends ComponentPropsWithoutRef<'section'> {}

export function Panel({ className, ...props }: PanelProps) {
  return <section className={cn('panel', className)} {...props} />;
}
