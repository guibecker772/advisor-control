// AppSidebar - Sidebar com grupos + toggle de tema no rodapé
import { useState, useRef, useEffect } from 'react';
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
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { useTool } from '../../../contexts/ToolContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme, type ThemePref } from '../../../contexts/ThemeContext';
import advisorControlMark from '../../../assets/brand/advisor-control-mark.svg';

// Sidebar navigation — agrupada por tópicos
const navigationGroups = [
  {
    label: 'PRINCIPAL',
    items: [
      { name: 'Visão Geral', href: '/', icon: LayoutDashboard },
      { name: 'Agendas', href: '/agendas', icon: Calendar },
    ],
  },
  {
    label: 'RELACIONAMENTO',
    items: [
      { name: 'Clientes', href: '/clientes', icon: Users },
      { name: 'Prospects', href: '/prospects', icon: UserPlus },
    ],
  },
  {
    label: 'MOVIMENTAÇÃO',
    items: [
      { name: 'Captação', href: '/captacao', icon: ArrowDownUp },
      { name: 'Cross Selling', href: '/cross', icon: Repeat },
      { name: 'Ofertas/Ativos', href: '/ofertas', icon: Package },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { name: 'Metas', href: '/metas', icon: Goal },
      { name: 'Salário', href: '/salario', icon: DollarSign },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// Ícone do tema atual
function ThemeIcon({ pref, effective }: { pref: ThemePref; effective: 'dark' | 'light' }) {
  if (pref === 'system') {
    return effective === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />;
  }
  if (pref === 'light') return <Sun className="w-4 h-4" />;
  return <Moon className="w-4 h-4" />;
}

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { toolInfo } = useTool();
  const { logout } = useAuth();
  const { pref, effective, setPref } = useTheme();
  const location = useLocation();

  // Popover de tema (modo rail/recolhido)
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Fechar popover ao clicar fora
  useEffect(() => {
    if (!themePopoverOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setThemePopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themePopoverOpen]);

  const themeOptions: { value: ThemePref; label: string; icon: typeof Monitor }[] = [
    { value: 'system', label: 'Auto', icon: Monitor },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'light', label: 'Claro', icon: Sun },
  ];

  const navigation = navigationGroups;

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
        <img
          src={advisorControlMark}
          alt="Advisor Control"
          className="w-9 h-9 rounded-lg flex-shrink-0"
        />
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

      {/* Navigation Groups */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navigation.map((group, groupIdx) => (
          <div key={group.label} className={groupIdx > 0 ? 'mt-3' : ''}>
            {/* Group header — hidden in rail mode */}
            {!collapsed && (
              <div className="px-4 mb-1">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {group.label}
                </span>
              </div>
            )}

            {/* Divider in rail mode between groups */}
            {collapsed && groupIdx > 0 && (
              <div
                className="mx-3 mb-2"
                style={{ borderTop: '1px solid var(--sidebar-border)' }}
              />
            )}

            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/' && location.pathname.startsWith(item.href));

                return (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      className={`
                        group flex items-center gap-3 px-3 py-2 rounded-lg
                        transition-all duration-200
                        ${collapsed ? 'justify-center' : ''}
                        ${!isActive ? 'hover:bg-[var(--sidebar-item-hover)]' : ''}
                      `}
                      style={{
                        ...(isActive && { backgroundColor: 'var(--sidebar-item-active-bg)' }),
                        borderLeft: isActive
                          ? '3px solid var(--sidebar-item-active-border)'
                          : '3px solid transparent',
                        marginLeft: '-3px',
                      }}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon
                        className="w-5 h-5 flex-shrink-0 transition-colors"
                        style={{
                          color: isActive
                            ? 'var(--color-gold)'
                            : 'var(--color-text-secondary)',
                        }}
                      />
                      {!collapsed && (
                        <span
                          className="text-sm font-medium truncate transition-colors"
                          style={{
                            color: isActive
                              ? 'var(--color-gold)'
                              : 'var(--color-text-secondary)',
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
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="p-2 border-t space-y-1"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* ── Theme toggle ── */}
        {collapsed ? (
          /* Rail mode: ícone + popover */
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setThemePopoverOpen(!themePopoverOpen)}
              className="flex items-center justify-center w-full px-3 py-2 rounded-lg transition-colors hover:bg-[var(--sidebar-item-hover)]"
              style={{
                color: 'var(--color-text-muted)',
              }}
              title="Tema"
              aria-label="Alterar tema"
            >
              <ThemeIcon pref={pref} effective={effective} />
            </button>

            {themePopoverOpen && (
              <div
                className="absolute left-full bottom-0 ml-2 w-40 rounded-xl overflow-hidden shadow-lg animate-fade-in"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  zIndex: 50,
                }}
              >
                <div className="p-1.5">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setPref(opt.value);
                        setThemePopoverOpen(false);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        color:
                          pref === opt.value
                            ? 'var(--color-gold)'
                            : 'var(--color-text-secondary)',
                        backgroundColor:
                          pref === opt.value
                            ? 'var(--color-gold-bg)'
                            : 'transparent',
                      }}
                      role="radio"
                      aria-checked={pref === opt.value}
                      aria-label={`Tema ${opt.label}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Expanded: label "Tema" + segmented Auto | Escuro | Claro */
          <div className="px-3 py-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest block mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Tema
            </span>
            <div
              className="flex rounded-lg p-0.5 gap-0.5"
              style={{ backgroundColor: 'var(--color-surface-2)' }}
              role="radiogroup"
              aria-label="Selecionar tema"
            >
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPref(opt.value)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                  style={{
                    color:
                      pref === opt.value
                        ? 'var(--color-gold)'
                        : 'var(--color-text-muted)',
                    backgroundColor:
                      pref === opt.value
                        ? 'var(--color-gold-bg)'
                        : 'transparent',
                  }}
                  role="radio"
                  aria-checked={pref === opt.value}
                  aria-label={`Tema ${opt.label}`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-lg
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
            flex items-center gap-3 w-full px-3 py-2 rounded-lg
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
