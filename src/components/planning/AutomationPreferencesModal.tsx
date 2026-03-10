import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui';
import { Settings, RotateCcw } from 'lucide-react';
import type {
  AutomationPreferences,
  AlertThresholds,
  SuggestionThresholds,
  AutomationRulePreferences,
} from '../../domain/planning/planningTypes';
import {
  AUTOMATION_RULE_LABELS,
  ALERT_THRESHOLD_LABELS,
  SUGGESTION_THRESHOLD_LABELS,
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_SUGGESTION_THRESHOLDS,
  DEFAULT_RULE_PREFERENCES,
  PRIORITY_LABELS,
} from '../../domain/planning/planningConstants';
import type { TaskPriority } from '../../domain/planning/planningTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefs: AutomationPreferences;
  saving: boolean;
  onSave: (patch: Partial<AutomationPreferences>) => Promise<void>;
}

export default function AutomationPreferencesModal({
  isOpen,
  onClose,
  prefs,
  saving,
  onSave,
}: Props) {
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(prefs.alertThresholds);
  const [suggestionThresholds, setSuggestionThresholds] = useState<SuggestionThresholds>(prefs.suggestionThresholds);
  const [rulePreferences, setRulePreferences] = useState<AutomationRulePreferences>(prefs.rulePreferences);

  // Sync local state when prefs change
  useEffect(() => {
    setAlertThresholds(prefs.alertThresholds);
    setSuggestionThresholds(prefs.suggestionThresholds);
    setRulePreferences(prefs.rulePreferences);
  }, [prefs]);

  const handleSave = async () => {
    await onSave({ alertThresholds, suggestionThresholds, rulePreferences });
    onClose();
  };

  const handleResetDefaults = () => {
    setAlertThresholds(DEFAULT_ALERT_THRESHOLDS);
    setSuggestionThresholds(DEFAULT_SUGGESTION_THRESHOLDS);
    setRulePreferences(DEFAULT_RULE_PREFERENCES);
  };

  const updateAlert = <K extends keyof AlertThresholds>(key: K, value: number) => {
    setAlertThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const updateSuggestion = <K extends keyof SuggestionThresholds>(key: K, value: number) => {
    setSuggestionThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRule = (rule: keyof AutomationRulePreferences) => {
    setRulePreferences((prev) => ({
      ...prev,
      [rule]: { ...prev[rule], enabled: !prev[rule].enabled },
    }));
  };

  const updateRulePriority = (rule: keyof AutomationRulePreferences, priority: TaskPriority) => {
    setRulePreferences((prev) => ({
      ...prev,
      [rule]: { ...prev[rule], priority },
    }));
  };

  const priorityOptions: TaskPriority[] = ['max', 'high', 'medium', 'low'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Preferências de Automação" size="lg" footer={
      <div className="flex items-center justify-between w-full">
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
          type="button"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar padrões
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    }>
      <div className="space-y-6">
        {/* Regras de automação */}
        <section>
          <h3
            className="flex items-center gap-2 text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text)' }}
          >
            <Settings className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
            Regras de Automação
          </h3>
          <div className="space-y-2">
            {(Object.keys(AUTOMATION_RULE_LABELS) as (keyof AutomationRulePreferences)[]).map((rule) => (
              <div
                key={rule}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rulePreferences[rule].enabled}
                    onClick={() => toggleRule(rule)}
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-gold"
                    style={{
                      backgroundColor: rulePreferences[rule].enabled
                        ? 'var(--color-gold)'
                        : 'var(--color-surface-hover)',
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5"
                      style={{
                        transform: rulePreferences[rule].enabled
                          ? 'translateX(1rem)'
                          : 'translateX(0.125rem)',
                      }}
                    />
                  </button>
                  <span
                    className="text-sm truncate"
                    style={{
                      color: rulePreferences[rule].enabled
                        ? 'var(--color-text)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {AUTOMATION_RULE_LABELS[rule]}
                  </span>
                </div>
                <select
                  value={rulePreferences[rule].priority}
                  onChange={(e) => updateRulePriority(rule, e.target.value as TaskPriority)}
                  className="text-xs rounded-md px-2 py-1 border-0 focus-gold"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* Limiares de Alerta */}
        <section>
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text)' }}
          >
            Limiares de Alerta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(ALERT_THRESHOLD_LABELS) as (keyof AlertThresholds)[]).map((key) => {
              const meta = ALERT_THRESHOLD_LABELS[key];
              return (
                <div
                  key={key}
                  className="rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <label
                    className="block text-xs mb-1.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {meta.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={alertThresholds[key]}
                      onChange={(e) => updateAlert(key, Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 text-sm rounded-md px-2 py-1 border-0 focus-gold"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {meta.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Limiares de Sugestão */}
        <section>
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text)' }}
          >
            Limiares de Sugestão
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(SUGGESTION_THRESHOLD_LABELS) as (keyof SuggestionThresholds)[]).map((key) => {
              const meta = SUGGESTION_THRESHOLD_LABELS[key];
              return (
                <div
                  key={key}
                  className="rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <label
                    className="block text-xs mb-1.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {meta.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={suggestionThresholds[key]}
                      onChange={(e) => updateSuggestion(key, Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 text-sm rounded-md px-2 py-1 border-0 focus-gold"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {meta.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}
