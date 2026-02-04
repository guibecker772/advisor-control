import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  footer,
}: ModalProps) {
  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ zIndex: 'var(--z-modal-backdrop)' }}
      />
      
      {/* Modal Content */}
      <div
        className={`
          relative w-full ${sizeClasses[size]} 
          rounded-xl overflow-hidden
          animate-fade-in animate-slide-up
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 'var(--z-modal)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div 
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {title && (
              <h2 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text)' }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="flex items-center justify-end gap-3 px-6 py-4 border-t"
            style={{ 
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Confirm Dialog
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const variantColors = {
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p 
        className="text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {message}
      </p>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ 
            backgroundColor: variantColors[variant],
            color: 'white',
          }}
        >
          {loading ? 'Aguarde...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
