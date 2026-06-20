import { useState } from 'react';
import { Search } from 'lucide-react';

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
                <span className="item-icon">{item.icon}</span>
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
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary, #94a3b8)',
              padding: '0.75rem 1rem',
              borderRadius: '14px',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>
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
                    <span className="item-icon">{item.icon}</span>
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
                <span className="item-icon">{item.icon}</span>
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
