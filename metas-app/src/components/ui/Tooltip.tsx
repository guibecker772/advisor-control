import { type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  disabled?: boolean;
}

export function Tooltip({ content, children, disabled = false }: TooltipProps) {
  if (disabled || !content) return <>{children}</>;

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 60,
        }}
      >
        {content}
      </span>
    </span>
  );
}
