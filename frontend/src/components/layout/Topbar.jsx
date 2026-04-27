import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../ui/Icon.jsx';

const PAGE_INFO = {
  lancamentos: { title: 'Lançamentos',     sub: 'Visualização e edição de movimentações', icon: 'receipt_long' },
  plano:       { title: 'Plano de Contas', sub: 'Estrutura hierárquica editável',          icon: 'account_tree' },
  importar:    { title: 'Importar Dados',  sub: 'Upload de arquivos por base',             icon: 'upload_file' },
  orcamento:   { title: 'Orçamento',       sub: 'Metas, cenários e acompanhamento',        icon: 'gps_fixed' },
};

const DASHBOARD_MODES = [
  { id: 'caixa',       label: 'Fluxo de Caixa',       icon: 'account_balance_wallet' },
  { id: 'competencia', label: 'Regime de Competência', icon: 'bar_chart' },
];

export default function Topbar({ onMenuClick }) {
  const { state, actions } = useApp();
  const { currentPage, darkMode } = state;
  const isDashboard = currentPage === 'caixa' || currentPage === 'competencia';
  const info = PAGE_INFO[currentPage] || {};

  return (
    <div
      style={{ minHeight: 60, flexShrink: 0 }}
      className="bg-white dark:bg-[#152030] border-b border-slate-100 dark:border-[#1e2d42] px-5 lg:px-7 flex items-center gap-4 sticky top-0 z-50 transition-colors"
    >
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden text-text-2 hover:text-text-base transition-colors p-1 -ml-1 flex-shrink-0"
        onClick={onMenuClick}
      >
        <Icon name="menu" size="text-[22px]" />
      </button>

      {/* Left: page title or regime tabs */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isDashboard ? (
          <div
            className="flex items-center p-1 rounded-lg gap-0.5"
            style={{ background: 'rgba(15,35,64,0.06)', border: '1px solid rgba(15,35,64,0.08)' }}
          >
            {DASHBOARD_MODES.map(m => {
              const isActive = currentPage === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => actions.setPage(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 8,
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                    transition: 'all .15s', whiteSpace: 'nowrap',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#1e40af' : '#64748b',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 15, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                  >
                    {m.icon}
                  </span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(79,70,229,0.10))',
                border: '1px solid rgba(37,99,235,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={info.icon || 'grid_view'} size="text-[17px]" style={{ color: '#2563eb' }} />
            </div>
            <div className="min-w-0">
              <div
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.3px', lineHeight: 1 }}
                className="text-text-base dark:text-[#eef2f7] truncate"
              >
                {info.title}
              </div>
              <div
                style={{ fontSize: 11.5, marginTop: 2 }}
                className="text-text-3 hidden sm:block"
              >
                {info.sub}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dark mode toggle */}
        <button
          onClick={actions.toggleDark}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', transition: 'all .15s',
          }}
          className="border-slate-200 dark:border-[#2d4060] bg-white dark:bg-[#1a2d42] text-text-2 dark:text-[#c4d4e4] hover:bg-slate-50 dark:hover:bg-[#233d55]"
        >
          <Icon name={darkMode ? 'light_mode' : 'dark_mode'} size="text-[15px]" />
          <span className="hidden sm:inline">{darkMode ? 'Claro' : 'Escuro'}</span>
        </button>

        {/* Import button */}
        <button
          onClick={() => actions.setPage('importar')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            border: 'none', fontSize: 12.5, fontWeight: 700,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.1px',
            background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(37,99,235,0.30)',
            transition: 'opacity .15s, transform .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.90'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Icon name="upload_file" size="text-[15px]" />
          <span className="hidden sm:inline">Importar</span>
        </button>
      </div>
    </div>
  );
}
