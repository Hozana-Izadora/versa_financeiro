import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import FilterBar from './FilterBar.jsx';

export default function Shell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const handler = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const sidebarW = isDesktop ? (collapsed ? 60 : 224) : 0;

  return (
    <div className="flex h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <motion.div
        className="flex-1 flex flex-col min-h-screen overflow-y-auto"
        style={{
          marginLeft: sidebarW,
          background: 'var(--tw-bg)',
          transition: 'margin-left 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
        animate={{ marginLeft: sidebarW }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <Topbar onMenuClick={() => setMobileOpen(o => !o)} />
        <FilterBar />

        <div className="px-5 lg:px-8 py-6 flex-1 bg-bg dark:bg-[#0d1117] transition-colors">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
