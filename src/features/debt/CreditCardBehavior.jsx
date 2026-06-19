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
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  LabelList
} from 'recharts';
import './CreditCardBehavior.css';

import { 
  DEFAULT_CC_INPUTS as DEFAULT_INPUTS,
  BEHAVIOR_METADATA,
  EDUCATIONAL_EXPLANATIONS,
  EDUCATIONAL_TAKEAWAYS,
  BEHAVIOR_KEYS
} from '../../domain/debt/debtConstants.js';
import { 
  classifyBehavior, 
  getBehaviorDefaults 
} from '../../domain/debt/creditCardStates.js';
import { 
  calculateAmortizedPayment,
  calculatePayoffTimeline,
  getYAxisBoundsAt36
} from '../../domain/debt/debtProjection.js';
import { 
  formatPayoffText,
  formatPayoffSummary as formatPayoffSummaryDomain,
  getScenarioStatus as getScenarioStatusDomain,
  getEducationalInsights
} from '../../domain/debt/debtRecommendations.js';

// Utility to retrieve numerical URL params safely
function getNumParam(params, key, fallback) {
  const val = params.get(key);
  if (val === null || val === '') return fallback;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}

// Formats number to currency USD
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// Formats Y-axis labels for Recharts
const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

export default function CreditCardBehavior() {
  const [inputs, setInputs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool !== 'creditcard') return DEFAULT_INPUTS;

    return {
      balance: getNumParam(params, 'balance', DEFAULT_INPUTS.balance),
      apr: getNumParam(params, 'apr', DEFAULT_INPUTS.apr),
      monthlyPayment: getNumParam(params, 'monthlyPayment', DEFAULT_INPUTS.monthlyPayment),
      monthlyNewDebt: getNumParam(params, 'monthlyNewDebt', DEFAULT_INPUTS.monthlyNewDebt),
      extraPayment: getNumParam(params, 'extraPayment', DEFAULT_INPUTS.extraPayment),
      startingCash: getNumParam(params, 'startingCash', DEFAULT_INPUTS.startingCash)
    };
  });

  const [activeBehavior, setActiveBehavior] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const behavior = params.get('behavior');
    if (behavior === 'payInFull') return BEHAVIOR_KEYS.PAYOFF_IN_FULL;
    return behavior || BEHAVIOR_KEYS.CARRY_BALANCE;
  });

  const [isManualOverride, setIsManualOverride] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hasInputs = params.has('monthlyPayment') || params.has('monthlyNewDebt');
    return hasInputs;
  });

  const [compareMode, setCompareMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compare') === 'true';
  });

  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [activeTab, setActiveTab] = useState('drag'); // 'drag' | 'balance' | 'payoff'
  const [hoveredBar, setHoveredBar] = useState(null);

  // Sync inputs with URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tool') !== 'creditcard') return;

    Object.keys(inputs).forEach((key) => {
      if (inputs[key] !== DEFAULT_INPUTS[key]) {
        params.set(key, inputs[key]);
      } else {
        params.delete(key);
      }
    });

    if (activeBehavior !== BEHAVIOR_KEYS.CARRY_BALANCE) {
      params.set('behavior', activeBehavior);
    } else {
      params.delete('behavior');
    }

    if (compareMode) {
      params.set('compare', 'true');
    } else {
      params.delete('compare');
    }

    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [inputs, activeBehavior, compareMode]);



  // Handle local state text input editing to allow typing decimals without immediate jumping
  const [localValues, setLocalValues] = useState({});
  const activeFieldRef = useRef(null);

  useEffect(() => {
    const nextLocals = { ...localValues };
    let changed = false;

    Object.keys(inputs).forEach((key) => {
      if (activeFieldRef.current !== key) {
        const displayVal = inputs[key].toString();
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
    if (sanitized !== '' && sanitized !== '.') {
      const parsedVal = parseFloat(sanitized);
      if (!isNaN(parsedVal)) {
        if (key === 'apr' && parsedVal > 36) sanitized = '36';
        if (parsedVal < 0) sanitized = '0';
      }
    }

    setLocalValues((prev) => ({ ...prev, [key]: sanitized }));

    let numericVal = 0;
    if (sanitized !== '' && sanitized !== '.') {
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) {
        numericVal = parsed;
      }
    }

    setInputs((prev) => {
      const next = { ...prev, [key]: numericVal };

      // Sync monthly payment and spending when balance/APR changes and user hasn't manually overridden them
      if ((key === 'balance' || key === 'apr') && !isManualOverride) {
        const defaults = getBehaviorDefaults(activeBehavior, next.balance, next.apr, next.monthlyPayment);
        next.monthlyPayment = defaults.payment;
        next.monthlyNewDebt = defaults.spending;
      }

      return next;
    });

    // If manually changing payment or spending, set manual override and reclassify behavior
    if (key === 'monthlyPayment' || key === 'monthlyNewDebt') {
      setIsManualOverride(true);
      setInputs((currentInputs) => {
        const classified = classifyBehavior(
          currentInputs.balance,
          currentInputs.apr,
          currentInputs.monthlyPayment,
          currentInputs.monthlyNewDebt
        );
        setActiveBehavior(classified);
        return currentInputs;
      });
    }
  };

  const handleBlur = (key) => {
    activeFieldRef.current = null;
    const rawVal = inputs[key];
    const displayVal = rawVal.toString();
    setLocalValues((prev) => ({ ...prev, [key]: displayVal }));
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setActiveBehavior(BEHAVIOR_KEYS.CARRY_BALANCE);
    setIsManualOverride(false);
    setCompareMode(false);
  };

  const handleBehaviorCardClick = (behaviorKey) => {
    setIsManualOverride(false);
    setActiveBehavior(behaviorKey);
    setInputs((prev) => {
      const defaults = getBehaviorDefaults(behaviorKey, prev.balance, prev.apr, prev.monthlyPayment);
      return {
        ...prev,
        monthlyPayment: defaults.payment,
        monthlyNewDebt: defaults.spending
      };
    });
  };

  // Run dynamic math configurations
  const simulations = useMemo(() => {
    const { balance, apr, monthlyPayment, monthlyNewDebt, extraPayment, startingCash } = inputs;
    const r = apr / 100;

    // Get default values for each behavior
    const def_payInFull = getBehaviorDefaults(BEHAVIOR_KEYS.PAYOFF_IN_FULL, balance, apr);
    const def_paydown = getBehaviorDefaults(BEHAVIOR_KEYS.PAYDOWN, balance, apr);
    const def_slow = getBehaviorDefaults(BEHAVIOR_KEYS.SLOW_PAYDOWN, balance, apr);
    const def_carry = getBehaviorDefaults(BEHAVIOR_KEYS.CARRY_BALANCE, balance, apr);
    const def_trap = getBehaviorDefaults(BEHAVIOR_KEYS.INTEREST_TRAP, balance, apr);
    const def_budget = getBehaviorDefaults(BEHAVIOR_KEYS.BUDGET_GAP, balance, apr);

    // If active behavior is X, use user's actual inputs. Otherwise use defaults.
    const P_payInFull = activeBehavior === BEHAVIOR_KEYS.PAYOFF_IN_FULL ? monthlyPayment : def_payInFull.payment;
    const S_payInFull = activeBehavior === BEHAVIOR_KEYS.PAYOFF_IN_FULL ? monthlyNewDebt : def_payInFull.spending;

    const P_paydown = activeBehavior === BEHAVIOR_KEYS.PAYDOWN ? monthlyPayment : def_paydown.payment;
    const S_paydown = activeBehavior === BEHAVIOR_KEYS.PAYDOWN ? monthlyNewDebt : def_paydown.spending;

    const P_slow = activeBehavior === BEHAVIOR_KEYS.SLOW_PAYDOWN ? monthlyPayment : def_slow.payment;
    const S_slow = activeBehavior === BEHAVIOR_KEYS.SLOW_PAYDOWN ? monthlyNewDebt : def_slow.spending;

    const P_carry = activeBehavior === BEHAVIOR_KEYS.CARRY_BALANCE ? monthlyPayment : def_carry.payment;
    const S_carry = activeBehavior === BEHAVIOR_KEYS.CARRY_BALANCE ? monthlyNewDebt : def_carry.spending;

    const P_trap = activeBehavior === BEHAVIOR_KEYS.INTEREST_TRAP ? monthlyPayment : def_trap.payment;
    const S_trap = activeBehavior === BEHAVIOR_KEYS.INTEREST_TRAP ? monthlyNewDebt : def_trap.spending;

    const P_budget = activeBehavior === BEHAVIOR_KEYS.BUDGET_GAP ? monthlyPayment : def_budget.payment;
    const S_budget = activeBehavior === BEHAVIOR_KEYS.BUDGET_GAP ? monthlyNewDebt : def_budget.spending;

    // Simulation outputs with extra payments
    const payInFullSim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_payInFull, monthlyNewDebt: S_payInFull, extraPayment, startingCash });
    const paydownSim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_paydown, monthlyNewDebt: S_paydown, extraPayment, startingCash });
    const slowSim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_slow, monthlyNewDebt: S_slow, extraPayment, startingCash });
    const carrySim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_carry, monthlyNewDebt: S_carry, extraPayment, startingCash });
    const trapSim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_trap, monthlyNewDebt: S_trap, extraPayment, startingCash });
    const budgetSim = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_budget, monthlyNewDebt: S_budget, extraPayment, startingCash });

    // Baseline outputs (no extra payment) to calculate before/after impact
    const payInFullBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_payInFull, monthlyNewDebt: S_payInFull, extraPayment: 0, startingCash });
    const paydownBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_paydown, monthlyNewDebt: S_paydown, extraPayment: 0, startingCash });
    const slowBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_slow, monthlyNewDebt: S_slow, extraPayment: 0, startingCash });
    const carryBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_carry, monthlyNewDebt: S_carry, extraPayment: 0, startingCash });
    const trapBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_trap, monthlyNewDebt: S_trap, extraPayment: 0, startingCash });
    const budgetBase = calculatePayoffTimeline({ startingBalance: balance, apr: r, monthlyPayment: P_budget, monthlyNewDebt: S_budget, extraPayment: 0, startingCash });

    return {
      [BEHAVIOR_KEYS.PAYOFF_IN_FULL]: { current: payInFullSim, base: payInFullBase, payment: P_payInFull + extraPayment, name: 'Payoff in Full' },
      [BEHAVIOR_KEYS.PAYDOWN]: { current: paydownSim, base: paydownBase, payment: P_paydown + extraPayment, name: 'Paydown' },
      [BEHAVIOR_KEYS.SLOW_PAYDOWN]: { current: slowSim, base: slowBase, payment: P_slow + extraPayment, name: 'Slow Paydown' },
      [BEHAVIOR_KEYS.CARRY_BALANCE]: { current: carrySim, base: carryBase, payment: P_carry + extraPayment, name: 'Carry Balance' },
      [BEHAVIOR_KEYS.INTEREST_TRAP]: { current: trapSim, base: trapBase, payment: P_trap + extraPayment, name: 'Interest Trap' },
      [BEHAVIOR_KEYS.BUDGET_GAP]: { current: budgetSim, base: budgetBase, payment: P_budget + extraPayment, name: 'Budget Gap' }
    };
  }, [inputs, activeBehavior]);

  // Aggregate year-by-year data points for the main chart comparison
  const chartData = useMemo(() => {
    const list = [];
    for (let y = 0; y <= 5; y++) {
      const dataPoint = { year: y };
      Object.keys(simulations).forEach((key) => {
        const sim = simulations[key].current;
        const entry = sim.yearlyData.find(d => d.year === y) || sim.yearlyData[sim.yearlyData.length - 1];
        dataPoint[simulations[key].name] = Math.round(entry.balance);
        dataPoint[`${simulations[key].name} NW`] = Math.round(entry.netWorth);
      });
      dataPoint["Pay in Full"] = 0;
      dataPoint["Pay in Full NW"] = Math.round(inputs.startingCash - inputs.balance);
      list.push(dataPoint);
    }
    return list;
  }, [simulations, inputs.startingCash, inputs.balance]);

  // Calculate required monthly payment data for years 1 to 5
  const payoffScenariosData = useMemo(() => {
    return [
      { name: '12 months', label: '1 Year', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 1)), color: '#0ea5e9' },
      { name: '24 months', label: '2 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 2)), color: '#10b981' },
      { name: '36 months', label: '3 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 3)), color: '#16a34a' },
      { name: '48 months', label: '4 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 4)), color: '#eab308' },
      { name: '60 months', label: '5 Years', payment: Math.round(calculateAmortizedPayment(inputs.balance, inputs.apr, 5)), color: '#f97316' }
    ];
  }, [inputs.balance, inputs.apr]);

  // Calculate y-axis bounds corresponding to APR 36% for the current balance and inputs
  const yAxisBoundsAt36 = useMemo(() => {
    return getYAxisBoundsAt36(inputs, activeBehavior);
  }, [inputs, activeBehavior]);

  // Determine line colors based on color-blind setting
  const getLineColors = (key) => {
    if (key === BEHAVIOR_KEYS.PAYOFF_IN_FULL) return '#22c55e';
    if (colorBlindMode) {
      switch (key) {
        case BEHAVIOR_KEYS.PAYDOWN: return '#2563eb'; // Blue
        case BEHAVIOR_KEYS.SLOW_PAYDOWN: return '#0284c7';       // Sky Blue
        case BEHAVIOR_KEYS.CARRY_BALANCE: return '#ea580c';    // Orange
        case BEHAVIOR_KEYS.INTEREST_TRAP: return '#dc2626';       // Bright Red
        case BEHAVIOR_KEYS.BUDGET_GAP: return '#4f46e5';  // Indigo
        default: return '#94a3b8';
      }
    } else {
      switch (key) {
        case BEHAVIOR_KEYS.PAYDOWN: return '#10b981'; // Emerald
        case BEHAVIOR_KEYS.SLOW_PAYDOWN: return '#0ea5e9';       // Sky
        case BEHAVIOR_KEYS.CARRY_BALANCE: return '#f59e0b';    // Amber
        case BEHAVIOR_KEYS.INTEREST_TRAP: return '#f43f5e';       // Rose
        case BEHAVIOR_KEYS.BUDGET_GAP: return '#8b5cf6';  // Violet
        default: return '#64748b';
      }
    }
  };

  const activeSim = simulations[activeBehavior];
  const monthlyInterest = inputs.balance * (inputs.apr / 100 / 12);

  // Generate dynamic educational summary and insights
  const educationalInsights = useMemo(() => {
    return getEducationalInsights(activeBehavior, inputs, activeSim.current, activeSim.base);
  }, [activeBehavior, activeSim, inputs]);

  // Format payoff timeline helper for rendering cards
  const formatPayoffSummary = (simObj) => {
    return formatPayoffSummaryDomain(simObj, inputs.balance);
  };

  const getScenarioStatus = (key, simObj) => {
    return getScenarioStatusDomain(key, simObj, inputs.balance);
  };

  // Compute metric values for the Drag Metrics Cards
  const annualDrag = activeSim.current.annualInterestYear1;
  const lifetimeDrag = activeSim.current.totalInterestPaid;
  const debtFreeDateText = activeSim.current.isPaidOff ? formatPayoffText(activeSim.current.monthsToPayoff) : 'Never';
  
  const interestSaved = useMemo(() => {
    const carryBaseline = simulations[BEHAVIOR_KEYS.CARRY_BALANCE].base.totalInterestPaid;
    const currentInterest = activeSim.current.totalInterestPaid;
    return Math.max(0, carryBaseline - currentInterest);
  }, [simulations, activeSim]);

  return (
    <div className="credit-card-calculator" id="credit-card-calculator-main">

      <div className="dashboard-grid">
        {/* Left Column: Interactive Controls */}
        <div className="assumptions-section">
          <div className="glass-card">
            <div className="card-header-clean">
              <h3 className="card-title">Starting Debt & Behavior</h3>
              <button className="reset-btn" onClick={handleReset}>Reset All</button>
            </div>

            <div className="inputs-list">
              {/* Balance Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Current Balance</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.balance ?? ''}
                      onFocus={() => { activeFieldRef.current = 'balance'; }}
                      onChange={(e) => handleInputChange('balance', e.target.value)}
                      onBlur={() => handleBlur('balance')}
                      id="cc-input-balance"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="500"
                  max="50000"
                  step="500"
                  className="custom-range"
                  value={inputs.balance}
                  onChange={(e) => handleInputChange('balance', e.target.value)}
                  id="cc-slider-balance"
                />
              </div>

              {/* APR Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Annual APR</span>
                  <div className="input-field-wrap">
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.apr ?? ''}
                      onFocus={() => { activeFieldRef.current = 'apr'; }}
                      onChange={(e) => handleInputChange('apr', e.target.value)}
                      onBlur={() => handleBlur('apr')}
                      id="cc-input-apr"
                    />
                    <span className="unit">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="36"
                  step="0.5"
                  className="custom-range"
                  value={inputs.apr}
                  onChange={(e) => handleInputChange('apr', e.target.value)}
                  id="cc-slider-apr"
                />
              </div>

              {/* Monthly Payment Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Minimum Monthly Payment</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.monthlyPayment ?? ''}
                      onFocus={() => { activeFieldRef.current = 'monthlyPayment'; }}
                      onChange={(e) => handleInputChange('monthlyPayment', e.target.value)}
                      onBlur={() => handleBlur('monthlyPayment')}
                      id="cc-input-payment"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max={Math.max(2000, inputs.balance)}
                  step="10"
                  className="custom-range"
                  value={inputs.monthlyPayment}
                  onChange={(e) => handleInputChange('monthlyPayment', e.target.value)}
                  id="cc-slider-payment"
                />
              </div>

              {/* Monthly New Debt Input */}
              <div className="input-wrapper">
                <div className="input-label-row">
                  <span className="input-name">Monthly New Spending</span>
                  <div className="input-field-wrap">
                    <span className="unit">$</span>
                    <input
                      type="number"
                      className="input-number-box"
                      value={localValues.monthlyNewDebt ?? ''}
                      onFocus={() => { activeFieldRef.current = 'monthlyNewDebt'; }}
                      onChange={(e) => handleInputChange('monthlyNewDebt', e.target.value)}
                      onBlur={() => handleBlur('monthlyNewDebt')}
                      id="cc-input-newdebt"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="10"
                  className="custom-range"
                  value={inputs.monthlyNewDebt}
                  onChange={(e) => handleInputChange('monthlyNewDebt', e.target.value)}
                  id="cc-slider-newdebt"
                />
              </div>


            </div>

            {/* Interest Threshold Helper Card */}
            <div className="interest-threshold-alert">
              <span className="alert-icon">💡</span>
              <span className="alert-text">
                Your monthly interest charges start at <strong>{formatCurrency(monthlyInterest)}</strong>. Any payment below this amount triggers an <strong>Interest Trap</strong>.
              </span>
            </div>

            {/* Manual Override Reclassification Indicator */}
            {isManualOverride && (
              <div className="manual-override-note" id="cc-manual-override-note">
                <span className="override-icon">✏️</span>
                <span className="override-text">
                  Your inputs now match <strong>{BEHAVIOR_METADATA[activeBehavior].name}</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Prominent Extra Payment Box */}
          <div className="glass-card extra-payment-card">
            <div className="extra-payment-title-row">
              <span className="extra-payment-badge">OPTIMIZE</span>
              <h3 className="extra-payment-title">Extra Payment Per Month</h3>
            </div>
            
            <div className="extra-value-display">
              <span className="extra-dollar">+ {formatCurrency(inputs.extraPayment)}</span>
              <span className="extra-freq">/ month</span>
            </div>

            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              className="custom-range extra-payment-range"
              value={inputs.extraPayment}
              onChange={(e) => handleInputChange('extraPayment', e.target.value)}
              id="cc-slider-extrapayment"
            />
            
            <p className="extra-help-text">Increase this slider to see how small additional payments crush the interest compounds and accelerate your payoff date.</p>
          </div>
        </div>

        {/* Right Column: Visualization & Insights */}
        <div className="results-display">
          
          {/* Detailed Behavior Selector Cards */}
          <div className="behavior-cards-grid">
            {Object.keys(simulations).map((key) => {
              const simObj = simulations[key];
              const isActive = activeBehavior === key;
              const status = getScenarioStatus(key, simObj);
              const meta = BEHAVIOR_METADATA[key];

              return (
                <div
                  key={key}
                  className={`behavior-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleBehaviorCardClick(key)}
                  style={{ '--border-glow': getLineColors(key) }}
                  id={`cc-scenario-card-${key}`}
                >
                  <div className="behavior-card-header">
                    <span className="behavior-icon">{meta.icon}</span>
                    <span className="behavior-name-text">{meta.name}</span>
                  </div>
                  <p className="behavior-description">{meta.description}</p>
                  <div className="behavior-rule-badge">
                    <span className="rule-label">Rule:</span> {meta.rule}
                  </div>
                  <div className="behavior-outcome-preview">
                    <span className="outcome-label">Outcome preview:</span>
                    <div className="outcome-details">
                      <span className="outcome-timeline">{formatPayoffSummary(simObj)}</span>
                      <span className={`status-badge ${status.class}`}>{status.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metric Dashboard block */}
          <div className="cc-metrics-dashboard">
            <div className="cc-metric-card border-amber">
              <span className="cc-metric-title">Annual Credit Card Drag</span>
              <span className="cc-metric-value text-amber">{formatCurrency(annualDrag)} / yr</span>
              <span className="cc-metric-subtitle">Interest paid in Year 1</span>
            </div>

            <div className="cc-metric-card border-rose">
              <span className="cc-metric-title">Lifetime Credit Card Drag</span>
              <span className="cc-metric-value text-rose">{formatCurrency(lifetimeDrag)}</span>
              <span className="cc-metric-subtitle">Total interest paid</span>
            </div>

            <div className="cc-metric-card border-primary">
              <span className="cc-metric-title">Debt-Free Date</span>
              <span className="cc-metric-value text-primary">{debtFreeDateText}</span>
              <span className="cc-metric-subtitle">Payoff timeline duration</span>
            </div>

            <div className="cc-metric-card border-emerald">
              <span className="cc-metric-title">Interest Saved</span>
              <span className="cc-metric-value text-emerald">{formatCurrency(interestSaved)}</span>
              <span className="cc-metric-subtitle">Compared to Carry Balance</span>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="cc-chart-tabs" id="cc-chart-tabs-nav">
            <button
              className={`cc-tab-btn ${activeTab === 'drag' ? 'active' : ''}`}
              onClick={() => setActiveTab('drag')}
              id="cc-tab-btn-drag"
            >
              📉 Credit Card Drag
            </button>
            <button
              className={`cc-tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
              onClick={() => setActiveTab('balance')}
              id="cc-tab-btn-balance"
            >
              💳 Debt Balance
            </button>
            <button
              className={`cc-tab-btn ${activeTab === 'payoff' ? 'active' : ''}`}
              onClick={() => setActiveTab('payoff')}
              id="cc-tab-btn-payoff"
            >
              📊 Alternate Payoffs
            </button>
          </div>

          {/* Chart 1: Debt Balance Over Time */}
          {activeTab === 'balance' && (
            <div className="glass-card chart-card" id="cc-balance-chart-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Debt Balance Over Time</h3>
                  <span className="chart-subtitle">Comparing remaining debt balance profiles over 5 years</span>
                </div>

                <div className="chart-controls">
                  <label className="toggle-label-checkbox compare-toggle" id="cc-compare-toggle">
                    <input
                      type="checkbox"
                      checked={compareMode}
                      onChange={(e) => setCompareMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    🔄 Compare all behaviors
                  </label>
                  <label className="toggle-label-checkbox">
                    <input
                      type="checkbox"
                      checked={colorBlindMode}
                      onChange={(e) => setColorBlindMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    👁️ Color-blind Mode
                  </label>
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
                      type="number"
                      dataKey="year"
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: 'var(--text-tertiary)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                      width={55}
                      domain={[0, yAxisBoundsAt36.maxBalance]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="tooltip-year-label"><strong>Year {label}</strong></p>
                              {payload.map((entry, index) => (
                                <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                                  {entry.name}: <strong>{formatCurrency(entry.value)}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)', paddingTop: 10 }}
                    />
                    
                    {(!compareMode ? [BEHAVIOR_KEYS.PAYOFF_IN_FULL, BEHAVIOR_KEYS.PAYDOWN, BEHAVIOR_KEYS.SLOW_PAYDOWN, BEHAVIOR_KEYS.CARRY_BALANCE, BEHAVIOR_KEYS.INTEREST_TRAP, BEHAVIOR_KEYS.BUDGET_GAP].filter(k => k === activeBehavior) : [BEHAVIOR_KEYS.PAYOFF_IN_FULL, BEHAVIOR_KEYS.PAYDOWN, BEHAVIOR_KEYS.SLOW_PAYDOWN, BEHAVIOR_KEYS.CARRY_BALANCE, BEHAVIOR_KEYS.INTEREST_TRAP, BEHAVIOR_KEYS.BUDGET_GAP]).map((key) => {
                      const simName = simulations[key].name;
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={simName}
                          name={simName}
                          stroke={getLineColors(key)}
                          strokeWidth={activeBehavior === key ? 3.5 : 1.5}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                    <Line
                      type="monotone"
                      dataKey="Pay in Full"
                      name="Pay in Full"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />

                    <ReferenceLine x={0} stroke="var(--border-color)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart 2: Credit Card Drag Over Time */}
          {activeTab === 'drag' && (
            <div className="glass-card chart-card" id="cc-drag-chart-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Credit Card Drag Over Time</h3>
                  <span className="chart-subtitle">Net worth impact of different credit card payment behaviors</span>
                </div>

                <div className="chart-controls">
                  <label className="toggle-label-checkbox compare-toggle" id="cc-compare-toggle-drag">
                    <input
                      type="checkbox"
                      checked={compareMode}
                      onChange={(e) => setCompareMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    🔄 Compare all behaviors
                  </label>
                  <label className="toggle-label-checkbox">
                    <input
                      type="checkbox"
                      checked={colorBlindMode}
                      onChange={(e) => setColorBlindMode(e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    👁️ Color-blind Mode
                  </label>
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
                      type="number"
                      dataKey="year"
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: 'var(--text-tertiary)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={formatYAxis}
                      width={55}
                      domain={[yAxisBoundsAt36.minNetWorth, inputs.startingCash - inputs.balance]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="tooltip-year-label"><strong>Year {label}</strong></p>
                              {payload.map((entry, index) => (
                                <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                                  {entry.name.replace(' NW', '')}: <strong>{formatCurrency(entry.value)}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)', paddingTop: 10 }}
                    />
                    
                    {(!compareMode ? [BEHAVIOR_KEYS.PAYOFF_IN_FULL, BEHAVIOR_KEYS.PAYDOWN, BEHAVIOR_KEYS.SLOW_PAYDOWN, BEHAVIOR_KEYS.CARRY_BALANCE, BEHAVIOR_KEYS.INTEREST_TRAP, BEHAVIOR_KEYS.BUDGET_GAP].filter(k => k === activeBehavior) : [BEHAVIOR_KEYS.PAYOFF_IN_FULL, BEHAVIOR_KEYS.PAYDOWN, BEHAVIOR_KEYS.SLOW_PAYDOWN, BEHAVIOR_KEYS.CARRY_BALANCE, BEHAVIOR_KEYS.INTEREST_TRAP, BEHAVIOR_KEYS.BUDGET_GAP]).map((key) => {
                      const simName = simulations[key].name;
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={`${simName} NW`}
                          name={simName}
                          stroke={getLineColors(key)}
                          strokeWidth={activeBehavior === key ? 3.5 : 1.5}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                    <Line
                      type="monotone"
                      dataKey="Pay in Full NW"
                      name="Pay in Full"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />

                    <ReferenceLine x={0} stroke="var(--border-color)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart 3: Alternate Payoff Scenarios */}
          {activeTab === 'payoff' && (
            <div className="glass-card chart-card alternate-payoff-scenarios-card" id="cc-payoff-scenarios-card">
              <div className="chart-header-row">
                <div>
                  <h3 className="card-title">Alternate Payoff Scenarios</h3>
                  <span className="chart-subtitle">Monthly payment required to pay off debt in 1 to 5 years</span>
                </div>
              </div>

              <div className="chart-container-inner" style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={payoffScenariosData}
                    margin={{ top: 30, right: 10, left: 10, bottom: 5 }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={11}
                      tickFormatter={(val) => `$${val}`}
                      domain={[0, Math.ceil(yAxisBoundsAt36.maxPayoffPayment * 1.15)]}
                    />
                    <Bar dataKey="payment" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {payoffScenariosData.map((entry, index) => {
                        const isHovered = hoveredBar === index;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            onMouseEnter={() => setHoveredBar(index)}
                            style={{
                              filter: isHovered 
                                ? `drop-shadow(0 0 10px ${entry.color}) brightness(1.2)` 
                                : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="payment"
                        position="top"
                        formatter={(val) => formatCurrency(val)}
                        style={{ fill: 'var(--text-primary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Behavior-Specific Educational Explanation Card */}
          <div className="glass-card behavior-explanation-card" id="cc-behavior-explanation-card" style={{ borderLeftColor: getLineColors(activeBehavior) }}>
            <h4 className="explanation-title" style={{ color: getLineColors(activeBehavior) }}>
              {BEHAVIOR_METADATA[activeBehavior].name} Explanation
            </h4>
            <p className="explanation-text">
              {EDUCATIONAL_EXPLANATIONS[activeBehavior]}
            </p>
          </div>

          {/* Educational Callout Block */}
          <div className="glass-card cc-drag-callout-card">
            <h4 className="cc-callout-title">What is Credit Card Drag?</h4>
            <div className="cc-callout-body">
              <p>Every dollar paid toward principal simply transfers money from cash to debt, keeping your total net worth identical.</p>
              <p className="highlight-text">Every dollar paid in interest permanently reduces net worth.</p>
              <p><strong>Credit Card Drag</strong> is the wealth lost to credit card interest over time. Reducing high-interest debt reduces future drag and improves long-term financial outcomes.</p>
            </div>
          </div>

          {/* Educational Insights Box */}
          <div className="glass-card active-insights-card" style={{ borderLeft: `5px solid ${getLineColors(activeBehavior)}` }}>
            <div className="insights-header">
              <span className="insights-bulb">💡</span>
              <h4 className="insights-title">Insights: {activeSim.name}</h4>
            </div>

            <div className="insights-content-layout">
              <div className="insights-text-block">
                <p className="educational-insight-text">{educationalInsights}</p>
              </div>

              {/* Scenario details dashboard */}
              <div className="insights-metrics-panel">
                {activeBehavior === BEHAVIOR_KEYS.PAYOFF_IN_FULL || activeBehavior === BEHAVIOR_KEYS.PAYDOWN || activeBehavior === BEHAVIOR_KEYS.SLOW_PAYDOWN || activeBehavior === BEHAVIOR_KEYS.CARRY_BALANCE ? (
                  <>
                    <div className="insight-metric">
                      <span className="metric-label">Debt-Free Timeline</span>
                      <span className="metric-value">
                        {debtFreeDateText}
                      </span>
                      {inputs.extraPayment > 0 && activeSim.base.isPaidOff && (
                        <span className="metric-comparison">
                          Saved {((activeSim.base.monthsToPayoff - activeSim.current.monthsToPayoff) / 12).toFixed(1)} years
                        </span>
                      )}
                      {inputs.extraPayment > 0 && !activeSim.base.isPaidOff && activeSim.current.isPaidOff && (
                        <span className="metric-comparison">
                          Broke infinite debt cycle!
                        </span>
                      )}
                    </div>
                    
                    <div className="insight-metric">
                      <span className="metric-label">Total Interest Paid</span>
                      <span className="metric-value">{formatCurrency(lifetimeDrag)}</span>
                      {inputs.extraPayment > 0 && (
                        <span className="metric-comparison positive">
                          Saved {formatCurrency(Math.max(0, activeSim.base.totalInterestPaid - activeSim.current.totalInterestPaid))}
                        </span>
                      )}
                    </div>

                    <div className="insight-metric">
                      <span className="metric-label">Total Payments Made</span>
                      <span className="metric-value">{formatCurrency(activeSim.current.totalPayments)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="insight-metric">
                      <span className="metric-label">Debt Growth (Year 1)</span>
                      <span className="metric-value text-danger">
                        +{formatCurrency(activeSim.current.debtAfter1Year - inputs.balance)}
                      </span>
                    </div>
                    
                    <div className="insight-metric">
                      <span className="metric-label">Debt After 5 Years</span>
                      <span className="metric-value text-danger">
                        {formatCurrency(activeSim.current.debtAfter5Years)}
                      </span>
                    </div>

                    <div className="insight-metric">
                      <span className="metric-label">Debt After 10 Years</span>
                      <span className="metric-value text-danger">
                        {formatCurrency(activeSim.current.debtAfter10Years)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* General tips panel */}
            <div className="insights-action-tips">
              <span className="tip-badge">EDUCATIONAL TAKEAWAY</span>
              <p className="tip-message">
                {EDUCATIONAL_TAKEAWAYS[activeBehavior]}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
