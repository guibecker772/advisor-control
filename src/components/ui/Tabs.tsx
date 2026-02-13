import { type ReactNode } from 'react';

interface TabItem {
  value: string;
  label: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Segmented / Tabs — estilo Private Wealth.
 * Dark: fundo surface-2, ativo com gold-bg.
 * Light: mesma lógica, tokens adaptam.
 */
export function Tabs({
  items,
  value,
  onChange,
  size = 'md',
  className = '',
}: TabsProps) {
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${className}`}
      style={{ backgroundColor: 'var(--color-surface-2)' }}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`
              ${sizeClasses[size]} font-medium rounded-md
              transition-all duration-200
              focus-gold
            `}
            style={{
              color: isActive ? 'var(--color-gold)' : 'var(--color-text-muted)',
              backgroundColor: isActive ? 'var(--color-gold-bg)' : 'transparent',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
            role="tab"
            aria-selected={isActive}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
