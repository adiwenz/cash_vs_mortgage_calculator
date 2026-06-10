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
  savingsRate: 0.04,
  investmentRate503020: 0.08
};

// Scenario Metadata
const SCENARIO_INFO = {
  cashBuyer: { label: 'Cash Buyer', dataKey: 'cashBuyerNW', color: '#6366f1' },
  cashBuyerHomeOnly: { label: 'Cash Buyer Home-Only', dataKey: 'cashBuyerHomeOnlyNW', color: '#f43f5e' },
  mortgageBuyer: { label: 'Mortgage Buyer', dataKey: 'mortgageBuyerNW', color: '#10b981' },
  keptAsCash: { label: 'Mortgage - Kept as Cash', dataKey: 'keptAsCashNW', color: '#f59e0b' },
  savingsAccount: { label: 'Mortgage - Savings Account', dataKey: 'savingsAccountNW', color: '#8b5cf6' },
  completelySpent: { label: 'Mortgage - Completely Spent', dataKey: 'completelySpentNW', color: '#64748b' },
  budgeted503020: { label: 'Mortgage - 50/30/20 Budget', dataKey: 'budgeted503020NW', color: '#ec4899' }
};

export default function App() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'table' | 'education'
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  // Visibility state for each scenario
  const [visibleScenarios, setVisibleScenarios] = useState({
    cashBuyer: true,
    cashBuyerHomeOnly: true,
    mortgageBuyer: true,
    keptAsCash: true,
    savingsAccount: true,
    completelySpent: true,
    budgeted503020: true
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
    return calculateScenarios(inputs);
  }, [inputs]);

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
              data={calcResults.data}
              visibleScenarios={visibleScenarios}
              onToggleScenario={handleToggleScenario}
              scenarioInfo={SCENARIO_INFO}
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
