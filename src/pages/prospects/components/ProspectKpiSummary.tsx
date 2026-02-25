import { useMemo } from 'react';
import { Bell } from 'lucide-react';
import { type Prospect } from '../../../domain/types';
import { formatCurrency } from '../../../domain/calculations';
import { Button, InlineEmpty, KpiCard, SectionCard } from '../../../components/ui';
import { getPipeAtualValue, getTipoLabel, isProspectAtivo } from '../utils/prospectUi';

interface ProspectKpiSummaryProps {
  prospects: Prospect[];
  reminders: Prospect[];
  onOpenProspect: (prospect: Prospect) => void;
}

export default function ProspectKpiSummary({
  prospects,
  reminders,
  onOpenProspect,
}: ProspectKpiSummaryProps) {
  const totals = useMemo(() => {
    const ativos = prospects.filter((prospect) => isProspectAtivo(prospect.status));
    const pipeAtualCL = ativos
      .filter((prospect) => getTipoLabel(prospect.potencialTipo) === 'CL')
      .reduce((sum, prospect) => sum + getPipeAtualValue(prospect), 0);
    const pipeAtualTXP = ativos
      .filter((prospect) => getTipoLabel(prospect.potencialTipo) === 'TXP')
      .reduce((sum, prospect) => sum + getPipeAtualValue(prospect), 0);
    const realizadoCL = prospects
      .filter((prospect) => getTipoLabel(prospect.realizadoTipo) === 'CL')
      .reduce((sum, prospect) => sum + Number(prospect.realizadoValor ?? 0), 0);
    const realizadoTXP = prospects
      .filter((prospect) => getTipoLabel(prospect.realizadoTipo) === 'TXP')
      .reduce((sum, prospect) => sum + Number(prospect.realizadoValor ?? 0), 0);

    return {
      total: prospects.length,
      ativos: ativos.length,
      pipeAtualCL,
      pipeAtualTXP,
      pipeAtualTotal: pipeAtualCL + pipeAtualTXP,
      realizadoCL,
      realizadoTXP,
      realizadoTotal: realizadoCL + realizadoTXP,
      reminders: reminders.length,
    };
  }, [prospects, reminders]);

  return (
    <SectionCard
      title="Resumo do Pipeline"
      subtitle="Indicadores de pipeline e pendências de contato"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Prospects" value={totals.total} subtitle="Total filtrado" accentColor="info" layout="wide" />
        <KpiCard title="Ativos" value={totals.ativos} subtitle="Sem ganho/perdido" accentColor="warning" layout="wide" />
        <KpiCard title="Pipe Atual" value={formatCurrency(totals.pipeAtualTotal)} subtitle="CL + TXP" accentColor="gold" layout="wide" />
        <KpiCard title="Pipe CL" value={formatCurrency(totals.pipeAtualCL)} subtitle="Captação Líquida" accentColor="info" layout="wide" />
        <KpiCard title="Pipe TXP" value={formatCurrency(totals.pipeAtualTXP)} subtitle="Transferência XP" accentColor="warning" layout="wide" />
        <KpiCard title="Realizado" value={formatCurrency(totals.realizadoTotal)} subtitle={`CL ${formatCurrency(totals.realizadoCL)} | TXP ${formatCurrency(totals.realizadoTXP)}`} accentColor="success" layout="wide" />
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          <Bell className="h-4 w-4" />
          Pendências de contato ({totals.reminders})
        </div>
        {reminders.length === 0 ? (
          <InlineEmpty message="Sem pendências de contato no momento." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {reminders.slice(0, 8).map((prospect) => (
              <Button
                key={prospect.id ?? prospect.nome}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onOpenProspect(prospect)}
              >
                {prospect.nome}
              </Button>
            ))}
            {reminders.length > 8 && (
              <span className="self-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                +{reminders.length - 8} prospect(s)
              </span>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
