import { useState } from 'react';
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
    liquidFundsAvailable
  } = houseRebalanceSummary;

  const [showComparisons, setShowComparisons] = useState(false);
  const [outcomeDetails, setOutcomeDetails] = useState(null);

  const currentHomePriceValue = houseRebalanceSummary.currentHomePrice || 0;
  const currentShortfall = Math.max(0, (houseRebalanceSummary.totalCashNeeded || 0) - (liquidFundsAvailable || 0));

  const selectedOption = houseRebalanceSummary.selectedOption || 'balanced';
  const selectedAffordablePrice = houseRebalanceSummary.selectedAffordablePrice !== undefined
    ? houseRebalanceSummary.selectedAffordablePrice
    : houseRebalanceSummary.affordablePriceBalanced;
  
  const isUpdateActionEnabled = selectedAffordablePrice !== null && selectedAffordablePrice !== undefined && selectedAffordablePrice > 0;

  const downPaymentNeeded = selectedOption === 'conservative' 
    ? (houseRebalanceSummary.totalCashNeededConservative || 0)
    : selectedOption === 'aggressive'
    ? (houseRebalanceSummary.totalCashNeededAggressive || 0)
    : (houseRebalanceSummary.totalCashNeededBalanced || 0);

  const additionalNeeded = Math.max(0, downPaymentNeeded - (liquidFundsAvailable || 0));

  const actualDownPayment = selectedOption === 'conservative'
    ? (houseRebalanceSummary.downPaymentConservative !== undefined ? houseRebalanceSummary.downPaymentConservative : (houseRebalanceSummary.totalCashNeededConservative || 0))
    : selectedOption === 'aggressive' || selectedOption === 'stretch'
    ? (houseRebalanceSummary.downPaymentAggressive !== undefined ? houseRebalanceSummary.downPaymentAggressive : (houseRebalanceSummary.totalCashNeededAggressive || 0))
    : (houseRebalanceSummary.downPaymentBalanced !== undefined ? houseRebalanceSummary.downPaymentBalanced : (houseRebalanceSummary.totalCashNeededBalanced || 0));

  const recommendedPayment = selectedOption === 'conservative'
    ? houseRebalanceSummary.affordablePaymentConservative
    : selectedOption === 'aggressive'
    ? houseRebalanceSummary.affordablePaymentAggressive
    : houseRebalanceSummary.affordablePaymentBalanced;

  const selectedRetirementAge = selectedOption === 'conservative'
    ? houseRebalanceSummary.conservativeRetirementAge
    : selectedOption === 'aggressive'
    ? houseRebalanceSummary.aggressiveRetirementAge
    : houseRebalanceSummary.balancedRetirementAge;

  const renderRetirementAgeText = (age) => {
    const baseAge = houseRebalanceSummary.baselineRetirementAge;
    if (age === null || age === undefined || age === "Not achievable" || baseAge === null || baseAge === undefined) {
      return 'Not achievable';
    }
    return `${baseAge} → ${age}`;
  };

  if (outcomeDetails) {
    const strategyName = outcomeDetails.option === 'conservative' ? 'Comfortable' : outcomeDetails.option === 'aggressive' || outcomeDetails.option === 'stretch' ? 'Stretch' : 'Balanced';
    return (
      <div className="modal-backdrop" onClick={() => setHouseRebalanceSummary(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', width: '90%', padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            🎉 House Purchase Updated
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
            Your plan has been updated to purchase a <strong>{formatCurrency(outcomeDetails.affordablePrice)}</strong> home using the <strong>{strategyName}</strong> strategy.
          </p>

          {/* Outcome Details Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left', margin: '0 0 1.25rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Full Mortgage Price:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.affordablePrice)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Down Payment:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.downPayment)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mortgage P&I:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {outcomeDetails.pi > 0 ? `${formatCurrency(outcomeDetails.pi)}/mo` : 'Paid in full (Cash)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Housing Cost:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.recommendedPayment)}/mo</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>New Retirement Age:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{renderRetirementAgeText(outcomeDetails.retirementAge)}</strong>
            </div>
          </div>

          {/* Budget Adjustments section */}
          <div style={{ padding: '1rem', background: 'rgba(249, 115, 22, 0.03)', border: '1px dashed var(--accent-orange, #f97316)', borderRadius: '12px', textAlign: 'left', margin: '0 0 1.5rem 0' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--accent-orange, #f97316)' }}>
              📈 Budget Adjustments
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              {outcomeDetails.wantsReduction > 0 ? (
                <div>
                  • <strong>Decrease Wants:</strong> reduced by <strong>{formatCurrency(outcomeDetails.wantsReduction)}/mo</strong> (from {formatCurrency(outcomeDetails.originalWants)} to <strong>{formatCurrency(outcomeDetails.newWants)}/mo</strong>)
                </div>
              ) : (
                <div>• Wants budget remained unchanged at <strong>{formatCurrency(outcomeDetails.originalWants)}/mo</strong>.</div>
              )}
              {outcomeDetails.savingsReduction > 0 ? (
                <div>
                  • <strong>Decrease Savings:</strong> reduced by <strong>{formatCurrency(outcomeDetails.savingsReduction)}/mo</strong> (from {formatCurrency(outcomeDetails.originalSavings)} to <strong>{formatCurrency(outcomeDetails.newSavings)}/mo</strong>)
                </div>
              ) : (
                outcomeDetails.originalSavings > 0 && (
                  <div>• Savings budget remained unchanged at <strong>{formatCurrency(outcomeDetails.originalSavings)}/mo</strong>.</div>
                )
              )}
            </div>
          </div>

          {renderRetirementAgeText(outcomeDetails.retirementAge) === 'Not achievable' && (
            <div style={{ 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.03)', 
              border: '1px solid var(--accent-red, #ef4444)', 
              borderRadius: '12px', 
              textAlign: 'left', 
              margin: '0 0 1.5rem 0',
              fontSize: '0.85rem'
            }}>
              <div style={{ fontWeight: 'bold', color: 'var(--accent-red, #ef4444)', marginBottom: '0.5rem' }}>
                Plan is not achievable:
              </div>
              <p style={{ color: 'var(--text-primary)', margin: '0 0 0.75rem 0', lineHeight: '1.4' }}>
                Housing cost increased by <strong>{formatCurrency(outcomeDetails.recommendedPayment - (houseRebalanceSummary.oldHousingCost || 0))}/mo</strong> and savings dropped by <strong>{formatCurrency(outcomeDetails.savingsReduction)}/mo</strong>.
              </p>
              <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Recommended Actions:
              </div>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>Create Income Boost for remaining gap</li>
                <li>Save larger down payment</li>
                <li>Reduce house price further</li>
              </ol>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={() => setHouseRebalanceSummary(null)}
            style={{ padding: '0.75rem 1rem', width: '100%', fontWeight: 'bold' }}
          >
            Close & View Simulator
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={() => setHouseRebalanceSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          🏠 Home Purchase Recommendation
        </h3>

        {/* Current Deficit Information */}
        <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
          Housing increased by {formatCurrency(houseRebalanceSummary.monthlyDifference)}/mo
        </div>
        <div style={{ color: 'var(--accent-red, #ef4444)', fontSize: '1.05rem', fontWeight: 'bold', margin: '0.5rem 0 0.5rem 0' }}>
          Monthly deficit: {formatCurrency(deficit)}/mo
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.4', padding: '0 0.5rem' }}>
          {houseRebalanceSummary.constraint === 'cash' 
            ? 'Your retirement plan can support a higher home price, but your available liquid assets at the purchase age are the limiting factor.'
            : houseRebalanceSummary.constraint === 'both'
            ? 'This purchase is limited by both upfront cash and monthly affordability.'
            : 'Your upfront cash is sufficient, but the monthly ownership costs would delay retirement.'}
        </p>

        {/* Real-World Affordability Comparisons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'left', margin: '0 0 1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Current Home:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {currentHomePriceValue ? formatCurrency(currentHomePriceValue) : 'Calculated'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Recommended:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {selectedAffordablePrice !== null ? formatCurrency(selectedAffordablePrice) : 'N/A'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Constraint:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {houseRebalanceSummary.constraint === 'cash' ? 'Upfront Cash' : houseRebalanceSummary.constraint === 'both' ? 'Both' : 'Monthly Budget'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {recommendedPayment !== null && recommendedPayment !== undefined ? `${formatCurrency(recommendedPayment)}/mo` : 'N/A'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Retirement:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {renderRetirementAgeText(selectedRetirementAge)}
            </strong>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Cash Required:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(downPaymentNeeded)}
            </strong>
          </div>
          {downPaymentNeeded - actualDownPayment > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0.5rem', marginTop: '0.15rem', gap: '0.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                <span>• Down Payment:</span>
                <span>{formatCurrency(actualDownPayment)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                <span>• Closing Costs & Upfront:</span>
                <span>{formatCurrency(downPaymentNeeded - actualDownPayment)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Current Liquid Funds:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(liquidFundsAvailable)}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Additional Needed:</span>
            <strong style={{ color: additionalNeeded > 0 ? 'var(--accent-orange, #f97316)' : 'var(--text-primary)' }}>
              {formatCurrency(additionalNeeded)}
            </strong>
          </div>
        </div>

        {/* Collapsible Comparison Section */}
        <div style={{ margin: '0 0 1.25rem 0', textAlign: 'left' }}>
          <button
            type="button"
            onClick={() => setShowComparisons(!showComparisons)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary)', 
              fontSize: '0.8rem', 
              cursor: 'pointer', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              fontWeight: '500'
            }}
          >
            {showComparisons ? '▼ Hide Option Comparisons' : '▶ Show Option Comparisons'}
          </button>
          
          {showComparisons && (
            <div className="animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Comfortable:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {affordablePriceConservative !== null ? formatCurrency(affordablePriceConservative) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.conservativeRetirementAge)})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Balanced (Default):</span>
                <strong style={{ color: 'var(--primary)' }}>
                  {affordablePriceBalanced !== null ? formatCurrency(affordablePriceBalanced) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.balancedRetirementAge)})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Stretch:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {affordablePriceAggressive !== null ? formatCurrency(affordablePriceAggressive) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.aggressiveRetirementAge)})
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
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
              setOutcomeDetails({
                affordablePrice: selectedAffordablePrice,
                downPayment: actualDownPayment,
                recommendedPayment: recommendedPayment,
                retirementAge: selectedRetirementAge,
                option: selectedOption,
                originalWants: houseRebalanceSummary.originalWants,
                originalSavings: houseRebalanceSummary.originalSavings,
                wantsReduction: selectedOption === 'conservative' ? 0 : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.wantsReductionAggressive : houseRebalanceSummary.wantsReductionBalanced),
                savingsReduction: selectedOption === 'conservative' ? 0 : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.savingsReductionAggressive : houseRebalanceSummary.savingsReductionBalanced),
                newWants: selectedOption === 'conservative' ? houseRebalanceSummary.originalWants : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.newWantsAggressive : houseRebalanceSummary.newWantsBalanced),
                newSavings: selectedOption === 'conservative' ? houseRebalanceSummary.originalSavings : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.newSavingsAggressive : houseRebalanceSummary.newSavingsBalanced),
                pi: selectedOption === 'conservative' ? houseRebalanceSummary.piConservative : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.piAggressive : houseRebalanceSummary.piBalanced),
              });
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
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🏠 Update House Purchase</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              {isUpdateActionEnabled ? (
                `Set price to ${selectedOption === 'conservative' ? 'Comfortable' : selectedOption === 'aggressive' ? 'Stretch' : 'Balanced'} option: ${formatCurrency(selectedAffordablePrice)}`
              ) : (
                'Plan is unsustainable'
              )}
            </span>
          </button>

          {/* Action 3: Save for Down Payment */}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              handleApplyRebalanceStrategy('saveForDownPayment');
              setHouseRebalanceSummary(null);
            }}
            style={{ padding: '0.75rem 1rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: 'auto' }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>📅 Save for Down Payment</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              Prioritize saving {formatCurrency(additionalNeeded)} down payment gap
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
