import { type ReactNode } from 'react';
import { BaseCard, SectionHeader } from './Card';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  headerClassName?: string;
  contentClassName?: string;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  variant = 'default',
  padding = 'md',
  headerClassName = '',
  contentClassName = '',
  className = '',
}: SectionCardProps) {
  return (
    <BaseCard variant={variant} padding={padding} className={className}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={action}
        className={headerClassName}
      />
      <div className={contentClassName}>
        {children}
      </div>
    </BaseCard>
  );
}

