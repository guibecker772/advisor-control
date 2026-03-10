import { type ReactNode, useEffect, useId, useRef, useCallback, type RefObject } from 'react';
import { X } from 'lucide-react';

type DrawerSide = 'right' | 'left';
type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  side?: DrawerSide;
  size?: DrawerSize;
  showCloseButton?: boolean;
  headerActions?: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

const sizeClasses: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  side = 'right',
  size = 'lg',
  showCloseButton = true,
  headerActions,
  footer,
  initialFocusRef,
  restoreFocusRef,
}: DrawerProps) {
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => onCloseRef.current(), []);

  // Focus management + ESC + scroll lock
  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
      );
      firstFocusable?.focus();
    }, 0);

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      stableOnClose();
    };

    const previousOverflow = document.body.style.overflow;
    const restoreTarget = restoreFocusRef?.current ?? null;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEsc);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = previousOverflow;

      if (restoreTarget) {
        restoreTarget.focus();
      } else {
        previousFocusRef.current?.focus();
      }
    };
  }, [initialFocusRef, isOpen, stableOnClose, restoreFocusRef]);

  if (!isOpen) return null;

  const isRight = side === 'right';
  const slideClass = isRight ? 'animate-slide-in-right' : 'animate-slide-in-left';
  const positionClass = isRight ? 'right-0' : 'left-0';

  return (
    <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        style={{
          zIndex: 'var(--z-modal-backdrop)',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={contentRef}
        className={`
          absolute top-0 ${positionClass} h-full w-full ${sizeClasses[size]}
          flex flex-col ${slideClass}
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderLeft: isRight ? '1px solid var(--color-border)' : 'none',
          borderRight: !isRight ? '1px solid var(--color-border)' : 'none',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 'var(--z-modal)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton || headerActions) && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-semibold truncate"
                  style={{ color: 'var(--color-text)' }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  className="text-sm mt-0.5 truncate"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
              {headerActions}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="focus-gold inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer — sticky at bottom */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
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
