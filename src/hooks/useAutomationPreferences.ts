import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type {
  AutomationPreferences,
  AlertThresholds,
  SuggestionThresholds,
  AutomationRulePreferences,
} from '../domain/planning/planningTypes';
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_SUGGESTION_THRESHOLDS,
  DEFAULT_RULE_PREFERENCES,
} from '../domain/planning/planningConstants';
import * as planningService from '../services/planningService';

/** In-memory fallback used while loading or when there is no user. */
const FALLBACK: AutomationPreferences = {
  alertThresholds: DEFAULT_ALERT_THRESHOLDS,
  suggestionThresholds: DEFAULT_SUGGESTION_THRESHOLDS,
  rulePreferences: DEFAULT_RULE_PREFERENCES,
};

export function useAutomationPreferences() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;

  const [prefs, setPrefs] = useState<AutomationPreferences>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load on mount / user change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading || !ownerUid) {
        setPrefs(FALLBACK);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await planningService.getAutomationPreferences(ownerUid);
        if (!cancelled) setPrefs(data);
      } catch (err) {
        console.error('[useAutomationPreferences] Erro ao carregar:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authLoading, ownerUid]);

  // Persist partial update
  const save = useCallback(
    async (patch: Partial<AutomationPreferences>) => {
      if (!ownerUid) return;
      setSaving(true);
      try {
        const updated = await planningService.saveAutomationPreferences(patch, ownerUid);
        setPrefs(updated);
      } catch (err) {
        console.error('[useAutomationPreferences] Erro ao salvar:', err);
      } finally {
        setSaving(false);
      }
    },
    [ownerUid],
  );

  // Convenience setters
  const updateAlertThresholds = useCallback(
    (patch: Partial<AlertThresholds>) => {
      const merged = { ...prefs.alertThresholds, ...patch };
      return save({ alertThresholds: merged });
    },
    [prefs.alertThresholds, save],
  );

  const updateSuggestionThresholds = useCallback(
    (patch: Partial<SuggestionThresholds>) => {
      const merged = { ...prefs.suggestionThresholds, ...patch };
      return save({ suggestionThresholds: merged });
    },
    [prefs.suggestionThresholds, save],
  );

  const updateRulePreference = useCallback(
    (rule: keyof AutomationRulePreferences, patch: Partial<AutomationRulePreferences[keyof AutomationRulePreferences]>) => {
      const merged: AutomationRulePreferences = {
        ...prefs.rulePreferences,
        [rule]: { ...prefs.rulePreferences[rule], ...patch },
      };
      return save({ rulePreferences: merged });
    },
    [prefs.rulePreferences, save],
  );

  return {
    prefs,
    loading,
    saving,
    save,
    updateAlertThresholds,
    updateSuggestionThresholds,
    updateRulePreference,
  };
}
