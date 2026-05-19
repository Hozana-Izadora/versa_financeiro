import React, { useEffect, useRef } from 'react';

export default function ChartModal({ chart, onClose }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!chart) return null;

  function handleBackdrop(e) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center"
      style={{ backdropFilter: 'blur(3px)' }}
    >
      <div
        className="bg-card rounded-card p-6 flex flex-col gap-4 relative"
        style={{ width: '88vw', maxWidth: 1100, height: '76vh' }}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="font-inter font-bold text-[15px] text-text-base">{chart.title}</div>
          <button onClick={onClose} className="text-text-3 hover:text-text-base text-2xl leading-none transition-colors">✕</button>
        </div>
        <div className="flex-1" style={{ minHeight: 0 }}>
          {chart.element}
        </div>
      </div>
    </div>
  );
}
