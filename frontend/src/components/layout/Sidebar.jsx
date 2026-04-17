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

  return (
    <nav
      className={`
        bg-bg-2 dark:bg-[#152030] border-r border-slate-100 dark:border-[#1e2d42]
        flex flex-col fixed top-0 left-0 bottom-0 z-[100]
        transition-[width,transform] duration-300 overflow-hidden
        w-[220px]
        ${collapsed ? 'lg:w-[60px]' : 'lg:w-[220px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      {/* Logo */}
      <div className="px-[18px] py-[22px] pb-4 border-b border-slate-100 dark:border-[#1e2d42] flex items-center justify-between min-h-[72px]">
        <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'lg:hidden' : ''}`}>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
          >
            <span className="text-white font-black text-[11px]">V</span>
          </div>
          <div>
            <div
              className="font-inter font-black text-base tracking-tight whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              Versa Finanças
            </div>
            <div className="text-[9px] uppercase tracking-[2px] text-text-3 mt-0.5">Dashboard Gerencial</div>
          </div>
        </div>

        {/* Collapsed desktop logo */}
        <div
          className={`w-6 h-6 rounded-md items-center justify-center flex-shrink-0 flex-col
            ${collapsed ? 'hidden lg:flex' : 'hidden'}`}
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
        >
          <span className="text-white font-black text-[11px]">V</span>
        </div>

        {/* Mobile close button */}
        <button
          className="lg:hidden text-text-3 hover:text-text-base p-1 flex-shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <Icon name="close" size="text-[18px]" />
        </button>
      </div>

      {/* Empresa badge */}
      {user?.clientName && !collapsed && (
        <div className={`mx-3.5 mt-3 rounded-lg px-3 py-2 border ${
          'bg-slate-50 dark:bg-[rgba(255,255,255,0.05)] border-slate-100 dark:border-[rgba(255,255,255,0.08)]'
        }`}>
          <div className="text-[9px] uppercase tracking-[1px] text-text-3">Empresa</div>
          <div className="text-[11.5px] font-semibold text-text-base dark:text-[#fff] mt-0.5 truncate">{user.clientName}</div>
        </div>
      )}

      {/* Nav */}
      <div className="px-2.5 py-3.5 flex-1 overflow-y-auto overflow-x-hidden">
        {sections.map(section => (
          <div key={section} className="mb-5">
            <div className={`text-[9px] uppercase tracking-[2px] text-text-3 px-2.5 mb-1.5 whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>
              {section}
            </div>
            {NAV_ITEMS.filter(i => i.section === section).map(item => {
              const isActive = item.isDashboard
                ? currentPage === 'caixa'
                : currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2 py-2 rounded-sm cursor-pointer text-xs font-medium transition-all mb-0.5 border text-left
                    ${collapsed ? 'lg:justify-center lg:px-0' : 'px-2.5'}
                    ${isActive
                      ? 'bg-blue-50 dark:bg-[rgba(37,99,235,0.12)] text-accent border-blue-200 dark:border-[rgba(37,99,235,0.3)]'
                      : 'text-text-2 dark:text-[rgba(255,255,255,0.55)] border-transparent hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.04)] hover:text-text-base dark:hover:text-[rgba(255,255,255,0.85)]'
                    }`}
                >
                  <Icon name={item.icon} size="text-[16px]" className="flex-shrink-0" />
                  <span className={`flex-1 whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>
                    {item.label}
                  </span>
                  {item.badge && txCount > 0 && (
                    <span className={`bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ${collapsed ? 'lg:hidden' : ''}`}>
                      {txCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Base indicator */}
      <div className={`px-[18px] py-3 border-t border-slate-100 dark:border-[#1e2d42] ${collapsed ? 'lg:hidden' : ''}`}>
        <div className="text-[9px] uppercase tracking-[1.5px] text-text-3 mb-1.5">Base ativa</div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981', borderColor: 'rgba(16,185,129,0.25)' }}>
            Caixa ({transactions.caixa.length})
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap" style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed', borderColor: 'rgba(124,58,237,0.25)' }}>
            Comp. ({transactions.competencia.length})
          </span>
        </div>
      </div>

      {/* User + logout + collapse toggle */}
      <div className={`px-[18px] py-3 border-t border-slate-100 dark:border-[#1e2d42] flex items-center gap-2.5 ${collapsed ? 'lg:flex-col lg:px-2 lg:gap-2' : ''}`}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
        >
          {initials}
        </div>

        <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
          <div className="text-[11px] font-semibold text-text-base dark:text-[#fff] truncate">
            {user?.displayName || user?.email}
          </div>
          <div className="text-[9px] text-text-3 truncate">
            {user?.role === 'admin' ? 'Administrador' : user?.role === 'viewer' ? 'Visualizador' : 'Usuário'}
          </div>
        </div>

        <button
          onClick={logout}
          title="Sair"
          className="text-text-3 hover:text-fin-red transition-colors flex-shrink-0"
        >
          <Icon name="logout" size="text-[16px]" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir' : 'Recolher'}
          className="hidden lg:flex text-text-3 hover:text-text-base transition-colors flex-shrink-0"
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="text-[16px]" />
        </button>
      </div>
    </nav>
  );
}
