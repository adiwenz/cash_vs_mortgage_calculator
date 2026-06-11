import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  calculateMortgageScenarioData,
  validateMortgageScenario,
  calculateMonthlyPayment
} from '../calculations';

// Premium Scenario Colors
const SCENARIO_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#0ea5e9', // Sky Blue
  '#f43f5e'  // Rose
];

// Default Scenarios
const DEFAULT_SCENARIOS = [
  {
    id: '1',
    name: 'Scenario A: Low Down Payment',
    homePrice: 500000,
    downPaymentPercent: 0.05,
    mortgageRate: 0.065,
    mortgageTerm: 30,
    homeAppreciation: 0.03,
    stockReturn: 0.08,
    savingsRate: 0.04,
    cashAvailableToday: 150000,
    amountInvestedOutside: 100000,
    amountKeptInSavings: 25000,
    enabled: true,
    color: SCENARIO_COLORS[0]
  },
  {
    id: '2',
    name: 'Scenario B: Standard Down Payment',
    homePrice: 500000,
    downPaymentPercent: 0.20,
    mortgageRate: 0.065,
    mortgageTerm: 30,
    homeAppreciation: 0.03,
    stockReturn: 0.08,
    savingsRate: 0.04,
    cashAvailableToday: 150000,
    amountInvestedOutside: 40000,
    amountKeptInSavings: 10000,
    enabled: true,
    color: SCENARIO_COLORS[1]
  },
  {
    id: '3',
    name: 'Scenario C: Shorter Loan',
    homePrice: 500000,
    downPaymentPercent: 0.20,
    mortgageRate: 0.060,
    mortgageTerm: 15,
    homeAppreciation: 0.03,
    stockReturn: 0.08,
    savingsRate: 0.04,
    cashAvailableToday: 150000,
    amountInvestedOutside: 40000,
    amountKeptInSavings: 10000,
    enabled: true,
    color: SCENARIO_COLORS[2]
  }
];

const PERCENT_FIELDS = [
  'downPaymentPercent',
  'mortgageRate',
  'homeAppreciation',
  'stockReturn',
  'savingsRate'
];

// Helper to format dollar values
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// Helper for short dollar labels on chart Y axis
const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

export default function MortgageComparer() {
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [expandedId, setExpandedId] = useState('1'); // Expand first card by default
  const [compareMetric, setCompareMetric] = useState('netWorth'); // 'netWorth' | 'homeEquity' | 'balance' | 'interest' | 'monthlyPayment'
  const [tableMode, setTableMode] = useState('comparison'); // 'comparison' | 'detail'
  const [activeDetailScenarioId, setActiveDetailScenarioId] = useState('1');
  const [tableMetric, setTableMetric] = useState('netWorth'); // Metric for comparison table mode

  // 1. Calculate base scenario stats (errors, loanAmount, monthlyPI)
  const baseScenarios = useMemo(() => {
    return scenarios.map((scen) => {
      const errors = validateMortgageScenario(scen);
      let loanAmount = 0;
      let monthlyPI = 0;
      if (errors.length === 0) {
        loanAmount = Math.max(0, scen.homePrice - (scen.homePrice * scen.downPaymentPercent));
        monthlyPI = calculateMonthlyPayment(loanAmount, scen.mortgageRate, scen.mortgageTerm);
      }
      return {
        ...scen,
        errors,
        loanAmount,
        monthlyPI
      };
    });
  }, [scenarios]);

  // 2. Find the max monthly payment among all enabled, valid scenarios
  const maxMonthlyPayment = useMemo(() => {
    let maxPI = 0;
    baseScenarios.forEach((scen) => {
      if (scen.enabled && scen.errors.length === 0) {
        if (scen.monthlyPI > maxPI) {
          maxPI = scen.monthlyPI;
        }
      }
    });
    return maxPI;
  }, [baseScenarios]);

  // 3. Compute final calculated results with reinvestment of savings
  const calculatedScenarios = useMemo(() => {
    return baseScenarios.map((scen) => {
      let results = null;
      if (scen.errors.length === 0) {
        results = calculateMortgageScenarioData(scen, maxMonthlyPayment);
      }
      return {
        ...scen,
        results
      };
    });
  }, [baseScenarios, maxMonthlyPayment]);

  // Scenarios to include in comparison (enabled + no errors)
  const activeScenarios = useMemo(() => {
    return calculatedScenarios.filter((s) => s.enabled && s.errors.length === 0);
  }, [calculatedScenarios]);

  // Handle input changes
  const handleScenarioChange = (id, field, value) => {
    setScenarios((prev) =>
      prev.map((scen) => (scen.id === id ? { ...scen, [field]: value } : scen))
    );
  };

  // Duplicate scenario
  const handleDuplicateScenario = (id) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    const newId = Date.now().toString();
    const newColor = SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length];
    const newScenario = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      color: newColor
    };
    setScenarios((prev) => [...prev, newScenario]);
    setExpandedId(newId);
  };

  // Add a new empty scenario
  const handleAddScenario = () => {
    const newId = Date.now().toString();
    const newColor = SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length];
    const newScenario = {
      id: newId,
      name: `Scenario ${String.fromCharCode(65 + scenarios.length)}`,
      homePrice: 500000,
      downPaymentPercent: 0.20,
      mortgageRate: 0.065,
      mortgageTerm: 30,
      homeAppreciation: 0.03,
      stockReturn: 0.08,
      savingsRate: 0.04,
      cashAvailableToday: 150000,
      amountInvestedOutside: 40000,
      amountKeptInSavings: 10000,
      enabled: true,
      color: newColor
    };
    setScenarios((prev) => [...prev, newScenario]);
    setExpandedId(newId);
  };

  // Delete scenario
  const handleDeleteScenario = (id) => {
    if (scenarios.length <= 1) return;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (expandedId === id) {
      const remaining = scenarios.filter((s) => s.id !== id);
      setExpandedId(remaining[0]?.id || null);
    }
  };

  // Format chart line data dynamically by combining active scenarios
  const chartData = useMemo(() => {
    if (activeScenarios.length === 0) return [];
    
    // We compute up to 30 years
    const dataRows = [];
    for (let y = 0; y <= 30; y++) {
      const row = { year: y };
      activeScenarios.forEach((scen) => {
        const yearData = scen.results.data.find((d) => d.year === y);
        if (yearData) {
          if (compareMetric === 'netWorth') {
            row[scen.name] = Math.round(yearData.netWorth);
          } else if (compareMetric === 'homeEquity') {
            row[scen.name] = Math.round(yearData.homeEquity);
          } else if (compareMetric === 'balance') {
            row[scen.name] = Math.round(yearData.mortgageBalance);
          } else if (compareMetric === 'interest') {
            row[scen.name] = Math.round(yearData.cumulativeInterestPaid);
          }
        }
      });
      dataRows.push(row);
    }
    return dataRows;
  }, [activeScenarios, compareMetric]);

  // Bar chart data for Monthly Payment Comparison
  const barChartData = useMemo(() => {
    return activeScenarios.map((scen) => ({
      name: scen.name,
      'Monthly Payment': Math.round(scen.results.monthlyPI),
      color: scen.color
    }));
  }, [activeScenarios]);

  // Custom Line Chart Tooltip
  const CustomLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      return (
        <div className="custom-chart-tooltip">
          <p style={{ fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
            Year {label}
          </p>
          {sortedPayload.map((item) => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.2rem 0' }}>
              <span style={{ color: item.stroke || item.color, fontWeight: '600' }}>{item.name}:</span>
              <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom Bar Chart Tooltip
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="custom-chart-tooltip">
          <p style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{item.payload.name}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Monthly P&I:</span>
            <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Export Combined Table Data as CSV
  const handleExportCSV = () => {
    if (activeScenarios.length === 0) return;
    let csvContent = '';

    if (tableMode === 'comparison') {
      const headers = ['Year', ...activeScenarios.map((s) => `"${s.name} (${tableMetric.toUpperCase()})"`)] ;
      csvContent += headers.join(',') + '\n';
      
      for (let y = 0; y <= 30; y++) {
        const line = [y];
        activeScenarios.forEach((scen) => {
          const yearData = scen.results.data.find((d) => d.year === y);
          line.push(yearData ? Math.round(yearData[tableMetric]) : 0);
        });
        csvContent += line.join(',') + '\n';
      }
    } else {
      const targetScen = activeScenarios.find((s) => s.id === activeDetailScenarioId);
      if (!targetScen) return;
      csvContent += `Year,Home Value,Mortgage Balance,Home Equity,Investment Value,Savings Value,Net Worth\n`;
      targetScen.results.data.forEach((row) => {
        csvContent += `${row.year},${Math.round(row.homeValue)},${Math.round(row.mortgageBalance)},${Math.round(row.homeEquity)},${Math.round(row.investmentValue)},${Math.round(row.savingsValue)},${Math.round(row.netWorth)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mortgage_comparison_${tableMode}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mortgage-comparer-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Left Column: Scenario Manager */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Mortgage Scenarios</h2>
            <button
              onClick={handleAddScenario}
              className="btn-icon"
              style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem', gap: '0.25rem' }}
            >
              <span>➕</span> Add Scenario
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {calculatedScenarios.map((scen, idx) => (
              <ScenarioCard
                key={scen.id}
                scenario={scen}
                isExpanded={expandedId === scen.id}
                onExpandToggle={() => setExpandedId(expandedId === scen.id ? null : scen.id)}
                onChange={(field, value) => handleScenarioChange(scen.id, field, value)}
                onDuplicate={() => handleDuplicateScenario(scen.id)}
                onDelete={() => handleDeleteScenario(scen.id)}
                canDelete={scenarios.length > 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Graphs and Data */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Metric Chart Viewer */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className="card-title">Scenario Chart Visualizer</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Compare multiple mortgage setups side by side</span>
            </div>
            
            {/* Chart Metric Selector */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.25rem', borderRadius: '8px', flexWrap: 'wrap', gap: '0.25rem' }}>
              {[
                { val: 'netWorth', label: 'Net Worth' },
                { val: 'homeEquity', label: 'Equity' },
                { val: 'balance', label: 'Loan Balance' },
                { val: 'interest', label: 'Interest Paid' },
                { val: 'monthlyPayment', label: 'Monthly P&I' }
              ].map((m) => (
                <button
                  key={m.val}
                  onClick={() => setCompareMetric(m.val)}
                  style={{
                    background: compareMetric === m.val ? 'var(--primary)' : 'transparent',
                    color: compareMetric === m.val ? '#ffffff' : 'var(--text-secondary)',
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

          {/* Chart Display Area */}
          <div className="chart-container-inner" style={{ position: 'relative', height: '350px' }}>
            {activeScenarios.length === 0 ? (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '2rem',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  border: '1px dashed var(--accent-rose)'
                }}
              >
                <div>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                  No active or valid scenarios. <br />
                  <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                    Please check that you have enabled at least one scenario and corrected any errors on the left.
                  </span>
                </div>
              </div>
            ) : compareMetric === 'monthlyPayment' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 15, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
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
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="Monthly Payment" radius={[6, 6, 0, 0]}>
                    {barChartData.map((entry, idx) => (
                      <Bar key={`bar-${idx}`} dataKey="Monthly Payment" fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 15, right: 10, left: 10, bottom: 10 }}
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
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend />
                  {activeScenarios.map((scen) => (
                    <Line
                      key={scen.id}
                      type="monotone"
                      dataKey={scen.name}
                      stroke={scen.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Calculation Table */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <h2 className="card-title">Scenario Breakdowns Table</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Yearly ledger breakdown logs</span>
            </div>
            
            {/* Table Export/Toggle Options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Table Mode Selector */}
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.2rem', borderRadius: '6px' }}>
                <button
                  className={`tab-btn ${tableMode === 'comparison' ? 'active' : ''}`}
                  onClick={() => setTableMode('comparison')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', borderRadius: '4px' }}
                >
                  ⚖️ Compare Metric
                </button>
                <button
                  className={`tab-btn ${tableMode === 'detail' ? 'active' : ''}`}
                  onClick={() => setTableMode('detail')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', borderRadius: '4px' }}
                >
                  📝 Scenario Detail
                </button>
              </div>

              {activeScenarios.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="btn-icon"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.75rem', gap: '0.25rem' }}
                >
                  📥 Export CSV
                </button>
              )}
            </div>
          </div>

          {activeScenarios.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
              No active scenario data available to display.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Sub-Selectors depending on Table Mode */}
              {tableMode === 'comparison' ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0 0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Comparing Metric:</span>
                  {[
                    { val: 'netWorth', label: 'Net Worth' },
                    { val: 'homeEquity', label: 'Home Equity' },
                    { val: 'mortgageBalance', label: 'Loan Balance' },
                    { val: 'cumulativeInterestPaid', label: 'Interest Paid' }
                  ].map((m) => (
                    <button
                      key={m.val}
                      onClick={() => setTableMetric(m.val)}
                      style={{
                        background: tableMetric === m.val ? 'var(--primary-light)' : 'transparent',
                        color: tableMetric === m.val ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        border: '1px solid',
                        borderColor: tableMetric === m.val ? 'var(--primary)' : 'var(--border-color)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0 0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Detail Scenario:</span>
                  {activeScenarios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveDetailScenarioId(s.id)}
                      style={{
                        background: activeDetailScenarioId === s.id ? 'var(--primary-light)' : 'transparent',
                        color: activeDetailScenarioId === s.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        border: '1px solid',
                        borderColor: activeDetailScenarioId === s.id ? 'var(--primary)' : 'var(--border-color)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Table element */}
              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="comparison-table">
                  <thead>
                    {tableMode === 'comparison' ? (
                      <tr>
                        <th>Year</th>
                        {activeScenarios.map((s) => (
                          <th key={s.id} style={{ borderBottom: `2px solid ${s.color}` }}>{s.name}</th>
                        ))}
                      </tr>
                    ) : (
                      <tr>
                        <th>Year</th>
                        <th>Home Value</th>
                        <th>Mortgage Balance</th>
                        <th>Home Equity</th>
                        <th>Investments</th>
                        <th>Savings</th>
                        <th>Net Worth</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {/* Render rows for years 0 to 30 */}
                    {Array.from({ length: 31 }).map((_, y) => {
                      if (tableMode === 'comparison') {
                        return (
                          <tr key={y}>
                            <td style={{ fontWeight: '600' }}>{y}</td>
                            {activeScenarios.map((scen) => {
                              const yearData = scen.results.data.find((d) => d.year === y);
                              return (
                                <td key={scen.id} className="table-highlight-col">
                                  {yearData ? formatCurrency(yearData[tableMetric]) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      } else {
                        const targetScen = activeScenarios.find((s) => s.id === activeDetailScenarioId);
                        const row = targetScen?.results?.data?.find((d) => d.year === y);
                        if (!row) return null;
                        return (
                          <tr key={y}>
                            <td style={{ fontWeight: '600' }}>{y}</td>
                            <td>{formatCurrency(row.homeValue)}</td>
                            <td>{y === 0 && row.mortgageBalance === 0 ? '-' : formatCurrency(row.mortgageBalance)}</td>
                            <td>{formatCurrency(row.homeEquity)}</td>
                            <td>{formatCurrency(row.investmentValue)}</td>
                            <td>{formatCurrency(row.savingsValue)}</td>
                            <td className="table-highlight-col">{formatCurrency(row.netWorth)}</td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stateful ScenarioCard Component
function ScenarioCard({ scenario, isExpanded, onExpandToggle, onChange, onDuplicate, onDelete, canDelete }) {
  const [localValues, setLocalValues] = useState({});
  const activeFieldRef = useRef(null);

  // Sync parent updates into local values if input is not focused
  useEffect(() => {
    const nextLocals = { ...localValues };
    let changed = false;

    Object.keys(scenario).forEach((key) => {
      if (activeFieldRef.current !== key && key !== 'id' && key !== 'name' && key !== 'color' && key !== 'enabled' && key !== 'errors' && key !== 'results') {
        const rawVal = scenario[key];
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
  }, [scenario]);

  const handleInputChange = (key, valueString) => {
    let sanitized = valueString.replace(/^0+(?=\d)/, '');
    const isPercent = PERCENT_FIELDS.includes(key);

    // Clamping percentages to 100% max
    if (sanitized !== '' && sanitized !== '.') {
      const parsedVal = parseFloat(sanitized);
      if (!isNaN(parsedVal)) {
        if (isPercent && parsedVal > 100) {
          sanitized = '100';
        } else if (isPercent && parsedVal < 0) {
          sanitized = '0';
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
    const rawVal = scenario[key];
    const isPercent = PERCENT_FIELDS.includes(key);
    const displayVal = isPercent ? (rawVal * 100).toFixed(1) : rawVal.toString();

    setLocalValues((prev) => ({
      ...prev,
      [key]: displayVal
    }));
  };

  const renderCardInput = (key, label, isPercent = false, isCurrency = false, step = 1) => {
    const valString = localValues[key] ?? '';

    return (
      <div className="input-wrapper" key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
            {isCurrency && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: '600' }}>$</span>}
            <input
              type="number"
              className="input-number-box"
              style={{ width: '85px', fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: 'auto' }}
              value={valString}
              step={isPercent ? step * 100 : step}
              onFocus={() => { activeFieldRef.current = key; }}
              onChange={(e) => handleInputChange(key, e.target.value)}
              onBlur={() => handleBlur(key)}
            />
            {isPercent && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: '600' }}>%</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '1rem', 
        border: '1px solid var(--border-color)', 
        borderLeft: `4px solid ${scenario.color}`, 
        background: 'var(--bg-tertiary)',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.75rem' 
      }}
    >
      
      {/* Scenario Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={scenario.enabled}
            onChange={(e) => onChange('enabled', e.target.checked)}
            style={{ accentColor: scenario.color }}
          />
          <input
            type="text"
            className="input-number-box"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              fontSize: '0.85rem', 
              fontWeight: '600', 
              color: 'var(--text-primary)', 
              padding: 0, 
              width: '160px', 
              boxShadow: 'none',
              cursor: 'text'
            }}
            value={scenario.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Scenario Name"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button 
            onClick={onDuplicate} 
            className="btn-icon" 
            title="Duplicate Scenario" 
            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
          >
            📋 Dup
          </button>
          {canDelete && (
            <button 
              onClick={onDelete} 
              className="btn-icon" 
              title="Delete Scenario" 
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)' }}
            >
              🗑️ Del
            </button>
          )}
          <button 
            onClick={onExpandToggle} 
            className="btn-icon" 
            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
          >
            {isExpanded ? '▲ Collapse' : '▼ Edit'}
          </button>
        </div>
      </div>

      {/* Render Card Errors inline */}
      {scenario.errors.length > 0 && (
        <div 
          style={{ 
            background: 'rgba(244, 63, 94, 0.05)', 
            border: '1px solid var(--accent-rose)', 
            borderRadius: '6px', 
            padding: '0.5rem 0.75rem', 
            fontSize: '0.75rem', 
            color: 'var(--accent-rose)' 
          }}
        >
          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {scenario.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Card Content: Form (Expanded) or Summaries (Collapsed) */}
      {isExpanded ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '0.25rem 0 0.1rem 0', textTransform: 'uppercase' }}>Home & Loan</h4>
            {renderCardInput('homePrice', 'Home Price', false, true, 10000)}
            {renderCardInput('downPaymentPercent', 'Down Payment %', true, false, 0.01)}
            {renderCardInput('mortgageRate', 'Mortgage Rate', true, false, 0.001)}
            {renderCardInput('mortgageTerm', 'Term (Years)', false, false, 1)}
            {renderCardInput('homeAppreciation', 'Appreciation', true, false, 0.001)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '0.25rem 0 0.1rem 0', textTransform: 'uppercase' }}>Assets & Cash</h4>
            {renderCardInput('cashAvailableToday', 'Cash Today', false, true, 10000)}
            {renderCardInput('amountInvestedOutside', 'Investments', false, true, 10000)}
            {renderCardInput('amountKeptInSavings', 'Savings', false, true, 5000)}
            {renderCardInput('stockReturn', 'Stock Return', true, false, 0.001)}
            {renderCardInput('savingsRate', 'Savings Rate', true, false, 0.001)}
          </div>
        </div>
      ) : (
        scenario.errors.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Monthly P&I</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.results.monthlyPI)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Down Payment</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.homePrice * scenario.downPaymentPercent)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Loan Amount</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.results.loanAmount)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Total Interest</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.results.totalInterestPaid)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>NW Year 10</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.results.data[10]?.netWorth || 0)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>NW Year 30</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(scenario.results.data[30]?.netWorth || 0)}</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
