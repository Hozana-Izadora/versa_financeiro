import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';

const NAV_ITEMS = [
  { id: 'caixa',       icon: 'account_balance_wallet', label: 'Caixa',           section: 'Dashboard', isDashboard: true },
  { id: 'competencia', icon: 'bar_chart',               label: 'Competência',     section: 'Dashboard' },
  { id: 'orcamento',   icon: 'gps_fixed',               label: 'Orçamento',       section: 'Dashboard' },
  { id: 'lancamentos', icon: 'receipt_long',             label: 'Lançamentos',     section: 'Dados', badge: true },
  { id: 'plano',       icon: 'account_tree',             label: 'Plano de Contas', section: 'Dados' },
  { id: 'importar',    icon: 'upload_file',              label: 'Importar Dados',  section: 'Dados' },
];

const sidebarVariants = {
  hidden:  { x: -16, opacity: 0 },
  visible: { x: 0,   opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
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
  const { user, logout } = useAuth();
  const { currentPage, transactions, darkMode } = state;
  const txCount = transactions.caixa.length + transactions.competencia.length;
  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleNav = (id) => { actions.setPage(id); setMobileOpen(false); };

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
            {/* Logo icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
            }}>
              <Icon name="bar_chart" size="text-[16px]" style={{ color: '#fff' }} />
            </div>
            {!collapsed && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: darkMode ? '#fff' : '#0f172a', whiteSpace: 'nowrap' }}>
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: 4, display: 'flex' }}>
            <Icon name="close" size="text-[18px]" />
          </button>
        </div>

        {/* Company badge */}
        {user?.clientName && !collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{
              margin: '10px 12px 0',
              borderRadius: 8,
              padding: '8px 11px',
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              flexShrink: 0,
            }}>
            <div style={{ fontSize: 8, letterSpacing: '1.2px', textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.40)' }}>Empresa</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#fff' : '#0f172a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.clientName}
            </div>
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
              {NAV_ITEMS.filter(i => i.section === section).map(item => {
                const isActive = item.isDashboard ? currentPage === 'caixa' : currentPage === item.id;
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

        {/* Base indicator */}
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
          </div>
        )}

        {/* User footer */}
        <div style={{
          padding: collapsed ? '10px 4px 12px' : '10px 12px 12px',
          borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          flexShrink: 0,
          flexDirection: collapsed ? 'column' : 'row',
        }}>
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
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'viewer' ? 'Visualizador' : 'Usuário'}
              </div>
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={actions.toggleDark}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)', display: 'flex', flexShrink: 0, transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#fff' : '#111827'}
            onMouseLeave={e => e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'}
          >
            <Icon name={darkMode ? 'light_mode' : 'dark_mode'} size="text-[16px]" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sair"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)', display: 'flex', flexShrink: 0, transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'}
          >
            <Icon name="logout" size="text-[16px]" />
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Recolher'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)', display: 'flex', flexShrink: 0, transition: 'color .15s' }}
            className="hidden lg:flex"
            onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#fff' : '#111827'}
            onMouseLeave={e => e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'}
          >
            <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="text-[16px]" />
          </button>
        </div>
      </motion.nav>
    </>
  );
}
