import React from 'react';

export default function MobileGoalSection({
  inputs,
  goalAgeInput,
  setGoalAgeInput,
  handleTapGoalAge,
  commitGoalAge,
  activeResults,
  isPlanOnTrack
}) {
  return (
    <div 
      className="glass-card mobile-goal-card"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: '1.25rem',
        background: 'var(--bg-secondary, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '20px',
        marginBottom: '1rem',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'left'
      }}
    >
      {/* Left Panel: Goal Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          When would you like to stop working?
        </h3>
        
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          onClick={handleTapGoalAge}
        >
          <input
            type="number"
            value={goalAgeInput}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d*$/.test(val)) {
                setGoalAgeInput(val);
              }
            }}
            onBlur={(e) => {
              commitGoalAge(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitGoalAge(e.target.value);
                e.target.blur();
              }
            }}
            onClick={(e) => e.stopPropagation()} // Prevent triggering parent onClick
            style={{
              width: '60px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '1.2rem',
              fontWeight: '800',
              padding: '0.35rem 0.5rem',
              textAlign: 'center',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>years old</span>
        </div>
        {Number(inputs.currentAge) === Number(inputs.targetRetirementAge) && (
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fef3c7',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: '600',
              marginTop: '4px',
              alignSelf: 'flex-start'
            }}
          >
            <span>🏖️ Stop Working Today</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '0 1rem' }} />

      {/* Right Panel: Secondary Metric & Pill */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '0.45rem', flex: 1 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.25' }}>
          You can currently stop working at{' '}
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {activeResults.retirementReadyAge || '—'}
          </strong>
        </div>

        <div 
          onClick={handleTapGoalAge}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: isPlanOnTrack ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isPlanOnTrack ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            color: isPlanOnTrack ? 'var(--accent-emerald, #10b981)' : 'var(--accent-orange, #f59e0b)',
            fontSize: '0.7rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          {isPlanOnTrack ? '✓ On Track' : '⚠ Delayed'}
        </div>
      </div>
    </div>
  );
}
