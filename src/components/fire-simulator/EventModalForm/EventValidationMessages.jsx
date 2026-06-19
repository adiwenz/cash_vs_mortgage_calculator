import React from 'react';
import { formatCurrency } from '../helpers';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall 
} from '../houseAffordabilityUtils';

export function LiquidAssetsWarning({
  editingEvent,
  inputs,
  activeResults,
  baselineResults,
  setShowImprovementModal
}) {
  const simulationResults = activeResults || baselineResults;
  const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
  const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
  const totalCashRequired = calculateTotalCashRequired(editingEvent);

  if (totalCashRequired <= liquidAssets) return null;
  const shortfall = calculateCashShortfall(totalCashRequired, liquidAssets);

  let projectionsAvailable = false;
  if (simulationResults && (simulationResults.nominalData || simulationResults.data)) {
    const logs = simulationResults.nominalData || simulationResults.data;
    const logBefore = logs.find(l => l.age === purchaseAge - 1);
    if (logBefore) {
      projectionsAvailable = true;
    }
  }

  return (
    <div style={{
      gridColumn: 'span 2',
      background: 'rgba(245, 158, 11, 0.08)',
      color: '#f59e0b',
      padding: '0.85rem',
      borderRadius: '6px',
      borderLeft: '4px solid #f59e0b',
      fontSize: '0.85rem',
      lineHeight: '1.45',
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem'
    }}>
      <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span>⚠️</span> Not Enough Liquid Assets
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
          <span>Total cash required:</span>
          <strong>{formatCurrency(totalCashRequired)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
          <span>Projected liquid assets at age {purchaseAge}:</span>
          <strong>{formatCurrency(liquidAssets)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0', borderTop: '1px dashed rgba(245, 158, 11, 0.2)', paddingTop: '0.25rem' }}>
          <span>Additional cash needed:</span>
          <strong>{formatCurrency(shortfall)}</strong>
        </div>
      </div>
      {!projectionsAvailable && (
        <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.85 }}>
          Using current liquid assets.
        </div>
      )}
      <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>
        Liquid assets include cash and taxable brokerage accounts. Retirement accounts are excluded to avoid taxes and withdrawal penalties.
      </div>
      {setShowImprovementModal && (
        <button
          type="button"
          onClick={() => {
            setShowImprovementModal(true);
            setTimeout(() => {
              const housingTypes = [
                'reduceHomePrice', 'increaseDownPayment', 'delayHomePurchase', 'increaseHomeIncome',
                'redirectSavingsDownPayment', 'pauseNonRetirementSavings', 'redirectBrokerageHouseFund',
                'increaseDownPaymentIncome', 'delayHomePurchaseDownPayment', 'purchaseWithPartner',
                'purchaseWithRoommate'
              ];
              for (const type of housingTypes) {
                const el = document.getElementById(`rec-card-${type}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.style.outline = '2px solid var(--primary)';
                  setTimeout(() => {
                    el.style.outline = 'none';
                  }, 2000);
                  break;
                }
              }
            }, 150);
          }}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            color: 'var(--primary, #6366f1)',
            fontWeight: '600',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.85rem',
            textDecoration: 'underline',
            marginTop: '0.35rem'
          }}
        >
          View Affordability Recommendations
        </button>
      )}
    </div>
  );
}

export function BorrowingAgeWarning({ editingEvent, inputs }) {
  if (editingEvent.timing !== 'future' || Number(editingEvent.startAge) > inputs.currentAge) {
    return null;
  }
  return (
    <div className="warning-box" style={{ gridColumn: 'span 2', background: 'rgba(244, 63, 94, 0.08)', color: 'var(--accent-rose, #f43f5e)', padding: '0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose, #f43f5e)', fontWeight: '500', fontSize: '0.85rem' }}>
      ⚠️ <strong>Validation Error:</strong> Start age for future borrowing must be greater than your current age ({inputs.currentAge}).
    </div>
  );
}

export function InterestTrapWarning({ editingEvent }) {
  const balance = Number(editingEvent.balance) || 0;
  const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
  const monthlyInterest = balance * r;
  const minPayment = Number(editingEvent.minPayment) || 0;
  const isInterestTrap = minPayment <= monthlyInterest;

  if (!isInterestTrap) return null;

  return (
    <div className="warning-box" style={{ background: 'rgba(244, 63, 94, 0.08)', color: 'var(--accent-rose, #f43f5e)', padding: '0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose, #f43f5e)', fontWeight: '500' }}>
      ⚠️ <strong>Interest Trap Alert:</strong> Your minimum payment of {formatCurrency(minPayment)} is less than or equal to the monthly interest accrued ({formatCurrency(monthlyInterest)}). The balance will never decrease and will grow over time!
    </div>
  );
}

export function BorrowingNotFoundWarning() {
  return (
    <div style={{ gridColumn: 'span 2', color: 'var(--accent-rose, #f43f5e)', fontSize: '0.85rem' }}>
      ⚠️ Error: Associated borrowing event not found.
    </div>
  );
}
