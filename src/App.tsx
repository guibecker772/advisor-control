import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToolProvider } from './contexts/ToolContext';
import { ThemeProvider } from './contexts/ThemeContext';
import FirebaseConfigErrorScreen from './components/FirebaseConfigErrorScreen';
import { firebaseInit } from './services/firebase';

const AppShell = lazy(() =>
  import('./components/layout/AppShell').then((module) => ({
    default: module.AppShell,
  })),
);
const LoginPage = lazy(() => import('./pages/login/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/clientes/ClientesPage'));
const ProspectsPage = lazy(() => import('./pages/prospects/ProspectsPage'));
const CrossPage = lazy(() => import('./pages/cross/CrossPage'));
const OfertasPage = lazy(() => import('./pages/reservas/OfertasPage'));
const SalarioPage = lazy(() => import('./pages/salario/SalarioPage'));
const CaptacaoPage = lazy(() => import('./pages/captacao/CaptacaoPage'));
const MetasPage = lazy(() => import('./pages/metas/MetasPage'));
const AgendasPage = lazy(() => import('./pages/agendas/AgendasPage'));
const WealthPlaceholder = lazy(() => import('./pages/wealth/WealthPlaceholder'));
const PrivateWealthCallbackPage = lazy(() => import('./pages/integrations/PrivateWealthCallbackPage'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
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

function App() {
  if (!firebaseInit.ok) {
    return <FirebaseConfigErrorScreen missingVars={firebaseInit.missingVars} />;
  }

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <ToolProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/integrations/pw/callback" element={<PrivateWealthCallbackPage />} />
                  <Route path="/" element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="clientes" element={<ClientesPage />} />
                    <Route path="prospects" element={<ProspectsPage />} />
                    <Route path="captacao" element={<CaptacaoPage />} />
                    <Route path="cross" element={<CrossPage />} />
                    <Route path="ofertas" element={<OfertasPage />} />
                    <Route path="agendas" element={<AgendasPage />} />
                    <Route path="metas" element={<MetasPage />} />
                    <Route path="salario" element={<SalarioPage />} />
                    <Route path="wealth" element={<WealthPlaceholder />} />
                    {/* Redirects para rotas antigas (removidas) */}
                    <Route path="reservas" element={<Navigate to="/" replace />} />
                    <Route path="custodia-receita" element={<Navigate to="/" replace />} />
                    <Route path="plano-receitas" element={<Navigate to="/" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ToolProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
