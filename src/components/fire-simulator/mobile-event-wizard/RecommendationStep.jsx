import { Check } from 'lucide-react';
import { formatCurrency } from '../helpers';
import { getEventFriendlyTitle } from './mobileWizardUtils';

export default function RecommendationStep({
  isNew,
  draftEvent,
  inputs,
  beforeAge,
  afterAge,
  displayRankedPlan,
  houseRebalanceSummary,
  houseImpactSummary,
  outcomeDetails,
  onSetOutcomeDetails,
  showComparisons,
  onSetShowComparisons,
  onApplyMobileRecommendation,
  onApplyRebalanceStrategy,
  onReviewAndSave,
  onDone
}) {
  const isChildFlow = draftEvent.type === 'haveChild';
  const isHouseFlow = draftEvent.type === 'buyHouse';
  const eventNameDisplay = getEventFriendlyTitle(
    draftEvent.type,
    draftEvent.borrowingType,
    draftEvent.name,
    draftEvent.childName
  );

  // House purchase flow
  if (isHouseFlow) {
    if (houseRebalanceSummary) {
      const { 
        deficit, 
        affordablePriceConservative,
        affordablePriceBalanced,
        affordablePriceAggressive,
        liquidFundsAvailable
      } = houseRebalanceSummary;

      const currentHomePriceValue = houseRebalanceSummary.currentHomePrice || 0;

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
        const baseAge = houseRebalanceSummary.baselineStopWorkingAge;
        if (age === null || age === undefined || age === "Not achievable" || baseAge === null || baseAge === undefined) {
          return 'Not achievable';
        }
        return `${baseAge} → ${age}`;
      };

      if (outcomeDetails) {
        const strategyName = outcomeDetails.option === 'conservative' ? 'Comfortable' : outcomeDetails.option === 'aggressive' || outcomeDetails.option === 'stretch' ? 'Stretch' : 'Balanced';
        return (
          <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>
                🎉 House Purchase Updated
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                Your plan has been updated to purchase a <strong>{formatCurrency(outcomeDetails.affordablePrice)}</strong> home using the <strong>{strategyName}</strong> strategy.
              </p>

              {/* Outcome Details Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left', margin: '0.75rem 0', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Full Mortgage Price:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.affordablePrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Down Payment:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.downPayment)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mortgage P&I:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {outcomeDetails.pi > 0 ? `${formatCurrency(outcomeDetails.pi)}/mo` : 'Paid in full (Cash)'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Housing Cost:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.recommendedPayment)}/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>New Can Stop Working Age:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{renderRetirementAgeText(outcomeDetails.retirementAge)}</strong>
                </div>
              </div>

              {/* Budget Adjustments section */}
              <div style={{ padding: '0.75rem', background: 'rgba(249, 115, 22, 0.03)', border: '1px dashed var(--accent-orange, #f97316)', borderRadius: '12px', textAlign: 'left', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 0.4rem 0', color: 'var(--accent-orange, #f97316)' }}>
                  📈 Budget Adjustments
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
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
                  padding: '0.75rem', 
                  background: 'rgba(239, 68, 68, 0.03)', 
                  border: '1px solid var(--accent-red, #ef4444)', 
                  borderRadius: '12px', 
                  textAlign: 'left', 
                  margin: '0 0 1rem 0',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-red, #ef4444)', marginBottom: '0.4rem' }}>
                    Plan is not achievable:
                  </div>
                  <p style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>
                    Housing cost increased by <strong>{formatCurrency(outcomeDetails.recommendedPayment - (houseRebalanceSummary.oldHousingCost || 0))}/mo</strong> and savings dropped by <strong>{formatCurrency(outcomeDetails.savingsReduction)}/mo</strong>.
                  </p>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    Recommended Actions:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Create Income Boost for remaining gap</li>
                    <li>Save larger down payment</li>
                    <li>Reduce house price further</li>
                  </ol>
                </div>
              )}

              <button
                type="button"
                className="mobile-wizard-btn-primary"
                onClick={onReviewAndSave}
                style={{ padding: '0.75rem 1rem', width: '100%', fontWeight: 'bold', margin: 0 }}
              >
                Review & Save
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>
              🏠 Home Purchase Recommendation
            </h3>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: '1.4', padding: '0 0.5rem' }}>
              {houseRebalanceSummary.constraint === 'cash' 
                ? 'Your retirement plan can support a higher home price, but your available liquid assets at the purchase age are the limiting factor.'
                : houseRebalanceSummary.constraint === 'both'
                ? 'This purchase is limited by both upfront cash and monthly affordability.'
                : 'Your upfront cash is sufficient, but the monthly ownership costs would delay when you can stop working.'}
            </p>
            
            {/* Primary Focus Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left', margin: '0.75rem 0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Home:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{currentHomePriceValue ? formatCurrency(currentHomePriceValue) : 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recommended:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedAffordablePrice !== null ? formatCurrency(selectedAffordablePrice) : 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Constraint:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {houseRebalanceSummary.constraint === 'cash' ? 'Upfront Cash' : houseRebalanceSummary.constraint === 'both' ? 'Both' : 'Monthly Budget'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{recommendedPayment !== null && recommendedPayment !== undefined ? `${formatCurrency(recommendedPayment)}/mo` : 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Can Stop Working:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{renderRetirementAgeText(selectedRetirementAge)}</strong>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Cash Required:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(downPaymentNeeded)}</strong>
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

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Liquid Funds:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(liquidFundsAvailable)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Additional Needed:</span>
                <strong style={{ color: additionalNeeded > 0 ? 'var(--accent-orange, #f97316)' : 'var(--text-primary)' }}>{formatCurrency(additionalNeeded)}</strong>
              </div>
            </div>

            {/* Collapsible Comparisons */}
            <div style={{ margin: '0.5rem 0', textAlign: 'left' }}>
              <button
                type="button"
                onClick={() => onSetShowComparisons(!showComparisons)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--primary)', 
                  fontSize: '0.75rem', 
                  cursor: 'pointer', 
                  padding: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.2rem',
                  fontWeight: '500'
                }}
              >
                {showComparisons ? '▼ Hide Option Comparisons' : '▶ Show Option Comparisons'}
              </button>
              
              {showComparisons && (
                <div className="animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Comfortable:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{affordablePriceConservative !== null ? formatCurrency(affordablePriceConservative) : 'N/A'} (Can Stop Working: {renderRetirementAgeText(houseRebalanceSummary.conservativeRetirementAge)})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Balanced (Default):</span>
                    <strong style={{ color: 'var(--primary)' }}>{affordablePriceBalanced !== null ? formatCurrency(affordablePriceBalanced) : 'N/A'} (Can Stop Working: {renderRetirementAgeText(houseRebalanceSummary.balancedRetirementAge)})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stretch:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{affordablePriceAggressive !== null ? formatCurrency(affordablePriceAggressive) : 'N/A'} (Can Stop Working: {renderRetirementAgeText(houseRebalanceSummary.aggressiveRetirementAge)})</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Action 1: Create Income Boost */}
            <button
              type="button"
              className="mobile-wizard-btn-primary"
              onClick={() => onApplyRebalanceStrategy('incomeBoost')}
              style={{ padding: '0.65rem 0.75rem', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', height: 'auto' }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>💰 Create Income Boost</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>+{formatCurrency((houseRebalanceSummary.remainingBalancedDeficit !== undefined ? houseRebalanceSummary.remainingBalancedDeficit : deficit) * 12)}/yr starting at purchase</span>
            </button>

            {/* Action 2: Update House Purchase */}
            <button
              type="button"
              className="mobile-wizard-btn-primary"
              disabled={!isUpdateActionEnabled}
              onClick={() => {
                onSetOutcomeDetails({
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
                padding: '0.65rem 0.75rem', 
                width: '100%', 
                margin: 0,
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '0.15rem',
                height: 'auto',
                opacity: isUpdateActionEnabled ? 1 : 0.5,
                cursor: isUpdateActionEnabled ? 'pointer' : 'not-allowed',
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🏠 Update House Purchase</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
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
              className="mobile-wizard-btn-primary"
              onClick={() => onApplyRebalanceStrategy('saveForDownPayment')}
              style={{ padding: '0.65rem 0.75rem', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', height: 'auto' }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📅 Save for Down Payment</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Prioritize saving {formatCurrency(additionalNeeded)} down payment gap</span>
            </button>
          </div>

          <div className="mobile-wizard-footer" style={{ display: 'flex', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              className="mobile-wizard-btn-secondary"
              style={{ flex: 1, margin: 0 }}
              onClick={onDone}
            >
              Skip / Cancel
            </button>
          </div>
        </div>
      );
    }

    if (houseImpactSummary) {
      const { 
        housingCostChange, 
        wantsReduction, 
        savingsReduction, 
        totalCashFlowImprovement, 
        baselineStopWorkingAge, 
        newRetirementAge, 
        retirementReadyAge 
      } = houseImpactSummary;

      const hasAdjustments = (wantsReduction > 0 || savingsReduction > 0);
      const isDelayed = baselineStopWorkingAge !== undefined && baselineStopWorkingAge !== null && newRetirementAge !== undefined && newRetirementAge !== null && newRetirementAge > baselineStopWorkingAge;
      const retirementColor = isDelayed ? 'var(--accent-orange, #f97316)' : 'var(--accent-emerald)';

      const renderRetirementImpact = () => {
        if (baselineStopWorkingAge === undefined || baselineStopWorkingAge === null || newRetirementAge === undefined || newRetirementAge === null) {
          return `Age ${retirementReadyAge || 'N/A'}`;
        }
        if (baselineStopWorkingAge === newRetirementAge) {
          return `Unchanged (Age ${newRetirementAge})`;
        }
        return `${baselineStopWorkingAge} → ${newRetirementAge}`;
      };

      return (
        <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', textAlign: 'center' }}>
          <div className="success-circle animate-pulse" style={{ margin: '0 auto 0.75rem' }}>
            <Check size={36} className="success-icon" />
          </div>
          <h3 className="success-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
            🏠 Home Purchase Added!
          </h3>
          <p className="success-desc" style={{ fontSize: '0.8rem', margin: '0 auto 1rem', maxWidth: '300px' }}>
            Congratulations! Your retirement plan remains fully on track and sustainable with this home purchase.
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Housing Cost Change:</span>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {housingCostChange >= 0 ? `+${formatCurrency(housingCostChange)}/mo` : `${formatCurrency(housingCostChange)}/mo`}
              </strong>
            </div>
            
            {!hasAdjustments ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Budget Adjustments:</span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  +$0/mo
                </strong>
              </div>
            ) : (
              <>
                {wantsReduction > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Wants Reduction:</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      +{formatCurrency(wantsReduction)}/mo
                    </strong>
                  </div>
                )}
                {savingsReduction > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Savings Reduction:</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      +{formatCurrency(savingsReduction)}/mo
                    </strong>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Cash Flow Improvement:</span>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {totalCashFlowImprovement >= 0 ? `+${formatCurrency(totalCashFlowImprovement)}/mo` : `${formatCurrency(totalCashFlowImprovement)}/mo`}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Retirement Impact:</span>
              <strong style={{ fontSize: '0.85rem', color: retirementColor }}>
                {renderRetirementImpact()}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1.25rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.9rem' }}>✓</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-emerald)' }}>Your plan still works</span>
          </div>

          <div className="mobile-wizard-footer" style={{ width: '100%' }}>
            <button 
              type="button" 
              className="mobile-wizard-btn-primary"
              onClick={onDone}
            >
              Done
            </button>
          </div>
        </div>
      );
    }
  }

  // Child / Budget recommendation flow
  const targetRetirementAge = inputs.targetRetirementAge || 65;
  const hasLocalShortfall = afterAge === "Needs Adjustment" || (typeof afterAge === 'number' && afterAge > targetRetirementAge);
  const hasShortfall = hasLocalShortfall || (displayRankedPlan && displayRankedPlan.length > 0);

  if (isChildFlow && hasShortfall && displayRankedPlan && displayRankedPlan.length > 0) {
    return (
      <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div className="success-circle animate-pulse" style={{ margin: '0 auto 0.75rem' }}>
            <Check size={36} className="success-icon" />
          </div>
          <h3 className="success-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
            👶 Child Added to Timeline!
          </h3>
          <p className="success-desc" style={{ fontSize: '0.8rem', margin: '0 auto 0.75rem', maxWidth: '300px' }}>
            Welcoming a child changes your financial timeline. Here is the projected impact on your retirement:
          </p>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '12px', padding: '0.5rem 1rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready Age:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--accent-orange, #f59e0b)' }}>
              {typeof beforeAge === 'number' ? `Age ${beforeAge}` : beforeAge} ➔ {typeof afterAge === 'number' ? `Age ${afterAge}` : afterAge}
            </strong>
          </div>
        </div>

        <div className="mobile-rec-container" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 'bold', margin: '0 0 0.5rem' }}>
            Recommended Adjustments
          </h4>
          {displayRankedPlan.map((scenario, idx) => {
            const badgeColor = scenario.savingsFocus === 'Earn More' ? '#10b981' : scenario.savingsFocus === 'Save More' ? '#6366f1' : '#f59e0b';
            const badgeBg = scenario.savingsFocus === 'Earn More' ? 'rgba(16, 185, 129, 0.12)' : scenario.savingsFocus === 'Save More' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)';
            return (
              <div className="mobile-rec-card" key={scenario.type || idx}>
                <div className="mobile-rec-card-header">
                  <h5 className="mobile-rec-title" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {scenario.recommendationName || scenario.title}
                  </h5>
                  <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor, fontWeight: '700', textTransform: 'uppercase' }}>
                    {scenario.savingsFocus}
                  </span>
                </div>
                
                <p className="mobile-rec-details">
                  {scenario.details}
                </p>

                {scenario.bulletPoints && scenario.bulletPoints.length > 0 && (
                  <ul className="mobile-rec-bullets">
                    {scenario.bulletPoints.map((bp, bIdx) => (
                      <li key={bIdx}>{bp}</li>
                    ))}
                  </ul>
                )}

                <div className="mobile-rec-kpis">
                  <div>
                    <span className="mobile-rec-kpi-lbl">New Ready Age</span>
                    <strong className="mobile-rec-kpi-val" style={{ color: scenario.readyAge <= targetRetirementAge ? 'var(--accent-emerald, #10b981)' : 'var(--accent-orange, #f59e0b)' }}>
                      Age {scenario.readyAge}
                    </strong>
                  </div>
                  <div>
                    <span className="mobile-rec-kpi-lbl">Effort / Difficulty</span>
                    <strong className="mobile-rec-kpi-val">
                      {scenario.savingsEffortScore === 1 ? '⚡ Low' : scenario.savingsEffortScore === 2 ? '⚡⚡ Medium' : '⚡⚡⚡ High'}
                    </strong>
                  </div>
                </div>

                {!scenario.isInfoOnly && (
                  <button 
                    type="button"
                    className="mobile-rec-apply-btn"
                    onClick={() => onApplyMobileRecommendation(scenario)}
                  >
                    Apply Adjustment
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mobile-wizard-footer" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button 
            type="button" 
            className="mobile-wizard-btn-secondary"
            style={{ flex: 1, margin: 0 }}
            onClick={onDone}
          >
            Skip for Now
          </button>
        </div>
      </div>
    );
  }

  // Normal success screen fallback
  return (
    <div className="mobile-wizard-step-content animate-scale-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="success-circle animate-pulse">
        <Check size={48} className="success-icon" />
      </div>

      <h3 className="success-title">
        {isNew ? `${eventNameDisplay} Added!` : 'Changes Saved!'}
      </h3>
      
      <p className="success-desc">
        We've recalculated your roadmap. The interactive timeline, budget intervals, and retirement projection curves are now fully updated.
      </p>

      <div className="mobile-wizard-footer" style={{ width: '100%' }}>
        <button 
          type="button" 
          className="mobile-wizard-btn-primary"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}
