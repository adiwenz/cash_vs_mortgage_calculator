/* eslint-disable react-refresh/only-export-components, no-case-declarations, no-useless-assignment, no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from 'react';
import { isEditableEvent, getEventIcon } from './helpers';

const getShortLabel = (evt) => {
  if (!evt) return '';
  if (evt.type === 'socialSecurity') return 'Social Sec.';
  if (evt.type === 'medicareEligibility') return 'Medicare';
  if (evt.type === 'retire') return 'Stop Working';
  if (evt.type === 'haveChild') {
    return evt.label.replace('Have Child:', '').trim() || 'Have Child';
  }
  if (evt.type === 'childSupportEnds') return 'Support Ends';
  if (evt.type === 'marriage') return 'Marriage';
  if (evt.type === 'buyHouse') return 'Buy Home';
  if (evt.type === 'sellHouse') return 'Sell Home';
  if (evt.type === 'mortgageOff') return 'Mortgage Ends';
  if (evt.type === 'college') return 'College';
  if (evt.type === 'sabbatical') return 'Sabbatical';
  if (evt.type === 'career') return 'Career';
  if (evt.type === 'lifestyle') return 'Lifestyle';
  if (evt.type === 'windfall') return 'Windfall';
  if (evt.type === 'assetTransfer') return 'Transfer';
  if (evt.type === 'borrowing') return 'Borrowing';
  if (evt.type === 'payoffPlanEnd') return 'Loan Off';
  if (evt.type === 'coastFire') return 'Coast FIRE';
  if (evt.type.startsWith('retirementReady')) return 'Can Stop Working';
  
  let cleanLabel = evt.label || '';
  if (cleanLabel.includes(':')) {
    cleanLabel = cleanLabel.split(':')[0];
  }
  return cleanLabel;
};

export const getRoadmapDetails = (evt, formatCurrency, inputs) => {
  if (!evt) return null;

  let title = getShortLabel(evt);
  let ageLabel = `Starts at Age ${evt.age}`;
  let benefitLabel = null;
  let benefitValue = null;
  let whyItMatters = '';

  if (evt.description) {
    const yrMatch = evt.description.match(/(\$[0-9,]+)\/year/);
    const moMatch = evt.description.match(/(\$[0-9,]+)\/month/);
    if (yrMatch) {
      benefitLabel = 'Estimated Benefit';
      benefitValue = `${yrMatch[1]}/year`;
      if (moMatch) {
        benefitValue += ` (${moMatch[1]}/month)`;
      }
    }
  }

  switch (evt.type) {
    case 'socialSecurity':
      title = 'Social Security';
      whyItMatters = 'Provides guaranteed, inflation-adjusted income and reduces the drawdown rate required from your investment portfolios.';
      break;
    case 'medicareEligibility':
      title = 'Medicare';
      whyItMatters = 'You become eligible for Medicare. Healthcare insurance premium expenses drop significantly, which increases portfolio longevity.';
      const premMatch = evt.description?.match(/(\$[0-9,]+)\/yr/g);
      if (premMatch && premMatch.length >= 2) {
        benefitLabel = 'Healthcare Premium Impact';
        benefitValue = `Drops from ${premMatch[0]} to ${premMatch[1]} annually`;
      }
      break;
    case 'retire':
      title = 'Target Stop Working';
      ageLabel = `Begins at Age ${evt.age}`;
      whyItMatters = 'Transition from the wealth accumulation stage to the wealth preservation and portfolio distribution stage.';
      break;
    case 'haveChild':
      whyItMatters = 'Welcoming a child introduces childcare, support, and education expenses, reducing your monthly savings capacity temporarily.';
      const childEv = inputs?.lifeEvents?.find(e => e.id === evt.originalId);
      if (childEv) {
        benefitLabel = 'Child Details';
        benefitValue = `${childEv.childName || 'Child'} Support Term: ${childEv.includeCollege ? 22 : 18} years`;
      }
      break;
    case 'childSupportEnds':
      whyItMatters = 'Child support and childcare expenses end, freeing up significant cash flow to accelerate savings.';
      break;
    case 'marriage':
      title = 'Marriage';
      whyItMatters = 'Combines household incomes, tax brackets, and sharing living expenses (like housing and utilities) to increase savings rate.';
      if (evt.spouseIncome) {
        benefitLabel = 'Spouse Details';
        benefitValue = `Income: ${formatCurrency(evt.spouseIncome)}/yr | Savings: ${evt.savingsRate || 0}%`;
      }
      break;
    case 'buyHouse':
      whyItMatters = 'Purchasing a home builds equity but introduces mortgage debt, property taxes, and ongoing maintenance costs.';
      const houseAsset = inputs?.houseAssets?.find(h => h.id === evt.houseId);
      if (houseAsset) {
        benefitLabel = 'Property Details';
        benefitValue = `${formatCurrency(houseAsset.purchasePrice || houseAsset.homePrice || 200000)} home • ${formatCurrency(houseAsset.downPayment || 40000)} down`;
      }
      break;
    case 'sellHouse':
      whyItMatters = 'Liquidates home equity, converting real estate value into investable brokerage assets to generate passive income.';
      const sellAsset = inputs?.houseAssets?.find(h => h.id === evt.houseId);
      if (sellAsset) {
        benefitLabel = 'Property Name';
        benefitValue = sellAsset.name || 'Primary Home';
      }
      break;
    case 'mortgageOff':
      whyItMatters = 'Eliminates monthly mortgage payments, dramatically reducing core living expenses and decreasing FI requirements.';
      break;
    case 'college':
      title = 'College Tuition';
      whyItMatters = 'Covers tuition and college costs. Temporary high spending phase funded via cash flow or dedicated child savings.';
      break;
    case 'sabbatical':
      title = 'Sabbatical';
      whyItMatters = 'Temporary break from work. Reduces income short-term to prioritize life experiences and well-being.';
      break;
    case 'coastFire':
      title = 'Coast FIRE Reached';
      ageLabel = `Achieved at Age ${evt.age}`;
      whyItMatters = 'Your portfolio is large enough to grow and cover lifestyle expenses by your target age without further savings.';
      break;
    case 'retirementReadySurvival':
    case 'retirementReadyComfortable':
    case 'retirementReadySWR':
      title = 'Can Stop Working';
      ageLabel = `Achieved at Age ${evt.age}`;
      whyItMatters = 'Your assets have reached the sustainability threshold, meaning you can stop working and support your lifestyle forever.';
      break;
    default:
      whyItMatters = evt.description || 'Occurs as part of your financial and life journey.';
      break;
  }

  return {
    title,
    ageLabel,
    benefitLabel,
    benefitValue,
    whyItMatters,
    description: evt.description
  };
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const getCircleColorClass = (type) => {
  if (type === 'today' || type === 'lifeExpectancy') return 'circle-neutral';
  if (type === 'haveChild') return 'circle-blue';
  if (type === 'retire' || type.startsWith('retirementReady')) return 'circle-green';
  if (type === 'socialSecurity' || type === 'career') return 'circle-gold';
  if (type === 'marriage') return 'circle-rose';
  if (type === 'buyHouse' || type === 'sellHouse' || type === 'mortgageOff') return 'circle-purple';
  return 'circle-purple';
};

const getEmojiFontSize = (isSelected) => {
  return isSelected ? '1.25rem' : '1.05rem';
};

export default function MobileTimeline({
  scenario,
  timeline,
  selectedEventIndex,
  setSelectedEventIndex,
  onEventTap,
  
  // Legacy:
  inputs: legacyInputs,
  timelineEvents: legacyTimelineEvents
}) {
  const inputs = scenario?.inputs ?? legacyInputs ?? timeline?.inputs ?? {};
  const timelineEvents = timeline?.timelineEvents ?? legacyTimelineEvents ?? [];
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(350);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const eventCount = timelineEvents.length;

  const resolvedPositions = useMemo(() => {
    if (!timelineEvents || timelineEvents.length === 0) return [];

    const ages = timelineEvents.map(e => Number(e.age));
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const ageSpan = maxAge - minAge;

    // We want at least 15px per year of age
    const minPixelsPerYear = 15;
    const padding = 48; // Padding on left and right for chips
    const computedWidth = ageSpan * minPixelsPerYear + padding * 2;
    const timelineWidth = Math.max(containerWidth || 350, computedWidth);
    const usableWidth = timelineWidth - padding * 2;

    // Initial proportional positioning
    let positions = timelineEvents.map((evt, idx) => {
      const pct = ageSpan > 0 ? (Number(evt.age) - minAge) / ageSpan : 0.5;
      const x = padding + pct * usableWidth;
      const isSelected = selectedEventIndex === idx;
      const size = isSelected ? 56 : 48; // 48px base, 56px active

      return {
        index: idx,
        event: evt,
        age: Number(evt.age),
        x,
        size
      };
    });

    // Collision pass: Ensure adjacent chips do not overlap.
    // Base size is 48px, active is 56px. 56px is a safe minimum distance to keep chips from overlapping.
    const minDistance = 56;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      if (curr.x - prev.x < minDistance) {
        curr.x = prev.x + minDistance;
      }
    }

    return positions;
  }, [timelineEvents, containerWidth, selectedEventIndex]);

  const trackWidth = useMemo(() => {
    if (resolvedPositions.length === 0) return containerWidth || 350;
    const padding = 48;
    const maxResolvedX = resolvedPositions[resolvedPositions.length - 1].x + padding;
    return Math.max(containerWidth || 350, maxResolvedX);
  }, [resolvedPositions, containerWidth]);

  return (
    <section 
      className="mobile-milestones-section mobile-roadmap-timeline-wrapper"
      style={{
        background: '#ffffff',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: '20px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        textAlign: 'left'
      }}
    >
      <div className="mobile-section-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="mobile-section-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary, #1e3a5f)', margin: 0 }}>Life Events</h2>
        <span className="mobile-section-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', marginTop: '0.2rem', display: 'block' }}>Tap an event to edit</span>
      </div>

      <div 
        ref={containerRef}
        className="mobile-timeline-scroll-container"
        style={{
          width: '100%',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          paddingBottom: '0.75rem',
          paddingTop: '0.5rem',
        }}
      >
        <div 
          className="mobile-roadmap-track" 
          style={{ 
            width: `${trackWidth}px`, 
            height: '110px', 
            position: 'relative',
            overflow: 'visible' 
          }}
        >
          {resolvedPositions.length > 0 && (
            <div
              className="mobile-roadmap-line"
              style={{
                position: 'absolute',
                top: '28px', // Center vertically with the 56px active chip (56/2 = 28px)
                left: `${resolvedPositions[0].x}px`,
                width: `${resolvedPositions[resolvedPositions.length - 1].x - resolvedPositions[0].x}px`,
                height: '3px',
                background: 'var(--primary, #16a34a)',
                opacity: 0.35,
                zIndex: 1
              }}
            />
          )}

          {resolvedPositions.map((item) => {
            const isSelected = selectedEventIndex === item.index;
            const circleColor = getCircleColorClass(item.event.type);
            const shortLabel = getShortLabel(item.event);
            const topPosition = 28 - item.size / 2;

            // Responsive density rules:
            // 1–6 events: Show age pills and labels for all
            // 7–10 events: Show age pills and labels for all, clamped to 2 lines
            // 11+ events: Show age pills for all events; show labels only for: selected event, first event, last event. Hide non-selected intermediate labels.
            let showLabelForThisEvent = true;
            if (eventCount >= 11) {
              showLabelForThisEvent = isSelected || item.index === 0 || item.index === eventCount - 1;
            }

            const eventIcon = getEventIcon(item.event) || '✨';

            return (
              <button
                key={item.index}
                type="button"
                className={`mobile-roadmap-milestone ${isSelected ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${item.x}px`,
                  transform: 'translateX(-50%)',
                  top: `${topPosition}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '90px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: isSelected ? 3 : 2,
                  outline: 'none',
                  scrollSnapAlign: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onClick={() => {
                  setSelectedEventIndex(item.index);
                  if (onEventTap) {
                    onEventTap(item.event, item.index);
                  }
                }}
              >
                <div
                  style={{
                    height: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    className={`mobile-roadmap-circle ${isSelected ? 'active pulse' : ''} ${circleColor}`}
                    style={{
                      width: `${item.size}px`,
                      height: `${item.size}px`,
                      borderRadius: '50%',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isSelected ? '1.4rem' : '1.15rem',
                      border: isSelected ? '3px solid var(--primary, #16a34a)' : '1.5px solid var(--border, #e5e7eb)',
                      boxShadow: isSelected 
                        ? '0 0 15px rgba(22, 163, 74, 0.35), 0 4px 8px rgba(0, 0, 0, 0.06)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {eventIcon}
                    </span>
                  </div>
                </div>
                
                {/* Age Pill is always visible for all events */}
                <span
                  className="mobile-roadmap-age mobile-roadmap-age-pill"
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: isSelected ? '800' : '700',
                    color: isSelected ? 'var(--primary, #16a34a)' : 'var(--text-secondary, #6b7280)',
                    background: isSelected ? 'var(--primary-light, rgba(22, 163, 74, 0.08))' : 'rgba(0, 0, 0, 0.03)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    marginTop: '0.3rem',
                    border: isSelected ? '1.5px solid var(--primary, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    boxShadow: isSelected ? '0 0 10px rgba(22, 163, 74, 0.15)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {item.event.age}
                </span>

                {showLabelForThisEvent && (
                  <span
                    className="mobile-roadmap-label-text"
                    style={{
                      fontSize: '0.65rem',
                      color: isSelected ? 'var(--text-primary, #1f2937)' : 'var(--text-tertiary, #9ca3af)',
                      fontWeight: isSelected ? '700' : '500',
                      marginTop: '0.15rem',
                      textAlign: 'center',
                      width: '100%',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      lineHeight: '1.2'
                    }}
                  >
                    {shortLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
