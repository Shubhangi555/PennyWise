import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AppLayout from './components/AppLayout';
import { useAuth } from './context/auth-context';
import AuthPage from './pages/AuthPage';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/TransactionsPage';

export default function App() {
  const { user } = useAuth();

  // Not logged in → auth page (whatever the URL); logged in → routed app
  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
