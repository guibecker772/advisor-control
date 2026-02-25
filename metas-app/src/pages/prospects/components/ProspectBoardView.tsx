import { useMemo } from 'react';
import { type Prospect } from '../../../domain/types';
import { BaseCard, InlineEmpty } from '../../../components/ui';
import { formatCurrency } from '../../../domain/calculations';
import ProspectCardLarge from './ProspectCardLarge';
import {
  PROSPECT_STATUS_COLUMNS,
  buildUrgencySortKey,
  compareUrgencySortKeys,
  getPipeAtualValue,
  type InteracoesByProspectMap,
  normalizeProspectStatus,
  sortByUrgency,
} from '../utils/prospectUi';

interface ProspectBoardViewProps {
  prospects: Prospect[];
  interacoesByProspect: InteracoesByProspectMap;
  onOpenDetails: (prospect: Prospect) => void;
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospect: Prospect) => void;
  onQuickAddInteracao: (prospect: Prospect) => void;
}

export default function ProspectBoardView({
  prospects,
  interacoesByProspect,
  onOpenDetails,
  onEdit,
  onDelete,
  onQuickAddInteracao,
}: ProspectBoardViewProps) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const lanes = useMemo(() => {
    const urgencyKeyByProspect = new WeakMap<Prospect, ReturnType<typeof buildUrgencySortKey>>();
    prospects.forEach((prospect) => {
      const interacoes = prospect.id ? interacoesByProspect.get(prospect.id) ?? [] : [];
      urgencyKeyByProspect.set(prospect, buildUrgencySortKey(prospect, today, interacoes));
    });

    return PROSPECT_STATUS_COLUMNS.map((column) => {
      const items = prospects
        .filter((prospect) => normalizeProspectStatus(prospect.status) === column.value)
        .sort((a, b) => {
          const keyA = urgencyKeyByProspect.get(a);
          const keyB = urgencyKeyByProspect.get(b);
          if (!keyA || !keyB) {
            return sortByUrgency(a, b, today, interacoesByProspect);
          }
          return compareUrgencySortKeys(keyA, keyB);
        });

      const pipeTotal = items.reduce((sum, prospect) => sum + getPipeAtualValue(prospect), 0);

      return {
        column,
        items,
        pipeTotal,
      };
    });
  }, [interacoesByProspect, prospects, today]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-4">
        {lanes.map(({ column, items, pipeTotal }) => (
          <div key={column.value} className="w-[320px] min-w-[280px] max-w-[88vw] shrink-0 space-y-3">
            <BaseCard padding="sm" className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {column.label}
                </h3>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {items.length} item(ns)
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Pipe: {formatCurrency(pipeTotal)}
              </p>
            </BaseCard>

            <div className="space-y-3">
              {items.length === 0 ? (
                <BaseCard padding="none">
                  <InlineEmpty message={`Sem prospects em ${column.label.toLowerCase()}.`} />
                </BaseCard>
              ) : (
                items.map((prospect) => (
                  <ProspectCardLarge
                    key={prospect.id ?? `${column.value}-${prospect.nome}`}
                    prospect={prospect}
                    interacoes={prospect.id ? interacoesByProspect.get(prospect.id) ?? [] : []}
                    today={today}
                    onOpenDetails={onOpenDetails}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onQuickAddInteracao={onQuickAddInteracao}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
