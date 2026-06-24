import React from 'react';

export default function MobileActionSection({
  setEditingEvent,
  handleSetBudgetClick,
  handleCreateEvent
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
      {/* Add Life Event Card */}
      <button 
        type="button"
        aria-label="➕ Add Life Event"
        onClick={() => setEditingEvent({ type: 'selectType', isNew: true })}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '1rem 1.25rem',
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'inherit'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}>
            ＋
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Add Life Event</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Plan for future milestones</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Edit Budget Card */}
      <div 
        onClick={() => handleSetBudgetClick()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Edit Budget</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review and update your spending</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Add Borrowing Card */}
      <div 
        onClick={() => handleCreateEvent('borrowing')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8b5cf6',
            fontWeight: 'bold',
            fontSize: '1.1rem'
          }}>
            $
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>Add Borrowing</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add a loan or other debt</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}
