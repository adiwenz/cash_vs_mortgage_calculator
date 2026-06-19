import { useState, useMemo, useEffect } from 'react';
import { calculateScenarios, validateInputs, getNumParam, getStrParam } from './calculations';
import AssumptionsPanel from './components/AssumptionsPanel';
import ComparisonChart from './components/ComparisonChart';
import ComparisonTable from './components/ComparisonTable';
import EducationHub from './components/EducationHub';
import MortgageComparer from './features/mortgage/MortgageComparer';
import SimpleCalculator from './features/calculator/SimpleCalculator';
import CapitalGainsBreakdownCard from './components/CapitalGainsBreakdownCard';
import FireSimulator from './components/FireSimulator';
import SavingsAllocator from './components/SavingsAllocator';
import CreditCardBehavior from './features/debt/CreditCardBehavior';
import logoImg from './assets/logo.png';

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
  cashBuyer: { label: 'Cash Buyer', dataKey: 'cashBuyerNW', color: '#0d9488' }, // Teal
  mortgageBuyer: { label: 'Mortgage Buyer', dataKey: 'mortgageBuyerNW', color: '#f59e0b' } // Amber
};

export default function App() {
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(30);
  const [colorBlindMode, setColorBlindMode] = useState(false);
  // On mount, parse tool from URL query parameter
  const [activeTool, setActiveTool] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool === 'advanced') return 'cashVsMortgage';
    if (tool === 'compare') return 'mortgageComparer';
    if (tool === 'fire') return 'fireSimulator';
    if (tool === 'allocator') return 'savingsAllocator';
    if (tool === 'creditcard') return 'creditCardBehavior';
    return 'cashVsMortgageSimple';
  });

  const [inputs, setInputs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('tool');
    if (tool !== 'advanced') return DEFAULT_INPUTS;

    return {
      homePrice: getNumParam(params, 'homePrice', DEFAULT_INPUTS.homePrice),
      downPaymentPercent: getNumParam(params, 'downPaymentPercent', DEFAULT_INPUTS.downPaymentPercent),
      mortgageTerm: getNumParam(params, 'mortgageTerm', DEFAULT_INPUTS.mortgageTerm),
      mortgageRate: getNumParam(params, 'mortgageRate', DEFAULT_INPUTS.mortgageRate),
      stockReturn: getNumParam(params, 'stockReturn', DEFAULT_INPUTS.stockReturn),
      homeAppreciation: getNumParam(params, 'homeAppreciation', DEFAULT_INPUTS.homeAppreciation),
      propertyTaxRate: getNumParam(params, 'propertyTaxRate', DEFAULT_INPUTS.propertyTaxRate),
      insuranceRate: getNumParam(params, 'insuranceRate', DEFAULT_INPUTS.insuranceRate),
      investmentPortfolioValue: getNumParam(params, 'investmentPortfolioValue', DEFAULT_INPUTS.investmentPortfolioValue),
      investmentCostBasis: getNumParam(params, 'investmentCostBasis', DEFAULT_INPUTS.investmentCostBasis),
      cashPurchaseDiscount: getNumParam(params, 'cashPurchaseDiscount', DEFAULT_INPUTS.cashPurchaseDiscount),
      capitalGainsRate: getNumParam(params, 'capitalGainsRate', DEFAULT_INPUTS.capitalGainsRate),
      savingsRate: getNumParam(params, 'savingsRate', DEFAULT_INPUTS.savingsRate)
    };
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  }); // 'dark' | 'light'
  const [isWarningsOpen, setIsWarningsOpen] = useState(true);

  // Mobile drawer & collapsible sections state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isTableSectionOpen, setIsTableSectionOpen] = useState(false);
  const [isEducationSectionOpen, setIsEducationSectionOpen] = useState(false);

  // Radio Decisions state
  const [mortgageLeftoverDest, setMortgageLeftoverDest] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tool') === 'advanced' ? getStrParam(params, 'mortgageLeftoverDest', 'invest') : 'invest';
  });

  const [cashSavingsDest, setCashSavingsDest] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tool') === 'advanced' ? getStrParam(params, 'cashSavingsDest', 'invest') : 'invest';
  });

  // Chart Zoom Range state
  const [zoomRange, setZoomRange] = useState(30); // 5 | 10 | 15 | 30

  // Visibility state for each scenario
  const [visibleScenarios, setVisibleScenarios] = useState({
    cashBuyer: true,
    mortgageBuyer: true
  });

  // URL state synchronization for active tool and browser back/forward buttons
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('tool')) {
      params.set('tool', 'simple');
      window.history.replaceState(null, '', `?${params.toString()}`);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const tool = p.get('tool');
      if (tool === 'advanced') {
        setActiveTool('cashVsMortgage');
      } else if (tool === 'compare') {
        setActiveTool('mortgageComparer');
      } else if (tool === 'fire') {
        setActiveTool('fireSimulator');
      } else if (tool === 'allocator') {
        setActiveTool('savingsAllocator');
      } else if (tool === 'creditcard') {
        setActiveTool('creditCardBehavior');
      } else {
        setActiveTool('cashVsMortgageSimple');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activeTool !== 'cashVsMortgage') return;
    const params = new URLSearchParams(window.location.search);
    params.set('tool', 'advanced');
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
  }, [inputs, mortgageLeftoverDest, cashSavingsDest, activeTool]);

  // Handle active tool changes via navigation click
  const handleToolSwitch = (tool) => {
    setActiveTool(tool);
    const params = new URLSearchParams();
    if (tool === 'cashVsMortgageSimple') {
      params.set('tool', 'simple');
    } else if (tool === 'cashVsMortgage') {
      params.set('tool', 'advanced');
    } else if (tool === 'fireSimulator') {
      params.set('tool', 'fire');
    } else if (tool === 'savingsAllocator') {
      params.set('tool', 'allocator');
    } else if (tool === 'creditCardBehavior') {
      params.set('tool', 'creditcard');
    } else {
      params.set('tool', 'compare');
    }
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle inputs change
  const handleInputChange = (key, value) => {
    setInputs((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setMortgageLeftoverDest('invest');
    setCashSavingsDest('invest');
  };

  // Run financial calculations dynamically
  const calcResults = useMemo(() => {
    return calculateScenarios(inputs, mortgageLeftoverDest, cashSavingsDest);
  }, [inputs, mortgageLeftoverDest, cashSavingsDest]);

  const selectedYearData = useMemo(() => {
    if (!calcResults || !calcResults.data) return null;
    return calcResults.data.find(row => row.year === selectedYear) || calcResults.data[30] || calcResults.data[calcResults.data.length - 1];
  }, [calcResults, selectedYear]);

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
          <img src={logoImg} alt="ProsperCalc" className="brand-logo-img" />
          <div className="brand-separator" />
          <div className="brand-title">
            {activeTool === 'cashVsMortgageSimple' ? (
              <>
                <h1>Cash v. Mortgage</h1>
                <p>Learn home buying basics, compounding, and leverage</p>
              </>
            ) : activeTool === 'cashVsMortgage' ? (
              <>
                <h1>Tax-Aware Cash v. Mortgage</h1>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
                  <span className="advanced-badge" style={{ marginTop: 0 }}>ADVANCED</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    For investors evaluating the tax impact of selling investments to buy a home.
                  </p>
                </div>
              </>
            ) : activeTool === 'fireSimulator' ? (
              <>
                <h1>FIRE & Life Simulator</h1>
                <p>Interactive compounding life-planning and financial independence simulator</p>
              </>
            ) : activeTool === 'savingsAllocator' ? (
              <>
                <h1>Savings Allocator</h1>
                <p>Optimize your monthly savings across different accounts and taxes</p>
              </>
            ) : activeTool === 'creditCardBehavior' ? (
              <>
                <h1>Credit Card Behavior</h1>
                <p>Educational debt compounding and payment behavior simulator</p>
              </>
            ) : (
              <>
                <h1>Compare Mortgages</h1>
                <p>Analyze different mortgage terms, down payments, and rates side-by-side</p>
              </>
            )}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Hamburger Menu - Always visible */}
          <div className="nav-hamburger">
            <button
              className="hamburger-btn"
              onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
              title="Switch calculator"
            >
              <span className="hamburger-icon">
                <span /><span /><span />
              </span>
            </button>
            {isNavMenuOpen && (
              <>
                <div className="hamburger-overlay" onClick={() => setIsNavMenuOpen(false)} />
                <div className="hamburger-dropdown">
                  {[
                    { tool: 'cashVsMortgageSimple', label: 'Cash v. Mortgage' },
                    { tool: 'cashVsMortgage', label: 'Tax-Aware Cash v. Mortgage' },
                    { tool: 'mortgageComparer', label: 'Compare Mortgages' },
                    { tool: 'fireSimulator', label: 'FIRE & Life Simulator' },
                    { tool: 'savingsAllocator', label: 'Savings Allocator' },
                    { tool: 'creditCardBehavior', label: 'Credit Card Behavior' }
                  ].map((item) => (
                    <button
                      key={item.tool}
                      className={`hamburger-item ${activeTool === item.tool ? 'active' : ''}`}
                      onClick={() => {
                        handleToolSwitch(item.tool);
                        setIsNavMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
          {/* Left Column: Sidebar for Assumptions (desktop only) */}
          <aside className="assumptions-sidebar assumptions-desktop-only">
            <AssumptionsPanel inputs={inputs} onChange={handleInputChange} onReset={handleReset} />
          </aside>

          {/* Right Column: Main Content Area */}
          <div className="advanced-main">
            {/* Edit Assumptions Button - visible on medium/small screens only */}
            <button
              className="edit-assumptions-btn"
              onClick={() => setIsMobileDrawerOpen(true)}
            >
              ⚙️ Edit Assumptions
            </button>

            {/* Assumptions Modal - centered overlay */}
            {isMobileDrawerOpen && (
              <>
                <div className="simple-modal-overlay" onClick={() => setIsMobileDrawerOpen(false)} />
                <div className="simple-modal">
                  <div className="simple-modal-content">
                    <AssumptionsPanel
                      inputs={inputs}
                      onChange={handleInputChange}
                      onReset={handleReset}
                      onClose={() => setIsMobileDrawerOpen(false)}
                    />
                  </div>
                </div>
              </>
            )}

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
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              colorBlindMode={colorBlindMode}
              onColorBlindModeChange={setColorBlindMode}
            />

            {/* Yearly Milestone Estimates Section */}
            {validation.errors.length === 0 && (
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
                              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(selectedYearData.homeValue - selectedYearData.mortgageBalance)}</span>
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
            )}

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
      ) : activeTool === 'fireSimulator' ? (
        <main style={{ marginTop: '1.5rem', width: '100%' }}>
          <FireSimulator />
        </main>
      ) : activeTool === 'savingsAllocator' ? (
        <main style={{ marginTop: '1.5rem', width: '100%' }}>
          <SavingsAllocator />
        </main>
      ) : activeTool === 'creditCardBehavior' ? (
        <main style={{ marginTop: '1.5rem', width: '100%' }}>
          <CreditCardBehavior />
        </main>
      ) : (
        <main style={{ marginTop: '1.5rem' }}>
          <MortgageComparer />
        </main>
      )}
    </div>
  );
}
