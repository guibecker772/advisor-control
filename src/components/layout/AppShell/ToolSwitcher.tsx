import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { TOOLS, useTool, type Tool } from '../../../contexts/ToolContext';

export default function ToolSwitcher() {
  const { activeTool, toolInfo, setActiveTool, getAllTools, isToolAvailable } = useTool();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const privateWealthBaseUrl = (import.meta.env.VITE_PRIVATE_WEALTH_BASE_URL ?? '').trim();
  const isPrivateWealthConfigured = privateWealthBaseUrl.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isToolEnabled = (tool: Tool) => {
    if (tool === 'wealth') return isPrivateWealthConfigured;
    return isToolAvailable(tool);
  };

  const handleToolSelect = (tool: Tool) => {
    if (!isToolEnabled(tool)) {
      return;
    }

    if (tool === 'wealth') {
      window.open(privateWealthBaseUrl, '_blank', 'noopener,noreferrer');
      setIsOpen(false);
      return;
    }

    setActiveTool(tool);
    navigate(TOOLS[tool].basePath);
    setIsOpen(false);
  };

  const tools = getAllTools();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--color-gold-bg)',
          color: 'var(--color-gold)',
        }}
        aria-label="Abrir seletor de ferramenta"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">{toolInfo.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl overflow-hidden shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Selecionar Ferramenta
            </p>
          </div>

          <div className="py-2">
            {tools.map((tool) => {
              const isActive = tool.id === activeTool;
              const isAvailable = isToolEnabled(tool.id);
              const useNativeDisabled = !isAvailable && tool.id !== 'wealth';
              const disabledTooltip = tool.id === 'wealth' && !isAvailable ? 'URL nao configurada' : undefined;
              const buttonAriaLabel =
                tool.id === 'wealth' && isAvailable ? 'Abrir Private Wealth' : `Selecionar ${tool.name}`;

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  disabled={useNativeDisabled}
                  title={disabledTooltip}
                  aria-label={buttonAriaLabel}
                  aria-disabled={!isAvailable}
                  className={`
                    w-full flex items-start gap-3 px-4 py-3
                    transition-colors text-left
                    ${isAvailable ? 'hover:bg-[var(--color-surface-hover)]' : 'opacity-60 cursor-not-allowed'}
                  `}
                  style={{
                    backgroundColor: isActive ? 'var(--color-gold-bg)' : 'transparent',
                  }}
                >
                  <span className="text-xl">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isActive ? 'var(--color-gold)' : 'var(--color-text)',
                        }}
                      >
                        {tool.name}
                      </span>
                      {!isAvailable && (
                        <span
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: 'var(--color-surface-2)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          <Lock className="w-3 h-3" />
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {tool.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: 'var(--color-gold)' }} />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="px-4 py-3 border-t"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {isPrivateWealthConfigured ? 'Private Wealth abre em nova aba' : 'Private Wealth sera integrado em breve'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
