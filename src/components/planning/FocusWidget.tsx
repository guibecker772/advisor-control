import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Target, Play, Pause, Square, ChevronDown, Clock,
  SkipForward, Volume2, VolumeX, Coffee,
  ListTodo, LayoutGrid, Sparkles, CheckCircle2, XCircle, Pencil,
  Bell, BellOff,
} from 'lucide-react';
import { useFocusMode, type FocusStatus, type FocusSourceType } from '../../contexts/FocusModeContext';

// ==========================================
// Helpers
// ==========================================

/** Format seconds → "MM:SS". */
function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Duration presets (in minutes)
const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [3, 5, 10];

const SOURCE_LABELS: Record<FocusSourceType, string> = {
  free: 'Foco livre',
  task: 'Tarefa',
  block: 'Bloco',
};

function SourceIcon({ type, className }: { type: FocusSourceType; className?: string }) {
  switch (type) {
    case 'task': return <ListTodo className={className} />;
    case 'block': return <LayoutGrid className={className} />;
    default: return <Sparkles className={className} />;
  }
}

// ==========================================
// Collapsed bubble
// ==========================================

function CollapsedBubble({ onClick, status }: { onClick: () => void; status: FocusStatus }) {
  const isActive = status === 'focusing' || status === 'paused' || status === 'breaking' || status === 'closing';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
      style={{
        backgroundColor: status === 'breaking'
          ? 'var(--color-info)'
          : isActive ? 'var(--color-gold)' : 'var(--color-surface)',
        border: `1.5px solid ${isActive ? 'var(--color-gold-hover)' : 'var(--color-border)'}`,
        color: isActive ? 'var(--color-text-inverse)' : 'var(--color-gold)',
      }}
      title="Modo Foco"
    >
      {status === 'breaking' ? (
        <Coffee className="w-5 h-5" />
      ) : (
        <Target className="w-5 h-5" />
      )}

      {/* Pulse ring when focusing */}
      {status === 'focusing' && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: 'var(--color-gold)', opacity: 0.2 }}
        />
      )}

      {/* Paused indicator dot */}
      {status === 'paused' && (
        <span
          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
          style={{ backgroundColor: 'var(--color-warning)', borderColor: 'var(--color-surface)' }}
        />
      )}
    </button>
  );
}

// ==========================================
// Expanded card
// ==========================================

function ExpandedCard() {
  const {
    status,
    phase,
    session,
    settings,
    setExpanded,
    updateSession,
    toggleSound,
    toggleBrowserNotifications,
    start,
    pause,
    resume,
    skipBreak,
    stop,
    completeSession,
    dismissClose,
    dailyGoalMinutes,
    setDailyGoalMinutes,
  } = useFocusMode();

  const inputRef = useRef<HTMLInputElement>(null);
  const [closingNote, setClosingNote] = useState('');
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  // Auto-focus input when idle
  useEffect(() => {
    if (status === 'idle' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status]);

  const isIdle = status === 'idle';
  const isFocusing = status === 'focusing';
  const isPaused = status === 'paused';
  const isBreaking = status === 'breaking';
  const isClosing = status === 'closing';
  const isActive = isFocusing || isPaused || isBreaking || isClosing;

  const handleStart = useCallback(() => {
    if (!session.label.trim()) return;
    start();
  }, [session.label, start]);

  // Progress percentage for visual ring
  const totalPhaseSeconds = phase === 'focus'
    ? session.durationMinutes * 60
    : session.breakMinutes * 60;
  const progressPct = totalPhaseSeconds > 0
    ? ((totalPhaseSeconds - session.remainingSeconds) / totalPhaseSeconds) * 100
    : 0;

  return (
    <div
      className="w-72 rounded-xl shadow-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${isBreaking ? 'var(--color-info)' : 'var(--color-border)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          {isBreaking ? (
            <Coffee className="w-4 h-4" style={{ color: 'var(--color-info)' }} />
          ) : (
            <Target className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
          )}
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {isBreaking ? 'Pausa' : 'Modo Foco'}
          </span>
          {isActive && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{
                backgroundColor: isBreaking
                  ? 'var(--color-info-bg)'
                  : isFocusing ? 'var(--color-success-bg)'
                  : isClosing ? 'var(--color-gold-bg)'
                  : 'var(--color-warning-bg)',
                color: isBreaking
                  ? 'var(--color-info)'
                  : isFocusing ? 'var(--color-success)'
                  : isClosing ? 'var(--color-gold)'
                  : 'var(--color-warning)',
              }}
            >
              {isBreaking ? 'Descansando' : isFocusing ? 'Focando' : isClosing ? 'Encerrando' : 'Pausado'}
            </span>
          )}
          {session.cycleCount > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              ×{session.cycleCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hover-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            title={settings.soundEnabled ? 'Som ligado' : 'Som desligado'}
          >
            {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          {/* Browser notification toggle */}
          <button
            type="button"
            onClick={toggleBrowserNotifications}
            className="p-1 rounded transition-colors"
            style={{ color: settings.browserNotificationsEnabled ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hover-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            title={settings.browserNotificationsEnabled ? 'Notificações do navegador ligadas' : 'Notificações do navegador desligadas'}
          >
            {settings.browserNotificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hover-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Recolher"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Timer display with progress ring */}
        {!isClosing && (
        <div className="text-center relative">
          {/* Progress bar (thin, below timer) */}
          {isActive && (
            <div
              className="mx-auto mb-2 rounded-full overflow-hidden"
              style={{
                width: '80%',
                height: '3px',
                backgroundColor: 'var(--color-surface-3)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isBreaking ? 'var(--color-info)' : 'var(--color-gold)',
                }}
              />
            </div>
          )}
          <p
            className="text-4xl font-mono font-bold tracking-wider"
            style={{
              color: isBreaking
                ? 'var(--color-info)'
                : isActive ? 'var(--color-gold)' : 'var(--color-text)',
            }}
          >
            {formatTime(session.remainingSeconds)}
          </p>
          {isBreaking && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-info)' }}>
              Descanse. Você merece.
            </p>
          )}
        </div>
        )}

        {/* Label input + duration selectors — shown when idle */}
        {isIdle && (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="No que vou focar..."
              value={session.label}
              onChange={e => updateSession({ label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />

            {/* Focus duration */}
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <div className="flex gap-1.5 flex-1">
                {FOCUS_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSession({ durationMinutes: d })}
                    className="flex-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: session.durationMinutes === d
                        ? 'var(--color-gold-bg)' : 'transparent',
                      color: session.durationMinutes === d
                        ? 'var(--color-gold)' : 'var(--color-text-muted)',
                      border: `1px solid ${session.durationMinutes === d
                        ? 'var(--color-gold-muted)' : 'var(--color-border-subtle)'}`,
                    }}
                    onMouseEnter={e => {
                      if (session.durationMinutes !== d) e.currentTarget.style.backgroundColor = 'var(--hover-light)';
                    }}
                    onMouseLeave={e => {
                      if (session.durationMinutes !== d) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {d}min
                  </button>
                ))}
              </div>
            </div>

            {/* Break duration */}
            <div className="flex items-center gap-2">
              <Coffee className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <div className="flex gap-1.5 flex-1">
                {BREAK_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSession({ breakMinutes: d })}
                    className="flex-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: session.breakMinutes === d
                        ? 'var(--color-info-bg)' : 'transparent',
                      color: session.breakMinutes === d
                        ? 'var(--color-info)' : 'var(--color-text-muted)',
                      border: `1px solid ${session.breakMinutes === d
                        ? 'var(--color-info)' : 'var(--color-border-subtle)'}`,
                    }}
                    onMouseEnter={e => {
                      if (session.breakMinutes !== d) e.currentTarget.style.backgroundColor = 'var(--hover-light)';
                    }}
                    onMouseLeave={e => {
                      if (session.breakMinutes !== d) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {d}min
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active session context */}
        {isActive && !isClosing && (
          <div
            className="rounded-lg p-2.5 space-y-1"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <SourceIcon type={session.sourceType} className="w-3 h-3 flex-shrink-0" />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {SOURCE_LABELS[session.sourceType]}
              </span>
              {session.sourceContext && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-gold-bg)',
                    color: 'var(--color-gold)',
                  }}
                >
                  {session.sourceContext}
                </span>
              )}
            </div>
            <p
              className="text-xs font-medium truncate"
              style={{ color: 'var(--color-text)' }}
              title={session.label}
            >
              {session.label}
            </p>
          </div>
        )}

        {/* Actions */}
        {!isClosing && (
        <div className="flex items-center justify-center gap-2">
          {isIdle && (
            <button
              type="button"
              onClick={handleStart}
              disabled={!session.label.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: session.label.trim() ? 'var(--color-gold)' : 'var(--color-surface-3)',
                color: session.label.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
                cursor: session.label.trim() ? 'pointer' : 'not-allowed',
                opacity: session.label.trim() ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (session.label.trim()) e.currentTarget.style.backgroundColor = 'var(--color-gold-hover)';
              }}
              onMouseLeave={e => {
                if (session.label.trim()) e.currentTarget.style.backgroundColor = 'var(--color-gold)';
              }}
            >
              <Play className="w-4 h-4" />
              Iniciar Foco
            </button>
          )}

          {isFocusing && (
            <>
              <button
                type="button"
                onClick={pause}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <Pause className="w-4 h-4" />
                Pausar
              </button>
              <button
                type="button"
                onClick={stop}
                className="p-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="Encerrar sessão"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                type="button"
                onClick={resume}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-gold)',
                  color: 'var(--color-text-inverse)',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-gold-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-gold)'; }}
              >
                <Play className="w-4 h-4" />
                Retomar
              </button>
              <button
                type="button"
                onClick={stop}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <Square className="w-3.5 h-3.5" />
                Encerrar
              </button>
            </>
          )}

          {isBreaking && (
            <>
              <button
                type="button"
                onClick={skipBreak}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-gold-bg)',
                  color: 'var(--color-gold)',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-gold-bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-gold-bg)'; }}
              >
                <SkipForward className="w-4 h-4" />
                Pular pausa
              </button>
              <button
                type="button"
                onClick={stop}
                className="p-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="Encerrar sessão"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
        )}

        {/* Keyboard shortcut hint */}
        {(isIdle || isFocusing || isPaused) && (
          <p className="text-center text-[10px]" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
            <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ backgroundColor: 'var(--color-surface-3)' }}>Ctrl+Shift+F</kbd>
            {' '}{isIdle ? 'para iniciar' : isFocusing ? 'para pausar' : 'para retomar'}
          </p>
        )}

        {/* Closing state — outcome card */}
        {isClosing && (
          <div className="space-y-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Sessão encerrada</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text)' }}>
                {session.label || 'Sessão livre'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {Math.round(session.elapsedFocusSeconds / 60)}min focados · {session.cycleCount} ciclo{session.cycleCount !== 1 ? 's' : ''}
              </p>
            </div>

            <input
              type="text"
              placeholder="Nota rápida (opcional)"
              value={closingNote}
              onChange={e => setClosingNote(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />

            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingOutcome}
                onClick={async () => {
                  setSavingOutcome(true);
                  await completeSession('completed', closingNote || undefined);
                  setClosingNote('');
                  setSavingOutcome(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Concluí
              </button>
              <button
                type="button"
                disabled={savingOutcome}
                onClick={async () => {
                  setSavingOutcome(true);
                  await completeSession('interrupted', closingNote || undefined);
                  setClosingNote('');
                  setSavingOutcome(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
              >
                <XCircle className="w-4 h-4" />
                Interrompi
              </button>
            </div>

            <button
              type="button"
              onClick={() => { dismissClose(); setClosingNote(''); }}
              className="w-full text-center text-xs py-1 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      {/* Footer: daily goal display + editor */}
      {isIdle && (
        <div
          className="px-4 py-2"
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-surface-2)',
          }}
        >
          {!editingGoal ? (
            <button
              type="button"
              onClick={() => setEditingGoal(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--color-text-muted)' }}
              title="Editar meta diária"
            >
              <Target size={12} />
              Meta diária: {dailyGoalMinutes}min
              <Pencil size={10} style={{ opacity: 0.6 }} />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Meta diária (min)
              </span>
              <div className="flex gap-1">
                {[60, 90, 120, 150, 180].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setDailyGoalMinutes(v); setEditingGoal(false); }}
                    className="px-2 py-0.5 rounded text-[11px] border cursor-pointer"
                    style={{
                      backgroundColor: v === dailyGoalMinutes ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: v === dailyGoalMinutes ? '#fff' : 'var(--color-text-secondary)',
                      borderColor: v === dailyGoalMinutes ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditingGoal(false)}
                className="text-[10px] bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main Widget (floating, bottom-right)
// ==========================================

export default function FocusWidget() {
  const { widgetVisible, expanded, setExpanded, status } = useFocusMode();
  const widgetRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded, setExpanded]);

  // Close on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    // Use timeout to avoid closing immediately on the same click that opens
    const id = setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', handler);
    };
  }, [expanded, setExpanded]);

  if (!widgetVisible) return null;

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 transition-all duration-300"
      style={{
        bottom: '24px',
        right: '24px',
      }}
    >
      {expanded ? (
        <ExpandedCard />
      ) : (
        <CollapsedBubble onClick={() => setExpanded(true)} status={status} />
      )}
    </div>
  );
}
