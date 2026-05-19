import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/ui/Icon.jsx';

const fadeSlide = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.40, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

function InputField({ label, icon, children }) {
  return (
    <motion.div custom={label === 'E-mail' ? 2 : 3} variants={fadeSlide}>
      <label style={{
        display: 'block', fontSize: 10.5, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7,
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex', pointerEvents: 'none' }}>
          <Icon name={icon} size="text-[16px]" />
        </span>
        {children}
      </div>
    </motion.div>
  );
}

const inputStyle = {
  width: '100%',
  paddingTop: 11, paddingBottom: 11,
  paddingLeft: 38,
  paddingRight: 14,
  fontSize: 13.5,
  borderRadius: 9,
  border: '1.5px solid rgba(0,0,0,0.10)',
  background: '#ffffff',
  color: '#0d1117',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
};

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
    setError(''); setLoading(true);
    try {
      const result = await login(email, password, selectedClientId || undefined);
      if (result?.requireClientSelection) {
        setClients(result.clients);
        setSelectedClientId(result.clients[0]?.id || '');
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSelectClient(e) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError(''); setLoading(true);
    try { await login(email, password, selectedClientId); }
    catch (err) { setError(err.message); setClients(null); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f6f8fa' }}>

      {/* ── Left brand panel ────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 460, flexShrink: 0,
          background: 'linear-gradient(160deg, #0d1117 0%, #1a2332 60%, #0d1117 100%)',
          padding: '48px 44px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Decorative orbs */}
        {[
          { top: -90, right: -90, size: 320, color: 'rgba(16,185,129,0.10)' },
          { bottom: 100, left: -60, size: 240, color: 'rgba(139,92,246,0.08)' },
          { bottom: -40, right: 60, size: 160, color: 'rgba(16,185,129,0.06)' },
        ].map((orb, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.12, duration: 0.7 }}
            style={{
              position: 'absolute',
              top: orb.top, bottom: orb.bottom,
              left: orb.left, right: orb.right,
              width: orb.size, height: orb.size,
              borderRadius: '50%',
              background: orb.color,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.20, duration: 0.40 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44 }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(16,185,129,0.40)',
            }}>
              <Icon name="bar_chart" size="text-[20px]" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
                Versa Finanças
              </div>
              <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 1 }}>
                Dashboard Gerencial
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.42 }}
          >
            <div style={{
              color: 'rgba(255,255,255,0.92)',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontWeight: 700, fontSize: 28,
              lineHeight: 1.28, letterSpacing: '-0.5px',
              maxWidth: 310, marginBottom: 16,
            }}>
              Gestão financeira com clareza e precisão.
            </div>
            <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 1.75, maxWidth: 300 }}>
              Acompanhe fluxo de caixa, competência e indicadores-chave em um único painel.
            </div>
          </motion.div>
        </div>

        {/* Feature list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.40 }}
          style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {[
            { icon: 'trending_up',     label: 'DRE por competência e caixa' },
            { icon: 'account_balance', label: 'Controle de saldos e lançamentos' },
            { icon: 'insert_chart',    label: 'Gráficos e indicadores em tempo real' },
          ].map(({ icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.50 + i * 0.08, duration: 0.32 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={icon} size="text-[14px]" style={{ color: '#6ee7b7' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5 }}>{label}</span>
            </motion.div>
          ))}

          <div style={{ color: 'rgba(255,255,255,0.20)', fontSize: 11, marginTop: 16 }}>
            © {new Date().getFullYear()} Versa Finanças · Todos os direitos reservados
          </div>
        </motion.div>
      </motion.div>

      {/* ── Right form panel ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>

        {/* Mobile logo */}
        <motion.div
          className="lg:hidden"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ textAlign: 'center', marginBottom: 36 }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="bar_chart" size="text-[17px]" style={{ color: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 800, fontSize: 18, color: '#0d1117', letterSpacing: '-0.3px' }}>
              Versa Finanças
            </span>
          </div>
        </motion.div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnimatePresence mode="wait">
            {!clients ? (
              /* Login form */
              <motion.div
                key="login"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -10 }}
                variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
              >
                <motion.div custom={0} variants={fadeSlide} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 24, fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 800, color: '#0d1117', letterSpacing: '-0.5px', marginBottom: 6 }}>
                    Bem-vindo de volta
                  </div>
                  <div style={{ fontSize: 13.5, color: '#6b7280' }}>
                    Entre com suas credenciais para acessar o painel
                  </div>
                </motion.div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <InputField label="E-mail" icon="mail">
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      required autoFocus
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.10)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </InputField>

                  <InputField label="Senha" icon="lock">
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.10)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button" tabIndex={-1}
                      onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}
                    >
                      <Icon name={showPass ? 'visibility_off' : 'visibility'} size="text-[16px]" />
                    </button>
                  </InputField>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: 12.5, color: '#dc2626',
                          background: '#fef2f2', border: '1px solid #fecaca',
                          borderLeft: '3px solid #ef4444',
                          borderRadius: 8, padding: '10px 14px',
                        }}
                      >
                        <Icon name="error_outline" size="text-[15px]" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div custom={4} variants={fadeSlide}>
                    <motion.button
                      type="submit" disabled={loading}
                      whileHover={!loading ? { scale: 1.015, boxShadow: '0 6px 24px rgba(16,185,129,0.35)' } : {}}
                      whileTap={!loading ? { scale: 0.985 } : {}}
                      style={{
                        width: '100%', marginTop: 4, padding: '13px 0',
                        background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff', border: 'none', borderRadius: 9,
                        fontSize: 14, fontWeight: 700,
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.1px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: loading ? 'none' : '0 4px 14px rgba(16,185,129,0.30)',
                      }}
                    >
                      {loading
                        ? <><Icon name="autorenew" size="text-[16px]" style={{ animation: 'spin 1s linear infinite' }} />Entrando…</>
                        : <><Icon name="login" size="text-[16px]" />Entrar</>
                      }
                    </motion.button>
                  </motion.div>
                </form>
              </motion.div>
            ) : (
              /* Client selector */
              <motion.div
                key="clients"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28 }}
              >
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 22, fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 800, color: '#0d1117', letterSpacing: '-0.3px', marginBottom: 6 }}>
                    Selecionar empresa
                  </div>
                  <div style={{ fontSize: 13.5, color: '#6b7280' }}>
                    Sua conta está associada a mais de uma empresa.
                  </div>
                </div>

                <form onSubmit={handleSelectClient} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                      Empresa
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
                        <Icon name="business" size="text-[16px]" />
                      </span>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: 38 }}
                      >
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: 12.5, color: '#dc2626',
                          background: '#fef2f2', border: '1px solid #fecaca',
                          borderLeft: '3px solid #ef4444',
                          borderRadius: 8, padding: '10px 14px',
                        }}
                      >
                        <Icon name="error_outline" size="text-[15px]" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => { setClients(null); setError(''); }}
                      style={{
                        flex: 1, padding: '12px 0',
                        background: '#fff', color: '#4b5563',
                        border: '1.5px solid rgba(0,0,0,0.10)',
                        borderRadius: 9, fontSize: 13.5, fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      Voltar
                    </button>
                    <motion.button
                      type="submit" disabled={loading}
                      whileHover={!loading ? { scale: 1.015 } : {}}
                      whileTap={!loading ? { scale: 0.985 } : {}}
                      style={{
                        flex: 1, padding: '12px 0',
                        background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff', border: 'none', borderRadius: 9,
                        fontSize: 13.5, fontWeight: 700, fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(16,185,129,0.28)',
                      }}
                    >
                      {loading ? 'Entrando…' : 'Continuar'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ textAlign: 'center', marginTop: 36, color: '#9ca3af', fontSize: 11.5 }}
          >
            Acesso restrito a usuários autorizados
          </motion.div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
