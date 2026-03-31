import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Shell from './components/layout/Shell.jsx';
import Notification from './components/ui/Notification.jsx';
import Modal from './components/ui/Modal.jsx';
import Caixa from './pages/Caixa.jsx';
import Competencia from './pages/Competencia.jsx';
import Lancamentos from './pages/Lancamentos.jsx';
import Plano from './pages/Plano.jsx';
import Importar from './pages/Importar.jsx';
import Login from './pages/Login.jsx';

function Router() {
  const { state } = useApp();
  switch (state.currentPage) {
    case 'caixa':        return <Caixa />;
    case 'competencia':  return <Competencia />;
    case 'lancamentos':  return <Lancamentos />;
    case 'plano':        return <Plano />;
    case 'importar':     return <Importar />;
    default:             return <Caixa />;
  }
}

function AppInner() {
  const { actions } = useApp();

  useEffect(() => {
    actions.refreshAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Shell><Router /></Shell>
      <Notification />
      <Modal />
    </>
  );
}

function AuthGate() {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) {
    // Avoid flash of login screen while we check for an existing session
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-text-3 text-sm">Carregando…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
