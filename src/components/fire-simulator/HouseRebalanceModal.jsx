import { formatCurrency } from './helpers';

export default function HouseRebalanceModal({
  houseRebalanceSummary,
  setHouseRebalanceSummary,
  handleApplyRebalanceStrategy
}) {
  if (!houseRebalanceSummary) return null;
  const { 
    deficit, 
    affordablePriceConservative,
    affordablePriceBalanced,
    affordablePriceAggressive,
    affordablePaymentBalanced,
    liquidFundsAvailable,
    estimatedDownPaymentCapacity
  } = houseRebalanceSummary;

  const currentHomePrice = houseRebalanceSummary.newHousingCost ? (houseRebalanceSummary.monthlyDifference + houseRebalanceSummary.oldHousingCost) : 0;

  const currentHomePriceValue = houseRebalanceSummary.currentHomePrice || 0;

  const isConservativeMonthlyValid = houseRebalanceSummary.isConservativeMonthlyValid !== false;
  const isBalancedMonthlyValid = houseRebalanceSummary.isBalancedMonthlyValid !== false;
  const isAggressiveMonthlyValid = houseRebalanceSummary.isAggressiveMonthlyValid !== false;

  const selectedAffordablePrice = houseRebalanceSummary.selectedAffordablePrice !== undefined
    ? houseRebalanceSummary.selectedAffordablePrice
    : houseRebalanceSummary.affordablePriceBalanced;
  const isUpdateActionEnabled = selectedAffordablePrice !== null && selectedAffordablePrice !== undefined;
  const isVeryLowPrice = isUpdateActionEnabled && selectedAffordablePrice < 100000;
  const selectedOption = houseRebalanceSummary.selectedOption || 'balanced';

  const renderRetirementAgeText = (age) => {
    if (age === null || age === undefined) return 'Retirement: N/A';
    const baseAge = houseRebalanceSummary.baselineRetirementAge;
    if (baseAge !== undefined && baseAge !== null && age > baseAge) {
      return `Retirement age: ${baseAge} → ${age}`;
    }
    return `Retirement age: ${age}`;
  };

  const selectedOptionSustainable = houseRebalanceSummary.selectedOption === 'balanced'
    ? houseRebalanceSummary.isBalancedSustainable !== false
    : houseRebalanceSummary.selectedOption === 'conservative'
    ? houseRebalanceSummary.isConservativeSustainable !== false
    : houseRebalanceSummary.isAggressiveSustainable !== false;

  return (
    <div className="modal-backdrop" onClick={() => setHouseRebalanceSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          🏠 Home Purchase Impact
        </h3>

        {/* Current Deficit Information */}
        <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
          Housing increased by {formatCurrency(houseRebalanceSummary.monthlyDifference)}/mo
        </div>
        <div style={{ color: 'var(--accent-red, #ef4444)', fontSize: '1.05rem', fontWeight: 'bold', margin: '0.5rem 0 0.5rem 0' }}>
          Monthly deficit: {formatCurrency(deficit)}/mo
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.4', padding: '0 0.5rem' }}>
          Your retirement plan can support homeownership, but your down payment is currently the limiting factor.
        </p>

        {/* Real-World Affordability Comparisons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'left', margin: '0 0 1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Current Home:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {currentHomePriceValue ? formatCurrency(currentHomePriceValue) : 'Calculated'}
            </strong>
          </div>
          
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Liquid Funds Available:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {liquidFundsAvailable !== undefined ? formatCurrency(liquidFundsAvailable) : 'N/A'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Down Payment Capacity:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {estimatedDownPaymentCapacity !== undefined ? formatCurrency(estimatedDownPaymentCapacity) : 'N/A'}
            </strong>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />
          
          {/* Conservative / Comfortable */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Comfortable:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {affordablePriceConservative !== null ? formatCurrency(affordablePriceConservative) : 'N/A'}
                {!isConservativeMonthlyValid && <span style={{ color: 'var(--accent-red, #ef4444)', fontWeight: 'normal', fontSize: '0.75rem' }}> (invalid)</span>}
              </strong>
            </div>
            {affordablePriceConservative !== null && houseRebalanceSummary.conservativeRetirementAge !== undefined && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {renderRetirementAgeText(houseRebalanceSummary.conservativeRetirementAge)}
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

          {/* Balanced */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
              <span>Balanced (Default):</span>
              <span>
                {affordablePriceBalanced !== null ? formatCurrency(affordablePriceBalanced) : 'N/A'}
                {!isBalancedMonthlyValid && <span style={{ color: 'var(--accent-red, #ef4444)', fontWeight: 'normal', fontSize: '0.75rem' }}> (invalid)</span>}
              </span>
            </div>
            {affordablePriceBalanced !== null && houseRebalanceSummary.balancedRetirementAge !== undefined && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {renderRetirementAgeText(houseRebalanceSummary.balancedRetirementAge)}
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

          {/* Aggressive / Stretch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Stretch:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {affordablePriceAggressive !== null ? formatCurrency(affordablePriceAggressive) : 'N/A'}
                {!isAggressiveMonthlyValid && <span style={{ color: 'var(--accent-red, #ef4444)', fontWeight: 'normal', fontSize: '0.75rem' }}> (invalid)</span>}
              </strong>
            </div>
            {affordablePriceAggressive !== null && houseRebalanceSummary.aggressiveRetirementAge !== undefined && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {renderRetirementAgeText(houseRebalanceSummary.aggressiveRetirementAge)}
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '500' }}>
          Choose a fix:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Action 1: Create Income Boost */}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              handleApplyRebalanceStrategy('incomeBoost');
              setHouseRebalanceSummary(null);
            }}
            style={{ padding: '0.75rem 1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: 'auto' }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>💰 Create Income Boost</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              +{formatCurrency((houseRebalanceSummary.remainingBalancedDeficit !== undefined ? houseRebalanceSummary.remainingBalancedDeficit : deficit) * 12)}/yr starting at purchase
            </span>
          </button>

          {/* Action 2: Update House Purchase */}
          <button
            type="button"
            className="btn-primary"
            disabled={!isUpdateActionEnabled}
            onClick={() => {
              handleApplyRebalanceStrategy('updatePrice');
              setHouseRebalanceSummary(null);
            }}
            style={{ 
              padding: '0.75rem 1rem', 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.25rem',
              height: 'auto',
              opacity: isUpdateActionEnabled ? 1 : 0.5,
              cursor: isUpdateActionEnabled ? 'pointer' : 'not-allowed',
              border: isVeryLowPrice ? '1px solid #f97316' : undefined
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🏠 Update House Purchase</span>
            <span style={{ fontSize: '0.75rem', color: isVeryLowPrice ? '#f97316' : 'inherit', opacity: isVeryLowPrice ? 1 : 0.85 }}>
              {isUpdateActionEnabled ? (
                selectedOption === 'aggressive' ? (
                  `⚠️ Set price to Stretch option: ${formatCurrency(selectedAffordablePrice)} (Warning: high budget strain)`
                ) : isVeryLowPrice ? (
                  `⚠️ Estimated affordable price: ${formatCurrency(selectedAffordablePrice)}`
                ) : (
                  `Set price to ${selectedOption === 'conservative' ? 'Comfortable' : 'Balanced'} option: ${formatCurrency(selectedAffordablePrice)}`
                )
              ) : (
                'Plan is unsustainable'
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
