import React, { useState, useMemo, useEffect } from 'react';
import { calculateScenarios, validateInputs } from './calculations';
import AssumptionsPanel from './components/AssumptionsPanel';
import ComparisonChart from './components/ComparisonChart';
import ComparisonTable from './components/ComparisonTable';
import EducationHub from './components/EducationHub';
import MortgageComparer from './components/MortgageComparer';
import SimpleCalculator from './components/SimpleCalculator';
import CapitalGainsBreakdownCard from './components/CapitalGainsBreakdownCard';

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
  investmentPortfolioValue: 500000,
  investmentCostBasis: 350000,
  cashPurchaseDiscount: 50000,
  capitalGainsRate: 0.20,
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
  const [isWarningsOpen, setIsWarningsOpen] = useState(true);
  const [activeTool, setActiveTool] = useState('cashVsMortgageSimple'); // 'cashVsMortgageSimple' | 'cashVsMortgage' | 'mortgageComparer'

  // Mobile drawer & collapsible sections state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isTableSectionOpen, setIsTableSectionOpen] = useState(false);
  const [isEducationSectionOpen, setIsEducationSectionOpen] = useState(false);

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
    setInputs((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Run financial calculations dynamically
  const calcResults = useMemo(() => {
    return calculateScenarios(inputs, mortgageLeftoverDest, cashSavingsDest);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest]);

  const validation = useMemo(() => {
    return validateInputs(inputs);
  }, [inputs]);

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
            {activeTool === 'cashVsMortgageSimple' ? (
              <>
                <h1>Cash vs Mortgage (Simple)</h1>
                <p>Learn home buying basics, compounding, and leverage</p>
              </>
            ) : activeTool === 'cashVsMortgage' ? (
              <>
                <h1>Advanced Cash vs Mortgage (Tax-Aware)</h1>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
                  <span className="advanced-badge" style={{ marginTop: 0 }}>ADVANCED</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    For investors evaluating the tax impact of selling investments to buy a home.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h1>Mortgage Options Comparer</h1>
                <p>Analyze different mortgage terms, down payments, and rates side-by-side</p>
              </>
            )}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Tool Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.2rem', borderRadius: '6px', gap: '0.2rem' }}>
            <button
              onClick={() => setActiveTool('cashVsMortgageSimple')}
              style={{
                background: activeTool === 'cashVsMortgageSimple' ? 'var(--primary)' : 'transparent',
                color: activeTool === 'cashVsMortgageSimple' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Cash vs Mortgage (Simple)
            </button>
            <button
              onClick={() => setActiveTool('cashVsMortgage')}
              style={{
                background: activeTool === 'cashVsMortgage' ? 'var(--primary)' : 'transparent',
                color: activeTool === 'cashVsMortgage' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Advanced (Tax-Aware)
            </button>
            <button
              onClick={() => setActiveTool('mortgageComparer')}
              style={{
                background: activeTool === 'mortgageComparer' ? 'var(--primary)' : 'transparent',
                color: activeTool === 'mortgageComparer' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Compare Options
            </button>
          </div>

          <button
            className="btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {activeTool === 'cashVsMortgageSimple' ? (
        <main style={{ marginTop: '1.5rem' }}>
          <SimpleCalculator />
        </main>
      ) : activeTool === 'cashVsMortgage' ? (
        <div className="advanced-layout">
          {/* Overlay for mobile drawer */}
          {isMobileDrawerOpen && (
            <div className="drawer-overlay" onClick={() => setIsMobileDrawerOpen(false)} />
          )}

          {/* Left Column: Collapsible Sidebar for Assumptions */}
          <aside className={`assumptions-sidebar ${isMobileDrawerOpen ? 'open' : ''}`}>
            <div className="sidebar-header-mobile">
              <h3>Edit Assumptions</h3>
              <button className="close-drawer-btn" onClick={() => setIsMobileDrawerOpen(false)}>
                &times;
              </button>
            </div>
            <AssumptionsPanel inputs={inputs} onChange={handleInputChange} />
          </aside>

          {/* Right Column: Main Content Area */}
          <div className="advanced-main">
            {/* Mobile Sidebar Toggle */}
            <button
              className="mobile-sidebar-toggle"
              onClick={() => setIsMobileDrawerOpen(true)}
            >
              ⚙️ Edit Assumptions
            </button>

            {/* KPI Cards Grid */}
            <div className="kpi-dashboard-grid">
              <div className="kpi-card text-rose">
                <span className="kpi-card-title">Cash Buyer Tax</span>
                <span className="kpi-card-value">{formatCurrency(calcResults.cashBuyerTax)}</span>
                <span className="kpi-card-subtitle">Immediate Gains Tax</span>
              </div>
              <div className="kpi-card text-amber">
                <span className="kpi-card-title">Mortgage Buyer Tax</span>
                <span className="kpi-card-value">{formatCurrency(calcResults.mortgageBuyerTax)}</span>
                <span className="kpi-card-subtitle">Tax for Down Payment</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-card-title">Mortgage Buyer Starting Stock</span>
                <span className="kpi-card-value">
                  {formatCurrency(calcResults.mortgageBuyerStartingStock)}
                </span>
                <span className="kpi-card-subtitle">Stock after down payment tax</span>
              </div>
              <div className="kpi-card text-emerald">
                <span className="kpi-card-title">Annual Mortgage P&I</span>
                <span className="kpi-card-value">{formatCurrency(calcResults.annualPI)}</span>
                <span className="kpi-card-subtitle">
                  {formatCurrency(calcResults.annualPI / 12)}/month P&I
                </span>
              </div>
            </div>

            {/* Errors list */}
            {validation.errors.length > 0 && (
              <div
                className="glass-card"
                style={{
                  borderLeft: '4px solid var(--accent-rose)',
                  background: 'rgba(244, 63, 94, 0.05)',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <h3 style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', fontWeight: '700', margin: 0 }}>
                  ❌ Fix Your Assumptions
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings collapsible accordion */}
            {validation.warnings.length > 0 && validation.errors.length === 0 && (
              <div
                className="glass-card"
                style={{
                  borderLeft: '4px solid var(--accent-amber)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <button
                  onClick={() => setIsWarningsOpen(!isWarningsOpen)}
                  style={{
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'var(--accent-amber)',
                    fontSize: '0.85rem',
                    fontWeight: '700'
                  }}
                >
                  <span>⚠️ Check Your Assumptions ({validation.warnings.length})</span>
                  <span style={{ transition: 'transform 0.2s', transform: isWarningsOpen ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: '0.7rem' }}>▶</span>
                </button>

                {isWarningsOpen && (
                  <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {validation.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Comparison Chart */}
            <ComparisonChart
              data={calcResults.data.slice(0, zoomRange + 1)}
              visibleScenarios={visibleScenarios}
              onToggleScenario={handleToggleScenario}
              scenarioInfo={SCENARIO_INFO}
              yAxisMax={maxInvestNW}
              zoomRange={zoomRange}
              onZoomChange={setZoomRange}
              disabled={validation.errors.length > 0}
            />

            {/* Interactive Decisions Section */}
            <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <h3 className="interactive-decisions-title">Interactive Buying Decisions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Mortgage Buyer Choice */}
                <div className="segmented-control-container">
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    What happens to leftover cash? (Mortgage Buyer)
                  </span>
                  <div className="segmented-control">
                    {[
                      { val: 'invest', label: '📈 Invest' },
                      { val: 'savings', label: '🏦 Save' },
                      { val: 'cash', label: '💵 Hold Cash' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        className={`segmented-control-btn ${mortgageLeftoverDest === item.val ? 'active' : ''}`}
                        onClick={() => setMortgageLeftoverDest(item.val)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Buyer Choice */}
                <div className="segmented-control-container">
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    What happens to monthly savings? (Cash Buyer)
                  </span>
                  <div className="segmented-control">
                    {[
                      { val: 'invest', label: '📈 Invest Savings' },
                      { val: 'savings', label: '🏦 Save Savings' },
                      { val: 'cash', label: '💵 Spend Savings' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        className={`segmented-control-btn ${cashSavingsDest === item.val ? 'active' : ''}`}
                        onClick={() => setCashSavingsDest(item.val)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Calculation Breakdown Section (Capital Gains breakdown) */}
            {validation.errors.length === 0 && (
              <CapitalGainsBreakdownCard inputs={inputs} calcResults={calcResults} />
            )}

            {/* Detailed Tables Section */}
            <div className="dashboard-section-card">
              <button
                type="button"
                className="dashboard-section-header"
                onClick={() => setIsTableSectionOpen(!isTableSectionOpen)}
              >
                <h3 className="dashboard-section-title">
                  <span>📋</span> Detailed Amortization & Net Worth Table
                </h3>
                <span
                  className="dashboard-section-toggle-icon"
                  style={{ transform: isTableSectionOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  ▶
                </span>
              </button>
              {isTableSectionOpen && (
                <div style={{ marginTop: '1rem' }}>
                  <ComparisonTable
                    data={calcResults.data}
                    visibleScenarios={visibleScenarios}
                    scenarioInfo={SCENARIO_INFO}
                  />
                </div>
              )}
            </div>

            {/* Educational Content Section */}
            <div className="dashboard-section-card">
              <button
                type="button"
                className="dashboard-section-header"
                onClick={() => setIsEducationSectionOpen(!isEducationSectionOpen)}
              >
                <h3 className="dashboard-section-title">
                  <span>🎓</span> Advanced Financial Education Hub
                </h3>
                <span
                  className="dashboard-section-toggle-icon"
                  style={{ transform: isEducationSectionOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  ▶
                </span>
              </button>
              {isEducationSectionOpen && (
                <div style={{ marginTop: '1rem' }}>
                  <EducationHub />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <main style={{ marginTop: '1.5rem' }}>
          <MortgageComparer />
        </main>
      )}
    </div>
  );
}
