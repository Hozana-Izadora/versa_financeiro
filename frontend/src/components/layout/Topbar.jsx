import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../ui/Icon.jsx';

const PAGE_INFO = {
  caixa:        { title: 'Fluxo de Caixa',         sub: 'Análise por regime de caixa',            icon: 'account_balance_wallet' },
  competencia:  { title: 'Regime de Competência',   sub: 'Análise por regime de competência',      icon: 'bar_chart' },
  lancamentos:  { title: 'Lançamentos',             sub: 'Visualização e edição de movimentações', icon: 'receipt_long' },
  plano:        { title: 'Plano de Contas',         sub: 'Estrutura hierárquica editável',          icon: 'account_tree' },
  importar:     { title: 'Importar Dados',          sub: 'Upload de arquivos por base',             icon: 'upload_file' },
  orcamento:    { title: 'Orçamento',               sub: 'Metas, cenários e acompanhamento',        icon: 'gps_fixed' },
};

export default function Topbar({ onMenuClick }) {
  const { state } = useApp();
  const { currentPage } = state;
  const info = PAGE_INFO[currentPage] || {};

  return (
    <div
      style={{ minHeight: 52, flexShrink: 0 }}
      className="bg-white dark:bg-[#152030] border-b border-slate-100 dark:border-[#1e2d42] px-5 lg:px-7 flex items-center gap-4 sticky top-0 z-50 transition-colors"
    >
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden text-text-2 hover:text-text-base transition-colors p-1 -ml-1 flex-shrink-0"
        onClick={onMenuClick}
      >
        <Icon name="menu" size="text-[22px]" />
      </button>

      {/* Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(79,70,229,0.10))',
            border: '1px solid rgba(37,99,235,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={info.icon || 'grid_view'} size="text-[16px]" style={{ color: '#2563eb' }} />
        </div>
        <div className="min-w-0">
          <div
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', lineHeight: 1 }}
            className="text-text-base dark:text-[#eef2f7] truncate"
          >
            {info.title}
          </div>
          <div
            style={{ fontSize: 11, marginTop: 2 }}
            className="text-text-3 hidden sm:block"
          >
            {info.sub}
          </div>
        </div>
      </div>
    </div>
  );
}
