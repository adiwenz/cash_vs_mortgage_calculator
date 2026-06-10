import React from 'react';

export default function EducationHub() {
  return (
    <div className="glass-card" style={{ marginTop: '1rem' }}>
      <div className="card-header">
        <h2 className="card-title">💡 Financial Education Hub</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Key concepts explained simply</span>
      </div>

      <div className="education-grid">
        <div className="concept-card">
          <div className="concept-icon">📈</div>
          <h3>The Power of Compounding</h3>
          <p>
            Compounding happens when the interest or returns you earn on your investments start earning their own returns! Over 30 years, even a small difference in return makes a massive difference in your net worth.
          </p>
          <div className="concept-math">A = P * (1 + r)^t</div>
        </div>

        <div className="concept-card">
          <div className="concept-icon">⚖️</div>
          <h3>Opportunity Cost</h3>
          <p>
            When you pay cash for a home, you avoid paying interest on a mortgage. However, you also lose the opportunity to invest that cash in the stock market. If stocks return 8% and your mortgage costs 6.5%, the opportunity cost of paying cash is the 1.5% difference!
          </p>
          <div className="concept-math">Net Gain = Stock Return - Loan Rate</div>
        </div>

        <div className="concept-card">
          <div className="concept-icon">🏛️</div>
          <h3>Capital Gains & Tax Drag</h3>
          <p>
            If you own stocks and sell them to buy a house, the government taxes the profit (gain) you made. To pay a $60,000 down payment, you might actually have to sell $75,000 worth of stock to cover the tax! That represents a $15,000 immediate loss to your net worth.
          </p>
          <div className="concept-math">Gross = Net / (1 - TaxRate)</div>
        </div>

        <div className="concept-card">
          <div className="concept-icon">🏡</div>
          <h3>Mortgage Amortization</h3>
          <p>
            Amortization means paying off a debt over time in equal installments. In the early years of a mortgage, almost all of your monthly payment goes to paying interest. In the later years, the balance shifts and you build equity (ownership) much faster.
          </p>
          <div className="concept-math">Equity = Home Value - Loan Balance</div>
        </div>
      </div>
    </div>
  );
}
