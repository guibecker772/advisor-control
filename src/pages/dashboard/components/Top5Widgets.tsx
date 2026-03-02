import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Crown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../domain/calculations';
import type { CaptacaoLancamento, Cliente } from '../../../domain/types';
import { SectionCard } from '../../../components/ui';

interface Top5ClientesCustodiaProps {
  clientes: Cliente[];
}

export function Top5ClientesCustodia({ clientes }: Top5ClientesCustodiaProps) {
  const top5 = useMemo(() => {
    return [...clientes]
      .filter((c) => c.status === 'ativo' && (c.custodiaAtual || 0) > 0)
      .sort((a, b) => (b.custodiaAtual || 0) - (a.custodiaAtual || 0))
      .slice(0, 5);
  }, [clientes]);

  return (
    <SectionCard
      title="Top 5 Clientes"
      subtitle="Por custódia"
      action={
        <Link
          to="/clientes"
          className="text-xs font-medium transition-colors hover:underline focus-gold"
          style={{ color: 'var(--color-gold)' }}
        >
          Ver todos
        </Link>
      }
    >
      {top5.length === 0 ? (
        <div className="py-4 text-center">
          <Crown className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum cliente com custódia registrada.
          </p>
          <Link
            to="/clientes"
            className="mt-2 inline-block text-xs font-medium hover:underline focus-gold"
            style={{ color: 'var(--color-gold)' }}
          >
            Gerenciar clientes
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {top5.map((cliente, idx) => (
            <Link
              key={cliente.id || idx}
              to="/clientes"
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-3)] focus-gold"
              style={{ backgroundColor: 'var(--color-surface-2)' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: idx === 0 ? 'var(--color-gold-bg)' : 'var(--color-surface-3)',
                  color: idx === 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
                }}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {cliente.nome}
                </p>
              </div>
              <span
                className="text-sm font-semibold tabular-nums flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {formatCurrency(cliente.custodiaAtual || 0)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

interface Top5CaptacoesProps {
  lancamentos: CaptacaoLancamento[];
}

export function Top5Captacoes({ lancamentos }: Top5CaptacoesProps) {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const top5 = useMemo(() => {
    return [...lancamentos]
      .filter(
        (l) =>
          l.mes === mesAtual &&
          l.ano === anoAtual &&
          l.direcao === 'entrada' &&
          (l.valor || 0) > 0,
      )
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 5);
  }, [lancamentos, mesAtual, anoAtual]);

  return (
    <SectionCard
      title="Top 5 Captações"
      subtitle="Do mês"
      action={
        <Link
          to="/captacao"
          className="text-xs font-medium transition-colors hover:underline focus-gold"
          style={{ color: 'var(--color-gold)' }}
        >
          Ver todos
        </Link>
      }
    >
      {top5.length === 0 ? (
        <div className="py-4 text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma captação registrada no mês.
          </p>
          <Link
            to="/captacao"
            className="mt-2 inline-block text-xs font-medium hover:underline focus-gold"
            style={{ color: 'var(--color-gold)' }}
          >
            Registrar captação
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {top5.map((lancamento, idx) => (
            <Link
              key={lancamento.id || idx}
              to="/captacao"
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-3)] focus-gold"
              style={{ backgroundColor: 'var(--color-surface-2)' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: idx === 0 ? 'var(--color-gold-bg)' : 'var(--color-surface-3)',
                  color: idx === 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
                }}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {lancamento.referenciaNome || 'Sem referência'}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {lancamento.tipo?.replace(/_/g, ' ') || 'Captação'}
                </p>
              </div>
              <span
                className="text-sm font-semibold tabular-nums flex-shrink-0"
                style={{ color: 'var(--color-success)' }}
              >
                {formatCurrency(lancamento.valor || 0)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
