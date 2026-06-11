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
    <div className="glass-card" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="card-title" style={{ fontSize: '0.85rem', margin: 0 }}>Capital Gains Tax Breakdown</h3>
      </div>

      {/* Cost Basis Method Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Method:</span>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '0.15rem', borderRadius: '4px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
          <button
            onClick={() => setCostBasisMethod('average')}
            style={{
              background: costBasisMethod === 'average' ? 'var(--primary)' : 'transparent',
              color: costBasisMethod === 'average' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              padding: '0.25rem 0.5rem',
              borderRadius: '3px',
              fontSize: '0.7rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Average Basis
          </button>
          <button
            disabled
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: 'none',
              padding: '0.25rem 0.5rem',
              borderRadius: '3px',
              fontSize: '0.7rem',
              fontWeight: '600',
              cursor: 'not-allowed',
              opacity: 0.5
            }}
            title="Coming Soon!"
          >
            Specific Lots (soon)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {/* Cash Buyer Column */}
        <div style={{ background: 'rgba(99, 102, 241, 0.02)', border: '1px solid rgba(99, 102, 241, 0.08)', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash Buyer Tax</span>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-rose)' }}>
            {formatCurrency(cashBuyerTax)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.65rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Amt Sold:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(cashBuyerAmountSold)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gain %:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{gainPercent.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Taxable:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(cashBuyerTaxableGain)}</span>
            </div>
          </div>
        </div>

        {/* Mortgage Buyer Column */}
        <div style={{ background: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.08)', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mortgage Buyer Tax</span>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-amber)' }}>
            {formatCurrency(mortgageBuyerTax)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.65rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem', marginTop: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Amt Sold:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(mortgageBuyerAmountSold)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gain %:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{gainPercent.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Taxable:</span>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(mortgageBuyerTaxableGain)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Explanation Section */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
        <button
          onClick={() => setIsExplanationOpen(!isExplanationOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.7rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            padding: 0
          }}
        >
          <span>💡 How this is calculated</span>
          <span style={{ transition: 'transform 0.15s', transform: isExplanationOpen ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: '0.6rem' }}>▶</span>
        </button>

        {isExplanationOpen && (
          <div style={{ marginTop: '0.4rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
            <p style={{ marginBottom: '0.35rem' }}>
              Assumes average gain percentage:
            </p>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '0.35rem', fontFamily: 'monospace', fontSize: '0.65rem' }}>
              <div>Gain % = (Portfolio - Basis) / Portfolio = {gainPercent.toFixed(1)}%</div>
            </div>
            <p>
              If you sell <strong>$100K</strong>:
              <br />
              • <strong>${gainPercent.toFixed(1)}K</strong> is taxable gain
              <br />
              • At 20% tax rate: Tax = ${gainPercent.toFixed(1)}K × 20% = ${Math.round(gainPercent * 0.2)}K
            </p>
          </div>
        )}
      </div>

      {/* Important Limitation */}
      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', fontSize: '0.65rem', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
        ⚠️ Real investors can choose which shares/lots to sell. This calculator uses an average-cost approach and does not model tax optimization.
      </div>
    </div>
  );
}
