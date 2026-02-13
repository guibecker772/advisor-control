import { useCallback, useMemo, type ReactNode } from 'react';

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: readonly SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps) {
  const optionIndexMap = useMemo(
    () => new Map(options.map((option, index) => [option.value, index])),
    [options],
  );

  const moveSelection = useCallback((currentIndex: number, direction: 1 | -1) => {
    if (options.length === 0 || currentIndex < 0) return;

    let nextIndex = currentIndex;

    for (let step = 0; step < options.length; step += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      const nextOption = options[nextIndex];
      if (!nextOption.disabled) {
        onChange(nextOption.value);
        break;
      }
    }
  }, [onChange, options]);

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1',
    md: 'px-3 py-2 text-sm gap-1.5',
  };

  return (
    <div className={`w-full overflow-x-auto ${className}`.trim()}>
      <div
        className="inline-flex min-w-max items-center gap-1 rounded-lg p-1"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border-subtle)',
        }}
        role="group"
      >
        {options.map((option) => {
          const isActive = option.value === value;
          const currentIndex = optionIndexMap.get(option.value) ?? -1;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled || option.value === value) return;
                onChange(option.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                moveSelection(currentIndex, event.key === 'ArrowRight' ? 1 : -1);
              }}
              className={`
                inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium
                transition-all duration-200
                focus-gold
                ${sizeClasses[size]}
                ${isActive ? '' : 'hover-light'}
                ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}
              `}
              style={{
                color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-gold-bg)' : 'transparent',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {option.icon && <span className="inline-flex flex-shrink-0">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
