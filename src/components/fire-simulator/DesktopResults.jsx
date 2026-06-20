import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatCurrency, formatYAxis } from './helpers';
import { ChildCostsBuckets } from './ChildImpactModal';

const generateLifeStory = (inp, results) => {
  const list = [];
  const curAge = inp.currentAge || 35;
  
  inp.incomeList.forEach(inc => {
    if (inc.startAge > curAge) {
      const isIncrease = inc.incomeChangeType === 'increaseByAmount';
      const amountVal = isIncrease 
        ? (inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) 
        : (inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount);
      list.push({
        age: inc.startAge,
        text: `Start new career: "${inc.name}" earning ${isIncrease ? 'an extra ' : ''}${formatCurrency(amountVal)}/yr`
      });
    }
  });

  inp.spendingPhases.forEach(phase => {
    if (phase.startAge > curAge) {
      list.push({
        age: phase.startAge,
        text: `Change lifestyle: "${phase.name}" costing ${formatCurrency(phase.frequency === 'monthly' ? phase.amount * 12 : phase.amount)}/yr${phase.movingCost ? ` (one-time moving cost: ${formatCurrency(phase.movingCost)})` : ''}`
      });
    }
  });

  inp.lifeEvents.forEach(ev => {
    if (ev.enabled) {
      if (ev.type === 'buyHouse') {
        const asset = (ev.houseId && inp.houseAssets)
          ? inp.houseAssets.find(h => h.id === ev.houseId)
          : ev;
        const price = asset ? (asset.homePrice !== undefined ? asset.homePrice : asset.purchasePrice) : ev.homePrice;
        const pType = asset ? asset.purchaseType : ev.purchaseType;
        const ageVal = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
        list.push({
          age: ageVal,
          text: `Buy a home for ${formatCurrency(price)} (${pType === 'cash' ? 'in cash' : 'with mortgage'})`
        });
      } else if (ev.type === 'haveChild') {
        const supportEndParentAge = Number(ev.birthAge) + (ev.includeCollege ? 22 : 18);
        const childCurrentAge = Math.max(0, curAge - Number(ev.birthAge));
        const bornText = Number(ev.birthAge) < curAge 
          ? `(already born, current age ${childCurrentAge}, support ends at parent age ${supportEndParentAge})` 
          : `(support ends at parent age ${supportEndParentAge})`;
        list.push({
          age: Number(ev.birthAge),
          text: `Have a child${ev.childName ? ` "${ev.childName}"` : ''} ${bornText}`
        });
      } else if (ev.type === 'college') {
        list.push({
          age: Number(ev.startAge),
          text: `Start paying college tuition of ${formatCurrency(ev.tuitionCost)}/yr`
        });
      } else if (ev.type === 'careerChange') {
        list.push({
          age: Number(ev.startAge),
          text: `Change career to "${ev.name}" earning ${formatCurrency(ev.newIncome)}/yr`
        });
      } else if (ev.type === 'spouseCareerChange') {
        list.push({
          age: Number(ev.startAge),
          text: `Spouse changes career to "${ev.name}" earning ${formatCurrency(ev.newIncome)}/yr`
        });
      } else if (ev.type === 'marriage') {
        list.push({
          age: Number(ev.marriageAge),
          text: `Get Married! Combined household income increases by ${formatCurrency(ev.spouseIncome)}/yr`
        });
      }
    }
  });

  inp.debtList.forEach(debt => {
    if (debt.enabled) {
      list.push({
        age: debt.startAge,
        text: `Take on debt: "${debt.name}" of ${formatCurrency(debt.balance)} at ${debt.interestRate}% interest`
      });
    }
  });

  // Sort list chronologically by age
  list.sort((a, b) => a.age - b.age);

  // Group events by age
  const grouped = {};
  list.forEach(item => {
    if (!grouped[item.age]) grouped[item.age] = [];
    grouped[item.age].push(item.text);
  });

  // Generate HTML blocks
  const ages = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  if (ages.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem 1rem', fontSize: '0.82rem' }}>
        No major planned events on your timeline yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
      {ages.map(age => (
        <div key={age} style={{ display: 'flex', gap: '1rem', borderLeft: '2px solid var(--primary)', paddingLeft: '0.85rem', marginLeft: '0.25rem' }}>
          <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem', minWidth: '45px' }}>
            Age {age}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {grouped[age].map((text, idx) => (
              <div key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

function LedgerRow({ row, formatCurrency }) {
  const [expanded, setExpanded] = useState(false);
  const isPos = row.type === 'positive';
  const isNeg = row.type === 'negative';
  const sign = isPos ? '+' : isNeg ? '-' : '';
  const color = isPos ? 'var(--success)' : isNeg ? 'var(--danger)' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: '0.8rem', 
          color: row.isSummary ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: row.expandable ? 'pointer' : 'default',
          padding: row.isSummary ? '0.3rem 0 0.15rem 0' : '0.15rem 0',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
          borderTop: row.isSummary ? '1px dashed var(--border)' : 'none',
          marginTop: row.isSummary ? '0.2rem' : '0',
          fontWeight: row.isSummary ? '700' : 'normal'
        }}
        onClick={() => row.expandable && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {row.isTransfer && <span>🔄</span>}
          <span>{sign} {row.label}</span>
          {row.expandable && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #a1a1aa)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
        <strong style={{ color: row.isSummary ? (row.type === 'neutral' ? 'var(--text-primary)' : 'var(--success)') : color }}>
          {sign}{formatCurrency(Math.abs(row.value))}
        </strong>
      </div>

      {row.helperText && (
        <div style={{ 
          fontSize: '0.7rem', 
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
          fontSize: '0.75rem', 
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

export default function DesktopResults({
  simulation,
  scenario,
  timeline,
  eventController,
  
  // Legacy:
  inputs: legacyInputs,
  displayedResults: legacyDisplayedResults,
  chartData: legacyChartData,
  validation: legacyValidation,
  selectedYear: legacySelectedYear,
  setSelectedYear: legacySetSelectedYear,
  handleEditRoadmapEvent: legacyHandleEditRoadmapEvent,
  
  showAssets,
  setShowAssets,
  showDebt,
  setShowDebt,
  showNetWorth,
  setShowNetWorth
}) {
  const inputs = scenario?.inputs ?? legacyInputs;
  const displayedResults = simulation?.displayedResults ?? legacyDisplayedResults;
  const chartData = simulation?.chartData ?? legacyChartData;
  const validation = simulation?.validation ?? legacyValidation;
  const selectedYear = timeline?.selectedYear ?? legacySelectedYear;
  const setSelectedYear = timeline?.setSelectedYear ?? legacySetSelectedYear;
  const handleEditRoadmapEvent = eventController?.handleEditRoadmapEvent ?? legacyHandleEditRoadmapEvent;
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);
  return (
    <>
      {/* Wealth Journey Graph (Full Width, directly below timeline) */}
      {validation.errors.length === 0 && (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Projected Net Worth
                <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                  <span className="toggle-tooltip-icon">i</span>
                  <span className="toggle-tooltip-text" style={{ textTransform: 'none', fontWeight: 'normal' }}>
                    Shows values at the start of the fiscal year.
                  </span>
                </span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Updates live • Click chart to view detailed benchmarks below</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={showAssets}
                  onChange={(e) => setShowAssets(e.target.checked)}
                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ color: '#10b981', fontWeight: '700' }}>Assets (Green)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={showDebt}
                  onChange={(e) => setShowDebt(e.target.checked)}
                  style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                />
                <span style={{ color: '#ef4444', fontWeight: '700' }}>Debt (Red)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={showNetWorth}
                  onChange={(e) => setShowNetWorth(e.target.checked)}
                  style={{ accentColor: '#1e3a5f', cursor: 'pointer' }}
                />
                <span style={{ color: '#1e3a5f', fontWeight: '700' }}>Net Worth (Navy)</span>
              </label>
            </div>
          </div>
          <div className="chart-container-inner" style={{ height: '240px', cursor: 'crosshair' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    setSelectedYear(Number(data.activeLabel));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="age"
                  stroke="var(--text-tertiary)"
                  fontFamily="var(--font-body)"
                  fontSize={10}
                />
                <YAxis
                  stroke="var(--text-tertiary)"
                  fontFamily="var(--font-body)"
                  fontSize={10}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-chart-tooltip">
                          <p style={{ fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                            Age {label}
                          </p>
                          {payload.map((item) => (
                            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.2rem 0' }}>
                              <span style={{ color: item.stroke || item.color, fontWeight: '500' }}>{item.name}:</span>
                              <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="assets"
                  name="Total Assets"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  hide={!showAssets}
                />
                <Line
                  type="monotone"
                  dataKey="debt"
                  name="Total Debt"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  hide={!showDebt}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  name="Net Worth"
                  stroke="#1e3a5f"
                  strokeWidth={2.5}
                  dot={false}
                  hide={!showNetWorth}
                />

                {/* 1. Planned Retirement Age */}
                {displayedResults.targetRetirementAge && (
                  <ReferenceLine
                    x={displayedResults.targetRetirementAge}
                    stroke="#a855f7"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    label={{
                      value: `Stop Working: Age ${displayedResults.targetRetirementAge}`,
                      position: 'insideTopRight',
                      fill: 'var(--text-primary)',
                      fontSize: 9,
                      dy: 10
                    }}
                  />
                )}

                {/* 2. Retirement Ready Age */}
                {displayedResults.retirementReadyAge && (
                  <ReferenceLine
                    x={displayedResults.retirementReadyAge}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `${inputs.readinessCriteria === 'lastsLifeExp' ? 'Sustainable' : inputs.readinessCriteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite'} Ready: Age ${displayedResults.retirementReadyAge}`,
                      position: 'insideTopRight',
                      fill: 'var(--text-primary)',
                      fontSize: 9,
                      dy: 25
                    }}
                  />
                )}

                {/* 3. Assets Depleted Age */}
                {displayedResults.runOutAge && (
                  <ReferenceLine
                    x={displayedResults.runOutAge}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Assets Run Out: Age ${displayedResults.runOutAge}`,
                      position: 'insideTopRight',
                      fill: 'var(--text-primary)',
                      fontSize: 9,
                      dy: 40
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {((inputs.lifeEvents || []).some(e => e.type === 'haveChild' && e.enabled) || displayedResults.runOutAge !== null) && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.65rem 0.85rem',
              background: 'rgba(99, 102, 241, 0.04)',
              border: '1px dashed rgba(99, 102, 241, 0.25)',
              borderRadius: '6px',
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.45'
            }}>
              <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>💡</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Lifecycle Planning Note:</strong> Temporary deficits or portfolio drawdowns (where your Net Worth line dips or flattens, such as during high-expense childcare/daycare years or early stop working years) are a normal and <strong>perfectly acceptable part of a long-term financial roadmap</strong>. As long as your portfolio recovery projections climb back up in the long run, your plan remains sustainable.
              </div>
            </div>
          )}
          {displayedResults.yearsWithLimitsReached > 0 && (
            <div style={{ 
              background: 'rgba(99, 102, 241, 0.08)', 
              border: '1px solid rgba(99, 102, 241, 0.2)', 
              borderRadius: '6px', 
              padding: '0.35rem 0.75rem',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              <span>ℹ️</span>
              <span style={{ lineHeight: '1.45' }}>
                Retirement account limits were reached in <strong>{displayedResults.yearsWithLimitsReached} years</strong> of the simulation. <strong>{formatCurrency(displayedResults.totalRedirectedSavings)}</strong> of additional savings were automatically invested in <strong>{displayedResults.redirectedToCash ? 'cash accounts' : 'taxable brokerage accounts'}</strong>.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="roadmap-grid-layout">
        {/* Left Column: Plan Story */}
        <div className="roadmap-grid-col-left">
          {/* Life Story Summary */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <h2 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Life Plan</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Select a life decision or milestone from the dropdown above the timeline to add it. Drag events on the timeline above or edit them below to map out your roadmap.
            </p>
            {generateLifeStory(inputs, displayedResults)}
          </div>
          <ChildCostsBuckets
            inputs={inputs}
            handleEditRoadmapEvent={handleEditRoadmapEvent}
          />
        </div>

        {/* Right Column: Graphs, Snapshot, and Settings */}
        <div className="roadmap-grid-col-right">
          {/* Benchmarks Snapshot */}
          {validation.errors.length === 0 && (() => {
            const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
            const yearData = chartData.find(d => d.age === activeYear);
            if (!yearData) return null;

            const isWorking = activeYear < displayedResults.targetRetirementAge;
            
            return (
              <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    🔍 Age {activeYear} Financial Snapshot
                  </h3>
                  <span className="badge" style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem', 
                    background: isWorking ? 'var(--secondary-light)' : 'var(--success-light)', 
                    color: isWorking ? 'var(--secondary)' : 'var(--success)',
                    border: `1px solid ${isWorking ? 'rgba(30, 58, 95, 0.25)' : 'rgba(22, 163, 74, 0.25)'}`,
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    {isWorking ? 'Working' : 'Retired'}
                  </span>
                </div>

                {/* KPI Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Net Worth</span>
                    <strong style={{ fontSize: '1.05rem', color: yearData.netWorth < 0 ? 'var(--danger)' : 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.netWorth)}</strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio Value / Total Assets</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.assets)}</strong>
                  </div>
                  {yearData.debt > 0 && (
                    <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Total Debt</span>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--danger)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.debt)}</strong>
                    </div>
                  )}
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.income)}</strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                      {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                    </strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {yearData.withdrawals > 0 ? 'Withdrawals' : 'Net Savings'}
                    </span>
                    <strong style={{ 
                      fontSize: '1.05rem', 
                      color: yearData.withdrawals > 0 ? 'var(--danger)' : 'var(--success)', 
                      display: 'block', 
                      marginTop: '0.25rem' 
                    }}>
                      {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                    </strong>
                  </div>
                </div>

                {/* Net Worth Ledger */}
                {yearData.netWorthLedger && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', margin: 0 }}>
                        📒 Net Worth Change This Year
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.15rem 0.4rem',
                          fontWeight: '600'
                        }}
                      >
                        {isLedgerExpanded ? 'Hide details ▴' : 'Show details ▾'}
                      </button>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Starting Net Worth:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(yearData.netWorthLedger.startingNetWorth)}
                        </strong>
                      </div>
                      
                      {isLedgerExpanded && [
                        { key: 'incomeInvesting', label: 'Income & Investing' },
                        { key: 'lifeEvents', label: 'Life Events' },
                        { key: 'homeActivity', label: 'Home Purchase Activity' },
                        { key: 'debtActivity', label: 'Debt Activity' }
                      ].map(sec => {
                        const secRows = yearData.netWorthLedger.rows.filter(r => r.section === sec.key);
                        if (secRows.length === 0) return null;
                        return (
                          <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.6 }}>
                              {sec.label}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.4rem' }}>
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
                                      <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.1rem', marginBottom: '0.15rem' }}>
                                        {sub.label}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.4rem' }}>
                                        {sub.key === 'equityTransfer' ? (
                                          subRows.map((row, rIdx) => (
                                            <div key={rIdx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.15rem 0' }}>
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
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                        borderTop: isLedgerExpanded ? '1px solid var(--border-color)' : 'none',
                        paddingTop: isLedgerExpanded ? '0.4rem' : '0',
                        marginTop: '0.1rem',
                        fontWeight: '700'
                      }}>
                        <span>Ending Net Worth:</span>
                        <strong style={{ color: yearData.netWorthLedger.endingNetWorth < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {formatCurrency(yearData.netWorthLedger.endingNetWorth)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash Flow Details Breakdown */}
                <div style={{ marginTop: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    📊 Cash Flow Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border)', paddingBottom: '0.25rem' }}>
                      <span>Base Annual Spending:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(Math.max(0, yearData.expenses - (yearData.taxes || 0) - (yearData.childCosts || 0)))}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border)', paddingBottom: '0.25rem' }}>
                      <span>Child Costs:</span>
                      <strong style={{ color: yearData.childCosts > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                        {formatCurrency(yearData.childCosts || 0)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border)', paddingBottom: '0.25rem' }}>
                      <span>Total Annual Spending:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border)', paddingBottom: '0.25rem' }}>
                      <span>Net Savings:</span>
                      <strong style={{ color: yearData.withdrawals > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Account Balances Breakdown */}
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    💼 Account Balances Breakdown
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>Cash / Reserves:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency((yearData.cashBalance || 0) + (yearData.emergencyFundBalance || 0))}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>Taxable Brokerage:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(yearData.brokerageBalance || 0)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>Pre-Tax 401(k) / IRA:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency((yearData.trad401kBalance || 0) + (yearData.tradIraBalance || 0))}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>Roth IRA:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(yearData.rothIraBalance || 0)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>HSA Balance:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(yearData.hsaBalance || 0)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                      <span>Real Estate:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(yearData.realEstateValue || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
