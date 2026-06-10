import React, { useState, useMemo, useEffect } from 'react';
import { calculateScenarios } from './calculations';
import AssumptionsPanel from './components/AssumptionsPanel';
import ComparisonChart from './components/ComparisonChart';
import ComparisonTable from './components/ComparisonTable';
import EducationHub from './components/EducationHub';

// Initial default inputs
const DEFAULT_INPUTS = {
  homePrice: 300000,
  downPaymentPercent: 0.20,
  mortgageTerm: 30,
  mortgageRate: 0.065,
  stockReturn: 0.08,
  homeAppreciation: 0.03,
  propertyTaxRate: 0.012,
  insuranceRate: 0.005,
  cashBuyerInitialStock: 0,
  mortgageBuyerInitialStock: 240000,
  cashPurchaseDiscount: 50000,
  capitalGainsRate: 0.20,
  taxablePortion: 1.0,
  savingsRate: 0.04
};

// Scenario Metadata
const SCENARIO_INFO = {
  cashBuyer: { label: 'Cash Buyer', dataKey: 'cashBuyerNW', color: '#6366f1' },
  mortgageBuyer: { label: 'Mortgage Buyer', dataKey: 'mortgageBuyerNW', color: '#10b981' }
};

export default function App() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'table' | 'education'
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  // Radio Decisions state
  const [mortgageLeftoverDest, setMortgageLeftoverDest] = useState('invest'); // 'invest' | 'savings' | 'cash'
  const [cashSavingsDest, setCashSavingsDest] = useState('invest'); // 'invest' | 'savings' | 'cash'

  // Chart Zoom Range state
  const [zoomRange, setZoomRange] = useState(30); // 5 | 10 | 15 | 30

  // Visibility state for each scenario
  const [visibleScenarios, setVisibleScenarios] = useState({
    cashBuyer: true,
    mortgageBuyer: true
  });

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle inputs change
  const handleInputChange = (key, value) => {
    setInputs((prev) => {
      const nextInputs = {
        ...prev,
        [key]: value
      };
      
      // Scale mortgage buyer's initial stock to 80% of home price when home price changes
      if (key === 'homePrice') {
        nextInputs.mortgageBuyerInitialStock = value * 0.80;
      }
      
      return nextInputs;
    });
  };

  // Run financial calculations dynamically
  const calcResults = useMemo(() => {
    return calculateScenarios(inputs, mortgageLeftoverDest, cashSavingsDest);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest]);

  // Calculate invested baseline for Y-axis scale based on zoom range
  const investResults = useMemo(() => {
    return calculateScenarios(inputs, 'invest', 'invest');
  }, [inputs]);

  const maxInvestNW = useMemo(() => {
    let maxVal = 0;
    const zoomedBaseline = investResults.data.slice(0, zoomRange + 1);
    zoomedBaseline.forEach((row) => {
      if (row.cashBuyerNW > maxVal) maxVal = row.cashBuyerNW;
      if (row.mortgageBuyerNW > maxVal) maxVal = row.mortgageBuyerNW;
    });
    return Math.ceil(maxVal * 1.05); // Add 5% padding
  }, [investResults, zoomRange]);

  // Toggle scenario visibility
  const handleToggleScenario = (key) => {
    setVisibleScenarios((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">🏡</div>
          <div className="brand-title">
            <h1>Cash vs. Mortgage Calculator</h1>
            <p>Compare home buying paths and long-term net worth</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Summary Widgets Strip */}
      <div className="summary-strip">
        <div className="summary-widget">
          <span className="widget-label">Cash Buyer Tax Paid</span>
          <span className="widget-value" style={{ color: 'var(--accent-rose)', WebkitTextFillColor: 'var(--accent-rose)' }}>
            {formatCurrency(calcResults.cashBuyerTax)}
          </span>
          <span className="widget-sub">Immediate Capital Gains Tax</span>
        </div>
        <div className="summary-widget">
          <span className="widget-label">Mortgage Buyer Tax Paid</span>
          <span className="widget-value" style={{ color: 'var(--accent-amber)', WebkitTextFillColor: 'var(--accent-amber)' }}>
            {formatCurrency(calcResults.mortgageBuyerTax)}
          </span>
          <span className="widget-sub">Tax Paid for Down Payment</span>
        </div>
        <div className="summary-widget">
          <span className="widget-label">Initial Uninvested Cash</span>
          <span className="widget-value">
            {formatCurrency(calcResults.initialUninvestedAmount)}
          </span>
          <span className="widget-sub">Mortgage buyer stock pot (Year 0)</span>
        </div>
        <div className="summary-widget">
          <span className="widget-label">Annual Mortgage P&I</span>
          <span className="widget-value" style={{ color: 'var(--accent-emerald)', WebkitTextFillColor: 'var(--accent-emerald)' }}>
            {formatCurrency(calcResults.annualPI)}
          </span>
          <span className="widget-sub">{formatCurrency(calcResults.annualPI / 12)}/month P&I payment</span>
        </div>
      </div>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Left Column: Assumptions */}
        <AssumptionsPanel inputs={inputs} onChange={handleInputChange} />

        {/* Right Column: Results & Interactive Views */}
        <div className="results-display">
          {/* Interactive Decisions Selector */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
              Interactive Buying Decisions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Mortgage Buyer Choice */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Mortgage leftover cash goes to:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 'invest', label: '📈 Invest (Stock)' },
                    { val: 'savings', label: '🏦 Savings Account' },
                    { val: 'cash', label: '💵 Hold as Cash' }
                  ].map((item) => (
                    <label
                      key={item.val}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        background: mortgageLeftoverDest === item.val ? 'var(--primary-light)' : 'transparent',
                        borderColor: mortgageLeftoverDest === item.val ? 'var(--primary)' : 'var(--border-color)',
                        color: mortgageLeftoverDest === item.val ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <input
                        type="radio"
                        name="mortgageLeftoverDest"
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

              {/* Cash Buyer Choice */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Cash Buyer monthly savings go to:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 'invest', label: '📈 Invest (Stock)' },
                    { val: 'savings', label: '🏦 Savings Account' },
                    { val: 'cash', label: '💵 Hold as Cash' }
                  ].map((item) => (
                    <label
                      key={item.val}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        background: cashSavingsDest === item.val ? 'var(--primary-light)' : 'transparent',
                        borderColor: cashSavingsDest === item.val ? 'var(--primary)' : 'var(--border-color)',
                        color: cashSavingsDest === item.val ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <input
                        type="radio"
                        name="cashSavingsDest"
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

          {/* Tab Navigation */}
          <nav className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              📊 Visual Chart
            </button>
            <button
              className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              📋 Calculation Table
            </button>
            <button
              className={`tab-btn ${activeTab === 'education' ? 'active' : ''}`}
              onClick={() => setActiveTab('education')}
            >
              🎓 Education Hub
            </button>
          </nav>

          {/* Active View Container */}
          {activeTab === 'chart' && (
            <ComparisonChart
              data={calcResults.data.slice(0, zoomRange + 1)}
              visibleScenarios={visibleScenarios}
              onToggleScenario={handleToggleScenario}
              scenarioInfo={SCENARIO_INFO}
              yAxisMax={maxInvestNW}
              zoomRange={zoomRange}
              onZoomChange={setZoomRange}
            />
          )}

          {activeTab === 'table' && (
            <ComparisonTable
              data={calcResults.data}
              visibleScenarios={visibleScenarios}
              scenarioInfo={SCENARIO_INFO}
            />
          )}

          {activeTab === 'education' && <EducationHub />}
        </div>
      </main>
    </div>
  );
}
