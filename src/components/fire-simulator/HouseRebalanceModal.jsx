import { formatCurrency } from './helpers';

export default function HouseRebalanceModal({
  houseRebalanceSummary,
  setHouseRebalanceSummary,
  handleApplyRebalanceStrategy
}) {
  if (!houseRebalanceSummary) return null;
  const { 
    monthlyDifference, 
    deficit, 
    affordablePrice, 
    affordablePayment, 
    earliestAffordableAge 
  } = houseRebalanceSummary;

  return (
    <div className="modal-backdrop" onClick={() => setHouseRebalanceSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1rem 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          🏠 Home Purchase Impact
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0 1.5rem 0', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Housing increased by <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(monthlyDifference)}/mo</strong>
          </div>
          <div style={{ color: 'var(--accent-red, #ef4444)', fontSize: '1rem', fontWeight: 'bold' }}>
            Monthly deficit: {formatCurrency(deficit)}/mo
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '500' }}>
          Choose a fix:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>+{formatCurrency(deficit * 12)}/yr starting at purchase</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={!affordablePrice}
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
              opacity: affordablePrice ? 1 : 0.5,
              cursor: affordablePrice ? 'pointer' : 'not-allowed'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🏠 Update House Price</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              {affordablePrice 
                ? `Set price to ${formatCurrency(affordablePrice)} (payment: ${formatCurrency(affordablePayment)}/mo)`
                : 'No affordable price found'}
            </span>
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={!earliestAffordableAge}
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
              opacity: earliestAffordableAge ? 1 : 0.5,
              cursor: earliestAffordableAge ? 'pointer' : 'not-allowed'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>📅 Delay Purchase</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              {earliestAffordableAge 
                ? `Delay purchase to age ${earliestAffordableAge}`
                : 'No affordable future age found'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
