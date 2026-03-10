import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { usePlanning } from '../../../hooks/usePlanning';
import { usePendingPlanning, deriveImpact } from '../../../hooks/usePendingPlanning';
import type { ImpactType, PendingFilters } from '../../../hooks/usePendingPlanning';
import { SectionCard, Badge, Button, Input, Select } from '../../../components/ui';
import {
  Search,
  Filter,
  X,
  Check,
  Clock,
  Edit3,
  Archive,
  AlertTriangle,
  CalendarX,
  Flame,
  Users,
  UserPlus,
  Gift,
  TrendingUp,
  Heart,
  Settings,
  ListTodo,
  ExternalLink,
} from 'lucide-react';
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_OPTIONS,
  TASK_ORIGIN_OPTIONS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  LINKED_ENTITY_LABELS,
} from '../../../domain/planning/planningConstants';
import { formatDateShort, todayString } from '../../../domain/planning/planningUtils';
import { getEntityRoute } from '../../../domain/planning/planningIntegration';
import type { PlanningTask } from '../../../domain/planning/planningTypes';
import TaskDrawer from '../../../components/planning/TaskDrawer';
import TaskFormModal from '../../../components/planning/TaskFormModal';
import { toastSuccess } from '../../../lib/toast';

type PlanningReturn = ReturnType<typeof usePlanning>;

interface PendingTabProps {
  planning: PlanningReturn;
}

const IMPACT_LABELS: Record<ImpactType, string> = {
  revenue: 'Receita',
  relationship: 'Relacionamento',
  operational: 'Operacional',
};

const IMPACT_COLORS: Record<ImpactType, string> = {
  revenue: 'var(--color-success)',
  relationship: 'var(--color-gold)',
  operational: 'var(--color-text-muted)',
};

const IMPACT_ICONS: Record<ImpactType, typeof TrendingUp> = {
  revenue: TrendingUp,
  relationship: Heart,
  operational: Settings,
};

interface QuickChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: React.ReactNode;
}

function QuickChip({ label, count, active, onClick, color, icon }: QuickChipProps) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
      style={{
        backgroundColor: active ? (color || 'var(--color-gold)') : 'var(--color-surface-2)',
        color: active ? '#fff' : (color || 'var(--color-text-secondary)'),
        border: `1px solid ${active ? 'transparent' : 'var(--color-border-subtle)'}`,
      }}
    >
      {icon}
      {label}
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
        style={{
          backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-3)',
          color: active ? '#fff' : 'var(--color-text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

export default function PendingTab({ planning }: PendingTabProps) {
  const navigate = useNavigate();
  const {
    filters,
    updateFilter,
    clearFilters,
    filteredTasks,
    totalPending,
    chipCounts,
    hasActiveFilters,
  } = usePendingPlanning(planning.tasks);

  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const today = todayString();

  // Quick chip toggle helpers
  const toggleTimeRange = (val: PendingFilters['timeRange']) => {
    updateFilter('timeRange', filters.timeRange === val ? 'all' : val);
  };
  const togglePriority = (val: PendingFilters['priority']) => {
    updateFilter('priority', filters.priority === val ? 'all' : val);
  };
  const toggleType = (val: PendingFilters['type']) => {
    updateFilter('type', filters.type === val ? 'all' : val);
  };
  const toggleEntityType = (val: PendingFilters['entityType']) => {
    updateFilter('entityType', filters.entityType === val ? 'all' : val);
  };

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{
          backgroundColor: chipCounts.overdue > 0 ? 'var(--color-danger-bg)' : 'var(--color-surface)',
          border: `1px solid ${chipCounts.overdue > 0 ? 'var(--color-danger)' : 'var(--color-border-subtle)'}`,
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            {chipCounts.overdue > 0 && (
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
            )}
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {totalPending} pendência(s) em aberto
            </p>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {chipCounts.overdue > 0
              ? `${chipCounts.overdue} atrasada(s) · ${filteredTasks.length} visível(is) com filtros atuais`
              : `${filteredTasks.length} visível(is) com os filtros atuais`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Buscar..."
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<Filter className="w-4 h-4" />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filtros
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        <QuickChip
          label="Atrasadas"
          count={chipCounts.overdue}
          active={filters.timeRange === 'overdue'}
          onClick={() => toggleTimeRange('overdue')}
          color="var(--color-danger)"
          icon={<AlertTriangle className="w-3 h-3" />}
        />
        <QuickChip
          label="Hoje"
          count={chipCounts.today}
          active={filters.timeRange === 'today'}
          onClick={() => toggleTimeRange('today')}
          color="var(--color-gold)"
          icon={<Flame className="w-3 h-3" />}
        />
        <QuickChip
          label="Alta prioridade"
          count={chipCounts.highPriority}
          active={filters.priority === 'high'}
          onClick={() => togglePriority('high')}
          color="var(--color-warning)"
        />
        <QuickChip
          label="Follow-ups"
          count={chipCounts.followUp}
          active={filters.type === 'follow_up'}
          onClick={() => toggleType('follow_up')}
          color="var(--color-info)"
          icon={<ListTodo className="w-3 h-3" />}
        />
        <QuickChip
          label="Com cliente"
          count={chipCounts.withClient}
          active={filters.entityType === 'client'}
          onClick={() => toggleEntityType('client')}
          color="var(--color-gold)"
          icon={<Users className="w-3 h-3" />}
        />
        <QuickChip
          label="Com prospect"
          count={chipCounts.withProspect}
          active={filters.entityType === 'prospect'}
          onClick={() => toggleEntityType('prospect')}
          color="var(--color-success)"
          icon={<UserPlus className="w-3 h-3" />}
        />
        <QuickChip
          label="Com oferta"
          count={chipCounts.withOffer}
          active={filters.entityType === 'offer'}
          onClick={() => toggleEntityType('offer')}
          color="var(--color-info)"
          icon={<Gift className="w-3 h-3" />}
        />
        <QuickChip
          label="Sem data"
          count={chipCounts.noDate}
          active={filters.timeRange === 'no_date'}
          onClick={() => toggleTimeRange('no_date')}
          color="var(--color-text-muted)"
          icon={<CalendarX className="w-3 h-3" />}
        />
      </div>

      {/* Advanced filters (collapsible) */}
      {showFilters && (
        <div
          className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Select
            label="Período"
            value={filters.timeRange}
            onChange={(e) => updateFilter('timeRange', e.target.value as PendingFilters['timeRange'])}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'overdue', label: 'Atrasadas' },
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: 'Esta semana' },
              { value: 'no_date', label: 'Sem data' },
            ]}
          />
          <Select
            label="Tipo"
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value as PendingFilters['type'])}
            options={[{ value: 'all', label: 'Todos' }, ...TASK_TYPE_OPTIONS]}
          />
          <Select
            label="Prioridade"
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value as PendingFilters['priority'])}
            options={[{ value: 'all', label: 'Todas' }, ...PRIORITY_OPTIONS]}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as PendingFilters['status'])}
            options={[{ value: 'all', label: 'Todos' }, ...STATUS_OPTIONS]}
          />
          <Select
            label="Impacto"
            value={filters.impact}
            onChange={(e) => updateFilter('impact', e.target.value as PendingFilters['impact'])}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'revenue', label: 'Receita' },
              { value: 'relationship', label: 'Relacionamento' },
              { value: 'operational', label: 'Operacional' },
            ]}
          />
        </div>
      )}

      {/* Task list */}
      <SectionCard title="Pendências" subtitle="Central de limpeza operacional">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <ListTodo className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {totalPending > 0
                ? 'Nenhuma pendência com esses filtros'
                : 'Nenhuma pendência em aberto'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {totalPending > 0
                ? 'Ajuste ou limpe os filtros para ver outros itens.'
                : 'Parabéns! Você está em dia com suas tarefas.'}
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3">
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div
              className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <div className="col-span-3">Título</div>
              <div className="col-span-1">Tipo</div>
              <div className="col-span-1">Impacto</div>
              <div className="col-span-2">Vínculo</div>
              <div className="col-span-1">Data</div>
              <div className="col-span-1">Prioridade</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Ações</div>
            </div>

            {/* Task rows */}
            {filteredTasks.map((task) => {
              const impact = deriveImpact(task);
              const ImpactIcon = IMPACT_ICONS[impact];
              const isOverdue = task.date && task.date < today && task.status !== 'completed';

              return (
                <div
                  key={task.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 px-4 py-3 items-center transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    borderLeft: isOverdue ? '3px solid var(--color-danger)' : '3px solid transparent',
                  }}
                  onClick={() => setSelectedTask(task)}
                >
                  {/* Title + mobile meta */}
                  <div className="lg:col-span-3">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {task.title}
                    </p>
                    {/* Mobile-only compact info */}
                    <div className="flex items-center gap-2 mt-1 lg:hidden">
                      <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {TASK_TYPE_LABELS[task.type]}
                      </span>
                      {task.linkedEntityName && task.linkedEntityType !== 'none' && (
                        <button
                          className="text-xs inline-flex items-center gap-1 hover:underline"
                          style={{ color: 'var(--color-gold)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const route = getEntityRoute(task.linkedEntityType, task.linkedEntityId);
                            if (route) navigate(route);
                          }}
                        >
                          {task.linkedEntityName}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <div className="hidden lg:block col-span-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {TASK_TYPE_LABELS[task.type]}
                    </span>
                  </div>

                  {/* Impact */}
                  <div className="hidden lg:flex col-span-1 items-center gap-1.5">
                    <ImpactIcon className="w-3.5 h-3.5" style={{ color: IMPACT_COLORS[impact] }} />
                    <span className="text-xs" style={{ color: IMPACT_COLORS[impact] }}>
                      {IMPACT_LABELS[impact]}
                    </span>
                  </div>

                  {/* Entity link */}
                  <div className="hidden lg:block col-span-2">
                    {task.linkedEntityName ? (
                      <button
                        className="flex flex-col text-left group"
                        onClick={(e) => {
                          e.stopPropagation();
                          const route = getEntityRoute(task.linkedEntityType, task.linkedEntityId);
                          if (route) navigate(route);
                        }}
                        title={`Abrir ${task.linkedEntityName}`}
                      >
                        <span className="text-xs font-medium inline-flex items-center gap-1 group-hover:underline" style={{ color: 'var(--color-gold)' }}>
                          {task.linkedEntityName}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        {task.linkedEntityType && task.linkedEntityType !== 'none' && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {LINKED_ENTITY_LABELS[task.linkedEntityType]}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>-</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="hidden lg:block col-span-1">
                    {task.date ? (
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {isOverdue && '⚠ '}
                        {formatDateShort(task.date)}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem data</span>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="hidden lg:block col-span-1">
                    <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>

                  {/* Status */}
                  <div className="hidden lg:block col-span-1">
                    <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </div>

                  {/* Quick actions */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { planning.completeTask(task.id!); toastSuccess('Tarefa concluída'); }}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--color-success-bg)]"
                        style={{ color: 'var(--color-success)' }}
                        title="Concluir"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { planning.postponeTask(task.id!); toastSuccess('Adiada +1 dia'); }}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--color-info-bg)]"
                        style={{ color: 'var(--color-info)' }}
                        title="Adiar +1 dia"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingTask(task); setShowTaskForm(true); }}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-3)]"
                        style={{ color: 'var(--color-text-secondary)' }}
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { planning.archiveTask(task.id!); toastSuccess('Arquivada'); }}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--color-warning-bg)]"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Arquivar"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Modals */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onComplete={async (id) => { await planning.completeTask(id); setSelectedTask(null); }}
        onPostpone={async (id) => { await planning.postponeTask(id); setSelectedTask(null); }}
        onReschedule={async (id, date, start, end) => { await planning.rescheduleTask(id, date, start, end); setSelectedTask(null); }}
        onEdit={(task) => { setSelectedTask(null); setEditingTask(task); setShowTaskForm(true); }}
        onArchive={async (id) => { await planning.archiveTask(id); setSelectedTask(null); }}
      />
      <TaskFormModal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        onSave={async (data) => {
          if (editingTask?.id) { await planning.editTask(editingTask.id, data); }
          else { await planning.addTask(data); }
          setShowTaskForm(false); setEditingTask(null);
        }}
        initialData={editingTask}
      />
    </div>
  );
}
