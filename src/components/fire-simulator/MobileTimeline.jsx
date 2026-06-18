import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
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

export default function MobileTimeline({
  inputs,
  timelineEvents,
  selectedEventIndex,
  setSelectedEventIndex,
  handleEditRoadmapEvent
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

  const totalYears = (inputs?.lifeExpectancy || 85) - (inputs?.currentAge || 35);

  // Dynamic Marker Sizing based on total events count (evenly spaced)
  const eventCount = timelineEvents.length;
  const sizes = useMemo(() => {
    return { baseCircleSize: 48, activeCircleSize: 60 };
  }, []);

  const showAge = eventCount <= 12;
  const showTitle = eventCount <= 8;

  // Evenly spaced milestones
  const resolvedPositions = useMemo(() => {
    if (timelineEvents.length === 0) return [];

    const W = containerWidth || 350;
    const paddingLeft = 36;
    const paddingRight = 36;
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

  const selectedEvent = timelineEvents[selectedEventIndex] || timelineEvents[0];

  const lineLeft = resolvedPositions.length > 0 ? resolvedPositions[0].x : 0;
  const lineRight = resolvedPositions.length > 0 ? resolvedPositions[resolvedPositions.length - 1].x : 0;
  const lineWidth = lineRight - lineLeft;

  return (
    <section className="mobile-milestones-section">
      <div className="mobile-section-header">
        <h2 className="mobile-section-title">Your Life Journey ✨</h2>
        <span className="mobile-section-subtitle">Tap any event to see details and impact</span>
      </div>

      <div className="mobile-roadmap-track" ref={containerRef} style={{ width: '100%', height: '140px', position: 'relative', overflow: 'hidden' }}>
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
                if (isSelected && isEditableEvent(item.event)) {
                  handleEditRoadmapEvent(item.event);
                } else {
                  setSelectedEventIndex(item.index);
                }
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
                  fontSize: isSelected ? '1.4rem' : '1.1rem',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <span>{item.event.icon}</span>
              </div>
              
              {showAge && (
                <span
                  className="mobile-roadmap-age"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: isSelected ? '#0f172a' : '#ffffff',
                    marginTop: '0.4rem'
                  }}
                >
                  {item.event.age}
                </span>
              )}

              {showTitle && (
                <span
                  className="mobile-roadmap-label-text"
                  style={{
                    fontSize: '0.65rem',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isSelected ? '700' : '500',
                    marginTop: '0.1rem',
                    textAlign: 'center',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
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
