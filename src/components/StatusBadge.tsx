import React from 'react';
import { cn } from '../utils/cn';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case 'paid':
      case 'verified':
      case 'in stock':
        return 'bg-tertiary-container text-tertiary-fixed';
      case 'pending':
        return 'bg-secondary-container text-on-secondary-container';
      case 'overdue':
      case 'critical':
        return 'bg-error-container text-on-error-container';
      case 'low stock':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-surface-container-high text-on-surface-variant';
    }
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
      getStatusStyles(status),
      className
    )}>
      {status}
    </span>
  );
}
