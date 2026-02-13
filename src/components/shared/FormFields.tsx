import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';

/* ---- shared inline style helpers ---- */
const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
};

const baseInputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
};

const errorInputStyle: React.CSSProperties = {
  ...baseInputStyle,
  borderColor: 'var(--color-danger)',
};

const errorTextStyle: React.CSSProperties = {
  color: 'var(--color-danger)',
};

function applyFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-gold)';
  e.currentTarget.style.borderColor = 'var(--color-gold)';
}

function removeFocus(
  e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  hasError?: boolean,
) {
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.borderColor = hasError
    ? 'var(--color-danger)'
    : 'var(--color-border)';
}

/* ---- Input ---- */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', onFocus, onBlur, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium" style={labelStyle}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`block w-full px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm ${className}`}
          style={error ? errorInputStyle : baseInputStyle}
          onFocus={(e) => {
            applyFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            removeFocus(e, !!error);
            onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <p className="text-sm" style={errorTextStyle}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

/* ---- Select ---- */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', onFocus, onBlur, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium" style={labelStyle}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`block w-full px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm ${className}`}
          style={error ? errorInputStyle : baseInputStyle}
          onFocus={(e) => {
            applyFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            removeFocus(e, !!error);
            onBlur?.(e);
          }}
          {...props}
        >
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm" style={errorTextStyle}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

/* ---- TextArea ---- */
interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', onFocus, onBlur, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium" style={labelStyle}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={3}
          className={`block w-full px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm ${className}`}
          style={error ? errorInputStyle : baseInputStyle}
          onFocus={(e) => {
            applyFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            removeFocus(e, !!error);
            onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <p className="text-sm" style={errorTextStyle}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';

/* ---- CurrencyInput ---- */
interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  value: number;
  onChange: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, error, value, onChange, className = '', onFocus, onBlur, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      const numericValue = parseInt(rawValue, 10) / 100 || 0;
      onChange(numericValue);
    };

    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium" style={labelStyle}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          value={formattedValue}
          onChange={handleChange}
          className={`block w-full px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm ${className}`}
          style={error ? errorInputStyle : baseInputStyle}
          onFocus={(e) => {
            applyFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            removeFocus(e, !!error);
            onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <p className="text-sm" style={errorTextStyle}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';

/* ---- PeriodFilter ---- */
interface PeriodFilterProps {
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
}

export function PeriodFilter({ mes, ano, onMesChange, onAnoChange }: PeriodFilterProps) {
  const meses = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - 2 + i),
    label: String(currentYear - 2 + i),
  }));

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    <div className="flex items-center space-x-4">
      <select
        value={mes}
        onChange={(e) => onMesChange(Number(e.target.value))}
        className="px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm"
        style={selectStyle}
        onFocus={(e) => applyFocus(e)}
        onBlur={(e) => removeFocus(e)}
      >
        {meses.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={ano}
        onChange={(e) => onAnoChange(Number(e.target.value))}
        className="px-3 py-2 rounded-md shadow-sm focus:outline-none sm:text-sm"
        style={selectStyle}
        onFocus={(e) => applyFocus(e)}
        onBlur={(e) => removeFocus(e)}
      >
        {anos.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </div>
  );
}
