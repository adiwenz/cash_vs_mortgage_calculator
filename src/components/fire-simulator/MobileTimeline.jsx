import { ChevronRight } from 'lucide-react';
import { isEditableEvent } from './helpers';

const getShortLabel = (evt) => {
  if (!evt) return '';
  if (evt.type === 'socialSecurity') return 'Social Sec.';
  if (evt.type === 'medicareEligibility') return 'Medicare';
  if (evt.type === 'retire') return 'Retire';
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
  if (evt.type.startsWith('retirementReady')) return 'Retire Ready';
  
  let cleanLabel = evt.label || '';
  if (cleanLabel.includes(':')) {
    cleanLabel = cleanLabel.split(':')[0];
  }
  return cleanLabel;
};

const getRoadmapDetails = (evt, formatCurrency) => {
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
      whyItMatters = 'Provides guaranteed, inflation-adjusted retirement income and reduces the drawdown rate required from your investment portfolios.';
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
      title = 'Target Retirement';
      ageLabel = `Begins at Age ${evt.age}`;
      whyItMatters = 'Transition from the wealth accumulation stage to the wealth preservation and portfolio distribution stage.';
      break;
    case 'haveChild':
      whyItMatters = 'Welcoming a child introduces childcare, support, and education expenses, reducing your monthly savings capacity temporarily.';
      break;
    case 'childSupportEnds':
      whyItMatters = 'Child support and childcare expenses end, freeing up significant cash flow to accelerate retirement savings.';
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
      break;
    case 'sellHouse':
      whyItMatters = 'Liquidates home equity, converting real estate value into investable brokerage assets to generate passive income.';
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
      whyItMatters = 'Your portfolio is large enough to grow and cover retirement expenses by your target age without further savings.';
      break;
    case 'retirementReadySurvival':
    case 'retirementReadyComfortable':
    case 'retirementReadySWR':
      title = 'Retirement Ready';
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

export default function MobileTimeline({
  timelineEvents,
  selectedEventIndex,
  setSelectedEventIndex,
  handleEditRoadmapEvent
}) {
  const selectedEvent = timelineEvents[selectedEventIndex] || timelineEvents[0];

  return (
    <section className="mobile-milestones-section">
      <div className="mobile-section-header">
        <h2 className="mobile-section-title">Life Events</h2>
        <span className="mobile-section-subtitle">Tap a milestone to view details</span>
      </div>
      
      <div className="mobile-roadmap-track">
        <div className="mobile-roadmap-scroll-container">
          {timelineEvents.length > 0 && (
            <div 
              className="mobile-roadmap-line-container"
              style={{
                width: `${timelineEvents.length * 6}rem`,
              }}
            >
              <div 
                className="mobile-roadmap-line" 
                style={{
                  left: '3rem',
                  right: '3rem',
                }}
              />
              <div 
                className="mobile-roadmap-line-active" 
                style={{
                  left: '3rem',
                  width: `${selectedEventIndex * 6}rem`,
                }}
              />
            </div>
          )}

          {timelineEvents.map((evt, idx) => {
            let circleColor = 'circle-purple';
            if (evt.type === 'haveChild') circleColor = 'circle-blue';
            else if (evt.type === 'retire') circleColor = 'circle-green';
            else if (evt.type === 'socialSecurity') circleColor = 'circle-gold';

            const isSelected = selectedEventIndex === idx;
            const shortLabel = getShortLabel(evt);

            return (
              <button
                key={idx}
                type="button"
                className={`mobile-roadmap-milestone ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedEventIndex(idx)}
              >
                <div className={`mobile-roadmap-circle ${isSelected ? 'active' : ''} ${circleColor}`}>
                  <span>{evt.icon}</span>
                </div>
                <span className="mobile-roadmap-age">{evt.age}</span>
                <span className="mobile-roadmap-label-text">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedEvent && (() => {
        const details = getRoadmapDetails(selectedEvent, formatCurrency);
        return (
          <div className="mobile-roadmap-details-card">
            <div className="mobile-roadmap-details-header">
              <span className="mobile-roadmap-details-icon">{selectedEvent.icon}</span>
              <div className="mobile-roadmap-details-title-col">
                <h3 className="mobile-roadmap-details-title">{details.title}</h3>
                <span className="mobile-roadmap-details-age-badge">{details.ageLabel}</span>
              </div>
            </div>
            
            <div className="mobile-roadmap-details-content">
              {details.benefitLabel && (
                <div className="mobile-roadmap-details-section-item">
                  <span className="mobile-roadmap-details-lbl">{details.benefitLabel}</span>
                  <span className="mobile-roadmap-details-val highlight-purple">{details.benefitValue}</span>
                </div>
              )}

              {details.whyItMatters && (
                <div className="mobile-roadmap-details-section-item">
                  <span className="mobile-roadmap-details-lbl">Why it matters</span>
                  <p className="mobile-roadmap-details-desc">{details.whyItMatters}</p>
                </div>
              )}

              {details.description && details.description !== details.whyItMatters && (!details.whyItMatters || !details.whyItMatters.includes(details.description)) && (
                <div className="mobile-roadmap-details-section-item">
                  <span className="mobile-roadmap-details-lbl">Details</span>
                  <p className="mobile-roadmap-details-desc">{details.description}</p>
                </div>
              )}
            </div>

            {isEditableEvent(selectedEvent) && (
              <button
                type="button"
                className="mobile-roadmap-edit-btn"
                onClick={() => handleEditRoadmapEvent(selectedEvent)}
              >
                ⚙️ Edit Event
              </button>
            )}
          </div>
        );
      })()}
    </section>
  );
}
