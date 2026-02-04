import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToolProvider } from './contexts/ToolContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClientesPage from './pages/clientes/ClientesPage';
import ProspectsPage from './pages/prospects/ProspectsPage';
import CrossPage from './pages/cross/CrossPage';
import OfertasPage from './pages/reservas/OfertasPage';
import SalarioPage from './pages/salario/SalarioPage';
import CaptacaoPage from './pages/captacao/CaptacaoPage';
import MetasPage from './pages/metas/MetasPage';
import AgendasPage from './pages/agendas/AgendasPage';
import WealthPlaceholder from './pages/wealth/WealthPlaceholder';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ToolProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
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
          </ToolProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
