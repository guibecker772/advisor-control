import type { CSSProperties, ReactNode } from 'react';
import {
  Package,
  SearchX,
  Inbox,
  Construction,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Shared action types                                                */
/* ------------------------------------------------------------------ */
interface StateAction {
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

type StateActionLike = StateAction | ReactNode;

function isStateAction(value: StateActionLike | undefined): value is StateAction {
  if (!value || typeof value !== 'object') return false;
  return 'label' in value && typeof (value as { label?: unknown }).label === 'string';
}

/* ------------------------------------------------------------------ */
/*  Internal: ActionButtons                                            */
/* ------------------------------------------------------------------ */
function ActionButtons({
  primary,
  secondary,
}: {
  primary?: StateActionLike;
  secondary?: StateActionLike;
}) {
  if (!primary && !secondary) return null;

  const btnBase = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-gold';

  const renderBtn = (action: StateAction, variant: 'primary' | 'secondary') => {
    const isPrimary = variant === 'primary';
    const style: CSSProperties = isPrimary
      ? { backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }
      : { color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' };

    if (action.to) {
      return (
        <a
          href={action.to}
          className={btnBase}
          style={style}
        >
          {action.label}
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        className={`${btnBase} disabled:opacity-50`}
        aria-label={action.ariaLabel ?? action.label}
        style={style}
      >
        {action.label}
      </button>
    );
  };

  const renderAction = (action: StateActionLike | undefined, variant: 'primary' | 'secondary') => {
    if (!action) return null;
    if (!isStateAction(action)) return action;
    return renderBtn(action, variant);
  };

  return (
    <div className="flex items-center gap-3 mt-5">
      {renderAction(primary, 'primary')}
      {renderAction(secondary, 'secondary')}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState — nenhum dado ainda (primeira visita / lista vazia)     */
/* ------------------------------------------------------------------ */
interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: StateActionLike;
  primaryAction?: StateActionLike;
  secondaryAction?: StateActionLike;
}

export function EmptyState({
  title = 'Nenhum dado encontrado',
  description = 'Comece adicionando o primeiro registro.',
  icon,
  action,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const resolvedPrimaryAction = action ?? primaryAction;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        {icon || <Package className="w-7 h-7" style={{ color: 'var(--color-text-muted)' }} />}
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm mt-1 max-w-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>
      <ActionButtons primary={resolvedPrimaryAction} secondary={secondaryAction} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NoResults — busca/filtro sem resultados                            */
/* ------------------------------------------------------------------ */
interface NoResultsProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  onClearFilters?: () => void;
}

export function NoResults({
  title = 'Sem resultados',
  description = 'Nenhum registro encontrado com os filtros atuais.',
  icon,
  onClearFilters,
}: NoResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        {icon || <SearchX className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }} />}
      </div>
      <h3
        className="text-base font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm mt-1 max-w-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-gold"
          style={{ color: 'var(--color-gold)', border: '1px solid var(--color-gold)' }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  InlineEmpty — versão compacta para seções/cards inline             */
/* ------------------------------------------------------------------ */
interface InlineEmptyProps {
  title?: string;
  description?: string;
  message?: string;
  icon?: ReactNode;
  action?: StateActionLike;
  secondaryAction?: StateActionLike;
  className?: string;
}

export function InlineEmpty({
  title,
  description,
  message = 'Nenhum item.',
  icon,
  action,
  secondaryAction,
  className = '',
}: InlineEmptyProps) {
  const resolvedDescription = description ?? message;

  return (
    <div className={`flex flex-col items-center py-8 px-4 text-center ${className}`}>
      {icon || (
        <Inbox className="w-8 h-8 mb-2" style={{ color: 'var(--color-text-muted)' }} />
      )}
      {title && (
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h4>
      )}
      <p className={`${title ? 'mt-1' : ''} text-sm`} style={{ color: 'var(--color-text-muted)' }}>
        {resolvedDescription}
      </p>
      <ActionButtons primary={action} secondary={secondaryAction} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ComingSoon — funcionalidade em desenvolvimento                     */
/* ------------------------------------------------------------------ */
interface ComingSoonProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  backAction?: StateAction;
}

export function ComingSoon({
  title = 'Em breve',
  description = 'Esta funcionalidade está em desenvolvimento e estará disponível em breve.',
  icon,
  backAction,
}: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: 'var(--color-gold-bg)' }}
      >
        {icon || <Construction className="w-8 h-8" style={{ color: 'var(--color-gold)' }} />}
      </div>
      <h2
        className="text-xl font-bold"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h2>
      <p
        className="text-sm mt-2 max-w-md"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>
      {backAction && (
        <div className="mt-6">
          <a
            href={backAction.to || '/'}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-gold"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            {backAction.label || 'Voltar ao Dashboard'}
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ErrorState — erro ao carregar dados                                */
/* ------------------------------------------------------------------ */
interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Erro ao carregar',
  description = 'Não foi possível carregar os dados. Tente novamente.',
  icon,
  onRetry,
  retryLabel = 'Tentar novamente',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--color-danger-bg)' }}
      >
        {icon || <AlertTriangle className="w-7 h-7" style={{ color: 'var(--color-danger)' }} />}
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm mt-1 max-w-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-gold"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PageSkeleton — skeleton placeholder para loading de página         */
/* ------------------------------------------------------------------ */
interface PageSkeletonProps {
  /** Número de linhas de tabela */
  rows?: number;
  /** Mostrar cards de KPI */
  showKpis?: boolean;
  /** Número de KPI cards */
  kpiCount?: number;
}

function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ backgroundColor: 'var(--color-surface-2)' }}
    />
  );
}

export function PageSkeleton({
  rows = 5,
  showKpis = false,
  kpiCount = 3,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-7 w-48" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
        <SkeletonPulse className="h-10 w-36 rounded-lg" />
      </div>

      {/* KPI cards skeleton */}
      {showKpis && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
            >
              <SkeletonPulse className="h-4 w-24 mb-2" />
              <SkeletonPulse className="h-8 w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Table skeleton */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        {/* Search bar */}
        <div className="p-4">
          <SkeletonPulse className="h-10 w-72 rounded-lg" />
        </div>
        {/* Header row */}
        <div
          className="flex gap-4 px-4 py-3"
          style={{ backgroundColor: 'var(--color-surface-2)' }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonPulse key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
