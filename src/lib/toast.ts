/**
 * Toast helpers — wrappers padronizados sobre react-hot-toast.
 * Durações PT-BR padrão Private Wealth.
 */
import toast from 'react-hot-toast';

/** Sucesso — 3 s */
export function toastSuccess(message: string) {
  toast.success(message, { duration: 3000 });
}

/** Erro — 5 s */
export function toastError(message: string) {
  toast.error(message, { duration: 5000 });
}

/** Aviso — 4 s */
export function toastWarning(message: string) {
  toast(message, {
    duration: 4000,
    icon: '⚠️',
    style: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-warning)',
      border: '1px solid var(--color-warning)',
    },
  });
}

/** Informativo — 4 s */
export function toastInfo(message: string) {
  toast(message, {
    duration: 4000,
    icon: 'ℹ️',
    style: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-info)',
      border: '1px solid var(--color-info)',
    },
  });
}
