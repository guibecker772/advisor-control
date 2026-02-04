import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// ============================================
// MODO DE TESTE - Firebase desativado
// Para ativar o Firebase, comente o bloco abaixo
// e descomente o bloco de produção
// ============================================

// Usuário mockado para testes
const MOCK_USER = {
  uid: 'test-user-123',
  email: 'teste@teste.com',
  displayName: 'Usuário Teste',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  photoURL: null,
  providerId: 'mock',
} as any;

interface AuthContextType {
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Modo de teste: auto-login com usuário mockado
    console.log('🔓 Modo de teste ativado - Login automático');
    setUser(MOCK_USER);
    setLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    console.log('🔓 Login mockado:', email);
    setUser(MOCK_USER);
  };

  const register = async (email: string, _password: string) => {
    console.log('🔓 Registro mockado:', email);
    setUser(MOCK_USER);
  };

  const logout = async () => {
    console.log('🔓 Logout mockado');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
