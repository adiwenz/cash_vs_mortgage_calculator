import React, { useState, useEffect, useRef } from 'react';

const PERCENT_FIELDS = [
  'homeAppreciation',
  'downPaymentPercent',
  'mortgageRate',
  'stockReturn',
  'savingsRate',
  'capitalGainsRate',
  'propertyTaxRate',
  'insuranceRate'
];

const formatCurrencyShort = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

export default function AssumptionsPanel({ inputs, onChange }) {

  // Local state to hold the string representation of inputs during editing
  const [localValues, setLocalValues] = useState({});
  const activeFieldRef = useRef(null);

  // Sync parent changes to local state, but only for fields that are NOT currently focused
  useEffect(() => {
    const nextLocals = { ...localValues };
    let changed = false;

    Object.keys(inputs).forEach((key) => {
      if (activeFieldRef.current !== key) {
        const rawVal = inputs[key];
        const isPercent = PERCENT_FIELDS.includes(key);
        const displayVal = isPercent ? (rawVal * 100).toString() : rawVal.toString();
        
        if (nextLocals[key] !== displayVal) {
          nextLocals[key] = displayVal;
          changed = true;
        }
      }
    });

    if (changed) {
      setLocalValues(nextLocals);
    }
  }, [inputs]);

  const handleChange = (key, valueString) => {
    let sanitized = valueString.replace(/^0+(?=\d)/, '');
    const isPercent = PERCENT_FIELDS.includes(key);
    
    if (sanitized !== '' && sanitized !== '.') {
      const parsedVal = parseFloat(sanitized);
      if (!isNaN(parsedVal)) {
        if (isPercent && parsedVal > 100) {
          sanitized = '100';
        } else if (key === 'mortgageTerm') {
          if (parsedVal > 30) {
            sanitized = '30';
          } else if (parsedVal < 0) {
            sanitized = '0';
          }
        }
      }
    }

    setLocalValues((prev) => ({
      ...prev,
      [key]: sanitized
    }));

    if (sanitized === '' || sanitized === '.') {
      onChange(key, 0);
    } else {
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) {
        onChange(key, isPercent ? parsed / 100 : parsed);
      }
    }
  };

  const handleBlur = (key) => {
    activeFieldRef.current = null;
    const rawVal = inputs[key];
    const isPercent = PERCENT_FIELDS.includes(key);
    const displayVal = isPercent ? (rawVal * 100).toFixed(1) : rawVal.toString();
    
    setLocalValues((prev) => ({
      ...prev,
      [key]: displayVal
    }));
  };

  const renderInput = (key, label, type, min, max, step, isPercent = false, isCurrency = false) => {
    const valString = localValues[key] ?? '';

    return (
      <div className="input-wrapper" key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.35rem' }}>
        <div className="input-label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="input-name" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
            {isCurrency && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: '600' }}>$</span>}
            <input
              type="number"
              className="input-number-box"
              style={{ width: '95px', fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: 'auto' }}
              value={valString}
              step={isPercent ? step * 100 : step}
              onFocus={() => {
                activeFieldRef.current = key;
              }}
              onChange={(e) => {
                handleChange(key, e.target.value);
              }}
              onBlur={() => {
                handleBlur(key);
              }}
            />
            {isPercent && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: '600' }}>%</span>}
          </div>
        </div>
      </div>
    );
  };

  const homeSummary = `${formatCurrencyShort(inputs.homePrice)} home • ${(inputs.homeAppreciation * 100).toFixed(1)}% appreciation`;
  const mortgageSummary = `${(inputs.downPaymentPercent * 100).toFixed(0)}% down • ${(inputs.mortgageRate * 100).toFixed(1)}% rate • ${inputs.mortgageTerm} years`;
  const investSummary = `${(inputs.stockReturn * 100).toFixed(1)}% stock • ${(inputs.savingsRate * 100).toFixed(1)}% savings`;
  const sellingSummary = `${formatCurrencyShort(inputs.investmentPortfolioValue)} portfolio • ${formatCurrencyShort(inputs.investmentCostBasis)} basis • ${(inputs.capitalGainsRate * 100).toFixed(0)}% tax`;

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        <h2 className="card-title" style={{ fontSize: '1rem', margin: 0 }}>Advanced Assumptions</h2>
      </div>

      {/* Home Assumptions */}
      <FormSection title="Home Assumptions">
        {renderInput('homePrice', 'Home Price', 'number', 50000, 1500000, 10000, false, true)}
        {renderInput('cashPurchaseDiscount', 'Cash Discount', 'number', 0, 200000, 5000, false, true)}
        {renderInput('homeAppreciation', 'Annual Appreciation', 'number', 0.0, 0.15, 0.001, true)}
        {renderInput('propertyTaxRate', 'Property Tax Rate', 'number', 0.0, 0.05, 0.001, true)}
        {renderInput('insuranceRate', 'Insurance Rate', 'number', 0.0, 0.03, 0.001, true)}
      </FormSection>

      {/* Mortgage Assumptions */}
      <FormSection title="Mortgage Assumptions">
        {renderInput('downPaymentPercent', 'Down Payment %', 'number', 0.0, 1.0, 0.01, true)}
        {renderInput('mortgageTerm', 'Mortgage Term (Years)', 'number', 0, 30, 1)}
        {renderInput('mortgageRate', 'Mortgage Rate', 'number', 0.0, 0.15, 0.001, true)}
      </FormSection>

      {/* Investment Assumptions */}
      <FormSection title="Investment Assumptions">
        {renderInput('stockReturn', 'Stock Market Return', 'number', 0.0, 0.20, 0.001, true)}
        {renderInput('savingsRate', 'Savings Account Rate', 'number', 0.0, 0.10, 0.001, true)}
      </FormSection>

      {/* Selling Investments Assumptions */}
      <FormSection title="Selling Investments to Buy" isLast>
        {renderInput('investmentPortfolioValue', 'Portfolio Value', 'number', 50000, 2000000, 10000, false, true)}
        {renderInput('investmentCostBasis', 'Portfolio Cost Basis', 'number', 50000, 2000000, 10000, false, true)}
        {renderInput('capitalGainsRate', 'Capital Gains Tax Rate', 'number', 0.0, 0.50, 0.01, true)}
      </FormSection>
    </div>
  );
}

function FormSection({ title, children, isLast }) {
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
      <div style={{ padding: '0.2rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.15rem' }}>
        {children}
      </div>
    </div>
  );
}
