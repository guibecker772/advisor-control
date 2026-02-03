import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';

// Pages
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClientesPage from './pages/clientes/ClientesPage';
import ProspectsPage from './pages/prospects/ProspectsPage';
import CrossPage from './pages/cross/CrossPage';
import ReservasPage from './pages/reservas/ReservasPage';
import CustodiaReceitaPage from './pages/custodia-receita/CustodiaReceitaPage';
import PlanoReceitasPage from './pages/plano-receitas/PlanoReceitasPage';
import SalarioPage from './pages/salario/SalarioPage';
import CaptacaoPage from './pages/captacao/CaptacaoPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="prospects" element={<ProspectsPage />} />
            <Route path="captacao" element={<CaptacaoPage />} />
            <Route path="cross" element={<CrossPage />} />
            <Route path="reservas" element={<ReservasPage />} />
            <Route path="custodia-receita" element={<CustodiaReceitaPage />} />
            <Route path="plano-receitas" element={<PlanoReceitasPage />} />
            <Route path="salario" element={<SalarioPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
