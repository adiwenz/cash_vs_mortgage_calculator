import { useState } from 'react';
import { Search } from 'lucide-react';

const getPastelColor = (type) => {
  const colors = {
    marriage: '#edf2ff',      // soft pastel blue/indigo
    buyHouse: '#ffedd5',      // soft peach
    haveChild: '#dcfce7',     // soft green
    careerChange: '#f1f5f9',  // soft cool gray
    move: '#fee2e2',          // soft pink/red
    windfall: '#fef9c3',      // soft yellow/gold
    
    sabbatical: '#e0f2fe',    // soft tropical blue
    sellHouse: '#ffedd5',     // soft orange/peach
    studentLoan: '#fee2e2',   // soft red
    creditCard: '#f1f5f9',    // soft gray
    carLoan: '#e0f2fe',       // soft blue
    personalLoan: '#f3e8ff',  // soft purple
    debtPayoff: '#dcfce7',    // soft green
    college: '#f3e8ff',       // soft lavender
    custom: '#e0f2fe',        // soft cyan/blue
    retire: '#ffedd5',        // soft warm orange
    socialSecurity: '#fef9c3',// soft gold
    pension: '#dcfce7',       // soft green
    rentalIncome: '#e2e8f0',  // soft slate
    annuity: '#f3e8ff',       // soft violet
    otherRetirementIncome: '#fef9c3' // soft gold
  };
  return colors[type] || '#f1f5f9';
};

export default function EventTypeStep({
  searchQuery,
  setSearchQuery,
  searchFocused,
  setSearchFocused,
  eventTypes,
  selectEventType,
  filteredEventTypes,
  inputs
}) {
  const [showAdvancedEvents, setShowAdvancedEvents] = useState(false);

  const isTypeDisabled = (type) => {
    if (!inputs) return false;
    if (type === 'retire') {
      return (inputs.lifeEvents || []).some(e => e.type === 'retire');
    }
    if (type === 'socialSecurity') {
      return inputs.includeSocialSecurity !== false;
    }
    return false;
  };

  const primaryKeys = [
    'marriage',
    'buyHouse',
    'haveChild',
    'careerChange',
    'move',
    'windfall'
  ];

  const advancedKeys = [
    'retire',
    'socialSecurity',
    'pension',
    'rentalIncome',
    'annuity',
    'otherRetirementIncome',
    'college',
    'debtPayoff',
    'custom',
    'sabbatical',
    'sellHouse',
    'studentLoan',
    'creditCard',
    'carLoan',
    'personalLoan'
  ];

  const primaryEvents = primaryKeys.map(key => eventTypes.find(e => e.type === key)).filter(Boolean);
  const advancedEvents = advancedKeys.map(key => eventTypes.find(e => e.type === key)).filter(Boolean);

  return (
    <div className="mobile-wizard-step-content animate-slide-up">
      <h3 className="mobile-wizard-title">What would you like to plan?</h3>
      
      {/* Search Bar */}
      <div className={`mobile-wizard-search-container ${searchFocused ? 'focused' : ''}`}>
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          className="mobile-wizard-search-input" 
          placeholder="Search events..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>
 
      {searchQuery === '' && (
        <div className="mobile-wizard-list" style={{ marginTop: '1rem' }}>
          {primaryEvents.map((item) => {
            const disabled = isTypeDisabled(item.type);
            return (
              <button 
                key={item.type} 
                type="button" 
                className="mobile-wizard-list-item"
                onClick={() => !disabled && selectEventType(item.type)}
                disabled={disabled}
                style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <span className="item-icon-wrapper" style={{ backgroundColor: getPastelColor(item.type) }}>
                  <span className="item-icon">{item.icon}</span>
                </span>
                <span className="item-label">
                  {item.label}{disabled ? ' (Already Added)' : ''}
                </span>
                <span className="item-arrow">→</span>
              </button>
            );
          })}

          <button
            type="button"
            className="mobile-wizard-list-item show-more-toggle-row"
            onClick={() => setShowAdvancedEvents(!showAdvancedEvents)}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {showAdvancedEvents ? 'Show Less ↑' : 'Show More ↓'}
            </span>
          </button>

          {showAdvancedEvents && (
            <>
              <div 
                className="advanced-divider"
                style={{
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  margin: '0.25rem 0'
                }} 
              />
              {advancedEvents.map((item) => {
                const disabled = isTypeDisabled(item.type);
                return (
                  <button 
                    key={item.type} 
                    type="button" 
                    className="mobile-wizard-list-item"
                    onClick={() => !disabled && selectEventType(item.type)}
                    disabled={disabled}
                    style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  >
                    <span className="item-icon-wrapper" style={{ backgroundColor: getPastelColor(item.type) }}>
                      <span className="item-icon">{item.icon}</span>
                    </span>
                    <span className="item-label">
                      {item.label}{disabled ? ' (Already Added)' : ''}
                    </span>
                    <span className="item-arrow">→</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {searchQuery !== '' && (
        <div className="mobile-wizard-list" style={{ marginTop: '1rem' }}>
          {filteredEventTypes.map((item) => {
            const disabled = isTypeDisabled(item.type);
            return (
              <button 
                key={item.type} 
                type="button" 
                className="mobile-wizard-list-item"
                onClick={() => !disabled && selectEventType(item.type)}
                disabled={disabled}
                style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <span className="item-icon-wrapper" style={{ backgroundColor: getPastelColor(item.type) }}>
                  <span className="item-icon">{item.icon}</span>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span className="item-label">
                    {item.label}{disabled ? ' (Already Added)' : ''}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{item.category}</span>
                </div>
                <span className="item-arrow">→</span>
              </button>
            );
          })}
          {filteredEventTypes.length === 0 && (
            <div className="mobile-wizard-no-results">
              No matching events found. Try search keywords like "Child", "Job", "House", "Loan".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
