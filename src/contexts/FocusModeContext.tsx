import {
  createContext, useContext, useState, useCallback, useRef, useEffect, useMemo,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import type { FocusSuggestion } from '../domain/planning/planningIntelligence';
import type { FocusSessionRecord, FocusOutcome } from '../domain/planning/planningTypes';
import { saveFocusSession, listFocusSessions } from '../services/planningService';
import { useAuth } from './AuthContext';

// ==========================================
// Types
// ==========================================

/**
 * idle      → nothing happening
 * focusing  → focus timer counting down
 * paused    → focus timer manually paused by user
 * breaking  → break timer counting down (after focus ends)
 * closing   → session ended, user choosing outcome
 * completed → session just finished (transient, auto-resets)
 */
export type FocusStatus = 'idle' | 'focusing' | 'paused' | 'breaking' | 'closing' | 'completed';

/** Which phase the timer is in. */
export type FocusPhase = 'focus' | 'break';

/** What initiated this focus session. */
export type FocusSourceType = 'free' | 'task' | 'block';

export interface FocusSession {
  /** What the user is working on. */
  label: string;
  /** What originated this session. */
  sourceType: FocusSourceType;
  /** ID of the linked task or block (when sourceType != 'free'). */
  sourceId?: string;
  /** Human-readable name of the source. */
  sourceName?: string;
  /** Extra context from the source (e.g. task type label, block category). */
  sourceContext?: string;
  /** Focus duration in minutes the user chose. */
  durationMinutes: number;
  /** Break duration in minutes. */
  breakMinutes: number;
  /** ISO timestamp when the session started (first play). */
  startedAt: string | null;
  /** Seconds remaining in the current phase. */
  remainingSeconds: number;
  /** How many focus cycles completed in this session. */
  cycleCount: number;
  /** Elapsed seconds in the current focus phase before it ended or was stopped. */
  elapsedFocusSeconds: number;
}

export interface FocusSettings {
  /** Whether transition sounds are enabled. */
  soundEnabled: boolean;
  /** Whether browser notifications are enabled for focus transitions. */
  browserNotificationsEnabled: boolean;
}

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const DEFAULT_DAILY_GOAL_MINUTES = 120;
const LS_DAILY_GOAL_KEY = 'advisor_focus_daily_goal_v1';

const EMPTY_SESSION: FocusSession = {
  label: '',
  sourceType: 'free',
  durationMinutes: DEFAULT_FOCUS_MINUTES,
  breakMinutes: DEFAULT_BREAK_MINUTES,
  startedAt: null,
  remainingSeconds: DEFAULT_FOCUS_MINUTES * 60,
  cycleCount: 0,
  elapsedFocusSeconds: 0,
};

/** Aggregated focus stats for the current day. */
export interface FocusDayHistory {
  totalMinutes: number;
  sessionCount: number;
  completedCount: number;
  interruptedCount: number;
  sessions: FocusSessionRecord[];
}

/** Per-day entry for the week focus chart. */
export interface FocusWeekDay {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "Seg", "Ter", …
  totalMinutes: number;
  sessionCount: number;
  isToday: boolean;
}

export interface FocusModeContextData {
  widgetVisible: boolean;
  expanded: boolean;
  status: FocusStatus;
  phase: FocusPhase;
  session: FocusSession;
  settings: FocusSettings;
  toggleWidget: () => void;
  setExpanded: (v: boolean) => void;
  updateSession: (patch: Partial<FocusSession>) => void;
  toggleSound: () => void;
  /** Toggle browser notifications (requests permission on first enable). */
  toggleBrowserNotifications: () => void;
  /** Start a free-form focus cycle. */
  start: () => void;
  /** Start focus linked to a planning task. */
  startFromTask: (task: { id: string; title: string; context?: string; durationMinutes?: number }) => void;
  /** Start focus linked to a planning block. */
  startFromBlock: (block: { id: string; title: string; context?: string; durationMinutes?: number }) => void;
  /** Manually pause the focus timer. */
  pause: () => void;
  /** Resume from manual pause. */
  resume: () => void;
  /** Skip the current break and start next focus cycle. */
  skipBreak: () => void;
  /** Stop / reset the entire session. */
  stop: () => void;
  /** Finish the closing flow: save outcome + optional note. */
  completeSession: (outcome: FocusOutcome, note?: string) => Promise<void>;
  /** Dismiss the closing card and go straight to idle. */
  dismissClose: () => void;
  /** Today's focus history (aggregated). */
  todayHistory: FocusDayHistory;
  /** Current week's per-day breakdown (Mon–Sun). */
  weekHistory: FocusWeekDay[];
  /** Reload history from persistence. */
  refreshHistory: () => void;
  /** Current smart suggestion from planning intelligence (set externally). */
  suggestion: FocusSuggestion | null;
  /** Set the current smart suggestion. */
  setSuggestion: (s: FocusSuggestion | null) => void;
  /** Daily focus goal in minutes (synced from preferences). */
  dailyGoalMinutes: number;
  /** Update the daily focus goal (persisted to localStorage; caller syncs to backend). */
  setDailyGoalMinutes: (minutes: number) => void;
}

// ==========================================
// Sound helper
// ==========================================

/** Play a short synthesized tone using Web Audio API. */
function playTone(type: 'focus_end' | 'break_end' | 'session_start') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft, professional tones
    switch (type) {
      case 'session_start':
        osc.frequency.value = 660;
        gain.gain.value = 0.12;
        osc.type = 'sine';
        break;
      case 'focus_end':
        // Two gentle rising notes
        osc.frequency.value = 523;
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        gain.gain.value = 0.15;
        osc.type = 'sine';
        break;
      case 'break_end':
        // Two gentle descending notes
        osc.frequency.value = 659;
        osc.frequency.setValueAtTime(659, ctx.currentTime);
        osc.frequency.setValueAtTime(523, ctx.currentTime + 0.15);
        gain.gain.value = 0.15;
        osc.type = 'sine';
        break;
    }

    // Fade out
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);

    // Cleanup
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available — silently ignore
  }
}

// ==========================================
// Toast helpers (styled for Focus)
// ==========================================

function focusToast(message: string, icon: string) {
  toast(message, {
    duration: 4000,
    icon,
    style: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-gold-muted)',
      fontSize: '13px',
    },
  });
}

// ==========================================
// Browser Notification helper
// ==========================================

/** Check if the Browser Notification API is available. */
function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Request notification permission. Returns true if granted. */
async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Send a browser notification with auto-close after 5s. */
function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: icon ?? '/favicon.ico',
      tag: 'advisor-focus',
      silent: true, // sound is handled separately by our own audio
    });
    // Auto-close after 5 seconds
    setTimeout(() => n.close(), 5000);
  } catch {
    // Silently ignore — e.g. iOS Safari doesn't support Notification constructor
  }
}

// ==========================================
// Context
// ==========================================

const FocusModeContext = createContext<FocusModeContextData | undefined>(undefined);

export function useFocusMode() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) throw new Error('useFocusMode must be used within FocusModeProvider');
  return ctx;
}

// ==========================================
// Provider
// ==========================================

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<FocusStatus>('idle');
  const [phase, setPhase] = useState<FocusPhase>('focus');
  const [session, setSession] = useState<FocusSession>({ ...EMPTY_SESSION });
  const [settings, setSettings] = useState<FocusSettings>(() => {
    try {
      const stored = localStorage.getItem('advisor_focus_sound_v1');
      const notifStored = localStorage.getItem('advisor_focus_browser_notif_v1');
      return {
        soundEnabled: stored !== 'false',
        browserNotificationsEnabled: notifStored === 'true',
      };
    } catch {
      return { soundEnabled: true, browserNotificationsEnabled: false };
    }
  });
  const [suggestion, setSuggestion] = useState<FocusSuggestion | null>(null);

  // Daily focus goal (fast from localStorage, synced from preferences externally)
  const [dailyGoalMinutes, setDailyGoalMinutesState] = useState<number>(() => {
    try {
      const v = localStorage.getItem(LS_DAILY_GOAL_KEY);
      return v ? Number(v) || DEFAULT_DAILY_GOAL_MINUTES : DEFAULT_DAILY_GOAL_MINUTES;
    } catch {
      return DEFAULT_DAILY_GOAL_MINUTES;
    }
  });

  const setDailyGoalMinutes = useCallback((minutes: number) => {
    const clamped = Math.max(10, Math.min(480, minutes));
    setDailyGoalMinutesState(clamped);
    try { localStorage.setItem(LS_DAILY_GOAL_KEY, String(clamped)); } catch { /* */ }
  }, []);

  // History: all loaded sessions (unfiltered)
  const [allHistoryRecords, setAllHistoryRecords] = useState<FocusSessionRecord[]>([]);

  // Snapshot of the session that just ended (kept for closing card)
  const closingSnapshotRef = useRef<FocusSession | null>(null);

  // Ref to track the wall-clock anchor for accurate timing
  const tickAnchorRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<FocusPhase>('focus');

  const toggleWidget = useCallback(() => setWidgetVisible(v => !v), []);

  const toggleSound = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled };
      try { localStorage.setItem('advisor_focus_sound_v1', String(next.soundEnabled)); } catch { /* */ }
      return next;
    });
  }, []);

  const toggleBrowserNotifications = useCallback(async () => {
    if (!settings.browserNotificationsEnabled) {
      // Turning ON: request permission first
      const granted = await requestNotificationPermission();
      if (!granted) {
        focusToast('Permissão de notificação negada pelo navegador.', '🔕');
        return;
      }
    }
    setSettings(prev => {
      const next = { ...prev, browserNotificationsEnabled: !prev.browserNotificationsEnabled };
      try { localStorage.setItem('advisor_focus_browser_notif_v1', String(next.browserNotificationsEnabled)); } catch { /* */ }
      return next;
    });
  }, [settings.browserNotificationsEnabled]);

  // ---- History helpers ----
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const loadHistory = useCallback(async () => {
    if (!ownerUid) return;
    try {
      const all = await listFocusSessions(ownerUid);
      setAllHistoryRecords(all);
    } catch {
      // silently ignore — history is not critical
    }
  }, [ownerUid]);

  const refreshHistory = useCallback(() => { loadHistory(); }, [loadHistory]);

  // Load history on mount / ownerUid change
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const todayHistory = useMemo<FocusDayHistory>(() => {
    const sessions = allHistoryRecords.filter(r => r.date === todayStr);
    return {
      totalMinutes: sessions.reduce((sum, s) => sum + s.totalFocusedMinutes, 0),
      sessionCount: sessions.length,
      completedCount: sessions.filter(s => s.outcome === 'completed').length,
      interruptedCount: sessions.filter(s => s.outcome === 'interrupted').length,
      sessions,
    };
  }, [allHistoryRecords, todayStr]);

  const weekHistory = useMemo<FocusWeekDay[]>(() => {
    const LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    // Monday-based week start
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

    const days: FocusWeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86400000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const daySessions = allHistoryRecords.filter(r => r.date === dateStr);
      days.push({
        date: dateStr,
        dayLabel: LABELS[d.getDay()],
        totalMinutes: daySessions.reduce((sum, s) => sum + s.totalFocusedMinutes, 0),
        sessionCount: daySessions.length,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [allHistoryRecords, todayStr]);

  const updateSession = useCallback((patch: Partial<FocusSession>) => {
    setSession(prev => {
      const next = { ...prev, ...patch };
      // Keep remainingSeconds in sync when user changes duration while idle
      if (patch.durationMinutes !== undefined && status === 'idle') {
        next.remainingSeconds = patch.durationMinutes * 60;
      }
      return next;
    });
  }, [status]);

  // ---- Timer interval ----
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    tickAnchorRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - tickAnchorRef.current) / 1000);
      if (elapsed < 1) return;
      tickAnchorRef.current += elapsed * 1000;

      setSession(prev => {
        const next = Math.max(0, prev.remainingSeconds - elapsed);
        const focusAdd = phaseRef.current === 'focus' ? elapsed : 0;
        return {
          ...prev,
          remainingSeconds: next,
          elapsedFocusSeconds: prev.elapsedFocusSeconds + focusAdd,
        };
      });
    }, 250); // tick 4× per second for smooth updates
  }, [clearTimer]);

  // ---- Transition handlers (called when remainingSeconds reaches 0) ----
  // Keep phaseRef in sync for the timer callback
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (session.remainingSeconds > 0) return;
    if (status === 'idle' || status === 'paused' || status === 'completed' || status === 'closing') return;

    if (status === 'focusing') {
      // Focus phase ended → transition to break
      clearTimer();
      const newCycleCount = session.cycleCount + 1;
      setSession(prev => ({
        ...prev,
        remainingSeconds: prev.breakMinutes * 60,
        cycleCount: newCycleCount,
      }));
      setPhase('break');
      setStatus('breaking');
      startTimer();

      if (settings.soundEnabled) playTone('focus_end');
      if (settings.browserNotificationsEnabled) {
        sendBrowserNotification(
          '☕ Hora da pausa',
          `Ciclo ${newCycleCount} concluído! Descanse ${session.breakMinutes}min.`,
        );
      }
      focusToast(`Ciclo ${newCycleCount} concluído! Hora de descansar.`, '☕');
    } else if (status === 'breaking') {
      // Break ended → back to focus
      clearTimer();
      setSession(prev => ({
        ...prev,
        remainingSeconds: prev.durationMinutes * 60,
      }));
      setPhase('focus');
      setStatus('focusing');
      startTimer();

      if (settings.soundEnabled) playTone('break_end');
      if (settings.browserNotificationsEnabled) {
        sendBrowserNotification(
          '🎯 Voltar ao foco',
          'Pausa encerrada. Hora de retomar a concentração!',
        );
      }
      focusToast('Pausa encerrada. Hora de voltar ao foco!', '🎯');
    }
  }, [session.remainingSeconds, status, clearTimer, startTimer, settings.soundEnabled, settings.browserNotificationsEnabled, session.cycleCount, session.breakMinutes, session.durationMinutes]);

  // ---- Public actions ----

  const start = useCallback(() => {
    setSession(prev => ({
      ...prev,
      sourceType: 'free' as const,
      sourceId: undefined,
      sourceName: undefined,
      sourceContext: undefined,
      startedAt: new Date().toISOString(),
      remainingSeconds: prev.durationMinutes * 60,
      cycleCount: 0,
      elapsedFocusSeconds: 0,
    }));
    setPhase('focus');
    setStatus('focusing');
    startTimer();

    if (settings.soundEnabled) playTone('session_start');
    focusToast('Sessão de foco iniciada. Boa concentração!', '🎯');
  }, [startTimer, settings.soundEnabled]);

  const startFromTask = useCallback(
    (task: { id: string; title: string; context?: string; durationMinutes?: number }) => {
      const dur = task.durationMinutes ?? DEFAULT_FOCUS_MINUTES;
      setSession(prev => ({
        ...prev,
        label: task.title,
        sourceType: 'task' as const,
        sourceId: task.id,
        sourceName: task.title,
        sourceContext: task.context,
        durationMinutes: dur,
        startedAt: new Date().toISOString(),
        remainingSeconds: dur * 60,
        cycleCount: 0,
        elapsedFocusSeconds: 0,
      }));
      setPhase('focus');
      setStatus('focusing');
      setExpanded(true);
      startTimer();

      if (settings.soundEnabled) playTone('session_start');
      focusToast(`Foco em: ${task.title}`, '🎯');
    },
    [startTimer, settings.soundEnabled, setExpanded],
  );

  const startFromBlock = useCallback(
    (block: { id: string; title: string; context?: string; durationMinutes?: number }) => {
      const dur = block.durationMinutes ?? DEFAULT_FOCUS_MINUTES;
      setSession(prev => ({
        ...prev,
        label: block.title,
        sourceType: 'block' as const,
        sourceId: block.id,
        sourceName: block.title,
        sourceContext: block.context,
        durationMinutes: dur,
        startedAt: new Date().toISOString(),
        remainingSeconds: dur * 60,
        cycleCount: 0,
        elapsedFocusSeconds: 0,
      }));
      setPhase('focus');
      setStatus('focusing');
      setExpanded(true);
      startTimer();

      if (settings.soundEnabled) playTone('session_start');
      focusToast(`Foco no bloco: ${block.title}`, '📌');
    },
    [startTimer, settings.soundEnabled, setExpanded],
  );

  const pause = useCallback(() => {
    clearTimer();
    setStatus('paused');
  }, [clearTimer]);

  const resume = useCallback(() => {
    setStatus('focusing');
    startTimer();
  }, [startTimer]);

  const skipBreak = useCallback(() => {
    clearTimer();
    setSession(prev => ({
      ...prev,
      remainingSeconds: prev.durationMinutes * 60,
    }));
    setPhase('focus');
    setStatus('focusing');
    startTimer();

    focusToast('Pausa pulada. Foco retomado!', '⚡');
  }, [clearTimer, startTimer]);

  const stop = useCallback(() => {
    clearTimer();
    const hadWork = session.cycleCount > 0 || status === 'focusing' || session.elapsedFocusSeconds > 0;
    if (hadWork) {
      // Transition to closing card so user can record outcome
      closingSnapshotRef.current = { ...session };
      setStatus('closing');
      setExpanded(true);
      if (settings.browserNotificationsEnabled) {
        const mins = Math.round(session.elapsedFocusSeconds / 60);
        sendBrowserNotification(
          '✅ Sessão encerrada',
          `${mins}min focados · ${session.cycleCount} ciclo${session.cycleCount !== 1 ? 's' : ''}. Registre o resultado.`,
        );
      }
    } else {
      // Nothing meaningful happened — skip closing
      setStatus('idle');
      setPhase('focus');
      setSession(prev => ({
        ...EMPTY_SESSION,
        durationMinutes: prev.durationMinutes,
        breakMinutes: prev.breakMinutes,
        remainingSeconds: prev.durationMinutes * 60,
      }));
    }
  }, [clearTimer, session, status, settings.browserNotificationsEnabled]);

  const resetToIdle = useCallback(() => {
    closingSnapshotRef.current = null;
    setStatus('idle');
    setPhase('focus');
    setSession(prev => ({
      ...EMPTY_SESSION,
      durationMinutes: prev.durationMinutes,
      breakMinutes: prev.breakMinutes,
      remainingSeconds: prev.durationMinutes * 60,
    }));
  }, []);

  const dismissClose = useCallback(() => {
    resetToIdle();
    focusToast('Sessão encerrada.', '✅');
  }, [resetToIdle]);

  const completeSession = useCallback(async (outcome: FocusOutcome, note?: string) => {
    const snap = closingSnapshotRef.current ?? session;
    const totalFocusedMinutes = Math.round(snap.elapsedFocusSeconds / 60);

    if (ownerUid && totalFocusedMinutes > 0) {
      const record: Omit<FocusSessionRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> = {
        date: todayStr,
        label: snap.label || 'Sessão livre',
        sourceType: snap.sourceType,
        sourceId: snap.sourceId,
        sourceContext: snap.sourceContext,
        outcome,
        cycleCount: snap.cycleCount,
        durationMinutes: snap.durationMinutes,
        totalFocusedMinutes,
        startedAt: snap.startedAt ?? new Date().toISOString(),
        endedAt: new Date().toISOString(),
        note: note?.trim() || undefined,
      };
      try {
        await saveFocusSession(record, ownerUid);
        // Refresh history with the new record
        await loadHistory();
      } catch {
        // Persistence failure is not critical
      }
    }

    resetToIdle();
    focusToast(
      outcome === 'completed'
        ? `Sessão concluída! ${totalFocusedMinutes} min focados.`
        : 'Sessão registrada como interrompida.',
      outcome === 'completed' ? '✅' : '⚠️',
    );
  }, [session, ownerUid, todayStr, resetToIdle, loadHistory]);

  // ---- Global keyboard shortcut: Ctrl+Shift+F ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && e.key === 'F')) return;

      // Don't fire when typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      e.preventDefault();

      if (status === 'idle') {
        // Only start if label is non-empty (matches UI validation)
        if (session.label.trim()) start();
      } else if (status === 'focusing') {
        pause();
      } else if (status === 'paused') {
        resume();
      }
      // breaking / closing states: do nothing (let the user interact with the card)
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, session.label, start, pause, resume]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <FocusModeContext.Provider
      value={{
        widgetVisible,
        expanded,
        status,
        phase,
        session,
        settings,
        toggleWidget,
        setExpanded,
        updateSession,
        toggleSound,
        toggleBrowserNotifications,
        start,
        startFromTask,
        startFromBlock,
        pause,
        resume,
        skipBreak,
        stop,
        completeSession,
        dismissClose,
        todayHistory,
        weekHistory,
        refreshHistory,
        suggestion,
        setSuggestion,
        dailyGoalMinutes,
        setDailyGoalMinutes,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  );
}
