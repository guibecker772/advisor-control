import { type ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const FOCUSABLE_SELECTOR = [
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusTarget = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusTarget?.focus();
    }, 0);

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEsc);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEsc);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:p-4">
        <div
          className="fixed inset-0 transition-opacity"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
          aria-hidden="true"
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative inline-block w-full ${sizeClasses[size]} overflow-hidden rounded-xl text-left transform transition-all sm:my-8`}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <h3 id={titleId} className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="focus-gold hover-light inline-flex min-h-10 min-w-10 items-center justify-center rounded-md"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Componente de confirmação de exclusão
interface ConfirmDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function ConfirmDelete({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar exclusão',
  message = 'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
  loading = false,
}: ConfirmDeleteProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="focus-gold hover-light rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="focus-gold rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-danger)',
              color: 'var(--color-text-inverse)',
            }}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
