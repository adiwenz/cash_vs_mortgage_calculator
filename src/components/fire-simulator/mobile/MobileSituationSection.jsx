import React, { useState } from 'react';
import MobileResults from '../MobileResults';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getAssetLabel } from '../helpers';

function LedgerRow({ row, formatCurrency }) {
  const [expanded, setExpanded] = useState(false);
  const isPos = row.type === 'positive';
  const isNeg = row.type === 'negative';
  const sign = isPos ? '+' : isNeg ? '-' : '';
  const color = isPos ? 'var(--accent-emerald)' : isNeg ? 'var(--accent-rose)' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: '0.75rem', 
          color: row.isSummary ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: row.expandable ? 'pointer' : 'default',
          padding: row.isSummary ? '0.3rem 0 0.15rem 0' : '0.15rem 0',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
          borderTop: row.isSummary ? '1px dashed var(--border-color)' : 'none',
          marginTop: row.isSummary ? '0.2rem' : '0',
          fontWeight: row.isSummary ? '700' : 'normal'
        }}
        onClick={() => row.expandable && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {row.isTransfer && <span>🔄</span>}
          <span>{sign} {row.label}</span>
          {row.expandable && (
            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted, #a1a1aa)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
        <strong style={{ color: row.isSummary ? (row.type === 'neutral' ? 'var(--text-primary)' : 'var(--accent-emerald)') : color }}>
          {sign}{formatCurrency(Math.abs(row.value))}
        </strong>
      </div>

      {row.helperText && (
        <div style={{ 
          fontSize: '0.68rem', 
          color: 'var(--text-muted)', 
          opacity: 0.85, 
          paddingLeft: row.isTransfer ? '1.2rem' : '0.4rem', 
          marginTop: '-0.15rem', 
          marginBottom: '0.1rem',
          fontStyle: 'italic',
          lineHeight: '1.2'
        }}>
          {row.helperText}
        </div>
      )}
      
      {row.expandable && expanded && row.details && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.25rem', 
          paddingLeft: '1rem', 
          fontSize: '0.7rem', 
          color: 'var(--text-secondary)',
          opacity: 0.9,
          borderLeft: '1px dashed var(--border-color)',
          marginLeft: '0.25rem',
          marginTop: '0.1rem',
          marginBottom: '0.25rem'
        }}>
          {row.details.paidFromSavings !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid From Savings</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(row.details.paidFromSavings)}</span>
            </div>
          )}
          {row.details.financed !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Financed</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(row.details.financed)}</span>
            </div>
          )}
          {row.details.currentDebtBalance !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current Debt Balance</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(row.details.currentDebtBalance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileSituationSection({
  activeTab,
  simulation,
  timeline,
  chartData,
  activeResults,
  selectedYear,
  setSelectedYear,
  activeChart,
  setActiveChart,
  inputs,
  displayedResults,
  displayedBaselineResults,
  formatCurrency,
  formatCompactCurrency,
  isMobileLedgerExpanded,
  setIsMobileLedgerExpanded,
  updateInput,
  handleAssetChange,
  
  selectedMobilePhaseId,
  setSelectedMobilePhaseId,
  selectedPhaseObj,
  prevPhaseObj,
  whyPhaseExistsOpen,
  setWhyPhaseExistsOpen,
  getWhyPhaseExistsItems,
  getPhaseTags,
  handleSetBudgetClick,
  isPlanOnTrack
}) {
  if (activeTab === 'Results') {
    const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
    const yearData = chartData.find(d => d.age === activeYear);
    const isWorking = activeYear < displayedResults.targetRetirementAge;

    return (
      <div>
        <h1 className="mobile-tab-title">Results</h1>
        <p className="mobile-tab-subtitle">Compare projections and view progress charts</p>

        {/* Swipe Tab Bar */}
        <div className="mobile-chart-tabs-scroller">
          {[
            { id: 'netWorth', label: 'Net Worth' },
            { id: 'assetsDebt', label: 'Assets vs Debt' },
            { id: 'progress', label: 'Financial Freedom Progress' },
            { id: 'incomeSpending', label: 'Income vs Spending' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`mobile-chart-tab-btn ${activeChart === tab.id ? 'active' : ''}`}
              onClick={() => setActiveChart(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Chart Box */}
        <MobileResults
          simulation={simulation}
          timeline={timeline}
          chartData={chartData}
          activeResults={activeResults}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          activeChart={activeChart}
          setActiveChart={setActiveChart}
        />

        {/* Financial Snapshot Card */}
        {yearData && (
          <div className="mobile-card" style={{ marginTop: '1.25rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                🔍 Age {activeYear} Financial Snapshot
              </h3>
              <span className="badge" style={{ 
                fontSize: '0.65rem', 
                padding: '0.15rem 0.45rem', 
                background: isWorking ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                color: isWorking ? 'var(--primary)' : 'var(--accent-emerald)',
                border: `1px solid ${isWorking ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                borderRadius: '12px',
                fontWeight: '600'
              }}>
                {isWorking ? 'Working' : 'Retired'}
              </span>
            </div>

            {/* KPI Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Net Worth</span>
                <strong style={{ fontSize: '0.95rem', color: yearData.netWorth < 0 ? 'var(--accent-rose)' : 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                  {formatCompactCurrency(yearData.netWorth)}
                </strong>
              </div>
              <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio / Assets</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                  {formatCompactCurrency(yearData.assets)}
                </strong>
              </div>
              {yearData.debt > 0 && (
                <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Total Debt</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--accent-rose)', display: 'block', marginTop: '0.15rem' }}>
                    {formatCompactCurrency(yearData.debt)}
                  </strong>
                </div>
              )}
              <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                  {formatCompactCurrency(yearData.income)}
                </strong>
              </div>
              <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.15rem' }}>
                  {formatCompactCurrency(yearData.expenses - (yearData.taxes || 0))}
                </strong>
              </div>
              <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {yearData.withdrawals > 0 ? 'Withdrawals' : 'Net Savings'}
                </span>
                <strong style={{ 
                  fontSize: '0.95rem', 
                  color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', 
                  display: 'block', 
                  marginTop: '0.15rem' 
                }}>
                  {yearData.withdrawals > 0 ? `-${formatCompactCurrency(yearData.withdrawals)}` : `+${formatCompactCurrency(yearData.savings)}`}
                </strong>
              </div>
            </div>

            {/* Net Worth Ledger */}
            {yearData.netWorthLedger && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    📒 Net Worth Change
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMobileLedgerExpanded(!isMobileLedgerExpanded)}
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--primary)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.15rem 0.4rem',
                      fontWeight: '600'
                    }}
                  >
                    {isMobileLedgerExpanded ? 'Hide details ▴' : 'Show details ▾'}
                  </button>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Starting Net Worth:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(yearData.netWorthLedger.startingNetWorth)}
                    </strong>
                  </div>

                  {isMobileLedgerExpanded && [
                    { key: 'incomeInvesting', label: 'Income & Investing' },
                    { key: 'lifeEvents', label: 'Life Events' },
                    { key: 'homeActivity', label: 'Home Purchase Activity' },
                    { key: 'debtActivity', label: 'Debt Activity' }
                  ].map(sec => {
                    const secRows = yearData.netWorthLedger.rows.filter(r => r.section === sec.key);
                    if (secRows.length === 0) return null;
                    return (
                      <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.6 }}>
                          {sec.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.4rem' }}>
                          {sec.key === 'homeActivity' ? (
                            [
                              { key: 'homePurchased', label: '🏠 Home Purchased' },
                              { key: 'equityTransfer', label: '🔄 Cash → Home Equity (No Net Worth Impact)' },
                              { key: 'purchaseCosts', label: '💸 Purchase Costs' },
                              { key: 'homeOwnership', label: '🏡 Home Ownership' }
                            ].map(sub => {
                              const subRows = secRows.filter(r => r.subgroup === sub.key);
                              if (subRows.length === 0) return null;
                              return (
                                <div key={sub.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.1rem', marginBottom: '0.15rem' }}>
                                    {sub.label}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.4rem' }}>
                                    {sub.key === 'equityTransfer' ? (
                                      subRows.map((row, rIdx) => (
                                        <div key={rIdx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.15rem 0' }}>
                                          {row.helperText}
                                        </div>
                                      ))
                                    ) : (
                                      subRows.map((row, rIdx) => (
                                        <LedgerRow key={rIdx} row={row} formatCurrency={formatCurrency} />
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            secRows.map((row, rIdx) => (
                              <LedgerRow key={rIdx} row={row} formatCurrency={formatCurrency} />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    borderTop: isMobileLedgerExpanded ? '1px solid var(--border-color)' : 'none',
                    paddingTop: isMobileLedgerExpanded ? '0.35rem' : '0',
                    fontWeight: '700'
                  }}>
                    <span>Ending Net Worth:</span>
                    <strong style={{ color: yearData.netWorthLedger.endingNetWorth < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      {formatCurrency(yearData.netWorthLedger.endingNetWorth)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Flow Details Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                📊 Cash Flow Details
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Gross Earned Income:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(yearData.income)}</span>
                </div>
                {inputs.includeTaxes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Progressive Taxes Paid:</span>
                    <span style={{ color: 'var(--accent-rose)', fontWeight: '600' }}>-{formatCurrency(yearData.taxes || 0)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Base Lifestyle Expenses:</span>
                  <span style={{ color: 'var(--accent-rose)', fontWeight: '600' }}>-{formatCurrency(yearData.expenses - (yearData.taxes || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem', marginTop: '0.15rem' }}>
                  <span>Net Annual Surplus / Cash Flow:</span>
                  <span style={{ color: yearData.savings >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: '700' }}>
                    {yearData.savings >= 0 ? '+' : ''}{formatCurrency(yearData.savings)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'Details') {
    return (
      <div className="mobile-details-section">
        <h1 className="mobile-tab-title">Settings & Details</h1>
        <p className="mobile-tab-subtitle">Configure advanced settings, starting balances, and assumptions</p>

        {/* Account Starting Balances Card */}
        <div className="mobile-card" style={{ textAlign: 'left' }}>
          <div className="mobile-details-group-title">🎯 Starting Account Balances</div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.35rem 0 1rem 0', lineHeight: '1.4' }}>
            Set starting assets. Changes update model outcomes instantly.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { key: 'cash', label: 'Cash / Checking Balance' },
              { key: 'emergencyFund', label: 'HYSA / Emergency Fund' },
              { key: 'brokerage', label: 'Taxable Brokerage' },
              { key: 'trad401k', label: 'Pre-Tax 401(k) / 403(b)' },
              { key: 'tradIra', label: 'Traditional IRA' },
              { key: 'rothIra', label: 'Roth IRA' },
              { key: 'hsa', label: 'Health Savings (HSA)' },
              { key: 'other', label: 'Other Assets / Accounts' }
            ].map(item => (
              <div key={item.key} className="mobile-input-row">
                <div className="mobile-input-label-col">
                  <span className="mobile-input-title">{item.label}</span>
                </div>
                <div className="mobile-input-box-wrapper">
                  <input
                    type="number"
                    className="mobile-input-box"
                    value={inputs.assets?.[item.key] || 0}
                    onChange={(e) => handleAssetChange(item.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Assumptions Card */}
        <div className="mobile-card" style={{ textAlign: 'left' }}>
          <div className="mobile-details-group-title">⚙️ Global Plan Assumptions</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">Pre-Retire Return (%)</span>
                <span className="mobile-input-desc">Annual expected growth rate before retirement</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.expectedReturn}
                  onChange={(e) => updateInput('expectedReturn', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">Post-Retire Return (%)</span>
                <span className="mobile-input-desc">Expected return once retired</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.postRetirementReturn !== undefined ? inputs.postRetirementReturn : inputs.expectedReturn}
                  onChange={(e) => updateInput('postRetirementReturn', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">Cash Return Rate (%)</span>
                <span className="mobile-input-desc">Checking and cash return rate</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.cashReturnRate !== undefined ? inputs.cashReturnRate : 2.0}
                  onChange={(e) => updateInput('cashReturnRate', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">Inflation Rate (%)</span>
                <span className="mobile-input-desc">Annual cost of living increase</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.inflationRate}
                  onChange={(e) => updateInput('inflationRate', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">SWR / Withdrawal Rate (%)</span>
                <span className="mobile-input-desc">Safe Withdrawal Rate target (e.g. 4%)</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.swr}
                  onChange={(e) => updateInput('swr', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mobile-input-row">
              <div className="mobile-input-label-col">
                <span className="mobile-input-title">Lifestyle Upgrades (%)</span>
                <span className="mobile-input-desc">Annual spending growth over inflation</span>
              </div>
              <div className="mobile-input-box-wrapper">
                <input
                  type="number"
                  step="0.1"
                  className="mobile-input-box"
                  value={inputs.lifestyleUpgrades || 0}
                  onChange={(e) => updateInput('lifestyleUpgrades', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Settings Card */}
        <div className="mobile-card" style={{ textAlign: 'left' }}>
          <div className="mobile-details-group-title">⚖️ Taxes & Progressive Logic</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            <div className="mobile-input-row">
              <label className="mobile-checkbox-label">
                <input
                  type="checkbox"
                  checked={inputs.includeTaxes}
                  onChange={(e) => updateInput('includeTaxes', e.target.checked)}
                />
                <span>Include Federal Progressive Taxes</span>
              </label>
            </div>

            {inputs.includeTaxes && (
              <div className="mobile-input-row">
                <div className="mobile-input-label-col">
                  <span className="mobile-input-title">Filing Status</span>
                </div>
                <div className="mobile-input-box-wrapper">
                  <select
                    className="mobile-input-box"
                    style={{ textAlign: 'left', paddingRight: '0.2rem' }}
                    value={inputs.filingStatus || 'single'}
                    onChange={(e) => updateInput('filingStatus', e.target.value)}
                  >
                    <option value="single">Single</option>
                    <option value="married">Married Joint</option>
                    <option value="headOfHousehold">Head of Household</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Config Card */}
        <div className="mobile-card" style={{ textAlign: 'left' }}>
          <div className="mobile-details-group-title">🛠️ Advanced Configuration</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            <div className="mobile-input-row">
              <label className="mobile-checkbox-label">
                <input
                  type="checkbox"
                  checked={inputs.enableHealthcareModel !== false}
                  onChange={(e) => updateInput('enableHealthcareModel', e.target.checked)}
                />
                <span>Enable Healthcare Cost Modeling</span>
              </label>
            </div>

            {inputs.enableHealthcareModel !== false && (
              <>
                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Pre-Medicare Premium</span>
                    <span className="mobile-input-desc">Annual private healthcare cost</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      className="mobile-input-box"
                      value={inputs.preMedicarePremium || 10000}
                      onChange={(e) => updateInput('preMedicarePremium', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="mobile-input-row">
                  <div className="mobile-input-label-col">
                    <span className="mobile-input-title">Medicare Premium</span>
                    <span className="mobile-input-desc">Annual Medicare cost (age 65+)</span>
                  </div>
                  <div className="mobile-input-box-wrapper">
                    <input
                      type="number"
                      className="mobile-input-box"
                      value={inputs.medicarePremium || 4000}
                      onChange={(e) => updateInput('medicarePremium', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Phase details overlay full-screen
  if (selectedMobilePhaseId && selectedPhaseObj) {
    const allocations = [];
    const phaseSavingsTotal = Object.values(selectedPhaseObj.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) +
                             (selectedPhaseObj.isMarried ? Object.values(selectedPhaseObj.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0);

    if (phaseSavingsTotal >= 0) {
      const combined = {};
      const addSavings = (obj) => {
        if (!obj) return;
        Object.entries(obj).forEach(([k, v]) => {
          const val = Number(v) || 0;
          if (val > 0) combined[k] = (combined[k] || 0) + val;
        });
      };
      addSavings(selectedPhaseObj.savings);
      if (selectedPhaseObj.isMarried) addSavings(selectedPhaseObj.partnerSavings);

      const totalAlloc = Object.values(combined).reduce((sum, v) => sum + v, 0);
      Object.entries(combined).forEach(([k, v]) => {
        allocations.push({
          key: k,
          label: getAssetLabel(k),
          amount: v,
          pct: totalAlloc > 0 ? Math.round((v / totalAlloc) * 100) : 0
        });
      });
    } else {
      const withdrawalAmt = Math.abs(phaseSavingsTotal);
      allocations.push(
        { key: 'brokerage', label: 'Taxable Brokerage', amount: Math.round(withdrawalAmt * 0.5), pct: 50 },
        { key: 'rothIra', label: 'Roth IRA', amount: Math.round(withdrawalAmt * 0.3), pct: 30 },
        { key: 'cash', label: 'Cash Reserve', amount: Math.round(withdrawalAmt * 0.2), pct: 20 }
      );
    }

    const barColors = ['bar-green', 'bar-blue', 'bar-purple', 'bar-orange', 'bar-teal'];

    const logs = displayedResults.data.filter(d => d.age >= selectedPhaseObj.startAge && d.age < selectedPhaseObj.endAge);
    const avgIncome = logs.reduce((sum, d) => sum + (d.income || 0), 0) / Math.max(1, logs.length);
    const avgSavings = logs.reduce((sum, d) => sum + (d.savings || 0), 0) / Math.max(1, logs.length);
    const phaseSurplusVal = Math.round(avgSavings / 12);
    const phaseSavingsRateVal = avgIncome > 0 ? Math.round((avgSavings / avgIncome) * 100) : 0;

    const baseLogs = displayedBaselineResults.data.filter(d => d.age >= selectedPhaseObj.startAge && d.age < selectedPhaseObj.endAge);
    const baseAvgIncome = baseLogs.reduce((sum, d) => sum + (d.income || 0), 0) / Math.max(1, baseLogs.length);
    const baseAvgSavings = baseLogs.reduce((sum, d) => sum + (d.savings || 0), 0) / Math.max(1, baseLogs.length);
    const baseSurplus = Math.round(baseAvgSavings / 12);
    const baseSavingsRate = baseAvgIncome > 0 ? Math.round((baseAvgSavings / baseAvgIncome) * 100) : 0;

    const nwAt85 = Math.round(displayedResults.data.find(d => d.age === 85)?.netWorth || 0);
    const baseNwAt85 = Math.round(displayedBaselineResults.data.find(d => d.age === 85)?.netWorth || 0);

    const surplusDiff = phaseSurplusVal - baseSurplus;
    const rateDiff = phaseSavingsRateVal - baseSavingsRate;
    const nwDiff = nwAt85 - baseNwAt85;

    return (
      <div className="mobile-detail-overlay">
        {/* Overlay Navbar */}
        <nav className="mobile-detail-navbar">
          <button 
            type="button" 
            className="mobile-icon-btn"
            onClick={() => setSelectedMobilePhaseId(null)}
            aria-label="Back to Roadmap"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="mobile-logo-text" style={{ fontSize: '1.1rem' }}>
            <Sparkles size={16} className="mobile-logo-sparkle" fill="#a78bfa" />
            Finley
          </span>
        </nav>

        {/* Overlay Body */}
        <div className="mobile-detail-body">
          {/* Phase Hero */}
          <div className="mobile-detail-hero-section">
            <span className="mobile-detail-emoji">{selectedPhaseObj.icon}</span>
            <h1 className="mobile-detail-title">{selectedPhaseObj.label}</h1>
            <span className="mobile-detail-meta">
              Age {selectedPhaseObj.startAge}–{selectedPhaseObj.endAge} &nbsp;•&nbsp; 📅 {selectedPhaseObj.endAge - selectedPhaseObj.startAge} years
            </span>
            <div className="mobile-detail-tags-row">
              {getPhaseTags(selectedPhaseObj).map((tag, idx) => (
                <span key={idx} className={`mobile-tag tag-${tag.color}`}>
                  {tag.text}
                </span>
              ))}
            </div>
          </div>

          {/* Why Collapsible */}
          <div className="mobile-card" style={{ textAlign: 'left' }}>
            <button 
              type="button" 
              className="mobile-collapsible-btn"
              onClick={() => setWhyPhaseExistsOpen(!whyPhaseExistsOpen)}
            >
              <span> Why this phase exists</span>
              <span>{whyPhaseExistsOpen ? '▲' : '▼'}</span>
            </button>
            
            {whyPhaseExistsOpen && (
              <div className="mobile-collapsible-content">
                {getWhyPhaseExistsItems(selectedPhaseObj, prevPhaseObj).map((item, idx) => {
                  if (item.isNetChange) {
                    return (
                      <div key={idx} className="mobile-dropdown-item mobile-dropdown-item-net">
                        <span>{item.label}</span>
                        <span className={item.isPositive ? 'mobile-dropdown-val-positive' : 'mobile-dropdown-val-negative'}>
                          {item.value}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="mobile-dropdown-item">
                      <span>{item.label}</span>
                      <span className={item.isPositive ? 'mobile-dropdown-val-positive' : 'mobile-dropdown-val-negative'}>
                        {item.value}
                      </span>
                    </div>
                  );
                })}
                {getWhyPhaseExistsItems(selectedPhaseObj, prevPhaseObj).length === 0 && (
                  <div className="mobile-dropdown-item" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                    Standard budget configuration remains unchanged.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Budget Card */}
          <div className="mobile-card" style={{ textAlign: 'left' }}>
            <div className="mobile-budget-header-row">
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                Budget <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>(Monthly)</span>
              </span>
              <button 
                type="button" 
                className="mobile-budget-edit-btn"
                onClick={() => {
                  setSelectedMobilePhaseId(null);
                  handleSetBudgetClick(selectedPhaseObj.id);
                }}
              >
                Edit
              </button>
            </div>

            <div className="mobile-budget-income-section">
              <div className="mobile-budget-income-label">Income</div>
              <div className="mobile-budget-income-val">{formatCompactCurrency(selectedPhaseObj.income || 0)}</div>
              <div className="mobile-budget-income-sub">After tax</div>
            </div>

            {(() => {
              const phaseNeedsTotal = (Number(selectedPhaseObj.expenses?.housing) || 0) +
                                     (Number(selectedPhaseObj.expenses?.utilities) || 0) +
                                     (Number(selectedPhaseObj.expenses?.food) || 0) +
                                     (Number(selectedPhaseObj.expenses?.transportation) || 0) +
                                     (Number(selectedPhaseObj.expenses?.healthcare) || 0) +
                                     (selectedPhaseObj.isMarried ? (Number(selectedPhaseObj.expenses?.debt) || 0) : 0) +
                                     (Number(selectedPhaseObj.expenses?.childcare) || 0) +
                                     (selectedPhaseObj.activeDebts || []).reduce((sum, d) => sum + (Number(selectedPhaseObj.expenses?.[`debt_${d.id}`]) || d.monthlyPayment || 0), 0);

              const phaseWantsTotal = (Number(selectedPhaseObj.expenses?.leisure) || 0) +
                                     (Number(selectedPhaseObj.expenses?.diningOut) || 0) +
                                     (Number(selectedPhaseObj.expenses?.misc) || 0);

              const incomeVal = Math.max(1, selectedPhaseObj.income || 0);
              const needsPct = Math.round((phaseNeedsTotal / incomeVal) * 100);
              const wantsPct = Math.round((phaseWantsTotal / incomeVal) * 100);
              const savingsPct = Math.round((Math.abs(phaseSavingsTotal) / incomeVal) * 100);

              return (
                <div className="mobile-budget-categories-row">
                  <div className="mobile-budget-cat">
                    <div className="mobile-budget-cat-label">Needs</div>
                    <div className="mobile-budget-cat-val val-red">{formatCompactCurrency(phaseNeedsTotal)}</div>
                    <div className="mobile-budget-cat-pct">{needsPct}%</div>
                  </div>
                  <div className="mobile-budget-cat">
                    <div className="mobile-budget-cat-label">Wants</div>
                    <div className="mobile-budget-cat-val val-orange">{formatCompactCurrency(phaseWantsTotal)}</div>
                    <div className="mobile-budget-cat-pct">{wantsPct}%</div>
                  </div>
                  <div className="mobile-budget-cat">
                    <div className="mobile-budget-cat-label">Save & Invest</div>
                    <div className="mobile-budget-cat-val val-blue">
                      {phaseSavingsTotal < 0 ? '-' : ''}{formatCompactCurrency(Math.abs(phaseSavingsTotal))}
                    </div>
                    <div className="mobile-budget-cat-pct">{savingsPct}%</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Allocation List */}
          <div className="mobile-card" style={{ textAlign: 'left' }}>
            <div className="mobile-budget-header-row">
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                {phaseSavingsTotal >= 0 ? 'Savings Allocation' : 'Withdrawal Distribution'} 
                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>(Monthly)</span>
              </span>
              <button 
                type="button" 
                className="mobile-budget-edit-btn"
                onClick={() => {
                  setSelectedMobilePhaseId(null);
                  handleSetBudgetClick(selectedPhaseObj.id);
                }}
              >
                Edit
              </button>
            </div>
            
            <div className="mobile-allocation-list" style={{ marginTop: '0.85rem' }}>
              {allocations.map((alloc, idx) => {
                const colorClass = barColors[idx % barColors.length];
                return (
                  <div key={alloc.key} className="mobile-allocation-item">
                    <div className="mobile-alloc-header-row">
                      <span className="mobile-alloc-name">{alloc.label}</span>
                      <div className="mobile-alloc-metrics">
                        <span className="mobile-alloc-pct">{alloc.pct}%</span>
                        <span className="mobile-alloc-amount">{formatCurrency(alloc.amount)}</span>
                      </div>
                    </div>
                    <div className="mobile-progress-track">
                      <div 
                        className={`mobile-progress-fill ${colorClass}`}
                        style={{ width: `${alloc.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {allocations.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                  No contributions configured for this phase.
                </div>
              )}
            </div>
          </div>

          {/* Impact Grid */}
          <div className="mobile-card" style={{ textAlign: 'left' }}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.85rem' }}>Impact of This Phase</h3>
            
            <div className="mobile-impact-grid">
              <div className="mobile-impact-item">
                <div className="mobile-impact-label">Monthly Surplus</div>
                <div className="mobile-impact-val" style={{ color: phaseSurplusVal >= 0 ? '#10b981' : '#f43f5e' }}>
                  {formatCurrency(phaseSurplusVal)}/mo
                </div>
                {surplusDiff !== 0 && (
                  <div className="mobile-impact-was">
                    was {formatCurrency(baseSurplus)}
                    <span className={surplusDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                      {surplusDiff > 0 ? '▲' : '▼'}
                    </span>
                  </div>
                )}
              </div>

              <div className="mobile-impact-item">
                <div className="mobile-impact-label">Savings Rate</div>
                <div className="mobile-impact-val">{phaseSavingsRateVal}%</div>
                {rateDiff !== 0 && (
                  <div className="mobile-impact-was">
                    was {baseSavingsRate}%
                    <span className={rateDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                      {rateDiff > 0 ? '▲' : '▼'}
                    </span>
                  </div>
                )}
              </div>

              <div className="mobile-impact-item">
                <div className="mobile-impact-label">Can Stop Working Age</div>
                <div className="mobile-impact-val" style={{ color: isPlanOnTrack ? '#10b981' : '#f59e0b' }}>
                  {isPlanOnTrack ? 'On Track' : 'Delayed'}
                </div>
                <div className="mobile-impact-was" style={{ fontSize: '0.65rem' }}>
                  Ready at {activeResults.retirementReadyAge || 'N/A'}
                </div>
              </div>

              <div className="mobile-impact-item">
                <div className="mobile-impact-label">NW at Age 85</div>
                <div className="mobile-impact-val">{formatCurrency(nwAt85)}</div>
                {nwDiff !== 0 && (
                  <div className="mobile-impact-was">
                    was {formatCurrency(baseNwAt85)}
                    <span className={nwDiff > 0 ? 'was-arrow-up' : 'was-arrow-down'}>
                      {nwDiff > 0 ? '▲' : '▼'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="mobile-sticky-footer">
          <button 
            type="button" 
            className="mobile-sticky-btn"
            onClick={() => {
              setSelectedMobilePhaseId(null);
              handleSetBudgetClick(selectedPhaseObj.id);
            }}
          >
            Edit This Phase
          </button>
        </div>
      </div>
    );
  }

  return null;
}
