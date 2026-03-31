import React from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import FilterBar from './FilterBar.jsx';

export default function Shell({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="ml-[220px] flex-1 flex flex-col min-h-screen overflow-y-auto">
        <Topbar />
        <FilterBar />
        <div className="px-7 py-6 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
