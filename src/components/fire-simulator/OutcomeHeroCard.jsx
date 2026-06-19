import React from 'react';

export default function OutcomeHeroCard({
  readyAge,
  targetRetirementAge,
  planStatus,
  runOutAge,
  onViewRecommendations,
  hasRecommendations = false
}) {
  const displayAge = readyAge || targetRetirementAge || 65;

  let statusIcon = '⚪';
  let statusText = 'Needs Adjustment';
  let accentColor = 'var(--text-secondary)'; // Gray default
  let bgStyle = 'linear-gradient(135deg, rgba(100, 116, 139, 0.08) 0%, rgba(100, 116, 139, 0.02) 100%)';
  let borderStyle = '1px solid rgba(100, 116, 139, 0.2)';
  let headline = 'Work Optional Not Yet Achievable';

  if (planStatus === 'comfortable') {
    statusIcon = '🟢';
    statusText = 'Comfortable';
    accentColor = 'var(--accent-emerald)';
    bgStyle = 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)';
    borderStyle = '1px solid rgba(16, 185, 129, 0.2)';
    headline = `Work Optional at Age ${displayAge}`;
  } else if (planStatus === 'sustainable') {
    statusIcon = '🟠';
    statusText = 'Sustainable';
    accentColor = 'var(--accent-amber)';
    bgStyle = 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)';
    borderStyle = '1px solid rgba(245, 158, 11, 0.2)';
    headline = `Work Optional at Age ${displayAge}`;
  } else {
    // Needs Adjustment
    if (runOutAge) {
      headline = `Assets Run Out at Age ${runOutAge}`;
    }
  }

  return (
    <div className="glass-card outcome-hero-card" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '1.25rem 1.5rem',
      marginBottom: '0.75rem',
      background: bgStyle,
      border: borderStyle,
      borderRadius: '12px',
      gap: '0.75rem',
      width: '100%',
      boxSizing: 'border-box',
      transition: 'all var(--transition-normal)'
    }}>
      {/* Top Row: Status Badge & Recommendations Link */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}>{statusIcon}</span>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: accentColor
          }}>
            {statusText}
          </span>
        </div>

        {/* Small text link for recommendations if they exist */}
        {hasRecommendations && (
          <button
            type="button"
            onClick={onViewRecommendations}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
          >
            See ways to retire sooner &rarr;
          </button>
        )}
      </div>

      {/* Outcome Headline */}
      <h2 style={{
        fontSize: '1.6rem',
        fontWeight: '800',
        margin: 0,
        color: accentColor,
        lineHeight: '1.2'
      }}>
        {headline}
      </h2>
    </div>
  );
}
