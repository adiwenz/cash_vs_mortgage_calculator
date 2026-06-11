import React, { useState } from 'react';

export default function CapitalGainsBreakdownCard({ inputs, calcResults }) {
  const [costBasisMethod, setCostBasisMethod] = useState('average'); // 'average' | 'lots'
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const {
    homePrice,
    downPaymentPercent,
    investmentPortfolioValue,
    investmentCostBasis,
    capitalGainsRate,
    cashPurchaseDiscount
  } = inputs;

  const {
    cashBuyerTax,
    mortgageBuyerTax
  } = calcResults;

  // Calculate portfolio gain ratio
  const portfolioGain = Math.max(0, investmentPortfolioValue - investmentCostBasis);
  const gainRatio = investmentPortfolioValue > 0 ? portfolioGain / investmentPortfolioValue : 0;
  const gainPercent = gainRatio * 100;

  // Cash Buyer
  const cashBuyerPrice = homePrice - cashPurchaseDiscount;
  const cashBuyerEffectiveTaxRate = capitalGainsRate * gainRatio;
  const cashBuyerAmountSold = cashBuyerEffectiveTaxRate < 1 ? cashBuyerPrice / (1 - cashBuyerEffectiveTaxRate) : 0;
  const cashBuyerTaxableGain = cashBuyerAmountSold * gainRatio;

  // Mortgage Buyer
  const downPaymentAmount = homePrice * downPaymentPercent;
  const mortgageBuyerEffectiveTaxRate = capitalGainsRate * gainRatio;
  const mortgageBuyerAmountSold = mortgageBuyerEffectiveTaxRate < 1 ? downPaymentAmount / (1 - mortgageBuyerEffectiveTaxRate) : 0;
  const mortgageBuyerTaxableGain = mortgageBuyerAmountSold * gainRatio;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="glass-card" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <h3 className="card-title" style={{ fontSize: '1rem' }}>Capital Gains Tax Calculation</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Breakdown of initial stock liquidation</span>
      </div>

      {/* Cost Basis Method Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Cost Basis Method:</span>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
          <button
            onClick={() => setCostBasisMethod('average')}
            style={{
              background: costBasisMethod === 'average' ? 'var(--primary)' : 'transparent',
              color: costBasisMethod === 'average' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Average Portfolio Cost Basis
          </button>
          <button
            disabled
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: 'none',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'not-allowed',
              opacity: 0.5
            }}
            title="Coming Soon!"
          >
            Specific Tax Lots (coming soon)
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        <strong>{gainPercent.toFixed(1)}%</strong> of every dollar sold is assumed to be taxable gain.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {/* Cash Buyer Column */}
        <div style={{ background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.1)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#6366f1' }}>Cash Buyer</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Amount Sold:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(cashBuyerAmountSold)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gain %:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{gainPercent.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Taxable Gain:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(cashBuyerTaxableGain)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem', marginTop: '0.25rem', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gains Tax:</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>{formatCurrency(cashBuyerTax)}</span>
            </div>
          </div>
        </div>

        {/* Mortgage Buyer Column */}
        <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>Mortgage Buyer</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Amount Sold:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(mortgageBuyerAmountSold)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gain %:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{gainPercent.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Taxable Gain:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(mortgageBuyerTaxableGain)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem', marginTop: '0.25rem', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gains Tax:</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-amber)' }}>{formatCurrency(mortgageBuyerTax)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Explanation Section */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <button
          onClick={() => setIsExplanationOpen(!isExplanationOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: 0
          }}
        >
          <span>💡 How This Tax Estimate Works</span>
          <span style={{ transition: 'transform 0.15s', transform: isExplanationOpen ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: '0.65rem' }}>▶</span>
        </button>

        {isExplanationOpen && (
          <div style={{ marginTop: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              This calculator assumes your investments all have the same average gain percentage.
            </p>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
              <div>Portfolio Value: $3,000,000</div>
              <div>Cost Basis: $900,000</div>
              <div>Gain Percentage: 70%</div>
            </div>
            <p style={{ marginBottom: '0.4rem' }}>
              If you sell <strong>$100,000</strong> of investments:
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <li><strong>$70,000</strong> is treated as gain (taxable)</li>
              <li><strong>$30,000</strong> is treated as original principal (tax-free)</li>
            </ul>
            <p>
              At a 20% capital gains tax rate:
              <br />
              <strong style={{ color: 'var(--primary)' }}>Tax = $70,000 × 20% = $14,000</strong>
            </p>
          </div>
        )}
      </div>

      {/* Important Limitation */}
      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: '1.35' }}>
        ⚠️ <strong>Important Limitation:</strong> Real investors can often choose which shares, funds, or lots to sell. This calculator uses an average-cost approach and does not model tax optimization strategies.
      </div>
    </div>
  );
}
