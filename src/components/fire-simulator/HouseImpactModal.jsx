import { formatCurrency } from './helpers';

export default function HouseImpactModal({
  eventController,
  
  // Legacy:
  houseImpactSummary: legacyHouseImpactSummary,
  setHouseImpactSummary: legacySetHouseImpactSummary
}) {
  const houseImpactSummary = eventController?.houseImpactSummary ?? legacyHouseImpactSummary;
  const setHouseImpactSummary = eventController?.setHouseImpactSummary ?? legacySetHouseImpactSummary;
  if (!houseImpactSummary) return null;
  
  const { 
    housingCostChange, 
    wantsReduction, 
    savingsReduction, 
    totalCashFlowImprovement, 
    baselineRetirementAge, 
    newRetirementAge, 
    retirementReadyAge, 
    isAffordable 
  } = houseImpactSummary;

  if (!isAffordable) return null;

  const hasAdjustments = (wantsReduction > 0 || savingsReduction > 0);
  const isDelayed = baselineRetirementAge !== undefined && baselineRetirementAge !== null && newRetirementAge !== undefined && newRetirementAge !== null && newRetirementAge > baselineRetirementAge;
  const retirementColor = isDelayed ? 'var(--accent-orange, #f97316)' : 'var(--accent-emerald)';

  const renderRetirementImpact = () => {
    if (baselineRetirementAge === undefined || baselineRetirementAge === null || newRetirementAge === undefined || newRetirementAge === null) {
      return `Age ${retirementReadyAge || 'N/A'}`;
    }
    if (baselineRetirementAge === newRetirementAge) {
      return `Unchanged (Age ${newRetirementAge})`;
    }
    return `${baselineRetirementAge} → ${newRetirementAge}`;
  };

  return (
    <div className="modal-backdrop" onClick={() => setHouseImpactSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏠 Home Purchase Added!
        </h3>
        
        <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Congratulations! Your retirement plan remains fully on track and sustainable with this home purchase.
        </p>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Housing Cost Change:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {housingCostChange >= 0 ? `+${formatCurrency(housingCostChange)}/mo` : `${formatCurrency(housingCostChange)}/mo`}
            </strong>
          </div>
          
          {!hasAdjustments ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Budget Adjustments:</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                +$0/mo
              </strong>
            </div>
          ) : (
            <>
              {wantsReduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Wants Reduction:</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    +{formatCurrency(wantsReduction)}/mo
                  </strong>
                </div>
              )}
              {savingsReduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Savings Reduction:</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    +{formatCurrency(savingsReduction)}/mo
                  </strong>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Cash Flow Improvement:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {totalCashFlowImprovement >= 0 ? `+${formatCurrency(totalCashFlowImprovement)}/mo` : `${formatCurrency(totalCashFlowImprovement)}/mo`}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Retirement Impact:</span>
            <strong style={{ fontSize: '0.9rem', color: retirementColor }}>
              {renderRetirementImpact()}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1rem' }}>✓</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-emerald)' }}>Your plan still works</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            className="btn-primary" 
            onClick={() => setHouseImpactSummary(null)}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

