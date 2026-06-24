import React from 'react';
import MobileTimeline from '../MobileTimeline';

export default function MobileTimelineSection({
  inputs,
  timelineEvents,
  selectedEventIndex,
  setSelectedEventIndex,
  setActiveEventForSheet,
  setLifeProfileTab,
  setIsLifeProfileOpen,
  formatCurrency
}) {
  const lifeProfile = inputs.lifeProfile || {};
  const household = lifeProfile.household || {};
  const home = lifeProfile.home || {};
  const children = lifeProfile.children || [];
  const filingStatus = inputs.filingStatus || household.status || 'single';

  const statusLabel = filingStatus === 'married' || filingStatus === 'partnered' ? 'Married' : 'Single';
  const homeLabel = home.status === 'own' ? 'Homeowner' : 'Renting';
  const incomeLabel = `Income ${formatCurrency(inputs.simpleIncome || 0)}`;

  return (
    <>
      <div 
        onClick={() => {
          setLifeProfileTab('timeline');
          setIsLifeProfileOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '20px',
          marginBottom: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        {/* Left: Avatar Circle Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary, #6366f1)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          {/* Middle Column Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Your Life
            </h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              {statusLabel} • {homeLabel}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              {incomeLabel}{children.length > 0 ? ` • ${children.length} ${children.length === 1 ? 'Child' : 'Children'}` : ''}
            </span>
          </div>
        </div>

        {/* Right Column: CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary, #6366f1)', fontSize: '0.78rem', fontWeight: '700' }}>
          <span>Life Planner</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <MobileTimeline
        timelineEvents={timelineEvents}
        selectedEventIndex={selectedEventIndex}
        setSelectedEventIndex={setSelectedEventIndex}
        onEventTap={setActiveEventForSheet}
        inputs={inputs}
      />
    </>
  );
}
