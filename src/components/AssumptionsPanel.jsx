import React, { useState, useEffect, useRef } from 'react';

const PERCENT_FIELDS = [
  'homeAppreciation',
  'downPaymentPercent',
  'mortgageRate',
  'stockReturn',
  'savingsRate',
  'capitalGainsRate',
  'taxablePortion',
  'propertyTaxRate',
  'insuranceRate'
];

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
        // Format to string, preserving a standard decimal place for percents
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
    // Strip leading zeros unless followed by decimal point
    let sanitized = valueString.replace(/^0+(?=\d)/, '');
    
    const isPercent = PERCENT_FIELDS.includes(key);
    
    // Clamp percentage inputs to a maximum of 100%, and mortgage term to [0, 30]
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

    // Update local string state immediately to let user type freely
    setLocalValues((prev) => ({
      ...prev,
      [key]: sanitized
    }));

    // Propagate parsed numeric value to parent for instant calculations
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
    // Format to a clean standardized decimal string on blur
    const displayVal = isPercent ? (rawVal * 100).toFixed(1) : rawVal.toString();
    
    setLocalValues((prev) => ({
      ...prev,
      [key]: displayVal
    }));
  };

  const renderInput = (key, label, type, min, max, step, isPercent = false, isCurrency = false) => {
    const valString = localValues[key] ?? '';

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
          
          {renderInput('mortgageTerm', 'Mortgage Term (Years)', 'number', 0, 30, 1)}

          {renderInput('mortgageRate', 'Mortgage Rate', 'number', 0.0, 0.15, 0.001, true)}
        </div>

        <div className="assumptions-group" style={{ marginTop: '1.5rem' }}>
          <div className="assumptions-group-title">Investments & Savings</div>
          {renderInput('stockReturn', 'Stock Market Return', 'number', 0.0, 0.20, 0.001, true)}
          {renderInput('savingsRate', 'Savings Account Rate', 'number', 0.0, 0.10, 0.001, true)}
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
