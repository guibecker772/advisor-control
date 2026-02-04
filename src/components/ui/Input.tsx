import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div 
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full rounded-lg px-3 py-2 text-sm
            transition-colors
            focus:outline-none focus:ring-2
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${error ? 'ring-1' : ''}
          `}
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            ...(error && { 
              borderColor: 'var(--color-danger)',
              ringColor: 'var(--color-danger)',
            }),
          }}
          {...props}
        />
        {rightIcon && (
          <div 
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-danger)' }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`
          w-full rounded-lg px-3 py-2 text-sm
          transition-colors resize-none
          focus:outline-none focus:ring-2
          ${error ? 'ring-1' : ''}
        `}
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          ...(error && { 
            borderColor: 'var(--color-danger)',
            ringColor: 'var(--color-danger)',
          }),
        }}
        {...props}
      />
      {error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-danger)' }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({
  label,
  error,
  hint,
  options,
  className = '',
  id,
  ...props
}: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`
          w-full rounded-lg px-3 py-2 text-sm
          transition-colors
          focus:outline-none focus:ring-2
          ${error ? 'ring-1' : ''}
        `}
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          ...(error && { 
            borderColor: 'var(--color-danger)',
            ringColor: 'var(--color-danger)',
          }),
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-danger)' }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p 
          className="mt-1 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
