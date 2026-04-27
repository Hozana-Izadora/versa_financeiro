import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';

const NAV_ITEMS = [
  { id: 'caixa',       icon: 'account_balance_wallet', label: 'Caixa',            section: 'Dashboard', isDashboard: true },
  { id: 'competencia', icon: 'bar_chart',               label: 'Competência',      section: 'Dashboard' },
  { id: 'orcamento',   icon: 'gps_fixed',               label: 'Orçamento',        section: 'Dashboard' },
  { id: 'lancamentos', icon: 'receipt_long',             label: 'Lançamentos',      section: 'Dados', badge: true },
  { id: 'plano',       icon: 'account_tree',             label: 'Plano de Contas',  section: 'Dados' },
  { id: 'importar',    icon: 'upload_file',              label: 'Importar Dados',   section: 'Dados' },
];

const S = {
  sidebar: (collapsed, mobileOpen) => ({
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #0c1e33 0%, #0f2744 60%, #0a1b2e 100%)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    transition: 'width 300ms ease, transform 300ms ease',
    width: 220,
  }),
  logoArea: {
    padding: '20px 18px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 68, flexShrink: 0,
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoName: {
    fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15.5,
    letterSpacing: '-0.3px', color: '#fff', whiteSpace: 'nowrap',
  },
  logoSub: {
    fontSize: 8.5, letterSpacing: '1.8px', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)', marginTop: 1,
  },
  companyBadge: {
    margin: '12px 14px 0',
    borderRadius: 8,
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  companyLabel: { fontSize: 8.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' },
  companyName: { fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  navScroll: { padding: '14px 10px', flex: 1, overflowY: 'auto', overflowX: 'hidden' },
  sectionLabel: {
    fontSize: 9, letterSpacing: '1.8px', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.30)', padding: '0 10px', marginBottom: 6, whiteSpace: 'nowrap',
  },
  navGroup: { marginBottom: 22 },
  navBtn: (isActive) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: '8.5px 10px', borderRadius: 8, marginBottom: 2,
    cursor: 'pointer', border: 'none', textAlign: 'left',
    fontSize: 12.5, fontWeight: isActive ? 600 : 500,
    fontFamily: 'inherit', transition: 'all .15s',
    background: isActive ? 'rgba(37,99,235,0.25)' : 'transparent',
    color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.58)',
    boxShadow: isActive ? 'inset 0 0 0 1px rgba(37,99,235,0.40)' : 'none',
  }),
  badge: {
    background: '#2563eb', color: '#fff', fontSize: 9,
    padding: '1px 6px', borderRadius: 99, fontWeight: 700, marginLeft: 'auto',
  },
  baseSection: {
    padding: '10px 18px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  baseLabel: { fontSize: 8.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 7 },
  pill: (green) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 9px', borderRadius: 99,
    fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
    background: green ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)',
    color: green ? '#6ee7b7' : '#c4b5fd',
    border: `1px solid ${green ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.25)'}`,
  }),
  userSection: {
    padding: '10px 14px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', gap: 10,
    flexShrink: 0,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 800, color: '#fff',
  },
  userName: { fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6,
    color: 'rgba(255,255,255,0.38)', display: 'flex', flexShrink: 0, transition: 'color .15s',
  },
};

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { state, actions } = useApp();
  const { user, logout } = useAuth();
  const { currentPage, transactions } = state;
  const txCount = transactions.caixa.length + transactions.competencia.length;
  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleNav = (id) => {
    actions.setPage(id);
    setMobileOpen(false);
  };

  const isCollapsed = collapsed;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 90 }}
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        style={{
          ...S.sidebar(isCollapsed, mobileOpen),
          width: isCollapsed ? 60 : 220,
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        className={!mobileOpen ? '-translate-x-full lg:translate-x-0' : ''}
      >
        {/* Logo */}
        <div style={S.logoArea}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', ...(isCollapsed ? { display: 'none' } : {}) }}
               className={isCollapsed ? 'lg:hidden' : ''}>
            <div style={S.logoIcon}>
              <Icon name="bar_chart" size="text-[16px]" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={S.logoName}>Versa Finanças</div>
              <div style={S.logoSub}>Dashboard Gerencial</div>
            </div>
          </div>

          {/* Collapsed icon */}
          <div
            style={{ ...S.logoIcon, ...(isCollapsed ? {} : { display: 'none' }) }}
            className={isCollapsed ? 'hidden lg:flex' : 'hidden'}
          >
            <Icon name="bar_chart" size="text-[16px]" style={{ color: '#fff' }} />
          </div>

          {/* Mobile close */}
          <button
            className="lg:hidden"
            style={{ ...S.iconBtn, marginLeft: 'auto' }}
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="close" size="text-[18px]" />
          </button>
        </div>

        {/* Company badge */}
        {user?.clientName && !isCollapsed && (
          <div style={S.companyBadge} className={isCollapsed ? 'lg:hidden' : ''}>
            <div style={S.companyLabel}>Empresa</div>
            <div style={S.companyName}>{user.clientName}</div>
          </div>
        )}

        {/* Nav */}
        <div style={S.navScroll}>
          {sections.map(section => (
            <div key={section} style={S.navGroup}>
              <div style={S.sectionLabel} className={isCollapsed ? 'lg:hidden' : ''}>{section}</div>
              {NAV_ITEMS.filter(i => i.section === section).map(item => {
                const isActive = item.isDashboard ? currentPage === 'caixa' : currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      ...S.navBtn(isActive),
                      ...(isCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {}),
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.58)'; } }}
                  >
                    <Icon name={item.icon} size="text-[17px]" style={{ flexShrink: 0, color: isActive ? '#93c5fd' : undefined }} />
                    {!isCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
                        {item.badge && txCount > 0 && (
                          <span style={S.badge}>{txCount}</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Base indicator */}
        {!isCollapsed && (
          <div style={S.baseSection}>
            <div style={S.baseLabel}>Base ativa</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={S.pill(true)}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                Caixa ({transactions.caixa.length})
              </span>
              <span style={S.pill(false)}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
                Comp. ({transactions.competencia.length})
              </span>
            </div>
          </div>
        )}

        {/* User footer */}
        <div style={{ ...S.userSection, ...(isCollapsed ? { flexDirection: 'column', padding: '10px 6px 12px' } : {}) }}>
          <div style={S.avatar}>{initials}</div>

          {!isCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.userName}>{user?.displayName || user?.email}</div>
              <div style={S.userRole}>
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'viewer' ? 'Visualizador' : 'Usuário'}
              </div>
            </div>
          )}

          <button
            onClick={logout}
            title="Sair"
            style={S.iconBtn}
            onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
          >
            <Icon name="logout" size="text-[16px]" />
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={isCollapsed ? 'Expandir' : 'Recolher'}
            style={S.iconBtn}
            className="hidden lg:flex"
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
          >
            <Icon name={isCollapsed ? 'chevron_right' : 'chevron_left'} size="text-[16px]" />
          </button>
        </div>
      </nav>
    </>
  );
}
