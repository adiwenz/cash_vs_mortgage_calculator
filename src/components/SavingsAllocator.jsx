import { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import './SavingsAllocator.css';
import { getRetirementLimit } from '../simulatorMathUtils';

// 10 allocation categories with curated colors and descriptions
const CATEGORIES = [
  { id: 'trad401k', name: '401(k) (Pre-Tax)', color: '#6366f1', desc: 'Pre-tax workplace retirement plan.' },
  { id: 'rothIra', name: 'Roth IRA', color: '#f59e0b', desc: 'Tax-free retirement growth and withdrawals.' },
  { id: 'tradIra', name: 'Traditional IRA', color: '#3b82f6', desc: 'Individual pre-tax retirement account.' },
  { id: 'hsa', name: 'HSA', color: '#10b981', desc: 'Triple tax-advantaged health savings account.' },
  { id: 'brokerage', name: 'Taxable Brokerage', color: '#8b5cf6', desc: 'Standard investment account (no tax shelter).' },
  { id: 'checking', name: 'Checking', color: '#0ea5e9', desc: 'Primary transactional account for daily expenses.' },
  { id: 'hysa', name: 'High-Yield Savings', color: '#0d9488', desc: 'Interest-bearing savings account (liquid).' },
  { id: 'emergency', name: 'Emergency Fund', color: '#ec4899', desc: 'Liquid reserve for unexpected life events.' },
  { id: 'debt', name: 'Debt Payoff', color: '#ef4444', desc: 'Accelerated payments on credit cards, loans, etc.' },
  { id: 'other', name: 'Other Savings', color: '#64748b', desc: 'Miscellaneous savings goals or niche assets.' }
];

// U.S. Federal Tax Data (2026 guidelines)
const TAX_DATA = {
  single: {
    standardDeduction: 16100,
    brackets: [
      { limit: 12400, rate: 0.10 },
      { limit: 50400, rate: 0.12 },
      { limit: 105700, rate: 0.22 },
      { limit: 201775, rate: 0.24 },
      { limit: 256225, rate: 0.32 },
      { limit: 640600, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  },
  married: {
    standardDeduction: 32200,
    brackets: [
      { limit: 24800, rate: 0.10 },
      { limit: 100800, rate: 0.12 },
      { limit: 211400, rate: 0.22 },
      { limit: 403550, rate: 0.24 },
      { limit: 512450, rate: 0.32 },
      { limit: 768700, rate: 0.35 },
      { limit: Infinity, rate: 0.37 }
    ]
  }
};

function calculateUSTax(grossIncome, preTaxDeductions, filingStatus) {
  const taxConfig = TAX_DATA[filingStatus] || TAX_DATA.single;
  const taxable = Math.max(0, grossIncome - taxConfig.standardDeduction - preTaxDeductions);
  
  let tax = 0;
  let prevLimit = 0;
  for (const bracket of taxConfig.brackets) {
    if (taxable > bracket.limit) {
      tax += (bracket.limit - prevLimit) * bracket.rate;
      prevLimit = bracket.limit;
    } else {
      tax += (taxable - prevLimit) * bracket.rate;
      break;
    }
  }
  return tax;
}

export default function SavingsAllocator() {
  // --- STATE VARIABLES ---
  const [grossIncome, setGrossIncome] = useState(100000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(4500);
  const [filingStatus, setFilingStatus] = useState('single');
  const [allocationMode, setAllocationMode] = useState('surplus'); // 'surplus' | 'gross' | 'net'
  const [taxAware, setTaxAware] = useState(true);
  const [age, setAge] = useState(30);
  
  // Balance parameters for guardrails
  const [currentEmergencyFund, setCurrentEmergencyFund] = useState(5000);
  const [currentChecking, setCurrentChecking] = useState(3000);
  const [hsaCoverage, setHsaCoverage] = useState('single'); // 'single' | 'family'
  
  // Employer match settings
  const [matchRate, setMatchRate] = useState(50); // 50% match
  const [matchLimit, setMatchLimit] = useState(6); // up to 6% of salary
  const [enableMatch, setEnableMatch] = useState(true);

  // Allocation percentages (must sum to 100%)
  const [allocations, setAllocations] = useState({
    trad401k: 15,
    rothIra: 15,
    tradIra: 10,
    hsa: 10,
    brokerage: 20,
    checking: 5,
    hysa: 10,
    emergency: 5,
    debt: 5,
    other: 5
  });

  const totalAllocationPct = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  }, [allocations]);

  // --- CALCULATION ENGINE ---
  const results = useMemo(() => {
    const cap401k = getRetirementLimit('401k', age, filingStatus);
    const capIRA = getRetirementLimit('traditionalIRA', age, filingStatus);
    const capHSA = getRetirementLimit('hsa', age, hsaCoverage === 'family' ? 'married' : 'single');

    let preTaxDeductionsAnnual = 0;
    let taxes = 0;
    let netAnnualIncome = grossIncome;
    let monthlySurplus = 0;
    let monthlyContributions = {};
    let takeHomePayAnnual = grossIncome;

    // Standard tax without pre-tax accounts to calculate savings
    const baseTaxes = calculateUSTax(grossIncome, 0, filingStatus);

    if (taxAware) {
      // Iterative solver to resolve tax deductions and surplus
      for (let iter = 0; iter < 10; iter++) {
        taxes = calculateUSTax(grossIncome, preTaxDeductionsAnnual, filingStatus);
        netAnnualIncome = grossIncome - taxes;
        const netMonthlyTakehome = netAnnualIncome / 12;
        monthlySurplus = netMonthlyTakehome - monthlyExpenses;

        let savingsPool = 0;
        if (allocationMode === 'surplus') {
          savingsPool = Math.max(0, monthlySurplus);
        } else if (allocationMode === 'gross') {
          savingsPool = grossIncome / 12;
        } else { // net
          savingsPool = netMonthlyTakehome;
        }

        // Project temporary pre-tax sums
        const temp401k = savingsPool * ((allocations.trad401k || 0) / 100);
        const tempTradIra = savingsPool * ((allocations.tradIra || 0) / 100);
        const tempHSA = savingsPool * ((allocations.hsa || 0) / 100);

        // Cap deductions at legal limits
        const capped401k = Math.min(cap401k, temp401k * 12);
        const cappedTradIRA = Math.min(capIRA, tempTradIra * 12);
        const cappedHSA = Math.min(capHSA, tempHSA * 12);

        const nextPreTaxDeductions = capped401k + cappedTradIRA + cappedHSA;

        if (Math.abs(nextPreTaxDeductions - preTaxDeductionsAnnual) < 1) {
          preTaxDeductionsAnnual = nextPreTaxDeductions;
          break;
        }
        preTaxDeductionsAnnual = nextPreTaxDeductions;
      }
      takeHomePayAnnual = grossIncome - taxes;
    } else {
      // Non tax-aware standard calculations
      taxes = baseTaxes;
      takeHomePayAnnual = grossIncome - taxes;
      preTaxDeductionsAnnual = 0;
    }

    const netMonthlyTakehome = takeHomePayAnnual / 12;
    monthlySurplus = netMonthlyTakehome - monthlyExpenses;

    let savingsPool = 0;
    if (allocationMode === 'surplus') {
      savingsPool = Math.max(0, monthlySurplus);
    } else if (allocationMode === 'gross') {
      savingsPool = grossIncome / 12;
    } else { // net
      savingsPool = netMonthlyTakehome;
    }

    // Populate actual contributions
    CATEGORIES.forEach(cat => {
      const pct = allocations[cat.id] || 0;
      monthlyContributions[cat.id] = savingsPool * (pct / 100);
    });

    // Employer Match calculation
    let annualEmployerMatch = 0;
    if (enableMatch && grossIncome > 0) {
      // Work out what % of gross income the user's 401(k) contribution is
      const user401kAnnual = monthlyContributions.trad401k * 12;
      const user401kPct = (user401kAnnual / grossIncome) * 100;
      
      const effectiveMatchPct = Math.min(user401kPct, matchLimit);
      annualEmployerMatch = grossIncome * (effectiveMatchPct / 100) * (matchRate / 100);
    }

    const taxSavings = Math.max(0, baseTaxes - taxes);

    return {
      taxes,
      taxSavings,
      monthlyTakehome: netMonthlyTakehome,
      monthlySurplus,
      savingsPool,
      monthlyContributions,
      annualEmployerMatch,
      takeHomePayAnnual
    };
  }, [grossIncome, monthlyExpenses, filingStatus, allocationMode, taxAware, allocations, hsaCoverage, matchRate, matchLimit, enableMatch, age]);

  // --- GUARDRAILS & WARNINGS ENGINE ---
  const guardrails = useMemo(() => {
    const warnings = [];
    const caps = {
      trad401k: getRetirementLimit('401k', age, filingStatus),
      iraCombined: getRetirementLimit('traditionalIRA', age, filingStatus),
      hsa: getRetirementLimit('hsa', age, hsaCoverage === 'family' ? 'married' : 'single')
    };

    const c = results.monthlyContributions;
    
    // 1. Retirement Limits Check
    const annual401k = (c.trad401k || 0) * 12;
    if (annual401k > caps.trad401k) {
      warnings.push({
        id: 'limit-401k',
        type: 'error',
        message: `Your annual 401(k) contribution of $${Math.round(annual401k).toLocaleString()} exceeds the IRS employee limit of $${caps.trad401k.toLocaleString()}. Consider redirecting the excess $${Math.round(annual401k - caps.trad401k).toLocaleString()} to a Roth IRA or Taxable Brokerage.`
      });
    }

    const annualTradIRA = (c.tradIra || 0) * 12;
    if (annualTradIRA > caps.iraCombined) {
      warnings.push({
        id: 'limit-trad-ira',
        type: 'error',
        message: `Your annual Traditional IRA contribution of $${Math.round(annualTradIRA).toLocaleString()} exceeds the individual IRA limit of $${caps.iraCombined.toLocaleString()}.`
      });
    }

    const annualRothIRA = (c.rothIra || 0) * 12;
    if (annualRothIRA > caps.iraCombined) {
      warnings.push({
        id: 'limit-roth-ira',
        type: 'error',
        message: `Your annual Roth IRA contribution of $${Math.round(annualRothIRA).toLocaleString()} exceeds the individual IRA limit of $${caps.iraCombined.toLocaleString()}.`
      });
    }

    const combinedIRA = annualTradIRA + annualRothIRA;
    if (combinedIRA > caps.iraCombined) {
      warnings.push({
        id: 'limit-combined-ira',
        type: 'error',
        message: `Your combined IRA contributions ($${Math.round(combinedIRA).toLocaleString()} total) exceed the combined Traditional & Roth IRA annual limit of $${caps.iraCombined.toLocaleString()}.`
      });
    }

    const annualHSA = (c.hsa || 0) * 12;
    if (annualHSA > caps.hsa) {
      warnings.push({
        id: 'limit-hsa',
        type: 'error',
        message: `Your annual HSA contribution of $${Math.round(annualHSA).toLocaleString()} exceeds the annual limit of $${caps.hsa.toLocaleString()} for ${hsaCoverage} coverage.`
      });
    }

    // 2. Emergency Fund Checks
    const threeMonthExpenses = monthlyExpenses * 3;
    const sixMonthExpenses = monthlyExpenses * 6;
    const monthlyEmergencyAlloc = c.emergency || 0;

    if (currentEmergencyFund < threeMonthExpenses) {
      warnings.push({
        id: 'ef-below-min',
        type: 'warning',
        message: `Your current Emergency Fund ($${currentEmergencyFund.toLocaleString()}) is below the recommended 3-month safety floor ($${Math.round(threeMonthExpenses).toLocaleString()}). Consider prioritizing allocations to build it up.`
      });
    }

    if (allocations.emergency === 0 && currentEmergencyFund < sixMonthExpenses) {
      warnings.push({
        id: 'ef-no-alloc',
        type: 'warning',
        message: `You are allocating 0% to your emergency fund, but your current balance ($${currentEmergencyFund.toLocaleString()}) is below the standard 6-month buffer ($${Math.round(sixMonthExpenses).toLocaleString()}).`
      });
    }

    if (monthlyEmergencyAlloc > 0 && currentEmergencyFund < sixMonthExpenses) {
      const gap = sixMonthExpenses - currentEmergencyFund;
      const monthsToReach = gap / monthlyEmergencyAlloc;
      if (monthsToReach > 24) {
        warnings.push({
          id: 'ef-slow-growth',
          type: 'warning',
          message: `At your current savings rate, it will take ${Math.round(monthsToReach)} months (> 2 years) to reach a fully-funded 6-month emergency buffer ($${Math.round(sixMonthExpenses).toLocaleString()}). You may want to temporarily raise this allocation.`
        });
      }
    }

    // 3. Checking Account Hoarding Checks
    const checkingMonthlyAlloc = c.checking || 0;
    const oneMonthExpenses = monthlyExpenses;
    const twoMonthsExpenses = monthlyExpenses * 2;

    if (currentChecking > twoMonthsExpenses) {
      warnings.push({
        id: 'checking-too-high',
        type: 'warning',
        message: `Your current Checking balance ($${currentChecking.toLocaleString()}) is higher than 2 months of expenses ($${Math.round(twoMonthsExpenses).toLocaleString()}). We recommend redirecting excess funds to a High-Yield Savings Account (HYSA) or Taxable Brokerage to earn interest.`
      });
    }

    if (allocations.checking > 20) {
      warnings.push({
        id: 'checking-alloc-high',
        type: 'warning',
        message: `You are allocating ${allocations.checking}% of savings to checking. Checking accounts yield almost no interest. Consider transferring some of this to a High-Yield Savings Account.`
      });
    }

    return warnings;
  }, [results, hsaCoverage, monthlyExpenses, currentEmergencyFund, currentChecking, allocations, age, filingStatus]);

  // --- HANDLERS ---
  const handleSliderChange = (catId, value) => {
    const val = parseInt(value) || 0;
    setAllocations(prev => ({
      ...prev,
      [catId]: val
    }));
  };

  const handleTextPercentChange = (catId, text) => {
    let val = parseInt(text) || 0;
    val = Math.max(0, Math.min(100, val));
    setAllocations(prev => ({
      ...prev,
      [catId]: val
    }));
  };

  // Helper to rebalance all allocations proportionally to equal 100%
  const autoRebalance = () => {
    const sum = totalAllocationPct;
    if (sum === 100) return;

    if (sum === 0) {
      // Distribute evenly
      const evenVal = Math.floor(100 / CATEGORIES.length);
      const newAlloc = {};
      CATEGORIES.forEach((cat, idx) => {
        newAlloc[cat.id] = idx === 0 ? 100 - evenVal * (CATEGORIES.length - 1) : evenVal;
      });
      setAllocations(newAlloc);
      return;
    }

    const newAlloc = {};
    let newSum = 0;
    
    // Scale proportionally
    CATEGORIES.forEach(cat => {
      const currentVal = allocations[cat.id] || 0;
      const scaledVal = Math.round((currentVal / sum) * 100);
      newAlloc[cat.id] = scaledVal;
      newSum += scaledVal;
    });

    // Fix rounding errors by adjusting the largest value
    const difference = 100 - newSum;
    if (difference !== 0) {
      const keys = Object.keys(newAlloc);
      const largestKey = keys.reduce((maxKey, currentKey) => 
        (newAlloc[currentKey] > newAlloc[maxKey] ? currentKey : maxKey), keys[0]
      );
      newAlloc[largestKey] = Math.max(0, newAlloc[largestKey] + difference);
    }

    setAllocations(newAlloc);
  };

  // Data formatting for Recharts Donut
  const chartData = useMemo(() => {
    return CATEGORIES.map(cat => ({
      name: cat.name,
      value: allocations[cat.id] || 0,
      color: cat.color
    })).filter(item => item.value > 0);
  }, [allocations]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="allocator-container">
      {/* Configuration Header Card */}
      <div className="glass-card config-card">
        <h2 className="allocator-title">Savings Allocator Control Panel</h2>
        <p className="allocator-subtitle">
          Design your wealth-building flow. Specify your income, savings target, and allocate your dollars. Let the engine calculate the tax efficiency and guardrails.
        </p>

        <div className="config-grid">
          {/* Column 1: Financial Essentials */}
          <div className="config-column">
            <h3 className="section-header-small">💰 Take-Home Base Parameters</h3>
            
            <div className="input-field-group">
              <label className="field-label">Gross Annual Income</label>
              <div className="input-prefix-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  className="allocator-input-box"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="input-field-group">
              <label className="field-label">Monthly Spending / Expenses</label>
              <div className="input-prefix-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  className="allocator-input-box"
                  value={monthlyExpenses}
                  onChange={(e) => setMonthlyExpenses(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="input-field-group">
              <label className="field-label">Current Age</label>
              <input
                type="number"
                className="allocator-input-box"
                value={age}
                onChange={(e) => setAge(Math.max(18, Math.min(100, parseInt(e.target.value) || 30)))}
              />
            </div>

            <div className="input-field-group">
              <label className="field-label">Tax Filing Status</label>
              <select
                className="allocator-select"
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
              >
                <option value="single">Single Filer</option>
                <option value="married">Married Jointly</option>
              </select>
            </div>
          </div>

          {/* Column 2: Advanced Settings */}
          <div className="config-column">
            <h3 className="section-header-small">⚙️ Allocator Mode & Options</h3>

            <div className="input-field-group">
              <label className="field-label">Allocate percentages based on:</label>
              <div className="allocator-segmented">
                {[
                  { value: 'surplus', label: 'Surplus ($)' },
                  { value: 'gross', label: 'Gross ($)' },
                  { value: 'net', label: 'Net ($)' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`segment-btn ${allocationMode === opt.value ? 'active' : ''}`}
                    onClick={() => setAllocationMode(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="helper-label">
                {allocationMode === 'surplus' && `Allocating from Monthly Surplus: ${formatCurrency(Math.max(0, results.monthlySurplus))}/mo`}
                {allocationMode === 'gross' && `Allocating from Gross Income: ${formatCurrency(grossIncome / 12)}/mo`}
                {allocationMode === 'net' && `Allocating from Net Income: ${formatCurrency(results.monthlyTakehome)}/mo`}
              </span>
            </div>

            <div className="checkbox-row">
              <label className="field-label-checkbox">
                <input
                  type="checkbox"
                  checked={taxAware}
                  onChange={(e) => setTaxAware(e.target.checked)}
                />
                <span>Enable Tax-Aware Treatment</span>
              </label>
              <p className="helper-label" style={{ marginLeft: '1.4rem', marginTop: '-0.25rem' }}>
                Pre-tax contributions reduce taxable income, saving you money in taxes.
              </p>
            </div>

            <div className="input-field-group">
              <label className="field-label">HSA Coverage Plan Type</label>
              <div className="allocator-segmented">
                <button
                  type="button"
                  className={`segment-btn ${hsaCoverage === 'single' ? 'active' : ''}`}
                  onClick={() => setHsaCoverage('single')}
                >
                  Individual ($4,150)
                </button>
                <button
                  type="button"
                  className={`segment-btn ${hsaCoverage === 'family' ? 'active' : ''}`}
                  onClick={() => setHsaCoverage('family')}
                >
                  Family ($8,300)
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Current Cash Assets & Match */}
          <div className="config-column">
            <h3 className="section-header-small">🛡️ Guardrail Baselines & Match</h3>

            <div className="input-field-group">
              <label className="field-label">Current Emergency Fund Balance</label>
              <div className="input-prefix-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  className="allocator-input-box"
                  value={currentEmergencyFund}
                  onChange={(e) => setCurrentEmergencyFund(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="input-field-group">
              <label className="field-label">Current Checking Balance</label>
              <div className="input-prefix-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  className="allocator-input-box"
                  value={currentChecking}
                  onChange={(e) => setCurrentChecking(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="checkbox-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <label className="field-label-checkbox">
                <input
                  type="checkbox"
                  checked={enableMatch}
                  onChange={(e) => setEnableMatch(e.target.checked)}
                />
                <span style={{ fontWeight: '700' }}>401(k) Employer Match</span>
              </label>
            </div>

            {enableMatch && (
              <div className="match-inputs">
                <div className="input-field-group">
                  <label className="field-label">Match Rate</label>
                  <div className="input-prefix-wrapper">
                    <input
                      type="number"
                      className="allocator-input-box text-right"
                      value={matchRate}
                      onChange={(e) => setMatchRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                    <span className="suffix-symbol">%</span>
                  </div>
                </div>
                <div className="input-field-group">
                  <label className="field-label">Up to % of Salary</label>
                  <div className="input-prefix-wrapper">
                    <input
                      type="number"
                      className="allocator-input-box text-right"
                      value={matchLimit}
                      onChange={(e) => setMatchLimit(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                    <span className="suffix-symbol">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Allocator Slider & Visualization Layout */}
      <div className="allocator-main-layout">
        {/* Left Side: Category Slider Slates */}
        <div className="glass-card sliders-card">
          <div className="slider-card-header">
            <h3 className="section-header">Allocate Your Monthly Savings</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className={`sum-badge ${totalAllocationPct === 100 ? 'valid' : 'invalid'}`}>
                Total Allocation: {totalAllocationPct}%
              </span>
              {totalAllocationPct !== 100 && (
                <button
                  type="button"
                  className="rebalance-btn"
                  onClick={autoRebalance}
                >
                  ⚡ Auto-Balance to 100%
                </button>
              )}
            </div>
          </div>

          <div className="sliders-list">
            {CATEGORIES.map(cat => {
              const val = allocations[cat.id] || 0;
              const contribution = results.monthlyContributions[cat.id] || 0;

              return (
                <div key={cat.id} className="category-slider-row">
                  <div className="slider-label-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="category-dot" style={{ backgroundColor: cat.color }} />
                      <span className="category-name">{cat.name}</span>
                    </div>
                    <span className="category-desc">{cat.desc}</span>
                  </div>

                  <div className="slider-control-block">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="allocator-slider-bar"
                      style={{ '--slider-color': cat.color }}
                      value={val}
                      onChange={(e) => handleSliderChange(cat.id, e.target.value)}
                    />
                    <div className="slider-val-input-wrapper">
                      <input
                        type="number"
                        className="slider-val-input"
                        value={val}
                        onChange={(e) => handleTextPercentChange(cat.id, e.target.value)}
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>

                  <div className="slider-outcome-block">
                    <span className="monthly-flow-label">{formatCurrency(contribution)}/mo</span>
                    <span className="annual-flow-label">{formatCurrency(contribution * 12)}/yr</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Charts & Warnings */}
        <div className="results-column">
          {/* Visual Breakdown Card */}
          <div className="glass-card visual-card">
            <h3 className="section-header">Savings Flow Visualizer</h3>

            {/* Stacked Progress Bar */}
            <div className="stacked-progress-container">
              <span className="visualizer-header-title">Where each dollar goes:</span>
              <div className="allocation-progress-bar">
                {CATEGORIES.map(cat => {
                  const pct = allocations[cat.id] || 0;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={cat.id}
                      className="progress-segment"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat.color
                      }}
                      title={`${cat.name}: ${pct}%`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Donut Chart container */}
            <div className="chart-pie-container">
              {chartData.length > 0 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-chart-fallback">
                  📊 No allocations specified. Adjust sliders to see breakdown.
                </div>
              )}
            </div>

            {/* Live Financial Summary Data Table */}
            <div className="financial-data-table">
              <div className="table-row">
                <span className="data-name">Monthly Target Savings Pool:</span>
                <span className="data-val highlight">{formatCurrency(results.savingsPool)}</span>
              </div>
              {taxAware && (
                <div className="table-row">
                  <span className="data-name">Monthly Tax Savings:</span>
                  <span className="data-val green">{formatCurrency(results.taxSavings / 12)}/mo</span>
                </div>
              )}
              {enableMatch && results.annualEmployerMatch > 0 && (
                <div className="table-row">
                  <span className="data-name">Employer 401(k) Match:</span>
                  <span className="data-val emerald">{formatCurrency(results.annualEmployerMatch / 12)}/mo</span>
                </div>
              )}
              <div className="table-row total">
                <span className="data-name">Total Combined Annual Savings:</span>
                <span className="data-val">
                  {formatCurrency((results.savingsPool * 12) + results.annualEmployerMatch)}/yr
                </span>
              </div>
            </div>
          </div>

          {/* Guardrails Card */}
          <div className="glass-card guardrails-card">
            <h3 className="section-header">⚠️ Allocator Guardrails</h3>

            <div className="guardrails-list">
              {totalAllocationPct !== 100 ? (
                <div className="guardrail-alert error-alert">
                  <div className="alert-icon">❌</div>
                  <div className="alert-content">
                    <strong>Allocation Sum Mismatch:</strong> Your total allocation is {totalAllocationPct}%. It must sum to exactly 100% to run calculations. Click the "Auto-Balance" button above to fix this instantly.
                  </div>
                </div>
              ) : guardrails.length > 0 ? (
                guardrails.map((w, idx) => (
                  <div key={idx} className={`guardrail-alert ${w.type === 'error' ? 'error-alert' : 'warn-alert'}`}>
                    <div className="alert-icon">{w.type === 'error' ? '❌' : '⚠️'}</div>
                    <div className="alert-content">
                      <strong>{w.type === 'error' ? 'IRS Limit Violation: ' : 'Financial Risk Warning: '}</strong>
                      {w.message}
                    </div>
                  </div>
                ))
              ) : (
                <div className="guardrail-alert success-alert">
                  <div className="alert-icon">✅</div>
                  <div className="alert-content">
                    <strong>All guardrails passed!</strong> Your savings allocation plan is structurally sound, conforms to retirement contribution limits, and maintains a solid emergency fund strategy.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
