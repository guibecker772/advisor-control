import { X, Bell, Check, CheckCheck, Trash2, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotifications } from '../../contexts/NotificationContext';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll 
  } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reminder_60min':
      case 'reminder_30min':
        return <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
      case 'event_created':
      case 'event_updated':
        return <Calendar className="w-4 h-4" style={{ color: 'var(--color-info)' }} />;
      default:
        return <Bell className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), "dd/MM 'às' HH:mm", { locale: ptBR });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}>
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
                onClick={markAllAsRead}
                className="p-1.5 rounded-lg transition-colors hover-light"
                style={{ color: 'var(--color-text-muted)' }}
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
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
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover-light"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Notificações */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--color-gold)' }} />
            <p className="mt-2 text-sm">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <Bell className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 transition-colors"
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  backgroundColor: !notification.read ? 'var(--color-info-bg)' : 'transparent',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--color-info-bg)' : 'var(--row-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--color-info-bg)' : 'transparent'}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`} style={{ color: 'var(--color-text)' }}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-info)' }} />
                      )}
                    </div>
                    
                    {notification.message && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{notification.message}</p>
                    )}
                    
                    {notification.eventStart && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Evento: {formatTime(notification.eventStart)}
                      </p>
                    )}
                    
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id!)}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-info)'; e.currentTarget.style.backgroundColor = 'var(--color-info-bg)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Marcar como lida"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id!)}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      title="Excluir"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
