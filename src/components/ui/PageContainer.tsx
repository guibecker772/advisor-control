import { type HTMLAttributes, type ReactNode } from 'react';

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'wide' | 'full';
  className?: string;
}

export function PageContainer({
  children,
  variant = 'default',
  className = '',
  ...props
}: PageContainerProps) {
  const variantClasses = {
    default: 'w-full max-w-[1400px] mx-auto space-y-6',
    wide: 'w-full max-w-[1680px] mx-auto space-y-6',
    full: 'w-full space-y-6',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
