import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';

const NAV_ITEMS = [
  { id: 'caixa',        icon: 'account_balance', label: 'Regime de Caixa',       section: 'Análise' },
  { id: 'competencia',  icon: 'trending_up',      label: 'Regime de Competência', section: 'Análise' },
  { id: 'lancamentos',  icon: 'receipt_long',     label: 'Lançamentos',           section: 'Dados', badge: true },
  { id: 'plano',        icon: 'account_tree',     label: 'Plano de Contas',       section: 'Dados' },
  { id: 'importar',     icon: 'upload_file',      label: 'Importar Dados',        section: 'Dados' },
];

export default function Sidebar() {
  const { state, actions } = useApp();
  const { user, logout }   = useAuth();
  const { currentPage, transactions } = state;
  const txCount = transactions.caixa.length + transactions.competencia.length;

  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <nav className="w-[220px] bg-bg-2 border-r border-slate-100 flex flex-col fixed top-0 left-0 bottom-0 z-[100]">

      {/* Logo */}
      <div className="px-[18px] py-[22px] pb-4 border-b border-slate-100">
        <div
          className="font-inter font-black text-base tracking-tight"
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          FinançasPro
        </div>
        <div className="text-[9px] uppercase tracking-[2px] text-text-3 mt-1">Dashboard Gerencial</div>
      </div>

      {/* Nav */}
      <div className="px-2.5 py-3.5 flex-1 overflow-y-auto">
        {sections.map(section => (
          <div key={section} className="mb-5">
            <div className="text-[9px] uppercase tracking-[2px] text-text-3 px-2.5 mb-1.5">{section}</div>
            {NAV_ITEMS.filter(i => i.section === section).map(item => (
              <button
                key={item.id}
                onClick={() => actions.setPage(item.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-sm cursor-pointer text-xs font-medium transition-all mb-0.5 border text-left ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-accent border-blue-200'
                    : 'text-text-2 border-transparent hover:bg-slate-50 hover:text-text-base'
                }`}
              >
                <Icon name={item.icon} size="text-[16px]" className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && txCount > 0 && (
                  <span className="bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    {txCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Base indicator */}
      <div className="px-[18px] py-3 border-t border-slate-100">
        <div className="text-[9px] uppercase tracking-[1.5px] text-text-3 mb-1.5">Base ativa</div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981', borderColor: 'rgba(16,185,129,0.25)' }}>
            Caixa ({transactions.caixa.length})
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed', borderColor: 'rgba(124,58,237,0.25)' }}>
            Comp. ({transactions.competencia.length})
          </span>
        </div>
      </div>

      {/* User + logout */}
      <div className="px-[18px] py-3 border-t border-slate-100 flex items-center gap-2.5">
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
        >
          {initials}
        </div>

        {/* Name + client */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-text-base truncate">
            {user?.displayName || user?.email}
          </div>
          {user?.clientName && (
            <div className="text-[9px] text-text-3 truncate">{user.clientName}</div>
          )}
        </div>

        {/* Logout button */}
        <button
          onClick={logout}
          title="Sair"
          className="text-text-3 hover:text-fin-red transition-colors flex-shrink-0"
        >
          <Icon name="logout" size="text-[16px]" />
        </button>
      </div>

    </nav>
  );
}
