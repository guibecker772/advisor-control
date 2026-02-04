import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';

export default function AppShell() {
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />

      {/* Topbar */}
      <AppTopbar sidebarCollapsed={sidebarCollapsed} />

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
    </div>
  );
}
