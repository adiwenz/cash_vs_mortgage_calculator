import React from 'react';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall 
} from '../houseAffordabilityUtils';
import { hasResolvedRecommendationTradeoffs } from '../../../features/fire/recommendations/recommendationUtils.js';

export default function RecommendationFooter({
  type,
  editingEvent,
  inputs,
  activeResults,
  baselineResults,
  afterReadyAge,
  setShowImprovementModal,
  handleDeleteEvent,
  handleSaveEvent,
  setEditingEvent
}) {
  const claimAge = editingEvent?.claimingAge !== undefined 
    ? Number(editingEvent.claimingAge) 
    : (editingEvent?.startAge !== undefined ? Number(editingEvent.startAge) : 65);

  const isSaveDisabled = 
    (type === 'borrowing' && editingEvent.timing === 'future' && Number(editingEvent.startAge) <= inputs.currentAge) ||
    (type === 'socialSecurity' && (claimAge < 62 || claimAge > 70));

  return (
    <div style={{ display: 'flex', marginTop: '1.25rem', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn-secondary"
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}
          onClick={() => setEditingEvent(null)}
        >
          Cancel
        </button>
        {editingEvent.id && type !== 'retire' && type !== 'socialSecurity' && (
          <button
            type="button"
            className="btn-secondary"
            style={{
              color: 'var(--accent-rose, #f43f5e)',
              borderColor: 'rgba(244, 63, 94, 0.2)',
              backgroundColor: 'rgba(244, 63, 94, 0.05)',
              fontWeight: '700'
            }}
            onClick={handleDeleteEvent}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.2)';
            }}
          >
            Delete Event
          </button>
        )}
      </div>
      <div>
        {(() => {
          let primaryCta = 'Save Event';
          let onPrimaryClick = handleSaveEvent;

          if (type === 'buyHouse') {
            const simulationResults = activeResults || baselineResults;
            const needsReviewOptions = !hasResolvedRecommendationTradeoffs(editingEvent, inputs, simulationResults);

            const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
            const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
            const totalCashRequired = calculateTotalCashRequired(editingEvent);
            const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
            const hasCashShortfall = cashShortfall > 0;

            const beforeReadyAge = baselineResults?.retirementReadyAge || inputs.targetRetirementAge || 65;
            const afterReadyAgeVal = afterReadyAge !== null && afterReadyAge !== undefined ? afterReadyAge : (inputs.targetRetirementAge || 65);
            const retirementDelayYears = Math.max(0, afterReadyAgeVal - beforeReadyAge);
            const hasRetirementDelay = retirementDelayYears > 0;

            if (hasCashShortfall) {
              if (editingEvent.recommendationApplied) {
                primaryCta = 'Save Home Purchase';
              } else {
                primaryCta = 'Review Options';
              }
            } else if (hasRetirementDelay) {
              primaryCta = 'Save & Adjust Retirement';
            } else {
              primaryCta = 'Save Home Purchase';
            }

            if (needsReviewOptions) {
              onPrimaryClick = () => {
                if (setShowImprovementModal) {
                  setShowImprovementModal(true);
                }
              };
            }
          }

          return (
            <button
              type="button"
              className="btn-primary"
              onClick={onPrimaryClick}
              disabled={isSaveDisabled}
              style={{
                opacity: isSaveDisabled ? 0.5 : 1,
                cursor: isSaveDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {primaryCta}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
