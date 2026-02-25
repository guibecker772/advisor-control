import { AlertTriangle, CalendarClock, Clock3, Pencil, Trash2, UserRoundSearch, Workflow } from 'lucide-react';
import { type Prospect, type ProspectInteracao } from '../../../domain/types';
import { formatCurrency } from '../../../domain/calculations';
import { Badge, BaseCard, Button } from '../../../components/ui';
import {
  getAgingDays,
  getContactUrgency,
  getLastContactDate,
  getOrigemLabel,
  getPipeAtualValue,
  getStatusLabel,
  getTipoLabel,
  normalizeDate,
} from '../utils/prospectUi';

interface ProspectCardLargeProps {
  prospect: Prospect;
  interacoes: ProspectInteracao[];
  today: Date;
  onOpenDetails: (prospect: Prospect) => void;
  onEdit: (prospect: Prospect) => void;
  onDelete: (prospect: Prospect) => void;
  onQuickAddInteracao: (prospect: Prospect) => void;
}

function getStatusBadgeVariant(status: Prospect['status'] | undefined): 'neutral' | 'warning' | 'success' | 'danger' {
  if (status === 'ganho') return 'success';
  if (status === 'perdido') return 'danger';
  if (status === 'qualificado' || status === 'proposta') return 'warning';
  return 'neutral';
}

function getUrgencyBadgeVariant(urgency: ReturnType<typeof getContactUrgency>): 'neutral' | 'warning' | 'danger' | 'info' {
  if (urgency === 'overdue') return 'danger';
  if (urgency === 'today') return 'warning';
  if (urgency === 'upcoming') return 'info';
  return 'neutral';
}

function getAgingBadgeVariant(agingDays: number | undefined): 'neutral' | 'warning' | 'danger' {
  if (agingDays === undefined) return 'neutral';
  if (agingDays >= 15) return 'danger';
  if (agingDays >= 7) return 'warning';
  return 'neutral';
}

function formatContactLabel(prospect: Prospect, urgency: ReturnType<typeof getContactUrgency>): string {
  if (!prospect.proximoContato) return 'Sem próximo passo';
  const dueDate = normalizeDate(prospect.proximoContato);
  if (!dueDate) return 'Sem próximo passo';

  const formattedDate = dueDate.toLocaleDateString('pt-BR');
  const hourText = prospect.proximoContatoHora ? ` às ${prospect.proximoContatoHora}` : '';

  if (urgency === 'overdue') return `Vencido em ${formattedDate}${hourText}`;
  if (urgency === 'today') return `Hoje${hourText}`;
  return `${formattedDate}${hourText}`;
}

export default function ProspectCardLarge({
  prospect,
  interacoes,
  today,
  onOpenDetails,
  onEdit,
  onDelete,
  onQuickAddInteracao,
}: ProspectCardLargeProps) {
  const potencial = Number(prospect.potencial ?? 0);
  const realizado = Number(prospect.realizadoValor ?? 0);
  const pipeAtual = getPipeAtualValue(prospect);
  const tipoPipe = getTipoLabel(prospect.potencialTipo);
  const tipoRealizado = getTipoLabel(prospect.realizadoTipo);
  const urgency = getContactUrgency(prospect, today);
  const contactLabel = formatContactLabel(prospect, urgency);
  const lastContactDate = getLastContactDate(prospect, interacoes);
  const agingDays = getAgingDays(lastContactDate, today);
  const probability = Number(prospect.probabilidade ?? 0);

  return (
    <BaseCard padding="md" className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onOpenDetails(prospect)}
          className="focus-gold rounded-sm text-left text-base font-semibold hover:underline"
          style={{ color: 'var(--color-gold)' }}
        >
          {prospect.nome}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getStatusBadgeVariant(prospect.status)}>
            {getStatusLabel(prospect.status)}
          </Badge>
          <Badge variant={prospect.origem === 'liberta' ? 'success' : 'neutral'}>
            {getOrigemLabel(prospect.origem)}
          </Badge>
          {prospect.converted && <Badge variant="gold">Convertido</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Potencial ({tipoPipe})</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {formatCurrency(potencial)}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pipe atual</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-info)' }}>
            {formatCurrency(pipeAtual)}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Realizado ({tipoRealizado})</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(realizado)}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Probabilidade</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {Number.isFinite(probability) ? `${probability}%` : '-'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getUrgencyBadgeVariant(urgency)}>
            {contactLabel}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {urgency === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Próximo contato
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={getAgingBadgeVariant(agingDays)}>
            {agingDays === undefined ? 'Sem histórico de contato' : `Sem contato há ${agingDays} dia(s)`}
          </Badge>
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <Clock3 className="h-3.5 w-3.5" />
            Aging
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<UserRoundSearch className="h-4 w-4" />}
          onClick={() => onOpenDetails(prospect)}
          aria-label={`Abrir detalhes de ${prospect.nome}`}
        >
          Detalhes
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<Pencil className="h-4 w-4" />}
          onClick={() => onEdit(prospect)}
          aria-label={`Editar ${prospect.nome}`}
        >
          Editar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          leftIcon={<Workflow className="h-4 w-4" />}
          onClick={() => onQuickAddInteracao(prospect)}
          aria-label={`Registrar interação para ${prospect.nome}`}
        >
          Registrar interação
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          leftIcon={<Trash2 className="h-4 w-4" />}
          onClick={() => onDelete(prospect)}
          aria-label={`Excluir ${prospect.nome}`}
        >
          Excluir
        </Button>
      </div>
    </BaseCard>
  );
}
