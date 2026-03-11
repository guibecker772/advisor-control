import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  ListTodo,
  Lightbulb,
  BarChart3,
  ArrowRight,
  UserX,
  Layers,
  TrendingDown,
  Briefcase,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import type { Notification, NotificationCategory } from '../../domain/types/calendar';

interface NotificationPanelProps {
  onClose: () => void;
}

// ==========================================
// Category config
// ==========================================

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: 'var(--color-danger)' },
  hoje: { label: 'Hoje', color: 'var(--color-warning)' },
  sugestoes: { label: 'Sugestões', color: 'var(--color-info)' },
  planejamento: { label: 'Planejamento', color: 'var(--color-gold)' },
  agenda: { label: 'Agenda', color: 'var(--color-text-muted)' },
};

const CATEGORY_ORDER: NotificationCategory[] = ['urgente', 'hoje', 'sugestoes', 'planejamento', 'agenda'];

// ==========================================
// Helpers
// ==========================================

function getNotificationIcon(type: string) {
  switch (type) {
    // Calendar
    case 'reminder_60min':
    case 'reminder_30min':
      return <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    case 'event_created':
    case 'event_updated':
      return <Calendar className="w-4 h-4" style={{ color: 'var(--color-info)' }} />;
    case 'sync_error':
      return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />;
    // Planning
    case 'planning_overdue_followup':
      return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />;
    case 'planning_overdue_task':
      return <ListTodo className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    case 'planning_idle_prospect':
      return <UserX className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    case 'planning_client_no_contact':
      return <Users className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />;
    case 'planning_overflow_risk':
      return <Layers className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    case 'planning_free_slot':
      return <Lightbulb className="w-4 h-4" style={{ color: 'var(--color-info)' }} />;
    case 'planning_daily_summary':
      return <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />;
    case 'planning_meeting_prep':
      return <Briefcase className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    case 'planning_pace_behind':
      return <TrendingDown className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    default:
      return <Bell className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />;
  }
}

function getPriorityDotColor(priority: string | undefined): string | null {
  switch (priority) {
    case 'critical': return 'var(--color-danger)';
    case 'high': return 'var(--color-warning)';
    default: return null;
  }
}

function getEffectiveCategory(n: Notification): NotificationCategory {
  if (n.category && CATEGORY_CONFIG[n.category as NotificationCategory]) {
    return n.category as NotificationCategory;
  }
  // Calendar notifications → agenda
  return 'agenda';
}

function groupByCategory(notifications: Notification[]): Map<NotificationCategory, Notification[]> {
  const groups = new Map<NotificationCategory, Notification[]>();
  for (const n of notifications) {
    const cat = getEffectiveCategory(n);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(n);
  }
  return groups;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const navigate = useNavigate();

  const grouped = useMemo(() => groupByCategory(notifications), [notifications]);

  // Relative time helper — "agora", "há 5min", "há 2h", "há 1d"
  const relativeTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      const diff = Date.now() - new Date(dateString).getTime();
      if (diff < 0) return '';
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'agora';
      if (mins < 60) return `há ${mins}min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `há ${hours}h`;
      const days = Math.floor(hours / 24);
      return `há ${days}d`;
    } catch {
      return '';
    }
  };

  const handleNavigate = (route: string, n: Notification) => {
    navigate(route);
    if (!n.read) markAsRead(n.id!);
    onClose();
  };

  return (
    <div
      className="pointer-events-auto select-text rounded-xl shadow-sm overflow-hidden"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-2)' }}>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Notificações</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'var(--color-danger)', color: 'var(--color-text-inverse)' }}>
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={markAllAsRead}
                className="p-1.5 rounded-lg transition-colors hover-light"
                style={{ color: 'var(--color-text-muted)' }}
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="p-1.5 rounded-lg transition-colors hover-light"
                style={{ color: 'var(--color-text-muted)' }}
                title="Limpar todas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover-light"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Notificações (agrupada por categoria) */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--color-gold)' }} />
            <p className="mt-2 text-sm">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <Bell className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm">Nenhuma notificação</p>
            <p className="text-xs mt-1">Alertas do Planejamento e da Agenda aparecerão aqui.</p>
          </div>
        ) : (
          <div>
            {CATEGORY_ORDER.map(cat => {
              const items = grouped.get(cat);
              if (!items || items.length === 0) return null;
              const config = CATEGORY_CONFIG[cat];

              return (
                <div key={cat}>
                  {/* Category header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: 'var(--color-surface-2)', color: config.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    {config.label}
                    <span style={{ color: 'var(--color-text-muted)' }}>({items.length})</span>
                  </div>

                  {/* Items */}
                  {items.map(notification => {
                    const priorityDot = getPriorityDotColor(notification.priority);

                    return (
                      <div
                        key={notification.id}
                        className="px-4 py-3 transition-colors"
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          backgroundColor: !notification.read ? 'var(--color-info-bg)' : 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--color-info-bg)' : 'var(--row-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--color-info-bg)' : 'transparent'}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {priorityDot && (
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: priorityDot }}
                                />
                              )}
                              <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : ''}`} style={{ color: 'var(--color-text)' }}>
                                {notification.title}
                              </p>
                              {!notification.read && !priorityDot && (
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-info)' }} />
                              )}
                            </div>

                            {notification.message && (
                              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                                {notification.message}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {/* Multi-action buttons from actions[] */}
                              {notification.actions && notification.actions.length > 0 ? (
                                notification.actions.map((action, idx) => {
                                  const isPrimary = action.variant === 'primary';
                                  const isGhost = action.variant === 'ghost';
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleNavigate(action.route, notification)}
                                      className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-colors"
                                      style={{
                                        color: isPrimary ? 'var(--color-gold)' : isGhost ? 'var(--color-text-muted)' : 'var(--color-info)',
                                        backgroundColor: isPrimary ? 'rgba(212,175,55,0.1)' : isGhost ? 'transparent' : 'rgba(59,130,246,0.08)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isPrimary ? 'rgba(212,175,55,0.2)' : isGhost ? 'var(--color-surface-2)' : 'rgba(59,130,246,0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isPrimary ? 'rgba(212,175,55,0.1)' : isGhost ? 'transparent' : 'rgba(59,130,246,0.08)';
                                      }}
                                    >
                                      {action.label}
                                      {isPrimary && <ArrowRight className="w-3 h-3" />}
                                    </button>
                                  );
                                })
                              ) : notification.actionLabel && notification.actionRoute ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigate(notification.actionRoute!, notification)}
                                  className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-colors"
                                  style={{
                                    color: 'var(--color-gold)',
                                    backgroundColor: 'rgba(212,175,55,0.1)',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.2)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.1)'; }}
                                >
                                  {notification.actionLabel}
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ) : null}

                              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                                {relativeTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={() => markAsRead(notification.id!)}
                                className="p-1 rounded transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-info)'; e.currentTarget.style.backgroundColor = 'var(--color-info-bg)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Marcar como lida"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteNotification(notification.id!)}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--color-text-muted)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                              title="Excluir"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
