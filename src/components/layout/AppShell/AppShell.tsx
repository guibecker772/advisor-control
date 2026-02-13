import { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { resolveAccessCapabilities } from '../../../lib/access';
import CommandPalette from '../../command/CommandPalette';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';

export default function AppShell() {
  const { user, loading } = useAuth();
  const commandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('advisor_sidebar_collapsed_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const access = resolveAccessCapabilities(user);

  const handleToggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem('advisor_sidebar_collapsed_v1', String(next));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      const isCommandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isCommandK) return;

      event.preventDefault();
      setCommandPaletteOpen(true);
    };

    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-gold)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Sidebar */}
      <AppSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={handleToggleSidebar} 
      />

      {/* Topbar */}
      <AppTopbar
        sidebarCollapsed={sidebarCollapsed}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        commandTriggerRef={commandTriggerRef}
      />

      {/* Main Content */}
      <main
        className="pt-16 min-h-screen transition-all duration-300"
        style={{
          paddingLeft: sidebarCollapsed ? '72px' : '240px',
        }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        triggerRef={commandTriggerRef}
        uid={user?.uid}
        access={access}
      />
    </div>
  );
}
