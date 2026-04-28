import React, { useEffect, Component } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff0f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00', marginBottom: 16 }}>Erro de renderização</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#333', background: '#ffe', padding: 16, borderRadius: 6 }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px' }}>
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Shell from './components/layout/Shell.jsx';
import Notification from './components/ui/Notification.jsx';
import Modal from './components/ui/Modal.jsx';
import Caixa from './pages/Caixa.jsx';
import Competencia from './pages/Competencia.jsx';
import Lancamentos from './pages/Lancamentos.jsx';
import Plano from './pages/Plano.jsx';
import Importar from './pages/Importar.jsx';
import Orcamento from './pages/Orcamento.jsx';
import Login from './pages/Login.jsx';

function Router() {
  const { state } = useApp();
  switch (state.currentPage) {
    case 'caixa':        return <Caixa />;
    case 'competencia':  return <Competencia />;
    case 'orcamento':    return <Orcamento />;
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
    <ErrorBoundary>
      <AuthProvider>
        <ErrorBoundary>
          <AuthGate />
        </ErrorBoundary>
      </AuthProvider>
    </ErrorBoundary>
  );
}
