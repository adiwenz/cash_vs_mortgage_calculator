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
        <>
          {/* Popular Events Section */}
          <h4 className="mobile-wizard-section-lbl">Popular Events</h4>
          <div className="mobile-wizard-list">
            {eventTypes.filter(e => e.popular).map((item) => {
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
          </div>
        </>
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

      {searchQuery === '' && (
        <>
          {/* Categories Sections */}
          {['Family', 'Career', 'Housing', 'Debt', 'Goals', 'Stop Working'].map((cat) => {
            const catItems = eventTypes.filter(e => e.category === cat && !e.popular);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} style={{ marginTop: '1.25rem' }}>
                <h4 className="mobile-wizard-section-lbl">{cat}</h4>
                <div className="mobile-wizard-list">
                  {catItems.map((item) => {
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
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
