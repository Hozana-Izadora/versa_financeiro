import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function Login() {
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [clients,          setClients]          = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password, selectedClientId || undefined);
      if (result?.requireClientSelection) {
        setClients(result.clients);
        setSelectedClientId(result.clients[0]?.id || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectClient(e) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password, selectedClientId);
    } catch (err) {
      setError(err.message);
      setClients(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 relative overflow-hidden p-12"
        style={{
          background: 'linear-gradient(160deg, #0f2340 0%, #1a3a5c 55%, #0d2137 100%)',
        }}
      >
        {/* Geometric accent shapes */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320,
          borderRadius: '50%',
          background: 'rgba(37,99,235,0.12)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 120, left: -60,
          width: 240, height: 240,
          borderRadius: '50%',
          background: 'rgba(79,70,229,0.10)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, right: 60,
          width: 160, height: 160,
          borderRadius: '50%',
          background: 'rgba(37,99,235,0.08)',
          pointerEvents: 'none',
        }} />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div style={{
              width: 38, height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name="bar_chart" size="text-[18px]" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
                Versa Finanças
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9.5, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 1 }}>
                Dashboard Gerencial
              </div>
            </div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.90)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 30, lineHeight: 1.25, letterSpacing: '-0.5px', maxWidth: 320 }}>
            Gestão financeira com clareza e precisão.
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, lineHeight: 1.7, marginTop: 20, maxWidth: 300 }}>
            Acompanhe fluxo de caixa, resultados por competência e indicadores-chave em um único painel.
          </div>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-col gap-3">
          {[
            { icon: 'trending_up',  label: 'DRE por competência e caixa' },
            { icon: 'account_balance', label: 'Controle de saldos e lançamentos' },
            { icon: 'insert_chart', label: 'Gráficos e indicadores em tempo real' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={icon} size="text-[15px]" style={{ color: 'rgba(255,255,255,0.7)' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5 }}>{label}</span>
            </div>
          ))}

          <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 20 }}>
            © {new Date().getFullYear()} Versa Finanças · Todos os direitos reservados
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-10">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 4,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="bar_chart" size="text-[16px]" style={{ color: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Versa Finanças
            </span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {!clients ? (
            <>
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 24, fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px', marginBottom: 6 }}>
                  Bem-vindo de volta
                </div>
                <div style={{ fontSize: 13.5, color: '#64748b' }}>
                  Entre com suas credenciais para acessar o painel
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>
                    E-mail
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                      <Icon name="mail" size="text-[16px]" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      required
                      autoFocus
                      style={{
                        width: '100%',
                        paddingLeft: 38,
                        paddingRight: 14,
                        paddingTop: 11,
                        paddingBottom: 11,
                        fontSize: 13.5,
                        borderRadius: 8,
                        border: '1.5px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color .15s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>
                    Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                      <Icon name="lock" size="text-[16px]" />
                    </span>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        paddingLeft: 38,
                        paddingRight: 42,
                        paddingTop: 11,
                        paddingBottom: 11,
                        fontSize: 13.5,
                        borderRadius: 8,
                        border: '1.5px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color .15s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}
                    >
                      <Icon name={showPass ? 'visibility_off' : 'visibility'} size="text-[16px]" />
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: '#dc2626',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderLeft: '3px solid #ef4444',
                    borderRadius: 8, padding: '10px 14px',
                  }}>
                    <Icon name="error_outline" size="text-[15px]" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '13px 0',
                    background: loading ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.2px',
                    transition: 'opacity .15s, transform .1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.93'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {loading
                    ? <><Icon name="autorenew" size="text-[16px]" style={{ animation: 'spin 1s linear infinite' }} />Entrando…</>
                    : <><Icon name="login" size="text-[16px]" />Entrar</>
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', marginBottom: 6 }}>
                  Selecionar empresa
                </div>
                <div style={{ fontSize: 13.5, color: '#64748b' }}>
                  Sua conta está associada a mais de uma empresa.
                </div>
              </div>

              <form onSubmit={handleSelectClient} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>
                    Empresa
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                      <Icon name="business" size="text-[16px]" />
                    </span>
                    <select
                      value={selectedClientId}
                      onChange={e => setSelectedClientId(e.target.value)}
                      style={{
                        width: '100%',
                        paddingLeft: 38,
                        paddingRight: 14,
                        paddingTop: 11,
                        paddingBottom: 11,
                        fontSize: 13.5,
                        borderRadius: 8,
                        border: '1.5px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: '#dc2626',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderLeft: '3px solid #ef4444',
                    borderRadius: 8, padding: '10px 14px',
                  }}>
                    <Icon name="error_outline" size="text-[15px]" />
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => { setClients(null); setError(''); }}
                    style={{
                      flex: 1, padding: '12px 0',
                      background: '#fff', color: '#475569',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                      fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1, padding: '12px 0',
                      background: loading ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#4f46e5)',
                      color: '#fff', border: 'none',
                      borderRadius: 8, fontSize: 13.5, fontWeight: 700,
                      fontFamily: 'Inter, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.30)',
                    }}
                  >
                    {loading ? 'Entrando…' : 'Continuar'}
                  </button>
                </div>
              </form>
            </>
          )}

          <div style={{ textAlign: 'center', marginTop: 36, color: '#94a3b8', fontSize: 11.5 }}>
            Acesso restrito a usuários autorizados
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
