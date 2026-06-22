import { useState, useEffect, useRef } from 'react';

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
  lifeExpectancy = 85,
  hasSolvableRecommendations = false,
  status,
  onTargetAgeChange,
  isRetirementSuccessful = false
}) {
  const [val, setVal] = useState(String(targetRetirementAge));
  const debounceTimerRef = useRef(null);

  // Sync state if external changes happen
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Determine State A vs State B condition
  const projectedAgeNum = Number(projectedRetirementAge);
  const isValidProjectedAge =
    projectedRetirementAge !== null &&
    projectedRetirementAge !== undefined &&
    Number.isFinite(projectedAgeNum) &&
    projectedAgeNum <= lifeExpectancy &&
    projectedAgeNum >= currentAge &&
    isRetirementSuccessful === true;

  // Determine readiness status
  let readinessScore = 0.0;

  if (isValidProjectedAge) {
    if (projectedAgeNum > targetRetirementAge) {
      readinessScore = 0.5;
    } else {
      readinessScore = 1.0;
    }
  }

  // Illustration constants
  const treeTransform = 'translate(618px, 98.25px) scale(2.8)';
  const sunOpacity = 0.55 + (readinessScore * 0.45);
  const hillSaturation = 75 + (readinessScore * 25);
  const showTreeGlow = status === 'comfortable';

  return (
    <div className="glass-card goal-hero-card">
      {/* Left Area: Hero Input */}
      <div className="goal-hero-left-panel">
        <h3 className="goal-hero-heading">
          When do you want to stop working?
        </h3>

        <div className="goal-hero-input-container">
          <input
            type="text"
            value={val}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={String(currentAge)}
            className="goal-hero-input-box"
          />
          <span className="goal-hero-input-label">years old</span>
        </div>
      </div>

      {/* Right Area: Illustration & Results */}
      <div className="goal-hero-right-panel">
        {/* Dynamic content wrapper */}
        <div className="goal-hero-right-content">
          {isValidProjectedAge ? (
            <>
              <span className="goal-hero-right-desc">Based on your current plan...</span>
              <span className="goal-hero-right-title">You can stop working at</span>
              <div className="goal-hero-right-age-container">
                <span className="goal-hero-right-age-val">{projectedRetirementAge}</span>
                <span className="goal-hero-right-age-label">years old</span>
              </div>
              <div className="goal-hero-badge-container">
              </div>
            </>
          ) : (
            <>
              <h4 className="goal-hero-right-headline">
                {hasSolvableRecommendations ? "A few adjustments away." : "You’ve got a starting point."}
              </h4>
              <p className="goal-hero-right-subheadline">
                {hasSolvableRecommendations ? "Let’s get you there." : "Let’s build from here."}
              </p>
            </>
          )}
        </div>

        {/* SVG Landscape Illustration */}
        <div className="goal-hero-svg-container">
          <svg 
            viewBox="0 0 800 180" 
            preserveAspectRatio="xMaxYMax slice"
            className="goal-hero-svg"
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
            <circle cx="700" cy="85" r="50" fill="url(#sun-grad)" style={{ opacity: sunOpacity, transition: 'opacity 600ms ease' }} />

            {/* Clouds */}
            <path d="M 520,40 Q 528,32 538,36 Q 546,26 556,34 Q 566,31 570,40 Z" fill="#ffffff" opacity="0.35" />
            <path d="M 680,30 Q 686,23 694,27 Q 702,19 710,26 Q 718,23 722,30 Z" fill="#ffffff" opacity="0.3" />

            {/* Birds */}
            <path d="M 550,25 Q 552,22 554,25 Q 556,22 558,25" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" opacity="0.5" />
            <path d="M 562,20 Q 564,17 566,20 Q 568,17 570,20" fill="none" stroke="var(--text-tertiary)" strokeWidth="1" opacity="0.4" />
            <path d="M 620,35 Q 622,32 624,35 Q 626,32 628,35" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" opacity="0.5" />

            {/* Hills and winding path with dynamic saturation */}
            <g style={{ filter: `saturate(${hillSaturation}%)`, transition: 'filter 600ms ease' }}>
              {/* Hills */}
              <path d="M -420,180 L 150,180 C 200,180 310,139 380,115 Q 510,70 630,105 Q 715,130 820,100 L 820,180 Z" fill="url(#hill-grad-back)" />
              <path d="M -420,180 L 200,180 C 240,180 310,150 380,130 Q 520,90 650,125 Q 730,140 820,120 L 820,180 Z" fill="url(#hill-grad-mid)" />
              <path d="M -420,180 L 250,180 C 280,180 280,166 380,145 Q 550,110 710,143 Q 765,150 820,140 L 820,180 Z" fill="url(#hill-grad-front)" />

              {/* Winding Path */}
              <path d="M 680,180 C 665,160 650,155 648,150 C 646,145 658,142 658,137 C 658,132 632,130 620,124 L 616,124 C 626,130 648,132 648,137 C 648,142 636,145 638,150 C 640,155 650,160 660,180 Z" fill="url(#path-grad)" />
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
    </div>
  );
}
