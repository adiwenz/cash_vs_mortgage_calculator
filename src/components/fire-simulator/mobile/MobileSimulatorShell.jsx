import React from 'react';
import { Map, TrendingUp, Settings } from 'lucide-react';
import MobileHeader from './MobileHeader';

export default function MobileSimulatorShell({
  activeTab,
  setActiveTab,
  editingEvent,
  children
}) {
  return (
    <div className="mobile-layout-container">
      {/* Brand Header */}
      <MobileHeader />

      {/* Main Tab Content */}
      <div style={{ flex: 1 }}>
        {children}
      </div>

      {/* BOTTOM TAB NAVIGATION */}
      {!editingEvent && (
        <nav className="mobile-bottom-nav">
          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('Plan')}
          >
            <Map size={20} />
            Plan
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Results' ? 'active' : ''}`}
            onClick={() => setActiveTab('Results')}
          >
            <TrendingUp size={20} />
            Results
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'Details' ? 'active' : ''}`}
            onClick={() => setActiveTab('Details')}
          >
            <Settings size={20} />
            Details
          </button>
        </nav>
      )}
    </div>
  );
}
