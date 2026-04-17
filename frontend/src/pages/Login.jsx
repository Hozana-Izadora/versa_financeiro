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

  // Multi-client selection state
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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="font-inter font-black text-2xl tracking-tight inline-block"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Versa Finanças
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-text-3 mt-1">Dashboard Gerencial</div>
        </div>

        <div className="panel p-7">
          {!clients ? (
            /* ── Credentials form ── */
            <>
              <div className="font-inter font-bold text-base mb-1">Entrar</div>
              <div className="text-xs text-text-3 mb-6">Acesse sua conta para continuar</div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-text-2 uppercase tracking-wide mb-1.5 block">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    required
                    autoFocus
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-text-2 uppercase tracking-wide mb-1.5 block">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pr-9"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2 transition-colors"
                    >
                      <Icon name={showPass ? 'visibility_off' : 'visibility'} size="text-[16px]" />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-fin-red bg-red-50 border border-red-100 rounded-sm px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full mt-1"
                >
                  {loading ? 'Entrando…' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            /* ── Client selection form ── */
            <>
              <div className="font-inter font-bold text-base mb-1">Selecionar empresa</div>
              <div className="text-xs text-text-3 mb-6">
                Sua conta está associada a mais de uma empresa. Selecione para continuar.
              </div>

              <form onSubmit={handleSelectClient} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-text-2 uppercase tracking-wide mb-1.5 block">
                    Empresa
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="w-full"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="text-xs text-fin-red bg-red-50 border border-red-100 rounded-sm px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={() => { setClients(null); setError(''); }}
                  >
                    Voltar
                  </button>
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                    {loading ? 'Entrando…' : 'Continuar'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
