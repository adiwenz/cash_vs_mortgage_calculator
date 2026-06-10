import React from 'react';

export default function AssumptionsPanel({ inputs, onChange }) {
  const handleChange = (key, value) => {
    // Clamp values to valid numeric ranges if they are entered via number inputs
    let numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      numericValue = 0;
    }
    onChange(key, numericValue);
  };

  const renderInput = (key, label, type, min, max, step, isPercent = false, isCurrency = false) => {
    const rawVal = inputs[key];
    const displayVal = isPercent ? (rawVal * 100).toFixed(1) : rawVal;

    return (
      <div className="input-wrapper" key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.5rem' }}>
        <div className="input-label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="input-name" style={{ fontSize: '0.9rem' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {isCurrency && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: '500' }}>$</span>}
            <input
              type="number"
              className="input-number-box"
              style={{ width: '120px', fontSize: '0.9rem' }}
              value={displayVal}
              step={isPercent ? step * 100 : step}
              onChange={(e) => {
                const val = e.target.value;
                handleChange(key, isPercent ? parseFloat(val) / 100 : parseFloat(val));
              }}
            />
            {isPercent && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: '500' }}>%</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="assumptions-section">
      <div className="glass-card">
        <div className="card-header">
          <h2 className="card-title">Assumptions</h2>
        </div>

        <div className="assumptions-group">
          <div className="assumptions-group-title">Home Assumptions</div>
          {renderInput('homePrice', 'Home Price', 'number', 50000, 1500000, 10000, false, true)}
          {renderInput('cashPurchaseDiscount', 'Cash Purchase Discount', 'number', 0, 200000, 5000, false, true)}
          {renderInput('homeAppreciation', 'Annual Appreciation', 'number', 0.0, 0.15, 0.001, true)}
        </div>

        <div className="assumptions-group" style={{ marginTop: '1.5rem' }}>
          <div className="assumptions-group-title">Mortgage Assumptions</div>
          {renderInput('downPaymentPercent', 'Down Payment %', 'number', 0.0, 1.0, 0.01, true)}
          {renderInput('mortgageTerm', 'Mortgage Term (Years)', 'number', 5, 40, 1)}
          {renderInput('mortgageRate', 'Mortgage Rate', 'number', 0.0, 0.15, 0.001, true)}
        </div>

        <div className="assumptions-group" style={{ marginTop: '1.5rem' }}>
          <div className="assumptions-group-title">Investments & Savings</div>
          {renderInput('stockReturn', 'Stock Market Return', 'number', 0.0, 0.20, 0.001, true)}
          {renderInput('mortgageBuyerInitialStock', 'Mortgage Initial Stock', 'number', 50000, 1000000, 10000, false, true)}
        </div>

        <div className="assumptions-group" style={{ marginTop: '1.5rem' }}>
          <div className="assumptions-group-title">Taxes & Costs</div>
          {renderInput('capitalGainsRate', 'Capital Gains Tax Rate', 'number', 0.0, 0.50, 0.01, true)}
          {renderInput('taxablePortion', 'Taxable Portion of Gains', 'number', 0.0, 1.0, 0.05, true)}
          {renderInput('propertyTaxRate', 'Property Tax Rate', 'number', 0.0, 0.05, 0.001, true)}
          {renderInput('insuranceRate', 'Insurance Rate', 'number', 0.0, 0.03, 0.001, true)}
        </div>
      </div>
    </div>
  );
}
