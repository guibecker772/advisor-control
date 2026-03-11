import { useState, lazy, Suspense, useEffect } from 'react';
import { PageContainer, PageHeader, Tabs, PageSkeleton } from '../../components/ui';
import { Settings } from 'lucide-react';
import { usePlanning } from '../../hooks/usePlanning';
import { useAutomationPreferences } from '../../hooks/useAutomationPreferences';
import { useAgendaEvents } from '../../hooks/useAgendaEvents';
import { useFocusMode } from '../../contexts/FocusModeContext';
import TodayTab from './tabs/TodayTab';
import PlanningErrorBoundary from '../../components/planning/PlanningErrorBoundary';

// Lazy-loaded tabs (só carregam quando o usuário navega para elas)
const WeekTab = lazy(() => import('./tabs/WeekTab'));
const MonthTab = lazy(() => import('./tabs/MonthTab'));
const PendingTab = lazy(() => import('./tabs/PendingTab'));
const ChecklistTab = lazy(() => import('./tabs/ChecklistTab'));
const ReportTab = lazy(() => import('./tabs/ReportTab'));

// Lazy-loaded modal (só carrega quando o usuário abre Preferências)
const AutomationPreferencesModal = lazy(() => import('../../components/planning/AutomationPreferencesModal'));

const PLANNING_TABS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'pendencias', label: 'Pendências' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'relatorio', label: 'Relatório' },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <div
          className="h-4 w-4 animate-spin rounded-full border-2 border-current"
          style={{ borderTopColor: 'transparent' }}
        />
        Carregando...
      </div>
    </div>
  );
}

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState('hoje');
  const [showPrefs, setShowPrefs] = useState(false);
  const planning = usePlanning();
  const { prefs: automationPrefs, saving, save } = useAutomationPreferences();
  const { events: agendaEvents } = useAgendaEvents();
  const { setDailyGoalMinutes, dailyGoalMinutes } = useFocusMode();

  // Sync persisted goal → FocusMode context
  useEffect(() => {
    if (automationPrefs?.focusDailyGoalMinutes) {
      setDailyGoalMinutes(automationPrefs.focusDailyGoalMinutes);
    }
  }, [automationPrefs?.focusDailyGoalMinutes, setDailyGoalMinutes]);

  // Persist widget goal edits → Firestore
  useEffect(() => {
    if (
      automationPrefs &&
      dailyGoalMinutes !== automationPrefs.focusDailyGoalMinutes
    ) {
      save({ focusDailyGoalMinutes: dailyGoalMinutes });
    }
  }, [dailyGoalMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (planning.loading) {
    return (
      <PageContainer variant="wide">
        <PageSkeleton showKpis kpiCount={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide">
      <PageHeader
        title="Planejamento"
        subtitle="Organize sua rotina, prioridades e execução comercial"
        controls={
          <div className="flex items-center gap-3">
            <Tabs items={PLANNING_TABS} value={activeTab} onChange={setActiveTab} />
            <button
              onClick={() => setShowPrefs(true)}
              className="inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-[var(--color-surface-hover)] focus-gold"
              style={{ color: 'var(--color-text-muted)' }}
              title="Preferências de automação"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        }
      />

      {activeTab === 'hoje' && (
        <PlanningErrorBoundary section="Aba Hoje">
          <TodayTab planning={planning} automationPrefs={automationPrefs} onChangeTab={setActiveTab} agendaEvents={agendaEvents} />
        </PlanningErrorBoundary>
      )}

      <Suspense fallback={<TabFallback />}>
        {activeTab === 'semana' && <WeekTab planning={planning} agendaEvents={agendaEvents} />}
        {activeTab === 'mes' && <MonthTab planning={planning} />}
        {activeTab === 'pendencias' && <PendingTab planning={planning} />}
        {activeTab === 'checklist' && <ChecklistTab />}
        {activeTab === 'relatorio' && <ReportTab planning={planning} />}
      </Suspense>

      {showPrefs && (
        <Suspense fallback={null}>
          <AutomationPreferencesModal
            isOpen={showPrefs}
            onClose={() => setShowPrefs(false)}
            prefs={automationPrefs}
            saving={saving}
            onSave={save}
          />
        </Suspense>
      )}
    </PageContainer>
  );
}
