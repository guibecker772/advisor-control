import type { RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import ToolSwitcher from './ToolSwitcher';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/prospects': 'Prospects',
  '/captacao': 'Captacao',
  '/cross': 'Cross Selling',
  '/ofertas': 'Ofertas/Ativos',
  '/agendas': 'Agendas',
  '/metas': 'Metas',
  '/salario': 'Salario',
  '/wealth': 'Private Wealth',
};

interface AppTopbarProps {
  sidebarCollapsed: boolean;
  onOpenCommandPalette: () => void;
  commandTriggerRef: RefObject<HTMLButtonElement | null>;
}

export default function AppTopbar({
  sidebarCollapsed,
  onOpenCommandPalette,
  commandTriggerRef,
}: AppTopbarProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || 'Advisor Control';

  return (
    <header
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 z-20 transition-all duration-300"
      style={{
        left: sidebarCollapsed ? '72px' : '240px',
        backgroundColor: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <ToolSwitcher />

        <button
          ref={commandTriggerRef}
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
          style={{
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-subtle)',
          }}
          aria-label="Abrir comandos"
          title="Abrir comandos"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">⌘K</span>
        </button>

        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Notificacoes"
          aria-label="Notificacoes"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs font-medium flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-danger)',
                color: 'var(--color-text-inverse)',
                fontSize: '10px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 pl-4 border-l" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {user?.displayName || 'Assessor'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {user?.email}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-gold)',
            }}
          >
            {user?.displayName?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
          </div>
        </div>
      </div>
    </header>
  );
}
