import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-side actions (CTAs, buttons) */
  actions?: ReactNode;
  /** Second row: search, filters, tabs, segmented controls */
  controls?: ReactNode;
  className?: string;
}

/**
 * PageHeader — Padrão Private Wealth para todas as páginas.
 *
 * Layout:
 *   Row 1: [title + subtitle]  ···  [actions]
 *   Row 2: [controls]
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  controls,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Row 1: Title + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-sm mt-0.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Row 2: Controls */}
      {controls && (
        <div className="flex flex-wrap items-center gap-3">
          {controls}
        </div>
      )}
    </div>
  );
}
