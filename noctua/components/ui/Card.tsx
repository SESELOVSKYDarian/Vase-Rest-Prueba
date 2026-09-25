'use client';

import { cn } from '@/hooks/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function Card({ children, className, onClick, onDoubleClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-line rounded-lg',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}
