import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../ui/Icon.jsx';

const PAGE_INFO = {
  caixa:        { title: 'Fluxo de Caixa',        sub: 'Análise por regime de caixa',            icon: 'account_balance_wallet', color: '#10b981' },
  competencia:  { title: 'Competência',            sub: 'Análise por regime de competência',      icon: 'bar_chart',              color: '#8b5cf6' },
  lancamentos:  { title: 'Lançamentos',            sub: 'Visualização e edição de movimentações', icon: 'receipt_long',           color: '#3b82f6' },
  plano:        { title: 'Plano de Contas',        sub: 'Estrutura hierárquica editável',          icon: 'account_tree',           color: '#f59e0b' },
  importar:     { title: 'Importar Dados',         sub: 'Upload de arquivos por base',             icon: 'upload_file',            color: '#06b6d4' },
  orcamento:    { title: 'Orçamento',              sub: 'Metas, cenários e acompanhamento',        icon: 'gps_fixed',              color: '#f97316' },
};

export default function Topbar({ onMenuClick }) {
  const { state } = useApp();
  const { currentPage } = state;
  const info = PAGE_INFO[currentPage] || {};

  return (
    <div
      className="bg-white dark:bg-[#161b22] border-b border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] px-5 lg:px-8 flex items-center gap-4 sticky top-0 z-50 transition-colors"
      style={{ minHeight: 54, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden text-text-2 hover:text-text-base transition-colors p-1 -ml-1 flex-shrink-0"
        onClick={onMenuClick}
      >
        <Icon name="menu" size="text-[22px]" />
      </button>

      {/* Page title — animate on page change */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-3 min-w-0"
        >
          {/* Icon chip */}
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `${info.color || '#10b981'}15`,
            border: `1px solid ${info.color || '#10b981'}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={info.icon || 'grid_view'} size="text-[15px]" style={{ color: info.color || '#10b981' }} />
          </div>

          <div className="min-w-0">
            <div
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.3px', lineHeight: 1 }}
              className="text-text-base dark:text-[#e6edf3] truncate"
            >
              {info.title}
            </div>
            <div
              style={{ fontSize: 10.5, marginTop: 2 }}
              className="text-text-3 hidden sm:block"
            >
              {info.sub}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Divider */}
      <div className="flex-1" />

      {/* Right area — breadcrumb / env */}
      {/* <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af', fontFamily: 'Geist Mono, monospace' }}
        className="hidden md:flex"
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#10b981',
          boxShadow: '0 0 6px rgba(16,185,129,0.6)',
        }} />
        Ao vivo
      </div> */}
    </div>
  );
}
