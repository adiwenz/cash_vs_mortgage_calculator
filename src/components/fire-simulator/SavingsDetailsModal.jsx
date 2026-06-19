import { formatCurrency } from './helpers';

export default function SavingsDetailsModal({
  budgetController
}) {
  const {
    savingsDetails,
    setSavingsDetails,
    setIsSavingsDetailsOpen,
    handleSaveSavingsDetails
  } = budgetController;
  const totalDetails = Object.values(savingsDetails).reduce((sum, val) => sum + val, 0);

  return (
    <div className="modal-backdrop" onClick={() => setIsSavingsDetailsOpen(false)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
            🎯 Current Savings Breakdown
          </h3>
          <button 
            type="button" 
            onClick={() => setIsSavingsDetailsOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
          >
            ✖
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.45', textAlign: 'left' }}>
          Specify the starting balances for each of your savings and investment accounts below.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { key: 'cash', label: 'Cash / Checking Balance' },
            { key: 'emergencyFund', label: 'HYSA / Emergency Fund' },
            { key: 'brokerage', label: 'Taxable Brokerage' },
            { key: 'trad401k', label: 'Pre-Tax 401(k) / 403(b)' },
            { key: 'tradIra', label: 'Traditional IRA' },
            { key: 'rothIra', label: 'Roth IRA / Roth 401(k)' },
            { key: 'hsa', label: 'Health Savings Account (HSA)' },
            { key: 'other', label: 'Other Assets / Accounts' }
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <span className="input-name" style={{ fontSize: '0.85rem' }}>{item.label}</span>
              <div className="input-prefix-wrapper" style={{ width: '130px' }}>
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'right', padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                  value={savingsDetails[item.key] || 0}
                  onChange={(e) => setSavingsDetails({
                    ...savingsDetails,
                    [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                  })}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Savings:</span>
            <strong style={{ fontSize: '1rem', color: 'var(--primary)', marginLeft: '0.35rem' }}>
              {formatCurrency(totalDetails)}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              onClick={() => setIsSavingsDetailsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              onClick={handleSaveSavingsDetails}
            >
              Save Details
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
