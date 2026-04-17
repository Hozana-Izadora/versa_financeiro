import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../ui/Icon.jsx';

const PAGE_INFO = {
  lancamentos: { title: 'Lançamentos',    sub: 'Visualização e edição de movimentações' },
  plano:       { title: 'Plano de Contas', sub: 'Estrutura hierárquica editável' },
  importar:    { title: 'Importar Dados',  sub: 'Upload de arquivos por base' },
  orcamento:   { title: 'Orçamento',       sub: 'Metas, cenários e acompanhamento' },
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
    <div className="bg-bg-2 dark:bg-[#152030] border-b border-slate-100 dark:border-[#1e2d42] px-4 lg:px-7 flex items-center gap-3 sticky top-0 z-50 min-h-[56px] flex-wrap transition-colors">

      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden text-text-2 hover:text-text-base transition-colors p-1 -ml-1"
        onClick={onMenuClick}
      >
        <Icon name="menu" size="text-[22px]" />
      </button>

      {isDashboard ? (
        /* ── Regime toggle ── */
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1a2d42] p-0.5 rounded-lg">
          {DASHBOARD_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => actions.setPage(m.id)}
              className={`flex items-center gap-1.5 px-3 lg:px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                currentPage === m.id
                  ? 'bg-white dark:bg-[#1e3a52] text-accent shadow-sm border border-slate-200 dark:border-[#2d4060]'
                  : 'text-text-2 dark:text-[#c4d4e4] hover:text-text-base'
              }`}
            >
              <span
                className="material-symbols-outlined text-[14px] leading-none"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                {m.icon}
              </span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      ) : (
        /* ── Regular page title ── */
        <div>
          <div className="font-inter font-bold text-base text-text-base dark:text-[#eef2f7]">{info.title}</div>
          <div className="text-[11px] text-text-3 hidden sm:block">{info.sub}</div>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Dark mode toggle */}
        <button
          onClick={actions.toggleDark}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
          className="btn btn-ghost btn-sm px-2.5"
        >
          {darkMode ? '☀️' : '🌙'}
          <span className="hidden sm:inline">{darkMode ? 'Claro' : 'Escuro'}</span>
        </button>

        <button className="btn btn-ghost btn-sm" onClick={() => actions.setPage('importar')}>
          + Importar
        </button>
      </div>
    </div>
  );
}
