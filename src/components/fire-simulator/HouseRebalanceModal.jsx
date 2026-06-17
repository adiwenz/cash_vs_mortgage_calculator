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
    earliestAffordableAge 
  } = houseRebalanceSummary;

  const currentHomePrice = houseRebalanceSummary.newHousingCost ? (houseRebalanceSummary.monthlyDifference + houseRebalanceSummary.oldHousingCost) : 0; // Wait, we can get current price from the context, or compute it. But wait, is current home price available?
  // Let's pass current home price or get it. In getRebalanceStrategies, we know p. So let's look at getRebalanceStrategies:
  // It returns purchaseAge, oldHousingCost, newHousingCost, monthlyDifference, deficit...
  // Wait, let's look at how we get the current home price. In getRebalanceStrategies, we did:
  // const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  // Let's make sure getRebalanceStrategies returns currentHomePrice!
  // Oh, wait! In rebalance.js, we did not return currentHomePrice explicitly. But wait, we can calculate it or add it to getRebalanceStrategies return object!
  // Let's check: yes, let's return `currentHomePrice: p` in getRebalanceStrategies!
  // Let's first review our implementation of getRebalanceStrategies in rebalance.js.
  // In getRebalanceStrategies:
  // const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
  // It didn't return p. Let's make sure it returns `currentHomePrice: p` so we can easily display it in the modal!
  // Wait, is p available in the modal? Yes, if we return it from getRebalanceStrategies.
  // Let's check: does HouseRebalanceModal receive houseRebalanceSummary? Yes!
  // So if we return `currentHomePrice` from getRebalanceStrategies, it will be in houseRebalanceSummary.
  // Let's check if we should modify rebalance.js to return `currentHomePrice`.
  // Yes! Let's do that. But first, let's write HouseRebalanceModal.jsx to expect `currentHomePrice` from houseRebalanceSummary.

  const currentHomePriceValue = houseRebalanceSummary.currentHomePrice || 0;

  const isPriceCalculated = affordablePriceBalanced !== null;
  const isVeryLowPrice = isPriceCalculated && affordablePriceBalanced < 100000;
  const isDelayAvailable = earliestAffordableAge !== null;

  return (
    <div className="modal-backdrop" onClick={() => setHouseRebalanceSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          🏠 Home Purchase Impact
        </h3>

        {/* Current Deficit Information */}
        <div style={{ color: 'var(--accent-red, #ef4444)', fontSize: '1.05rem', fontWeight: 'bold', margin: '0.5rem 0 1rem 0' }}>
          Monthly deficit: {formatCurrency(deficit)}/mo
        </div>

        {/* Real-World Affordability Comparisons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'left', margin: '0 0 1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Current Home:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {currentHomePriceValue ? formatCurrency(currentHomePriceValue) : 'Calculated'}
            </strong>
          </div>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Affordable Conservatively:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {affordablePriceConservative !== null ? formatCurrency(affordablePriceConservative) : 'N/A'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            <span>Affordable with Budget Adjustments:</span>
            <span>
              {affordablePriceBalanced !== null ? formatCurrency(affordablePriceBalanced) : 'N/A'} (Default)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Affordable Aggressively:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {affordablePriceAggressive !== null ? formatCurrency(affordablePriceAggressive) : 'N/A'}
            </strong>
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
              +{formatCurrency(deficit * 12)}/yr starting at purchase
            </span>
          </button>

          {/* Action 2: Update House Purchase */}
          <button
            type="button"
            className="btn-primary"
            disabled={!isPriceCalculated}
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
              opacity: isPriceCalculated ? 1 : 0.5,
              cursor: isPriceCalculated ? 'pointer' : 'not-allowed',
              border: isVeryLowPrice ? '1px solid #f97316' : undefined
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🏠 Update House Purchase</span>
            <span style={{ fontSize: '0.75rem', color: isVeryLowPrice ? '#f97316' : 'inherit', opacity: isVeryLowPrice ? 1 : 0.85 }}>
              {isPriceCalculated ? (
                isVeryLowPrice ? (
                  `⚠️ Estimated affordable price: ${formatCurrency(affordablePriceBalanced)}`
                ) : (
                  `Set price to Balanced option: ${formatCurrency(affordablePriceBalanced)} (payment: ${formatCurrency(affordablePaymentBalanced)}/mo)`
                )
              ) : (
                'Cannot calculate affordable home price under current loan assumptions.'
              )}
            </span>
          </button>

          {/* Action 3: Delay Purchase */}
          <button
            type="button"
            className="btn-primary"
            disabled={!isDelayAvailable}
            onClick={() => {
              handleApplyRebalanceStrategy('delayPurchase');
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
              opacity: isDelayAvailable ? 1 : 0.5,
              cursor: isDelayAvailable ? 'pointer' : 'not-allowed'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>📅 Delay Purchase</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              {isDelayAvailable ? (
                `Move purchase to age ${earliestAffordableAge}`
              ) : (
                'No near-term delay fixes this'
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
