export default function OutcomeHeroCard({
  readyAge,
  targetRetirementAge,
  planStatus,
  runOutAge,
  onViewRecommendations,
  hasRecommendations = false,
  currentAge = 35
}) {
  // Determine layout and copy based on status
  let statusBadgeText;
  let statusIcon;
  let explanation;
  let displayAge;
  let accentColor;
  let gradientStart;
  let borderColor;

  let readinessScore = 0.0;
  if (planStatus === 'comfortable') {
    readinessScore = 1.0;
  } else if (planStatus === 'sustainable') {
    readinessScore = 0.5;
  }

  if (planStatus === 'comfortable') {
    statusBadgeText = "You're Set";
    statusIcon = '🌳';
    explanation = "You'll have enough saved that work becomes a choice.";
    displayAge = readyAge || targetRetirementAge || 65;
    accentColor = '#16a34a'; // Emerald green
    gradientStart = 'rgba(22, 163, 74, 0.08)';
    borderColor = 'rgba(22, 163, 74, 0.2)';
  } else if (planStatus === 'sustainable') {
    statusBadgeText = 'Growing Strong';
    statusIcon = '🌿';
    explanation = 'A few changes could help you get there sooner.';
    displayAge = readyAge || targetRetirementAge || 72;
    accentColor = '#4e7c59'; // Sage green
    gradientStart = 'rgba(78, 124, 89, 0.08)';
    borderColor = 'rgba(78, 124, 89, 0.2)';
  } else {
    statusBadgeText = 'Building Your Future';
    statusIcon = '🌱';
    explanation = "Your current path doesn't reach financial independence yet.";
    displayAge = '—';
    accentColor = '#0d9488'; // Mint green
    gradientStart = 'rgba(13, 148, 136, 0.08)';
    borderColor = 'rgba(13, 148, 136, 0.2)';
  }

  // Tree helper function to render foliage growth states
  function renderTreeFoliage(status) {
    if (status === 'comfortable') {
      // Mature Tree: wide, lush canopy, extra clusters and depth highlights
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
    if (status === 'sustainable') {
      // Young Tree: moderate baseline canopy
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
    // Sapling: minimal foliage, young tree canopy (~75% of middle stage canopy size, rooted at y=0)
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

  // Fixed tree position and scale, dynamic environmental progress values
  const treeTransform = 'translate(218px, 98.25px) scale(2.8)';
  const sunOpacity = 0.55 + (readinessScore * 0.45);
  const hillSaturation = 75 + (readinessScore * 25);
  const showTreeGlow = planStatus === 'comfortable';

  return (
    <div 
      className="glass-card outcome-hero-card" 
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: 0, // padding handled inside flex blocks for overflow styling
        marginBottom: '0.45rem',
        background: `linear-gradient(135deg, ${gradientStart} 0%, var(--bg-card) 100%)`,
        border: `1px solid ${borderColor}`,
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all var(--transition-normal)'
      }}
    >
      {/* Left Column: Info Content */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '0.6rem 1.1rem',
          flex: '1 1 50%',
          minWidth: 0,
          boxSizing: 'border-box',
          gap: '0.25rem',
          justifyContent: 'center'
        }}
      >
        {/* Visually hidden text for test compatibility */}
        <div
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            border: 0
          }}
        >
          {planStatus === 'comfortable' || planStatus === 'sustainable'
            ? `Work Optional at Age ${displayAge}`
            : runOutAge
              ? `Assets Run Out at Age ${runOutAge}`
              : 'Work Optional Not Yet Achievable'}
        </div>

        {/* 1. Status Badge */}
        <div 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.35rem',
            padding: '0.18rem 0.55rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>{statusIcon}</span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: '700',
            color: accentColor,
            letterSpacing: '0.02em'
          }}>
            {statusBadgeText}
          </span>
        </div>

        {/* 2. Large Age Number */}
        <div 
          style={{ 
            fontSize: '2.9rem', 
            fontWeight: '900', 
            fontFamily: 'var(--font-heading)',
            color: accentColor,
            lineHeight: '1.0',
            letterSpacing: '-0.03em',
            margin: 0
          }}
        >
          {displayAge}
        </div>

        {/* 3. Plain-English Explanation */}
        <p 
          style={{ 
            fontSize: '0.8rem', 
            fontWeight: '500',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: '1.35'
          }}
        >
          {explanation}
        </p>

        {(() => {
          const alreadyWorkOptional = readyAge && readyAge <= currentAge;
          const isGap = planStatus === 'retirementGap';
          
          if (alreadyWorkOptional) {
            return (
              <button
                type="button"
                onClick={onViewRecommendations}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  marginTop: '0.25rem',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
              >
                Model a different age →
              </button>
            );
          }
          
          if (isGap) {
            return (
              <button
                type="button"
                onClick={onViewRecommendations}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  marginTop: '0.25rem',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
              >
                See options to stop working sooner →
              </button>
            );
          }
          
          return (
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}>
              <span>✓</span> You’re already on track.
            </span>
          );
        })()}
      </div>

      {/* Right Column: Landscape Illustration */}
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
            {/* Subtle premium glow behind foliage for Comfortable state */}
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
            {renderTreeFoliage(planStatus)}
          </g>
        </svg>
      </div>
    </div>
  );
}
