// AppSidebar - Sidebar do tema escuro
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Repeat,
  DollarSign,
  ArrowDownUp,
  Package,
  Goal,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useTool } from '../../../contexts/ToolContext';
import { useAuth } from '../../../contexts/AuthContext';

// Navegação do Advisor Control
const advisorNavigation = [
  { name: 'Visão Geral', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Prospects', href: '/prospects', icon: UserPlus },
  { name: 'Captação', href: '/captacao', icon: ArrowDownUp },
  { name: 'Cross Selling', href: '/cross', icon: Repeat },
  { name: 'Ofertas/Ativos', href: '/ofertas', icon: Package },
  { name: 'Agendas', href: '/agendas', icon: Calendar },
  { name: 'Metas', href: '/metas', icon: Goal },
  { name: 'Salário', href: '/salario', icon: DollarSign },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { toolInfo } = useTool();
  const { logout } = useAuth();
  const location = useLocation();

  const navigation = advisorNavigation;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen z-30
        flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[72px]' : 'w-[240px]'}
      `}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo / Brand */}
      <div 
        className="flex items-center gap-3 px-4 h-16 border-b"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div 
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ 
            backgroundColor: 'var(--color-gold-bg)',
            color: 'var(--color-gold)',
          }}
        >
          {collapsed ? 'A' : 'AC'}
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span 
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {toolInfo.name}
            </span>
            <span 
              className="text-xs truncate"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Metas Pro
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${collapsed ? 'justify-center' : ''}
                  `}
                  style={{
                    backgroundColor: isActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--sidebar-item-active-border)' : '3px solid transparent',
                    marginLeft: '-3px',
                  }}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon 
                    className="w-5 h-5 flex-shrink-0 transition-colors"
                    style={{ 
                      color: isActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                    }}
                  />
                  {!collapsed && (
                    <span 
                      className="text-sm font-medium truncate transition-colors"
                      style={{ 
                        color: isActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {item.name}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div 
        className="p-2 border-t"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
            transition-colors hover:bg-[var(--sidebar-item-hover)]
            ${collapsed ? 'justify-center' : ''}
          `}
          style={{ color: 'var(--color-text-muted)' }}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Recolher</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`
            flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
            transition-colors hover:bg-[var(--color-danger-bg)]
            ${collapsed ? 'justify-center' : ''}
          `}
          style={{ color: 'var(--color-text-muted)' }}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
