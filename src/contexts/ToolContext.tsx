import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// Ferramentas disponíveis
export type Tool = 'advisor' | 'wealth';

export interface ToolInfo {
  id: Tool;
  name: string;
  description: string;
  icon: string;
  available: boolean;
  basePath: string;
}

export const TOOLS: Record<Tool, ToolInfo> = {
  advisor: {
    id: 'advisor',
    name: 'Advisor Control',
    description: 'Organização e controle do assessor',
    icon: '📊',
    available: true,
    basePath: '/',
  },
  wealth: {
    id: 'wealth',
    name: 'Private Wealth',
    description: 'Planejamento patrimonial do cliente',
    icon: '💎',
    available: false, // Será habilitado quando integrado
    basePath: '/wealth',
  },
};

interface ToolContextData {
  activeTool: Tool;
  toolInfo: ToolInfo;
  setActiveTool: (tool: Tool) => void;
  isToolAvailable: (tool: Tool) => boolean;
  getAllTools: () => ToolInfo[];
}

const ToolContext = createContext<ToolContextData | undefined>(undefined);

export function useTool() {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useTool must be used within ToolProvider');
  }
  return context;
}

interface ToolProviderProps {
  children: ReactNode;
  defaultTool?: Tool;
}

export function ToolProvider({ children, defaultTool = 'advisor' }: ToolProviderProps) {
  const [activeTool, setActiveToolState] = useState<Tool>(defaultTool);

  const setActiveTool = useCallback((tool: Tool) => {
    if (TOOLS[tool].available) {
      setActiveToolState(tool);
    }
  }, []);

  const isToolAvailable = useCallback((tool: Tool) => {
    return TOOLS[tool].available;
  }, []);

  const getAllTools = useCallback(() => {
    return Object.values(TOOLS);
  }, []);

  const toolInfo = TOOLS[activeTool];

  return (
    <ToolContext.Provider
      value={{
        activeTool,
        toolInfo,
        setActiveTool,
        isToolAvailable,
        getAllTools,
      }}
    >
      {children}
    </ToolContext.Provider>
  );
}
