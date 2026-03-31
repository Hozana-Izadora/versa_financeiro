import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Icon from './Icon.jsx';

export default function Modal() {
  const { state, actions } = useApp();
  const { modal } = state;

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') actions.closeModal(); }
    if (modal) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, actions]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) actions.closeModal(); }}
      className="fixed inset-0 z-[1000] flex items-center justify-center transition-all duration-200"
      style={{
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)',
        opacity: modal ? 1 : 0,
        pointerEvents: modal ? 'all' : 'none',
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-card p-7 max-w-[560px] w-[92%] relative max-h-[85vh] overflow-y-auto transition-transform duration-200"
        style={{ transform: modal ? 'translateY(0)' : 'translateY(16px)', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)' }}
      >
        <button
          onClick={actions.closeModal}
          className="absolute top-[18px] right-[18px] bg-transparent border-none text-text-2 cursor-pointer hover:text-text-base flex items-center"
        >
          <Icon name="close" size="text-[18px]" />
        </button>
        {modal}
      </div>
    </div>
  );
}
