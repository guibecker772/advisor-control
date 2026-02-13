import { type ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'purple';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  pill?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  neutral: {
    bg: 'var(--color-surface-2)',
    text: 'var(--color-text-secondary)',
  },
  success: {
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success)',
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    text: 'var(--color-warning)',
  },
  danger: {
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger)',
  },
  info: {
    bg: 'var(--color-info-bg)',
    text: 'var(--color-info)',
  },
  gold: {
    bg: 'var(--color-gold-bg)',
    text: 'var(--color-gold)',
  },
  purple: {
    bg: 'var(--color-surface-2)',
    text: 'var(--badge-purple)',
  },
};

export function Badge({
  children,
  variant = 'neutral',
  pill = true,
  className = '',
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 text-xs font-medium
        ${pill ? 'rounded-full' : 'rounded-md'}
        ${className}
      `}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
      }}
    >
      {children}
    </span>
  );
}

// Chip variant with optional icon (close button, etc.)
interface ChipProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
  onRemove?: () => void;
  removeAriaLabel?: string;
  className?: string;
}

export function Chip({
  children,
  variant = 'neutral',
  icon,
  onRemove,
  removeAriaLabel = 'Remover filtro',
  className = '',
}: ChipProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full
        ${className}
      `}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
      }}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="focus-gold ml-0.5 flex min-h-9 min-w-9 flex-shrink-0 items-center justify-center rounded-full p-1 transition-opacity hover:opacity-70"
          aria-label={removeAriaLabel}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
