import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

const PAGE_INFO = {
  caixa: { title: 'Regime de Caixa', sub: 'Demonstrativo financeiro de caixa' },
  competencia: { title: 'Regime de Competência', sub: 'DRE Gerencial — Resultado econômico' },
  lancamentos: { title: 'Lançamentos', sub: 'Visualização e edição de movimentações' },
  plano: { title: 'Plano de Contas', sub: 'Estrutura hierárquica editável' },
  importar: { title: 'Importar Dados', sub: 'Upload de arquivos por base' },
};

export default function Topbar() {
  const { state, actions } = useApp();
  const info = PAGE_INFO[state.currentPage] || { title: '', sub: '' };

  return (
    <div className="bg-bg-2 border-b border-slate-100 px-7 flex items-center gap-3.5 sticky top-0 z-50 min-h-[56px] flex-wrap">
      <div>
        <div className="font-inter font-bold text-base mr-2">{info.title}</div>
        <div className="text-[11px] text-text-3">{info.sub}</div>
      </div>
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => actions.setPage('importar')}>
          + Importar
        </button>
      </div>
    </div>
  );
}
