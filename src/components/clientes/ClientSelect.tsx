import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  filterClientSelectOptions,
  getNextEnabledOptionIndex,
  normalizeClientSearchText,
} from './clientSelectUtils';

export interface ClientSelectOption {
  value: string;
  label: string;
  hint?: string;
  searchText?: string;
  disabled?: boolean;
}

interface ClientSelectProps {
  label?: string;
  value: string;
  options: ClientSelectOption[];
  onChange: (value: string, option?: ClientSelectOption | null) => void;
  loading?: boolean;
  loadingText?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

const LARGE_OPTIONS_THRESHOLD = 500;
const MAX_VISIBLE_OPTIONS_WITHOUT_SEARCH = 120;

export default function ClientSelect({
  label,
  value,
  options,
  onChange,
  loading = false,
  loadingText = 'Carregando clientes...',
  placeholder = 'Selecione um cliente',
  searchPlaceholder = 'Buscar cliente...',
  emptyText = 'Nenhum cliente encontrado.',
  error,
  disabled = false,
  className = '',
}: ClientSelectProps) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    return filterClientSelectOptions(options, searchTerm);
  }, [options, searchTerm]);

  const normalizedSearchTerm = useMemo(() => normalizeClientSearchText(searchTerm), [searchTerm]);

  const shouldLimitWithoutSearch = normalizedSearchTerm.length === 0 && filteredOptions.length > LARGE_OPTIONS_THRESHOLD;
  const renderedOptions = useMemo(() => {
    if (!shouldLimitWithoutSearch) return filteredOptions;
    return filteredOptions.slice(0, MAX_VISIBLE_OPTIONS_WITHOUT_SEARCH);
  }, [filteredOptions, shouldLimitWithoutSearch]);
  const hasClippedOptions = shouldLimitWithoutSearch && renderedOptions.length < filteredOptions.length;

  const close = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const handleSelect = useCallback((nextValue: string) => {
    const selected = options.find((option) => option.value === nextValue) || null;
    onChange(nextValue, selected);
    close();
  }, [close, onChange, options]);

  useEffect(() => {
    if (!open) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();
    const frameId = window.requestAnimationFrame(() => {
      const firstEnabledIndex = renderedOptions.findIndex((option) => !option.disabled);
      setHighlightedIndex(firstEnabledIndex >= 0 ? firstEnabledIndex : 0);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open, renderedOptions]);

  const moveHighlight = (direction: 1 | -1) => {
    if (renderedOptions.length === 0) return;
    const nextIndex = getNextEnabledOptionIndex(renderedOptions, highlightedIndex, direction);
    if (nextIndex >= 0) {
      setHighlightedIndex(nextIndex);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDropdown();
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = renderedOptions[highlightedIndex];
      if (option && !option.disabled) {
        handleSelect(option.value);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      close();
    }
  };

  return (
    <div className={`relative space-y-1 ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm focus-gold disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          color: selectedOption ? 'var(--color-text)' : 'var(--color-text-muted)',
        }}
        onClick={() => (open ? close() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label || placeholder}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-[var(--z-dropdown)] mt-2 overflow-hidden rounded-lg border shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          <div className="border-b p-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={renderedOptions[highlightedIndex] ? `${listboxId}-option-${highlightedIndex}` : undefined}
                className="w-full rounded-md py-2 pl-8 pr-2 text-sm focus-gold"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          <div id={listboxId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <p className="px-2 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {loadingText}
              </p>
            ) : renderedOptions.length === 0 ? (
              <p className="px-2 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {emptyText}
              </p>
            ) : (
              renderedOptions.map((option, index) => (
                <button
                  key={`${option.value}-${option.label}`}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className="w-full rounded-md px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: index === highlightedIndex ? 'var(--color-surface-2)' : 'transparent',
                    color: option.value === value ? 'var(--color-gold)' : 'var(--color-text)',
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={option.value === value}
                >
                  <p className="truncate text-sm font-medium">{option.label}</p>
                  {option.hint && (
                    <p className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {option.hint}
                    </p>
                  )}
                </button>
              ))
            )}
            {!loading && hasClippedOptions && (
              <p className="px-2 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Muitos clientes ({filteredOptions.length}). Mostrando os primeiros {renderedOptions.length}; refine a busca.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
