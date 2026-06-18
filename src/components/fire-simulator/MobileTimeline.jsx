import { useState, useEffect, useRef, useMemo } from 'react';
import { isEditableEvent } from './helpers';

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
  inputs,
  timelineEvents,
  selectedEventIndex,
  setSelectedEventIndex,
  onEventTap
}) {
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

  const sizes = useMemo(() => {
    return { baseCircleSize: 40, activeCircleSize: 52 };
  }, []);

  // Evenly spaced milestones
  const resolvedPositions = useMemo(() => {
    if (timelineEvents.length === 0) return [];

    const W = containerWidth || 350;
    const paddingLeft = sizes.activeCircleSize / 2 + 8;
    const paddingRight = sizes.activeCircleSize / 2 + 8;
    const usableWidth = W - paddingLeft - paddingRight;

    return timelineEvents.map((evt, idx) => {
      const isSelected = selectedEventIndex === idx;
      const size = isSelected ? sizes.activeCircleSize : sizes.baseCircleSize;
      
      let x = paddingLeft + usableWidth / 2;
      if (timelineEvents.length > 1) {
        x = paddingLeft + (idx / (timelineEvents.length - 1)) * usableWidth;
      }

      return {
        index: idx,
        event: evt,
        age: Number(evt.age),
        x,
        size
      };
    });
  }, [timelineEvents, containerWidth, selectedEventIndex, sizes]);

  const lineLeft = resolvedPositions.length > 0 ? resolvedPositions[0].x : 0;
  const lineRight = resolvedPositions.length > 0 ? resolvedPositions[resolvedPositions.length - 1].x : 0;
  const lineWidth = lineRight - lineLeft;

  return (
    <section className="mobile-milestones-section">
      <div className="mobile-section-header">
        <h2 className="mobile-section-title">Your Life Journey ✨</h2>
        <span className="mobile-section-subtitle">Tap any event to see details and impact</span>
      </div>

      <div className="mobile-roadmap-track" ref={containerRef} style={{ width: '100%', height: '150px', position: 'relative', overflow: 'visible' }}>
        {timelineEvents.length > 0 && (
          <div
            className="mobile-roadmap-line"
            style={{
              position: 'absolute',
              top: '38px',
              left: `${lineLeft}px`,
              width: `${lineWidth}px`,
              height: '3px',
              background: 'rgba(255, 255, 255, 0.08)',
              zIndex: 1
            }}
          />
        )}

        {resolvedPositions.map((item) => {
          if (item.event.type === 'today' || item.event.type === 'lifeExpectancy') {
            return null;
          }
          const isSelected = selectedEventIndex === item.index;
          const circleColor = getCircleColorClass(item.event.type);
          const shortLabel = getShortLabel(item.event);
          const topPosition = 38 - item.size / 2;

          // Responsive density rules:
          // 1–6 events: Show age pills and labels for all
          // 7–10 events: Show age pills and labels for all, clamped to 2 lines
          // 11+ events: Show age pills for all events; show labels only for: selected event, first event, last event. Hide non-selected intermediate labels.
          let showLabelForThisEvent = true;
          if (eventCount >= 11) {
            showLabelForThisEvent = isSelected || item.index === 0 || item.index === eventCount - 1;
          }

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
                width: '80px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                zIndex: isSelected ? 3 : 2
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
                  height: `${sizes.activeCircleSize}px`,
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: getEmojiFontSize(isSelected),
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <span>{item.event.icon}</span>
                </div>
              </div>
              
              {/* Age Pill is always visible for all events */}
              <span
                className="mobile-roadmap-age mobile-roadmap-age-pill"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  marginTop: '0.5rem',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
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
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isSelected ? '700' : '500',
                    marginTop: '0.3rem',
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
    </section>
  );
}
