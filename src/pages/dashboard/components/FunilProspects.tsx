import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { Prospect } from '../../../domain/types';
import { SectionCard } from '../../../components/ui';

interface FunilProspectsProps {
  prospects: Prospect[];
}

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  filterParam: string;
}

export function FunilProspects({ prospects }: FunilProspectsProps) {
  const navigate = useNavigate();

  const stages = useMemo<FunnelStage[]>(() => {
    const statusCount = (status: string) =>
      prospects.filter((p) => (p.status || 'novo') === status).length;

    return [
      {
        key: 'novo',
        label: 'Novos',
        count: statusCount('novo'),
        color: 'var(--color-info)',
        bgColor: 'var(--color-info-bg)',
        filterParam: 'novo',
      },
      {
        key: 'em_contato',
        label: 'Em contato',
        count: statusCount('em_contato'),
        color: 'var(--color-warning)',
        bgColor: 'var(--color-warning-bg)',
        filterParam: 'em_contato',
      },
      {
        key: 'qualificado',
        label: 'Qualificado',
        count: statusCount('qualificado'),
        color: 'var(--chart-5)',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        filterParam: 'qualificado',
      },
      {
        key: 'proposta',
        label: 'Proposta',
        count: statusCount('proposta'),
        color: 'var(--color-gold)',
        bgColor: 'var(--color-gold-bg)',
        filterParam: 'proposta',
      },
      {
        key: 'ganho',
        label: 'Ganho',
        count: statusCount('ganho'),
        color: 'var(--color-success)',
        bgColor: 'var(--color-success-bg)',
        filterParam: 'ganho',
      },
      {
        key: 'perdido',
        label: 'Perdido',
        count: statusCount('perdido'),
        color: 'var(--color-danger)',
        bgColor: 'var(--color-danger-bg)',
        filterParam: 'perdido',
      },
    ];
  }, [prospects]);

  const totalOpen = stages
    .filter((s) => !['ganho', 'perdido'].includes(s.key))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <SectionCard
      title="Funil de Prospects"
      subtitle={`${totalOpen} em aberto`}
      action={
        <button
          type="button"
          onClick={() => navigate('/prospects')}
          className="text-xs font-medium transition-colors hover:underline focus-gold"
          style={{ color: 'var(--color-gold)' }}
        >
          Ver todos
        </button>
      }
    >
      {prospects.length === 0 ? (
        <div className="py-4 text-center">
          <Users className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum prospect ainda.
          </p>
          <button
            type="button"
            onClick={() => navigate('/prospects')}
            className="mt-2 text-xs font-medium hover:underline focus-gold"
            style={{ color: 'var(--color-gold)' }}
          >
            Cadastrar prospect
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {stages.map((stage) => {
            const maxCount = Math.max(...stages.map((s) => s.count), 1);
            const barWidth = Math.max(8, (stage.count / maxCount) * 100);

            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => navigate(`/prospects?status=${stage.filterParam}`)}
                className="w-full rounded-lg px-3 py-2 flex items-center gap-3 transition-colors hover:bg-[var(--color-surface-3)] focus-gold text-left"
                style={{ backgroundColor: 'var(--color-surface-2)' }}
              >
                <span
                  className="text-xs font-medium w-20 flex-shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {stage.label}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: stage.color }}
                  />
                </div>
                <span
                  className="text-sm font-semibold w-8 text-right tabular-nums"
                  style={{ color: stage.color }}
                >
                  {stage.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
