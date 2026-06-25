import { formatCurrency } from '../helpers';

export default function LifeSnapshotPanel({
  isMobile,
  projection,
  snapshot,
  selectedAge,
  currentAge,
  lifeExpectancy,
  onSelectedAgeChange
}) {
  const clampSelectedAge = (age) => {
    const min = Number(currentAge);
    const max = Number(lifeExpectancy);
    const numericAge = Number(age);

    if (!Number.isFinite(numericAge)) return min;
    return Math.min(max, Math.max(min, Math.round(numericAge)));
  };

  const handleDecrementAge = () => {
    onSelectedAgeChange(clampSelectedAge(selectedAge - 1));
  };

  const handleIncrementAge = () => {
    onSelectedAgeChange(clampSelectedAge(selectedAge + 1));
  };

  const isDecrementDisabled = selectedAge <= Number(currentAge);
  const isIncrementDisabled = selectedAge >= Number(lifeExpectancy);

  const getCategoryBg = (rowId) => {
    switch (rowId) {
      case 'relationship': return '#f3e8ff';
      case 'housing': return '#dcfce7';
      case 'children': return '#ffedd5';
      case 'education': return '#dbeafe';
      case 'debt': return '#fae8ff';
      case 'income': return '#ccfbf1';
      case 'assets': return '#fef9c3';
      default: return '#f3f4f6';
    }
  };

  const getMilestoneIcon = (category) => {
    switch (category) {
      case 'relationship': return '❤️';
      case 'housing': return '🏠';
      case 'children': return '👶';
      case 'education': return '🎓';
      case 'debt': return '💸';
      case 'income': return '💼';
      default: return '⭐️';
    }
  };

  const getMilestoneIconBg = (category) => {
    return getCategoryBg(category);
  };

  const formatRelationshipStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Single';
  };

  const formatChildrenSnapshot = (children) => {
    if (!children || children.length === 0) return 'None';
    return children.map(c => `${c.name} (Age ${Math.floor(c.age)})`).join(', ');
  };

  const formatNetWorthValue = (proj, age, fallback) => {
    const assetsRow = proj.rows.find(r => r.id === 'assets');
    const seriesItem = assetsRow?.items.find(item => item.type === 'series');
    const points = seriesItem?.metadata?.points || [];
    const pointAtAge = points.find(p => p.age === age);
    const netWorthVal = pointAtAge ? pointAtAge.value : fallback;
    return formatCurrency(netWorthVal);
  };

  const formatDebtsList = (activeDebts) => {
    if (!activeDebts || activeDebts.length === 0) return 'None';
    return activeDebts.map(d => d.name).join(', ');
  };

  const renderSnapshotRow = (icon, label, value) => {
    return (
      <div className="life-snapshot-row-item" key={label}>
        <div className="life-snapshot-row-item-left">
          <div className="life-snapshot-row-item-icon-circle">
            {icon}
          </div>
          <span className="life-snapshot-row-item-label">{label}</span>
        </div>
        <span className="life-snapshot-row-item-value">{value}</span>
      </div>
    );
  };

  return (
    <div className="life-snapshot-panel" style={isMobile ? { padding: '1rem' } : undefined}>
      <div className="life-snapshot-header">
        <h4 style={{ 
          fontSize: isMobile ? '1rem' : '1.05rem', 
          fontWeight: '800', 
          margin: 0, 
          color: 'var(--text-primary)' 
        }}>
          <span>Life Snapshot</span>
          <span style={{ 
            marginLeft: '0.5rem', 
            fontWeight: 'normal', 
            color: 'var(--text-secondary)', 
            fontSize: isMobile ? '0.8rem' : '0.85rem' 
          }}>
            - {selectedAge === Number(currentAge) ? 'Today' : `Age ${selectedAge}`}
          </span>
        </h4>
        <p style={{ 
          fontSize: isMobile ? '0.75rem' : '0.78rem', 
          color: 'var(--text-secondary)', 
          margin: '2px 0 0 0' 
        }}>
          View your life at any age.
        </p>
      </div>

      {/* Selected Age Indicator */}
      <div className="life-snapshot-age-selector-row" style={isMobile ? { margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' } : undefined}>
        <button 
          type="button" 
          className="age-selector-arrow-btn" 
          onClick={handleDecrementAge}
          disabled={isDecrementDisabled}
          aria-label="Previous age"
          style={isDecrementDisabled ? { opacity: 0.3, cursor: 'not-allowed' } : { cursor: 'pointer' }}
        >
          &larr;
        </button>
        <span className="age-selector-text">
          Age {selectedAge} {selectedAge === Number(currentAge) ? '(Today)' : ''}
        </span>
        <button 
          type="button" 
          className="age-selector-arrow-btn" 
          onClick={handleIncrementAge}
          disabled={isIncrementDisabled}
          aria-label="Next age"
          style={isIncrementDisabled ? { opacity: 0.3, cursor: 'not-allowed' } : { cursor: 'pointer' }}
        >
          &rarr;
        </button>
      </div>

      {/* Snapshot Rows */}
      <div className="life-snapshot-rows-list">
        {renderSnapshotRow('❤️', 'Relationship', formatRelationshipStatus(snapshot.relationshipStatus))}
        {renderSnapshotRow('🏠', 'Housing', snapshot.housingStatus === 'own' ? 'Homeowner' : 'Renting')}
        {renderSnapshotRow('👶', 'Children', formatChildrenSnapshot(snapshot.children))}
        {renderSnapshotRow('💼', 'Annual Income', formatCurrency(snapshot.income.annualIncome) + ' / yr')}
        {renderSnapshotRow('📈', 'Net Worth', formatNetWorthValue(projection, selectedAge, snapshot.assets.investedAssets))}
        {renderSnapshotRow('💸', 'Debts', formatDebtsList(snapshot.debts.activeDebts))}
      </div>

      {/* Upcoming Milestones */}
      <div className="upcoming-milestones-container">
        <h5 style={{ 
          fontSize: isMobile ? '0.82rem' : '0.85rem', 
          fontWeight: '800', 
          margin: '0.5rem 0 0 0', 
          color: 'var(--text-primary)' 
        }}>
          Upcoming Milestones
        </h5>
        {projection.upcomingMilestones.length === 0 ? (
          <p style={{ 
            fontSize: isMobile ? '0.72rem' : '0.75rem', 
            color: 'var(--text-secondary)', 
            margin: 0 
          }}>
            No upcoming milestones
          </p>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: isMobile ? '0.4rem' : '0.5rem', 
            marginTop: '0.25rem' 
          }}>
            {projection.upcomingMilestones.map(m => (
              <div key={m.id} className="upcoming-milestone-card">
                <div className="upcoming-milestone-icon-circle" style={{ background: getMilestoneIconBg(m.category) }}>
                  {getMilestoneIcon(m.category)}
                </div>
                <div className="upcoming-milestone-text-group">
                  <span className="upcoming-milestone-title-text">{m.title}</span>
                  <span className="upcoming-milestone-timing-text">Age {m.age} (In {m.age - projection.currentAge} years)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
