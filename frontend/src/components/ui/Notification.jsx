import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import Icon from './Icon.jsx';

const CONFIG = {
  ns: { icon: 'check_circle', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: '#10b981' },
  ne: { icon: 'cancel',       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: '#ef4444' },
  ni: { icon: 'info',         color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: '#3b82f6' },
};

export default function Notification() {
  const { state } = useApp();
  const { notification } = state;
  const cfg = CONFIG[notification?.cls] || CONFIG.ni;

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.msg}
          initial={{ opacity: 0, x: 60, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 60, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 2000,
            background: '#ffffff',
            border: `1px solid rgba(0,0,0,0.07)`,
            borderLeft: `3px solid ${cfg.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 320,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={cfg.icon} size="text-[15px]" style={{ color: cfg.color }} />
          </div>
          <span style={{ fontSize: 12.5, color: '#0d1117', fontWeight: 500, lineHeight: 1.4 }}>
            {notification.msg}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
