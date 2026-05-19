import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <AnimatePresence>
      {modal && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.20 }}
          onClick={e => { if (e.target === e.currentTarget) actions.closeModal(); }}
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: 'rgba(13,17,23,0.55)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1] }}
            className="bg-white dark:bg-[#161b22] rounded-card p-7 max-w-[560px] w-[92%] relative max-h-[85vh] overflow-y-auto"
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            {/* Close button */}
            <motion.button
              onClick={actions.closeModal}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(0,0,0,0.05)',
                border: 'none', borderRadius: '50%',
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#6b7280',
              }}
            >
              <Icon name="close" size="text-[16px]" />
            </motion.button>

            {modal}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
