import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  calculateSimpleScenarios,
  validateSimpleInputs,
  getNumParam,
  getStrParam
} from '../../calculations';

const DEFAULT_INPUTS = {
  homePrice: 500000,
  homeAppreciation: 0.03,
  downPaymentPercent: 0.20,
  mortgageRate: 0.065,
  mortgageTerm: 30,
  stockReturn: 0.08,
  savingsRate: 0.04,
  cashPurchaseDiscount: 50000
};

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
  const [colorBlindMode, setColorBlindMode] = useState(false);
  // Simple inputs state
  const [inputs, setInputs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool !== 'simple') return DEFAULT_INPUTS;

    return {
      homePrice: getNumParam(params, 'homePrice', DEFAULT_INPUTS.homePrice),
      homeAppreciation: getNumParam(params, 'homeAppreciation', DEFAULT_INPUTS.homeAppreciation),
      downPaymentPercent: getNumParam(params, 'downPaymentPercent', DEFAULT_INPUTS.downPaymentPercent),
      mortgageRate: getNumParam(params, 'mortgageRate', DEFAULT_INPUTS.mortgageRate),
      mortgageTerm: getNumParam(params, 'mortgageTerm', DEFAULT_INPUTS.mortgageTerm),
      stockReturn: getNumParam(params, 'stockReturn', DEFAULT_INPUTS.stockReturn),
      savingsRate: getNumParam(params, 'savingsRate', DEFAULT_INPUTS.savingsRate),
      cashPurchaseDiscount: getNumParam(params, 'cashPurchaseDiscount', DEFAULT_INPUTS.cashPurchaseDiscount)
    };
  });

  // Destinations choices
  const [mortgageLeftoverDest, setMortgageLeftoverDest] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tool') === 'simple' ? getStrParam(params, 'mortgageLeftoverDest', 'invest') : 'invest';
  });

  const [cashSavingsDest, setCashSavingsDest] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tool') === 'simple' ? getStrParam(params, 'cashSavingsDest', 'invest') : 'invest';
  });

  // Selected year for summary cards
  const [selectedYear, setSelectedYear] = useState(30);

  // Active chart metric
  const [chartMetric, setChartMetric] = useState('netWorth'); // 'netWorth' | 'homeEquity' | 'investment' | 'mortgageBalance'

  // Zoom range state
  const [zoomRange, setZoomRange] = useState(30); // 5 | 10 | 15 | 30

  // Real-time URL synchronization
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool !== 'simple') return;

    Object.keys(inputs).forEach((key) => {
      if (inputs[key] !== DEFAULT_INPUTS[key]) {
        params.set(key, inputs[key]);
      } else {
        params.delete(key);
      }
    });
    if (mortgageLeftoverDest !== 'invest') {
      params.set('mortgageLeftoverDest', mortgageLeftoverDest);
    } else {
      params.delete('mortgageLeftoverDest');
    }
    if (cashSavingsDest !== 'invest') {
      params.set('cashSavingsDest', cashSavingsDest);
    } else {
      params.delete('cashSavingsDest');
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest]);

  // Input validation
  const errors = useMemo(() => {
    return validateSimpleInputs(inputs);
  }, [inputs]);

  // Calculations
  const calcResults = useMemo(() => {
    if (errors.length > 0) return null;
    return calculateSimpleScenarios(inputs, mortgageLeftoverDest, cashSavingsDest);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest, errors]);

  const simpleBaselineResults = useMemo(() => {
    if (errors.length > 0) return null;
    return calculateSimpleScenarios(inputs, 'invest', 'invest');
  }, [inputs, errors]);

  const yAxisMax = useMemo(() => {
    if (!simpleBaselineResults) return 'auto';
    const zoomedBaseline = simpleBaselineResults.data.slice(0, zoomRange + 1);
    if (chartMetric === 'netWorth') {
      let maxVal = 0;
      zoomedBaseline.forEach((row) => {
        if (row.cashBuyerNW > maxVal) maxVal = row.cashBuyerNW;
        if (row.mortgageBuyerNW > maxVal) maxVal = row.mortgageBuyerNW;
      });
      return Math.ceil(maxVal * 1.05);
    } else if (chartMetric === 'investment') {
      let maxVal = 0;
      zoomedBaseline.forEach((row) => {
        if (row.cashBuyerStock > maxVal) maxVal = row.cashBuyerStock;
        if (row.mortgageBuyerStock > maxVal) maxVal = row.mortgageBuyerStock;
      });
      return Math.ceil(maxVal * 1.05);
    } else if (chartMetric === 'homeEquity') {
      let maxVal = 0;
      zoomedBaseline.forEach((row) => {
        if (row.homeValue > maxVal) maxVal = row.homeValue;
      });
      return Math.ceil(maxVal * 1.05);
    } else if (chartMetric === 'mortgageBalance') {
      return Math.ceil((calcResults?.loanAmount || 0) * 1.05) || 'auto';
    }
    return 'auto';
  }, [simpleBaselineResults, chartMetric, calcResults, zoomRange]);

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
        } else if (key === 'cashPurchaseDiscount') {
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

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setMortgageLeftoverDest('invest');
    setCashSavingsDest('invest');
  };

  const renderSimpleInput = (key, label, isPercent = false, isCurrency = false, step = 1, tooltipText = null) => {
    const valString = localValues[key] ?? '';
    return (
      <div className="input-wrapper" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
            {label}{' '}
            {tooltipText && (
              <span className="tooltip-trigger" data-tooltip={tooltipText}>ⓘ</span>
            )}
          </span>
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
    const sliced = calcResults.data.slice(0, zoomRange + 1);
    return sliced.map((row) => {
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
  }, [calcResults, chartMetric, zoomRange]);

  // Line keys for charts
  const lineKeys = useMemo(() => {
    const getColors = (isCash) => {
      if (colorBlindMode) {
        return isCash ? '#2563eb' : '#ea580c';
      }
      return isCash ? '#0d9488' : '#f59e0b';
    };

    if (chartMetric === 'netWorth') {
      return [
        { key: 'Cash Buyer NW', color: getColors(true) },
        { key: 'Mortgage Buyer NW', color: getColors(false) }
      ];
    } else if (chartMetric === 'homeEquity') {
      return [
        { key: 'Cash Buyer Equity', color: getColors(true) },
        { key: 'Mortgage Buyer Equity', color: getColors(false) }
      ];
    } else if (chartMetric === 'investment') {
      return [
        { key: 'Cash Buyer Investments', color: getColors(true) },
        { key: 'Mortgage Buyer Investments', color: getColors(false) }
      ];
    } else if (chartMetric === 'mortgageBalance') {
      return [
        { key: 'Cash Buyer Loan', color: getColors(true) },
        { key: 'Mortgage Buyer Loan', color: getColors(false) }
      ];
    }
    return [];
  }, [chartMetric, colorBlindMode]);

  const intersectionYear = useMemo(() => {
    if (!chartData || chartData.length < 2 || lineKeys.length < 2) return null;
    const key1 = lineKeys[0].key;
    const key2 = lineKeys[1].key;
    
    for (let i = 0; i < chartData.length - 1; i++) {
      const rowA = chartData[i];
      const rowB = chartData[i + 1];
      
      const valA1 = rowA[key1];
      const valA2 = rowA[key2];
      const valB1 = rowB[key1];
      const valB2 = rowB[key2];
      
      const diffA = valA1 - valA2;
      const diffB = valB1 - valB2;
      
      if (diffA === 0) return rowA.year;
      if (diffB === 0) return rowB.year;
      
      if (diffA * diffB < 0) {
        const t = diffA / (diffA - diffB);
        const crossYear = rowA.year + t * (rowB.year - rowA.year);
        return parseFloat(crossYear.toFixed(1));
      }
    }
    return null;
  }, [chartData, lineKeys]);

  // Get data at selected year
  const selectedYearData = useMemo(() => {
    if (!calcResults) return null;
    return calcResults.data.find((row) => row.year === selectedYear) || calcResults.data[30];
  }, [calcResults, selectedYear]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="dashboard-grid">
      {/* Left Column: Input Panel - visible on wide screens only */}
      <div className="assumptions-section assumptions-desktop-only">
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Simple Assumptions</h2>
            <button
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Reset to defaults
            </button>
          </div>
          
          <div className="assumptions-group">
            <div className="assumptions-group-title">Home</div>
            {renderSimpleInput('homePrice', 'Home Price', false, true, 10000)}
            {renderSimpleInput('cashPurchaseDiscount', 'Cash Discount Negotiated', false, true, 5000, "Cash buyers often negotiate 5-15% below list. Enter $0 if none.")}
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

      {/* Edit Assumptions Button - visible on medium/small screens only */}
      <button
        className="edit-assumptions-btn"
        onClick={() => setIsModalOpen(true)}
      >
        ⚙️ Edit Assumptions
      </button>

      {/* Assumptions Modal - centered overlay */}
      {isModalOpen && (
        <>
          <div className="simple-modal-overlay" onClick={() => setIsModalOpen(false)} />
          <div className="simple-modal">
            <div className="simple-modal-content glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Simple Assumptions</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    onClick={handleReset}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      lineHeight: 1,
                      padding: '0 0.25rem'
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>
              
              <div className="assumptions-group">
                <div className="assumptions-group-title">Home</div>
                {renderSimpleInput('homePrice', 'Home Price', false, true, 10000)}
                {renderSimpleInput('cashPurchaseDiscount', 'Cash Discount Negotiated', false, true, 5000, "Cash buyers often negotiate 5-15% below list. Enter $0 if none.")}
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

              {/* Buying Decisions in Modal */}
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
                          background: mortgageLeftoverDest === item.val ? 'var(--primary-light)' : 'transparent',
                          borderColor: mortgageLeftoverDest === item.val ? 'var(--primary)' : 'var(--border-color)',
                          color: mortgageLeftoverDest === item.val ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                      >
                        <input
                          type="radio"
                          name="modalMortgageLeftoverDest"
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
                          name="modalCashSavingsDest"
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

              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  alignSelf: 'center',
                  marginTop: '0.25rem',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

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
            {/* Interactive Visual Chart */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flex: 1 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Growth Charts</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Compare both strategies visualised over 30 years</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        <input
                          type="checkbox"
                          checked={colorBlindMode}
                          onChange={(e) => setColorBlindMode(e.target.checked)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        👁️ Color-blind Mode
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.25rem', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>Zoom:</span>
                        {[5, 10, 15, 30].map((years) => (
                          <button
                            key={years}
                            onClick={() => setZoomRange(years)}
                            style={{
                              background: zoomRange === years ? 'var(--primary)' : 'transparent',
                              color: zoomRange === years ? '#ffffff' : 'var(--text-secondary)',
                              border: 'none',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            {years === 30 ? 'All (30y)' : `${years}y`}
                          </button>
                        ))}
                      </div>
                    </div>
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
                    onClick={(state) => {
                      if (state && state.activeLabel !== undefined) {
                        setSelectedYear(Number(state.activeLabel));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                        type="number"
                        dataKey="year"
                        domain={[0, zoomRange]}
                        ticks={
                          zoomRange === 5 ? [0, 1, 2, 3, 4, 5] :
                          zoomRange === 10 ? [0, 2, 4, 6, 8, 10] :
                          zoomRange === 15 ? [0, 3, 6, 9, 12, 15] :
                          [0, 5, 10, 15, 20, 25, 30]
                        }
                        stroke="var(--text-tertiary)"
                        fontFamily="var(--font-body)"
                        fontSize={11}
                      />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                      domain={[0, yAxisMax]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
                          return (
                            <div className="custom-chart-tooltip">
                              <p style={{ fontWeight: '700', marginBottom: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>
                                Year {label}
                              </p>
                              {sortedPayload.map((item) => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.15rem 0' }}>
                                  <span style={{ color: item.stroke || item.color, fontWeight: '600' }}>{item.name}:</span>
                                  <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    {intersectionYear !== null && intersectionYear <= zoomRange && (
                        <ReferenceLine
                          x={intersectionYear}
                          stroke="var(--text-secondary)"
                          strokeDasharray="5 5 1 5"
                          strokeWidth={1.5}
                          label={{
                            value: `Break-even: Yr ${intersectionYear}`,
                            position: 'insideTopRight',
                            fill: 'var(--text-primary)',
                            fontSize: 10,
                            fontWeight: '700',
                            dy: 8,
                            dx: 4
                          }}
                        />
                      )}
                      {selectedYear <= zoomRange && (
                        <ReferenceLine
                          x={selectedYear}
                          stroke="var(--primary)"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          label={{
                            value: `Selected: Yr ${selectedYear}`,
                            position: 'insideBottomRight',
                            fill: 'var(--primary)',
                            fontSize: 10,
                            fontWeight: '700',
                            dy: -14,
                            dx: 4
                          }}
                        />
                      )}
                      {lineKeys.map((lk) => {
                        return (
                          <Line
                            key={lk.key}
                            type="monotone"
                            dataKey={lk.key}
                            stroke={lk.color}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        );
                      })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Year Selector & Summary Cards Header */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Yearly Milestone Estimates</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Click on any year in the graph above to view milestone values</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Show Year:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary)', minWidth: '24px', textAlign: 'center' }}>{selectedYear}</span>
                </div>
              </div>
              
              {selectedYearData && (() => {
                const cashNW = selectedYearData.cashBuyerNW;
                const mortNW = selectedYearData.mortgageBuyerNW;
                
                const cashColor = colorBlindMode ? '#2563eb' : '#0d9488';
                const mortgageColor = colorBlindMode ? '#ea580c' : '#f59e0b';

                const cashBg = colorBlindMode ? 'rgba(37, 99, 235, 0.04)' : 'rgba(13, 148, 136, 0.04)';
                const cashBorder = colorBlindMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(13, 148, 136, 0.15)';
                const cashBorderTop = colorBlindMode ? 'rgba(37, 99, 235, 0.12)' : 'rgba(13, 148, 136, 0.12)';
                const cashBadgeBg = colorBlindMode ? 'rgba(37, 99, 235, 0.1)' : 'rgba(13, 148, 136, 0.1)';

                const mortgageBg = colorBlindMode ? 'rgba(234, 88, 12, 0.04)' : 'rgba(245, 158, 11, 0.04)';
                const mortgageBorder = colorBlindMode ? 'rgba(234, 88, 12, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                const mortgageBorderTop = colorBlindMode ? 'rgba(234, 88, 12, 0.12)' : 'rgba(245, 158, 11, 0.12)';
                const mortgageBadgeBg = colorBlindMode ? 'rgba(234, 88, 12, 0.1)' : 'rgba(245, 158, 11, 0.1)';

                const diff = Math.abs(cashNW - mortNW);
                const cashWins = cashNW > mortNW;
                const tied = cashNW === mortNW;
                const winnerLabel = cashWins ? 'Cash Buyer' : 'Mortgage Buyer';
                const winnerColor = cashWins ? cashColor : mortgageColor;
                const winnerBg = cashWins 
                  ? (colorBlindMode ? 'rgba(37, 99, 235, 0.08)' : 'rgba(13, 148, 136, 0.08)') 
                  : (colorBlindMode ? 'rgba(234, 88, 12, 0.08)' : 'rgba(245, 158, 11, 0.08)');
                const winnerBorder = cashWins 
                  ? (colorBlindMode ? 'rgba(37, 99, 235, 0.25)' : 'rgba(13, 148, 136, 0.25)') 
                  : (colorBlindMode ? 'rgba(234, 88, 12, 0.25)' : 'rgba(245, 158, 11, 0.25)');

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
                      {/* Cash Buyer Card */}
                      <div style={{ background: cashBg, border: `1px solid ${cashBorder}`, borderRadius: '10px', padding: '1rem' }}>
                        <div style={{ borderBottom: `1px solid ${cashBorder}`, paddingBottom: '0.4rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: cashColor }}>Cash Buyer</span>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '0.15rem 0.4rem', background: cashBadgeBg, borderRadius: '4px', color: cashColor, fontWeight: '700' }}>No Loan</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Home Value:</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.homeValue)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Investment Account:</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.cashBuyerStock)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${cashBorderTop}`, paddingTop: '0.5rem', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Net Worth:</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: cashColor }}>{formatCurrency(cashNW)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mortgage Buyer Card */}
                      <div style={{ background: mortgageBg, border: `1px solid ${mortgageBorder}`, borderRadius: '10px', padding: '1rem' }}>
                        <div style={{ borderBottom: `1px solid ${mortgageBorder}`, paddingBottom: '0.4rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: mortgageColor }}>Mortgage Buyer</span>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '0.15rem 0.4rem', background: mortgageBadgeBg, borderRadius: '4px', color: mortgageColor, fontWeight: '700' }}>Leveraged</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${mortgageBorderTop}`, paddingTop: '0.5rem', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Net Worth:</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: mortgageColor }}>{formatCurrency(mortNW)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Winner Callout */}
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: tied ? 'rgba(100, 116, 139, 0.08)' : winnerBg,
                      border: `1px solid ${tied ? 'rgba(100, 116, 139, 0.2)' : winnerBorder}`,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>{tied ? '🤝' : '🏆'}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {tied ? (
                          <><strong>It's a tie!</strong> Both buyers have the same net worth at Year {selectedYear}.</>
                        ) : (
                          <>At Year {selectedYear}, the <strong style={{ color: winnerColor }}>{winnerLabel}</strong> comes out ahead by <strong>{formatCurrency(diff)}</strong>.</>
                        )}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Educational Callouts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
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
                  The cash buyer avoids paying substantial interest over 30 years, has no monthly payment obligations, and enjoys immediate 100% home equity. Cash buyers also have higher negotiating power, which can secure a purchase discount.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
