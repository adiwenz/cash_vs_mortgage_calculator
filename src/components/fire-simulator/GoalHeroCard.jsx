import React, { useState, useEffect, useRef } from 'react';

function renderTreeFoliage(planStatus) {
  if (planStatus === 'comfortable') {
    return (
      <>
        <circle cx="0" cy="-9" r="10.5" fill="#16a34a" />
        <circle cx="-6" cy="-6" r="8" fill="#15803d" />
        <circle cx="6" cy="-6" r="8" fill="#15803d" />
        <circle cx="0" cy="-14" r="7" fill="#22c55e" />
        <circle cx="-4" cy="-12" r="6" fill="#16a34a" />
        <circle cx="4" cy="-12" r="6" fill="#16a34a" />
        <circle cx="-8" cy="-8" r="5" fill="#15803d" />
        <circle cx="8" cy="-8" r="5" fill="#15803d" />
        <circle cx="-3" cy="-10" r="5" fill="#4ade80" opacity="0.8" />
        <circle cx="3" cy="-10" r="5" fill="#4ade80" opacity="0.8" />
        <circle cx="0" cy="-6" r="4.5" fill="#4ade80" opacity="0.6" />
      </>
    );
  }
  if (planStatus === 'sustainable') {
    return (
      <>
        <circle cx="0" cy="-8" r="9" fill="#16a34a" />
        <circle cx="-5" cy="-5" r="7" fill="#15803d" />
        <circle cx="5" cy="-5" r="7" fill="#15803d" />
        <circle cx="0" cy="-12" r="6" fill="#22c55e" />
        <circle cx="-3" cy="-9" r="4.5" fill="#4ade80" opacity="0.8" />
        <circle cx="3" cy="-9" r="4.5" fill="#4ade80" opacity="0.8" />
      </>
    );
  }
  return (
    <>
      <circle cx="0" cy="-6.5" r="7" fill="#16a34a" />
      <circle cx="-4" cy="-4.5" r="5" fill="#15803d" />
      <circle cx="4" cy="-4.5" r="5" fill="#15803d" />
      <circle cx="0" cy="-10" r="4.5" fill="#22c55e" />
      <circle cx="0" cy="-6.5" r="3.5" fill="#4ade80" opacity="0.8" />
    </>
  );
}

export default function GoalHeroCard({
  currentAge,
  targetRetirementAge,
  projectedRetirementAge,
  status,
  onTargetAgeChange
}) {
  const [val, setVal] = useState(String(targetRetirementAge));
  const debounceTimerRef = useRef(null);

  // Sync state if external changes happen
  useEffect(() => {
    setVal(String(targetRetirementAge || 65));
  }, [targetRetirementAge]);

  const commitValue = (newValStr) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    let parsed = parseInt(newValStr, 10);
    if (isNaN(parsed)) {
      parsed = 65;
    }

    // Constraints: min: currentAge, max: 90
    const finalVal = Math.min(90, Math.max(currentAge, parsed));
    setVal(String(finalVal));

    if (finalVal !== targetRetirementAge && onTargetAgeChange) {
      onTargetAgeChange(finalVal);
    }
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '' || /^\d*$/.test(raw)) {
      setVal(raw);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (raw !== '') {
        debounceTimerRef.current = setTimeout(() => {
          commitValue(raw);
        }, 300);
      }
    }
  };

  const handleBlur = () => {
    commitValue(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitValue(val);
      e.target.blur();
    }
  };

  // Determine readiness status and badge content
  let statusBadge = null;
  let readinessScore = 0.0;
  const isReady = projectedRetirementAge !== null;

  if (isReady) {
    if (projectedRetirementAge > targetRetirementAge) {
      const diff = projectedRetirementAge - targetRetirementAge;
      readinessScore = 0.5;
      statusBadge = (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.85rem',
          fontWeight: '700',
          backgroundColor: 'var(--warning-light, rgba(245, 158, 11, 0.1))',
          color: 'var(--warning, #f59e0b)',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          ⚠ {diff} {diff === 1 ? 'year' : 'years'} later than your goal
        </div>
      );
    } else {
      readinessScore = 1.0;
      if (projectedRetirementAge < targetRetirementAge) {
        const diff = targetRetirementAge - projectedRetirementAge;
        statusBadge = (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: 'var(--success-light, rgba(22, 163, 74, 0.1))',
            color: 'var(--success, #16a34a)',
            border: '1px solid rgba(22, 163, 74, 0.2)'
          }}>
            ✓ {diff} {diff === 1 ? 'year' : 'years'} earlier than your goal
          </div>
        );
      } else {
        statusBadge = (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: 'var(--success-light, rgba(22, 163, 74, 0.1))',
            color: 'var(--success, #16a34a)',
            border: '1px solid rgba(22, 163, 74, 0.2)'
          }}>
            ✓ You're on track
          </div>
        );
      }
    }
  } else {
    statusBadge = (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.35rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.85rem',
        fontWeight: '700',
        backgroundColor: 'var(--warning-light, rgba(245, 158, 11, 0.1))',
        color: 'var(--warning, #f59e0b)',
        border: '1px solid rgba(245, 158, 11, 0.2)'
      }}>
        ⚠ Goal not yet achievable
      </div>
    );
  }

  // Illustration constants
  const treeTransform = 'translate(218px, 98.25px) scale(2.8)';
  const sunOpacity = 0.55 + (readinessScore * 0.45);
  const hillSaturation = 75 + (readinessScore * 25);
  const showTreeGlow = status === 'comfortable';

  return (
    <div 
      className="glass-card goal-hero-card"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: 0,
        marginBottom: '0.45rem',
        background: `linear-gradient(135deg, ${status === 'comfortable' ? 'rgba(22, 163, 74, 0.05)' : 'rgba(245, 158, 11, 0.05)'} 0%, var(--bg-card) 100%)`,
        border: `1px solid ${status === 'comfortable' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all var(--transition-normal)'
      }}
    >
      {/* Left Area: Hero Input & Results Area */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '1.25rem 1.5rem',
          flex: '1 1 50%',
          minWidth: 0,
          boxSizing: 'border-box',
          gap: '1rem',
          justifyContent: 'center'
        }}
      >
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🎯 When do you want to stop working?
        </h3>

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
          {/* Textbox Input */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            <input
              type="text"
              value={val}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={String(currentAge)}
              style={{
                width: '180px',
                height: '80px',
                fontSize: '56px',
                fontWeight: '900',
                fontFamily: 'var(--font-heading)',
                textAlign: 'center',
                color: 'var(--primary)',
                border: '2px solid var(--border)',
                borderRadius: '16px',
                background: 'var(--bg-secondary)',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
                handleBlur();
              }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>years old</span>
          </div>

          {/* Results Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left', minHeight: '110px', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Based on your current plan...</span>
            <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '600' }}>You can stop working at</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '48px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: '1.1' }}>
                {isReady ? projectedRetirementAge : '—'}
              </span>
              {isReady && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: '600' }}>years old</span>}
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              {statusBadge}
            </div>
          </div>
        </div>
      </div>

      {/* Right Area: Illustration */}
      <div 
        className="hero-landscape-container"
        style={{
          flex: '1 1 50%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          minWidth: '205px',
          borderLeft: '1px solid var(--border-color)',
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05))'
        }}
      >
        <svg 
          viewBox="0 0 400 180" 
          style={{ 
            width: '100%', 
            height: '100%', 
            display: 'block',
            minHeight: '105px'
          }}
        >
          <defs>
            <linearGradient id="hill-grad-back" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#86efac" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="hill-grad-mid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#86efac" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#4ade80" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="hill-grad-front" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="sun-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#fef08a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="path-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0.95" />
            </linearGradient>
            <radialGradient id="tree-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sun */}
          <circle cx="300" cy="85" r="50" fill="url(#sun-grad)" style={{ opacity: sunOpacity, transition: 'opacity 600ms ease' }} />

          {/* Clouds */}
          <path d="M 120,40 Q 128,32 138,36 Q 146,26 156,34 Q 166,31 170,40 Z" fill="#ffffff" opacity="0.35" />
          <path d="M 280,30 Q 286,23 294,27 Q 302,19 310,26 Q 318,23 322,30 Z" fill="#ffffff" opacity="0.3" />

          {/* Birds */}
          <path d="M 150,25 Q 152,22 154,25 Q 156,22 158,25" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" opacity="0.5" />
          <path d="M 162,20 Q 164,17 166,20 Q 168,17 170,20" fill="none" stroke="var(--text-tertiary)" strokeWidth="1" opacity="0.4" />
          <path d="M 220,35 Q 222,32 224,35 Q 226,32 228,35" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" opacity="0.5" />

          {/* Hills and winding path with dynamic saturation */}
          <g style={{ filter: `saturate(${hillSaturation}%)`, transition: 'filter 600ms ease' }}>
            {/* Hills */}
            <path d="M -20,180 L -20,115 Q 110,70 230,105 Q 315,130 420,100 L 420,180 Z" fill="url(#hill-grad-back)" />
            <path d="M -20,180 L -20,130 Q 120,90 250,125 Q 330,140 420,120 L 420,180 Z" fill="url(#hill-grad-mid)" />
            <path d="M -20,180 L -20,145 Q 150,110 310,143 Q 365,150 420,140 L 420,180 Z" fill="url(#hill-grad-front)" />

            {/* Winding Path */}
            <path d="M 280,180 C 265,160 250,155 248,150 C 246,145 258,142 258,137 C 258,132 232,130 220,124 L 216,124 C 226,130 248,132 248,137 C 248,142 236,145 238,150 C 240,155 250,160 260,180 Z" fill="url(#path-grad)" />
          </g>

          {/* Dynamic Tree */}
          <g 
            style={{ 
              transition: 'transform 600ms ease', 
              transform: treeTransform 
            }}
          >
            {showTreeGlow && (
              <circle
                cx="0"
                cy="-8"
                r="18"
                fill="url(#tree-glow-grad)"
                style={{
                  mixBlendMode: 'screen',
                  transition: 'opacity 600ms ease',
                  opacity: showTreeGlow ? 1.0 : 0
                }}
              />
            )}
            {/* Trunk */}
            <rect x="-2" y="0" width="4" height="15" rx="1" fill="#78350f" />
            {/* Leaves */}
            {renderTreeFoliage(status)}
          </g>
        </svg>
      </div>
    </div>
  );
}
