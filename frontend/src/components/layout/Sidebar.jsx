import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { api } from '../../api/index.js';
import { confirmDialog } from '../../utils/alerts.js';
import Icon from '../ui/Icon.jsx';
import ChangePasswordModal from '../ui/ChangePasswordModal.jsx';
import logo from '../../assets/logo.jpeg';

const NAV_ITEMS = [
  { id: 'caixa',       icon: 'account_balance_wallet', label: 'Caixa',           section: 'Dashboard', isDashboard: true },
  { id: 'competencia', icon: 'bar_chart',               label: 'Competência',     section: 'Dashboard' },
  { id: 'orcamento',   icon: 'gps_fixed',               label: 'Orçamento',       section: 'Dashboard' },
  { id: 'lancamentos', icon: 'receipt_long',             label: 'Lançamentos',     section: 'Dados', badge: true },
  { id: 'plano',       icon: 'account_tree',             label: 'Plano de Contas', section: 'Dados' },
  { id: 'importar',    icon: 'upload_file',              label: 'Importar Dados',  section: 'Dados' },
  { id: 'admin',       icon: 'admin_panel_settings',     label: 'Administração',   section: 'Admin', adminOnly: true },
];

const sidebarVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
};

const navItemVariants = {
  hidden:  { x: -8, opacity: 0 },
  visible: (i) => ({
    x: 0, opacity: 1,
    transition: { delay: 0.05 + i * 0.045, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { state, actions } = useApp();
  const { user, logout, switchClient } = useAuth();
  const { can } = usePermissions();
  const { currentPage, transactions, darkMode } = state;
  const txCount = transactions.caixa.length + transactions.competencia.length;

  // ── Company switcher ────────────────────────────────────────────────
  const [myClients, setMyClients]   = useState([]);
  const [switching, setSwitching]   = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef();

  // ── User "more options" menu (Trocar senha, …) ────────────────────────
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef();

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDown(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!user?.clientId) return;
    api.myClients().then(setMyClients).catch(() => {});
  }, [user?.clientId]);

  useEffect(() => {
    if (!switcherOpen) return;
    function onDown(e) { if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [switcherOpen]);

  async function handleSwitchClient(clientId) {
    if (clientId === user.clientId) { setSwitcherOpen(false); return; }
    setSwitching(true);
    try {
      await switchClient(clientId);
      actions.setPage('caixa');
      await actions.refreshAll();
      actions.notify('Empresa alterada com sucesso.', 'ns');
    } catch (err) {
      actions.notify('Erro ao trocar de empresa: ' + err.message, 'ne');
    } finally {
      setSwitching(false);
      setSwitcherOpen(false);
    }
  }
  const visibleItems = NAV_ITEMS.filter(i => {
    if (i.adminOnly) return Boolean(user?.isSuperAdmin);
    return can(i.id);
  });
  const sections = [...new Set(visibleItems.map(i => i.section))];

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleNav = (id) => { actions.setPage(id); setMobileOpen(false); };

  async function handleLogout() {
    if (!await confirmDialog('Deseja realmente sair?', { confirmText: 'Sair' })) return;
    logout();
  }

  let navIndex = 0;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 90 }}
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.nav
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column',
          background: darkMode
            ? 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)'
            : '#ffffff',
          borderRight: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          transition: 'width 280ms cubic-bezier(0.4,0,0.2,1), transform 280ms cubic-bezier(0.4,0,0.2,1)',
          width: collapsed ? 60 : 224,
          transform: mobileOpen ? 'translateX(0)' : undefined,
          overflow: 'hidden',
        }}
        className={!mobileOpen ? '-translate-x-full lg:translate-x-0' : ''}
      >
        {/* Logo area */}
        <div style={{
          padding: '18px 14px 14px',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 64, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            {/* Logo */}
            <img src={logo} alt="Versa Finanças" style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
            }} />
            {!collapsed && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: darkMode ? '#fff' : '#0f172a', whiteSpace: 'nowrap' }}>
                    Versa Finanças
                  </div>
                  <div style={{ fontSize: 8.5, letterSpacing: '1.8px', textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)', marginTop: 1, whiteSpace: 'nowrap' }}>
                    Dashboard Gerencial
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Mobile close */}
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: 4 }}>
            <Icon name="close" size="text-[18px]" />
          </button>
        </div>

        {/* Company badge — becomes a switcher when the user has access to more than one */}
        {user?.clientName && !collapsed && (
          <motion.div
            ref={switcherRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{
              position: 'relative',
              margin: '10px 12px 0',
              borderRadius: 8,
              padding: '8px 11px',
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              flexShrink: 0,
              cursor: myClients.length > 1 ? 'pointer' : 'default',
              opacity: switching ? 0.6 : 1,
              pointerEvents: switching ? 'none' : 'auto',
            }}
            onClick={() => myClients.length > 1 && setSwitcherOpen(v => !v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ fontSize: 8, letterSpacing: '1.2px', textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.40)' }}>Empresa</div>
              {myClients.length > 1 && (
                <Icon
                  name="chevron_right"
                  size="text-[11px]"
                  className="transition-transform duration-150"
                  style={{ color: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', transform: switcherOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, overflow: 'hidden' }}>
              {switching
                ? <Icon name="autorenew" size="text-[14px]" style={{ animation: 'spin 1s linear infinite', color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
                : user.clientLogo && (
                  <img src={user.clientLogo} alt="" style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
                )
              }
              <div style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#fff' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {switching ? 'Trocando…' : user.clientName}
              </div>
            </div>

            {/* Dropdown list */}
            <AnimatePresence>
              {switcherOpen && myClients.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: darkMode ? '#21262d' : '#fff',
                    border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: 4,
                    zIndex: 200,
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}
                >
                  {myClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSwitchClient(c.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                        background: c.id === user.clientId ? (darkMode ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.10)') : 'transparent',
                        color: darkMode ? '#e6edf3' : '#0f172a',
                      }}
                      onMouseEnter={e => { if (c.id !== user.clientId) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
                      onMouseLeave={e => { if (c.id !== user.clientId) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {c.logo
                        ? <img src={c.logo} alt="" style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
                      }
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      {c.id === user.clientId && <Icon name="check" size="text-[13px]" style={{ color: '#10b981', flexShrink: 0 }} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Navigation */}
        <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {sections.map(section => (
            <div key={section} style={{ marginBottom: 20 }}>
              {!collapsed && (
                <div style={{ fontSize: 8.5, letterSpacing: '1.8px', textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)', padding: '0 8px', marginBottom: 5, whiteSpace: 'nowrap' }}>
                  {section}
                </div>
              )}
              {visibleItems.filter(i => i.section === section).map(item => {
                const isActive = item.isDashboard
                  ? currentPage === 'caixa'
                  : currentPage === item.id;
                const index = navIndex++;
                return (
                  <motion.button
                    key={item.id}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    variants={navItemVariants}
                    onClick={() => handleNav(item.id)}
                    title={collapsed ? item.label : undefined}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: collapsed ? '9px 0' : '8px 10px',
                      borderRadius: 8,
                      marginBottom: 2,
                      cursor: 'pointer',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 500,
                      fontFamily: 'inherit',
                      transition: 'background 0.15s, color 0.15s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: isActive
                        ? 'rgba(16,185,129,0.12)'
                        : 'transparent',
                      color: isActive
                        ? (darkMode ? '#6ee7b7' : '#059669')
                        : (darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)'),
                      boxShadow: isActive ? 'inset 0 0 0 1px rgba(16,185,129,0.22)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
                        e.currentTarget.style.color = darkMode ? '#fff' : '#111827';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)';
                      }
                    }}
                  >
                    <Icon
                      name={item.icon}
                      size="text-[17px]"
                      style={{ flexShrink: 0, color: isActive ? (darkMode ? '#6ee7b7' : '#059669') : undefined }}
                    />
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
                        {item.badge && txCount > 0 && (
                          <span style={{
                            background: '#10b981', color: '#fff',
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 700,
                          }}>
                            {txCount}
                          </span>
                        )}
                      </>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        style={{
                          position: 'absolute',
                          left: 0,
                          width: 3,
                          height: 22,
                          borderRadius: '0 4px 4px 0',
                          background: '#10b981',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Base indicator + version */}
        {!collapsed && (
          <div style={{
            padding: '10px 16px 12px',
            borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 8, letterSpacing: '1.2px', textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.38)', marginBottom: 6 }}>
              Base ativa
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                background: 'rgba(16,185,129,0.15)', color: '#6ee7b7',
                border: '1px solid rgba(16,185,129,0.22)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                Caixa ({transactions.caixa.length})
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
                border: '1px solid rgba(139,92,246,0.22)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                Comp. ({transactions.competencia.length})
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 9.5, color: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)', letterSpacing: '0.04em' }}>
              v{__APP_VERSION__} · Desenvolvido por Systemiza
            </div>
          </div>
        )}

        {/* User footer */}
        <div style={{
          padding: collapsed ? '10px 4px 12px' : '10px 12px 12px',
          borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexDirection: collapsed ? 'column' : 'row' }}>
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
            }}>
              {initials}
            </div>

            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#fff' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.displayName || user?.email}
                </div>
                <div style={{ fontSize: 10, color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.42)', marginTop: 1 }}>
                  {user?.isSuperAdmin ? 'Administrador' : 'Usuário'}
                </div>
              </div>
            )}

            {/* "…" more options menu */}
            <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                title="Mais opções"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)', display: 'flex', flexShrink: 0, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#fff' : '#111827'}
                onMouseLeave={e => e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'}
              >
                <Icon name="more_vert" size="text-[16px]" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      ...(collapsed ? { left: '100%', bottom: 0, marginLeft: 6 } : { bottom: '100%', right: 0, marginBottom: 6 }),
                      background: darkMode ? '#21262d' : '#fff',
                      border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      padding: 4,
                      minWidth: 160,
                      zIndex: 200,
                    }}
                  >
                    <button
                      onClick={() => { setUserMenuOpen(false); actions.openModal(<ChangePasswordModal />); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                        background: 'transparent', color: darkMode ? '#e6edf3' : '#0f172a',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Icon name="vpn_key" size="text-[14px]" style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }} />
                      Trocar senha
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Logout — deliberately the most visible action in this block */}
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8,
              width: '100%', padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              background: darkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
              border: darkMode ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(239,68,68,0.18)',
              color: '#ef4444', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)'}
          >
            <Icon name="logout" size="text-[15px]" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </motion.nav>

      {/* Collapse toggle — floats on the sidebar's right edge, vertically centered */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="hidden lg:flex"
        style={{
          position: 'fixed', top: '50%', left: collapsed ? 60 : 224,
          transform: 'translate(-50%, -50%)',
          alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
          background: darkMode ? '#21262d' : '#ffffff',
          border: darkMode ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(0,0,0,0.14)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
          transition: 'left 280ms cubic-bezier(0.4,0,0.2,1), background .15s, color .15s',
          zIndex: 110,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#30363d' : '#f3f4f6'; e.currentTarget.style.color = darkMode ? '#fff' : '#111827'; }}
        onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#21262d' : '#ffffff'; e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)'; }}
      >
        <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="text-[13px]" />
      </button>
    </>
  );
}
