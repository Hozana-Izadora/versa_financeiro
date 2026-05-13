import React, { useState, useRef, useEffect } from 'react';

export default function InfoPopover({ title, description }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  function toggle(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target))
        setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Reposition if popover overflows viewport right edge
  useEffect(() => {
    if (!open || !popRef.current) return;
    const popRect = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    if (popRect.right > vw - 12) {
      setPos(p => ({ ...p, left: p.left - (popRect.right - (vw - 12)) }));
    }
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Ver explicação"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 15, height: 15, borderRadius: '50%',
          border: '1.5px solid #94a3b8', background: 'transparent',
          cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
          color: open ? '#2563eb' : '#94a3b8',
          borderColor: open ? '#2563eb' : '#94a3b8',
          transition: 'color .12s, border-color .12s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.color = '#2563eb';
            e.currentTarget.style.borderColor = '#2563eb';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.borderColor = '#94a3b8';
          }
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'serif', userSelect: 'none' }}>i</span>
      </button>

      {open && (
        <div
          ref={popRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            width: 280,
            background: '#1a2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 9,
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            padding: '12px 14px',
            pointerEvents: 'auto',
          }}
        >
          {title && (
            <div style={{
              fontSize: 11.5, fontWeight: 700, color: '#e2eaf4',
              marginBottom: 7, fontFamily: 'Outfit, sans-serif',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: 7,
            }}>
              {title}
            </div>
          )}
          <div style={{
            fontSize: 11, color: '#94a3b8', lineHeight: 1.65,
            fontFamily: 'Outfit, sans-serif', whiteSpace: 'pre-line',
          }}>
            {description}
          </div>
        </div>
      )}
    </>
  );
}
