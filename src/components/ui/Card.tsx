import { type ReactNode, type HTMLAttributes } from 'react';

interface BaseCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function BaseCard({ 
  children, 
  variant = 'default',
  padding = 'md',
  className = '',
  ...props 
}: BaseCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantStyles = {
    default: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
    },
    elevated: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-md)',
    },
    bordered: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
    },
  };

  return (
    <div
      className={`rounded-xl ${paddingClasses[padding]} ${className}`}
      style={variantStyles[variant]}
      {...props}
    >
      {children}
    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  layout?: 'default' | 'wide';
  hint?: string;
  accentColor?: 'gold' | 'success' | 'danger' | 'info' | 'warning';
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  layout = 'default',
  hint,
  accentColor = 'gold',
  className = '',
}: KpiCardProps) {
  const accentColors = {
    gold: 'var(--color-gold)',
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    warning: 'var(--color-warning)',
  };

  const trendColors = {
    up: 'var(--color-success)',
    down: 'var(--color-danger)',
    neutral: 'var(--color-text-muted)',
  };
  const trendSymbol = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192';
  const isWideLayout = layout === 'wide';
  const hasIcon = Boolean(icon);

  return (
    <BaseCard className={className} padding="lg">
      <div className={isWideLayout ? 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between' : 'flex items-start justify-between'}>
        <div className={isWideLayout ? `flex-1 min-w-0 ${hasIcon ? 'sm:pr-3' : ''}` : 'flex-1'}>
          <p 
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: accentColors[accentColor] }}
          >
            {title}
          </p>
          <p 
            className={`text-2xl font-bold leading-tight ${isWideLayout ? 'mt-2 break-words' : ''}`}
            style={{ color: 'var(--color-text)' }}
          >
            {value}
          </p>
          {subtitle && (
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {subtitle}
            </p>
          )}
          {hint && (
            <p
              className="text-xs mt-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {hint}
            </p>
          )}
          {trend && trendValue && (
            <p 
              className="text-sm mt-2 font-medium"
              style={{ color: trendColors[trend] }}
            >
              {trendSymbol} {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div 
            className={isWideLayout ? 'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0' : 'w-10 h-10 rounded-lg flex items-center justify-center'}
            style={{ 
              backgroundColor: `${accentColors[accentColor]}15`,
              color: accentColors[accentColor],
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </BaseCard>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h2 
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p 
            className="text-sm mt-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface TableContainerProps {
  children: ReactNode;
  className?: string;
}

export function TableContainer({ children, className = '' }: TableContainerProps) {
  return (
    <BaseCard padding="none" className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        {children}
      </div>
    </BaseCard>
  );
}
