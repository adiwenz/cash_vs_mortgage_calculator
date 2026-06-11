import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  calculateSimpleScenarios,
  validateSimpleInputs
} from '../calculations';

const PERCENT_FIELDS = [
  'homeAppreciation',
  'downPaymentPercent',
  'mortgageRate',
  'stockReturn',
  'savingsRate'
];

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

export default function SimpleCalculator() {
  // Simple inputs state
  const [inputs, setInputs] = useState({
    homePrice: 500000,
    homeAppreciation: 0.03,
    downPaymentPercent: 0.20,
    mortgageRate: 0.065,
    mortgageTerm: 30,
    stockReturn: 0.08,
    savingsRate: 0.04,
    cashPurchaseDiscount: 50000
  });

  // Destinations choices
  const [mortgageLeftoverDest, setMortgageLeftoverDest] = useState('invest'); // 'invest' | 'savings'
  const [cashSavingsDest, setCashSavingsDest] = useState('invest'); // 'invest' | 'savings' | 'none'

  // Selected year for summary cards
  const [selectedYear, setSelectedYear] = useState(30);

  // Active chart metric
  const [chartMetric, setChartMetric] = useState('netWorth'); // 'netWorth' | 'homeEquity' | 'investment' | 'mortgageBalance'

  // Input validation
  const errors = useMemo(() => {
    return validateSimpleInputs(inputs);
  }, [inputs]);

  // Calculations
  const calcResults = useMemo(() => {
    if (errors.length > 0) return null;
    return calculateSimpleScenarios(inputs, mortgageLeftoverDest, cashSavingsDest);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest, errors]);

  // Local state for string input values
  const [localValues, setLocalValues] = useState({});
  const activeFieldRef = useRef(null);

  // Sync inputs to local values
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

  const handleInputChange = (key, valueString) => {
    let sanitized = valueString.replace(/^0+(?=\d)/, '');
    const isPercent = PERCENT_FIELDS.includes(key);

    if (sanitized !== '' && sanitized !== '.') {
      const parsedVal = parseFloat(sanitized);
      if (!isNaN(parsedVal)) {
        if (isPercent && parsedVal > 100) {
          sanitized = '100';
        } else if (key === 'mortgageTerm') {
          if (parsedVal > 30) sanitized = '30';
          if (parsedVal < 0) sanitized = '0';
        }
      }
    }

    setLocalValues((prev) => ({ ...prev, [key]: sanitized }));

    if (sanitized === '' || sanitized === '.') {
      setInputs((prev) => ({ ...prev, [key]: 0 }));
    } else {
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) {
        setInputs((prev) => ({ ...prev, [key]: isPercent ? parsed / 100 : parsed }));
      }
    }
  };

  const handleBlur = (key) => {
    activeFieldRef.current = null;
    const rawVal = inputs[key];
    const isPercent = PERCENT_FIELDS.includes(key);
    const displayVal = isPercent ? (rawVal * 100).toFixed(1) : rawVal.toString();
    setLocalValues((prev) => ({ ...prev, [key]: displayVal }));
  };

  const renderSimpleInput = (key, label, isPercent = false, isCurrency = false, step = 1) => {
    const valString = localValues[key] ?? '';
    return (
      <div className="input-wrapper" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            {isCurrency && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: '600' }}>$</span>}
            <input
              type="number"
              className="input-number-box"
              style={{ width: '105px', fontSize: '0.85rem', padding: '0.3rem 0.5rem', height: 'auto' }}
              value={valString}
              step={isPercent ? step * 100 : step}
              onFocus={() => { activeFieldRef.current = key; }}
              onChange={(e) => handleInputChange(key, e.target.value)}
              onBlur={() => handleBlur(key)}
            />
            {isPercent && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: '600' }}>%</span>}
          </div>
        </div>
      </div>
    );
  };

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!calcResults) return [];
    return calcResults.data.map((row) => {
      const formatted = { year: row.year };
      if (chartMetric === 'netWorth') {
        formatted['Cash Buyer NW'] = Math.round(row.cashBuyerNW);
        formatted['Mortgage Buyer NW'] = Math.round(row.mortgageBuyerNW);
      } else if (chartMetric === 'homeEquity') {
        formatted['Cash Buyer Equity'] = Math.round(row.homeValue);
        formatted['Mortgage Buyer Equity'] = Math.round(row.mortgageEquity);
      } else if (chartMetric === 'investment') {
        formatted['Cash Buyer Investments'] = Math.round(row.cashBuyerStock);
        formatted['Mortgage Buyer Investments'] = Math.round(row.mortgageBuyerStock);
      } else if (chartMetric === 'mortgageBalance') {
        formatted['Cash Buyer Loan'] = 0;
        formatted['Mortgage Buyer Loan'] = Math.round(row.mortgageBalance);
      }
      return formatted;
    });
  }, [calcResults, chartMetric]);

  // Line keys for charts
  const lineKeys = useMemo(() => {
    if (chartMetric === 'netWorth') {
      return [
        { key: 'Cash Buyer NW', color: '#6366f1' },
        { key: 'Mortgage Buyer NW', color: '#10b981' }
      ];
    } else if (chartMetric === 'homeEquity') {
      return [
        { key: 'Cash Buyer Equity', color: '#6366f1' },
        { key: 'Mortgage Buyer Equity', color: '#10b981' }
      ];
    } else if (chartMetric === 'investment') {
      return [
        { key: 'Cash Buyer Investments', color: '#6366f1' },
        { key: 'Mortgage Buyer Investments', color: '#10b981' }
      ];
    } else if (chartMetric === 'mortgageBalance') {
      return [
        { key: 'Cash Buyer Loan', color: '#6366f1' },
        { key: 'Mortgage Buyer Loan', color: '#10b981' }
      ];
    }
    return [];
  }, [chartMetric]);

  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <p style={{ fontWeight: '700', marginBottom: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>
            Year {label}
          </p>
          {payload.map((item) => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.15rem 0' }}>
              <span style={{ color: item.stroke || item.color, fontWeight: '600' }}>{item.name}:</span>
              <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get data at selected year
  const selectedYearData = useMemo(() => {
    if (!calcResults) return null;
    return calcResults.data.find((row) => row.year === selectedYear) || calcResults.data[30];
  }, [calcResults, selectedYear]);

  return (
    <div className="dashboard-grid">
      {/* Left Column: Input Panel */}
      <div className="assumptions-section">
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="card-title">Simple Assumptions</h2>
          
          <div className="assumptions-group">
            <div className="assumptions-group-title">Home</div>
            {renderSimpleInput('homePrice', 'Home Price', false, true, 10000)}
            {renderSimpleInput('cashPurchaseDiscount', 'Cash Purchase Discount', false, true, 5000)}
            {renderSimpleInput('homeAppreciation', 'Annual Appreciation', true, false, 0.005)}
          </div>

          <div className="assumptions-group">
            <div className="assumptions-group-title">Mortgage</div>
            {renderSimpleInput('downPaymentPercent', 'Down Payment %', true, false, 0.05)}
            {renderSimpleInput('mortgageRate', 'Mortgage Rate', true, false, 0.005)}
            {renderSimpleInput('mortgageTerm', 'Term (Years)', false, false, 1)}
          </div>

          <div className="assumptions-group">
            <div className="assumptions-group-title">Investing</div>
            {renderSimpleInput('stockReturn', 'Stock Market Return', true, false, 0.005)}
            {renderSimpleInput('savingsRate', 'Savings Account Rate', true, false, 0.005)}
          </div>

          {/* Optional Buying Decisions */}
          <div className="assumptions-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)' }}>
              Buying Decisions
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Mortgage Buyer remaining cash goes to:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { val: 'invest', label: '📈 Stocks' },
                  { val: 'savings', label: '🏦 Savings' }
                ].map((item) => (
                  <label
                    key={item.val}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      padding: '0.3rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: mortgageLeftoverDest === item.val ? 'var(--primary-light)' : 'transparent',
                      borderColor: mortgageLeftoverDest === item.val ? 'var(--primary)' : 'var(--border-color)',
                      color: mortgageLeftoverDest === item.val ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <input
                      type="radio"
                      name="simpleMortgageLeftoverDest"
                      value={item.val}
                      checked={mortgageLeftoverDest === item.val}
                      onChange={() => setMortgageLeftoverDest(item.val)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Cash Buyer avoided mortgage payments go to:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { val: 'invest', label: '📈 Stocks' },
                  { val: 'savings', label: '🏦 Savings' },
                  { val: 'none', label: '💵 Do not invest' }
                ].map((item) => (
                  <label
                    key={item.val}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      padding: '0.3rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: cashSavingsDest === item.val ? 'var(--primary-light)' : 'transparent',
                      borderColor: cashSavingsDest === item.val ? 'var(--primary)' : 'var(--border-color)',
                      color: cashSavingsDest === item.val ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <input
                      type="radio"
                      name="simpleCashSavingsDest"
                      value={item.val}
                      checked={cashSavingsDest === item.val}
                      onChange={() => setCashSavingsDest(item.val)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Visualizations & Summary */}
      <div className="results-display">
        {errors.length > 0 ? (
          <div 
            className="glass-card" 
            style={{ 
              borderLeft: '4px solid var(--accent-rose)', 
              background: 'rgba(244, 63, 94, 0.05)', 
              padding: '1.25rem 1.5rem', 
              color: 'var(--accent-rose)'
            }}
          >
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              ❌ Fix Your Assumptions
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {/* Year Selector & Summary Cards Header */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Yearly Milestone Estimates</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Drag the slider to see values for any specific year</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Show Year:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary)', minWidth: '24px', textAlign: 'center' }}>{selectedYear}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-tertiary)' }}>Year 0</span>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="custom-range"
                />
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-tertiary)' }}>Year 30</span>
              </div>

              {/* Side-by-side Summary Cards */}
              {selectedYearData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Cash Buyer Card */}
                  <div style={{ background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.15)', paddingBottom: '0.4rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#6366f1' }}>Cash Buyer</span>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '0.15rem 0.4rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '4px', color: '#6366f1', fontWeight: '700' }}>No Loan</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Worth:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.cashBuyerNW)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Home Value:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.homeValue)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Investment Account:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.cashBuyerStock)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mortgage Buyer Card */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.15)', paddingBottom: '0.4rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981' }}>Mortgage Buyer</span>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '0.15rem 0.4rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', color: '#10b981', fontWeight: '700' }}>Leveraged</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Worth:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.mortgageBuyerNW)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Home Equity:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.mortgageEquity)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Investment Account:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.mortgageBuyerStock)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mortgage Balance:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.mortgageBalance)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Visual Chart */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Growth Charts</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Compare both strategies visualised over 30 years</span>
                </div>
                
                {/* Metric toggles */}
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.2rem', borderRadius: '8px', gap: '0.2rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 'netWorth', label: 'Net Worth' },
                    { val: 'homeEquity', label: 'Home Equity' },
                    { val: 'investment', label: 'Investments' },
                    { val: 'mortgageBalance', label: 'Loan Balance' }
                  ].map((m) => (
                    <button
                      key={m.val}
                      onClick={() => setChartMetric(m.val)}
                      style={{
                        background: chartMetric === m.val ? 'var(--primary)' : 'transparent',
                        color: chartMetric === m.val ? '#ffffff' : 'var(--text-secondary)',
                        border: 'none',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chart-container-inner" style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="year"
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend />
                    {lineKeys.map((lk) => (
                      <Line
                        key={lk.key}
                        type="monotone"
                        dataKey={lk.key}
                        stroke={lk.color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Educational Callouts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.1)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ⏳ Opportunity Cost
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Money used to buy a house cannot be invested elsewhere. Paying cash saves on mortgage interest, but means missing out on stock market growth.
                </p>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ⚙️ Leverage
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  A mortgage allows you to control a large asset (the house) with a smaller upfront investment, freeing up remaining cash to build wealth in stocks.
                </p>
              </div>

              <div style={{ background: 'rgba(14, 165, 233, 0.03)', border: '1px solid rgba(14, 165, 233, 0.1)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  📈 Why Mortgage Wins
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  The mortgage buyer may end up with a higher net worth if long-term stock market returns exceed the mortgage interest rate cost.
                </p>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  🛡️ Why Cash Wins
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  The cash buyer avoids paying substantial interest over 30 years, has no monthly payment obligations, and enjoys immediate 100% home equity.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
