import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Section label shown in the fallback UI. */
  section?: string;
  /** Compact mode for inline sections (less padding). */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for Planning sections.
 * Catches render errors and displays a graceful fallback
 * instead of a white screen.
 */
export default class PlanningErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[PlanningErrorBoundary] ${this.props.section ?? 'Unknown'}:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { section, compact } = this.props;

    return (
      <div
        className={`rounded-xl flex flex-col items-center justify-center text-center ${compact ? 'p-4' : 'p-8'}`}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full mb-3"
          style={{ backgroundColor: 'var(--color-warning-bg)' }}
        >
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {section ? `Erro ao renderizar: ${section}` : 'Algo deu errado nesta seção'}
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          O restante da página continua funcionando normalmente.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--color-gold-bg)',
            color: 'var(--color-gold)',
            border: '1px solid var(--color-gold-muted)',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }
}
