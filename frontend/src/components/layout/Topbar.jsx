import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

const PAGE_INFO = {
  lancamentos: { title: 'Lançamentos',    sub: 'Visualização e edição de movimentações' },
  plano:       { title: 'Plano de Contas', sub: 'Estrutura hierárquica editável' },
  importar:    { title: 'Importar Dados',  sub: 'Upload de arquivos por base' },
};

const DASHBOARD_MODES = [
  { id: 'caixa',       label: 'Fluxo de Caixa',       icon: 'account_balance_wallet' },
  { id: 'competencia', label: 'Regime de Competência', icon: 'bar_chart' },
];

export default function Topbar() {
  const { state, actions } = useApp();
  const { currentPage } = state;
  const isDashboard = currentPage === 'caixa' || currentPage === 'competencia';
  const info = PAGE_INFO[currentPage] || {};

  return (
    <div className="bg-bg-2 border-b border-slate-100 px-7 flex items-center gap-4 sticky top-0 z-50 min-h-[56px] flex-wrap">

      {isDashboard ? (
        /* ── Regime toggle ── */
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          {DASHBOARD_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => actions.setPage(m.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                currentPage === m.id
                  ? 'bg-white text-accent shadow-sm border border-slate-200'
                  : 'text-text-2 hover:text-text-base'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] leading-none" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        /* ── Regular page title ── */
        <div>
          <div className="font-inter font-bold text-base">{info.title}</div>
          <div className="text-[11px] text-text-3">{info.sub}</div>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => actions.setPage('importar')}>
          + Importar
        </button>
      </div>
    </div>
  );
}
