import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-gold)',
      color: 'var(--color-text-inverse)',
    },
    secondary: {
      backgroundColor: 'var(--color-surface-2)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: 'white',
    },
    success: {
      backgroundColor: 'var(--color-success)',
      color: 'white',
    },
  };

  const hoverClass = {
    primary: 'hover:brightness-110',
    secondary: 'hover:bg-[var(--color-surface-3)]',
    ghost: 'hover:bg-[var(--color-surface)]',
    danger: 'hover:brightness-110',
    success: 'hover:brightness-110',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-all duration-200
        focus-gold
        ${sizeClasses[size]}
        ${hoverClass[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      style={variantStyles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span 
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}

// Botão de ícone
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: 'default' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label: string; // Para acessibilidade
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    variant = 'default',
    size = 'md',
    label,
    className = '',
    ...props
  },
  ref,
) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const variantStyles = {
    default: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text-secondary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
    },
  };

  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-lg
        transition-colors hover:bg-[var(--color-surface-hover)]
        focus-gold
        ${sizeClasses[size]}
        ${className}
      `}
      style={variantStyles[variant]}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
});

IconButton.displayName = 'IconButton';
