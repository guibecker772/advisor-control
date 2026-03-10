import type {
  TaskType,
  TaskOrigin,
  LinkedEntityType,
  TaskPriority,
  TaskStatus,
  BlockCategory,
  ChecklistPeriodType,
  ChecklistItem,
  AutomationPreferences,
  AlertThresholds,
  SuggestionThresholds,
  AutomationRulePreferences,
} from './planningTypes';

// ==========================================
// Labels em pt-BR
// ==========================================

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  meeting: 'Reunião',
  call: 'Ligação',
  follow_up: 'Follow-up',
  prospecting: 'Prospecção',
  admin: 'Administrativo',
  portfolio_review: 'Revisão de Carteira',
  offer: 'Oferta',
  post_meeting: 'Pós-Reunião',
  general: 'Tarefa Geral',
};

export const TASK_ORIGIN_LABELS: Record<TaskOrigin, string> = {
  manual: 'Manual',
  agenda: 'Agenda',
  client: 'Cliente',
  prospect: 'Prospect',
  offer: 'Oferta',
  cross: 'Cross Selling',
  goal: 'Meta',
  system: 'Sistema',
};

export const LINKED_ENTITY_LABELS: Record<LinkedEntityType, string> = {
  client: 'Cliente',
  prospect: 'Prospect',
  offer: 'Oferta',
  cross: 'Cross Selling',
  goal: 'Meta',
  none: 'Nenhum',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  max: 'Máxima',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  max: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  postponed: 'Adiada',
  archived: 'Arquivada',
};

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  prospecting: 'Prospecção',
  follow_up: 'Follow-up',
  meetings: 'Reuniões',
  admin: 'Administrativo',
  study: 'Estudo',
  review: 'Revisão',
  offer: 'Ofertas',
  deep_work: 'Trabalho Focado',
  general: 'Geral',
};

export const PERIOD_TYPE_LABELS: Record<ChecklistPeriodType, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
};

// ==========================================
// Badge variants por tipo/status/prioridade
// ==========================================

export const PRIORITY_BADGE_VARIANT: Record<TaskPriority, 'danger' | 'warning' | 'info' | 'neutral'> = {
  max: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export const STATUS_BADGE_VARIANT: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  pending: 'neutral',
  in_progress: 'info',
  completed: 'success',
  postponed: 'warning',
  archived: 'neutral',
};

// ==========================================
// Options (para selects/forms)
// ==========================================

export const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const TASK_ORIGIN_OPTIONS = Object.entries(TASK_ORIGIN_LABELS).map(([value, label]) => ({ value, label }));
export const LINKED_ENTITY_OPTIONS = Object.entries(LINKED_ENTITY_LABELS).map(([value, label]) => ({ value, label }));
export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const BLOCK_CATEGORY_OPTIONS = Object.entries(BLOCK_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

// ==========================================
// Timeline config
// ==========================================

export const TIMELINE_START_HOUR = 8;
export const TIMELINE_END_HOUR = 18;
export const TIMELINE_HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i,
);

// ==========================================
// Default checklist items
// ==========================================

export const DEFAULT_WEEKLY_CHECKLIST: Omit<ChecklistItem, 'id'>[] = [
  { label: 'Revisar agenda da semana', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 0 },
  { label: 'Confirmar reuniões importantes', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 1 },
  { label: 'Separar clientes prioritários', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 2 },
  { label: 'Revisar prospects em aberto', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 3 },
  { label: 'Revisar ofertas pendentes', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 4 },
  { label: 'Checar saldo parado', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 5 },
  { label: 'Definir blocos de prospecção', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 6 },
  { label: 'Definir follow-ups obrigatórios', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 7 },
  { label: 'Revisar meta semanal', checked: false, checkedAt: '', periodType: 'weekly', sortOrder: 8 },
];

export const DEFAULT_MONTHLY_CHECKLIST: Omit<ChecklistItem, 'id'>[] = [
  { label: 'Revisar metas do mês', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 0 },
  { label: 'Atualizar pipeline', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 1 },
  { label: 'Revisar clientes sem reunião', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 2 },
  { label: 'Identificar oportunidades de cross', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 3 },
  { label: 'Analisar receita projetada', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 4 },
  { label: 'Revisar campanhas/oportunidades', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 5 },
  { label: 'Ajustar planejamento das semanas restantes', checked: false, checkedAt: '', periodType: 'monthly', sortOrder: 6 },
];

// ==========================================
// Automation Preferences Defaults
// ==========================================

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  prospectIdleDays: 7,
  clientNoContactDays: 14,
  overflowTaskLimit: 10,
  reactivationThreshold: 3,
};

export const DEFAULT_SUGGESTION_THRESHOLDS: SuggestionThresholds = {
  freeHoursForBlock: 2,
  highPendingLimit: 10,
};

export const DEFAULT_RULE_PREFERENCES: AutomationRulePreferences = {
  meeting_created: { enabled: false, priority: 'medium' },
  prospect_idle: { enabled: true, priority: 'high' },
  offer_pending: { enabled: true, priority: 'high' },
  client_no_contact: { enabled: true, priority: 'medium' },
  goal_behind: { enabled: false, priority: 'max' },
  cross_opportunity: { enabled: false, priority: 'medium' },
};

export const DEFAULT_AUTOMATION_PREFERENCES: Omit<AutomationPreferences, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> = {
  alertThresholds: DEFAULT_ALERT_THRESHOLDS,
  suggestionThresholds: DEFAULT_SUGGESTION_THRESHOLDS,
  rulePreferences: DEFAULT_RULE_PREFERENCES,
};

/** Labels for automation rule triggers (pt-BR). */
export const AUTOMATION_RULE_LABELS: Record<keyof AutomationRulePreferences, string> = {
  meeting_created: 'Criar pré/pós-reunião automaticamente',
  prospect_idle: 'Alertar prospect sem contato',
  offer_pending: 'Alertar oferta pendente de contato',
  client_no_contact: 'Alertar cliente sem contato',
  goal_behind: 'Sugerir prospecção para meta atrasada',
  cross_opportunity: 'Criar tarefa para oportunidades de cross',
};

/** Labels for alert threshold fields (pt-BR). */
export const ALERT_THRESHOLD_LABELS: Record<keyof AlertThresholds, { label: string; unit: string }> = {
  prospectIdleDays: { label: 'Dias sem contato (prospect)', unit: 'dias' },
  clientNoContactDays: { label: 'Dias sem contato (cliente)', unit: 'dias' },
  overflowTaskLimit: { label: 'Limite de tarefas/dia (overflow)', unit: 'tarefas' },
  reactivationThreshold: { label: 'Mín. atrasadas p/ reativação', unit: 'tarefas' },
};

/** Labels for suggestion threshold fields (pt-BR). */
export const SUGGESTION_THRESHOLD_LABELS: Record<keyof SuggestionThresholds, { label: string; unit: string }> = {
  freeHoursForBlock: { label: 'Horas livres para sugerir bloco', unit: 'horas' },
  highPendingLimit: { label: 'Limite de pendências para alerta', unit: 'tarefas' },
};
