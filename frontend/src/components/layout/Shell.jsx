import React, { useState, useEffect } from 'react';
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

  const sidebarW = isDesktop ? (collapsed ? 60 : 220) : 0;

  return (
    <div className="flex h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div
        className="flex-1 flex flex-col min-h-screen overflow-y-auto transition-[margin-left,background-color] duration-300 dark:bg-[#0f1623]"
        style={{ marginLeft: sidebarW }}
      >
        <Topbar onMenuClick={() => setMobileOpen(o => !o)} />
        <FilterBar />
        <div className="px-4 lg:px-7 py-6 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
