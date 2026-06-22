import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatCurrency, formatYAxis } from './helpers';

function calculateTicks(min, max, targetTickCount = 5) {
  if (min > max) {
    [min, max] = [max, min];
  }
  
  const finalMin = Math.min(0, min);
  const finalMax = Math.max(0, max);
  
  if (finalMin === finalMax) {
    return [0];
  }
  
  const range = finalMax - finalMin;
  let roughStep = range / (targetTickCount - 1);
  
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / Math.pow(10, exponent);
  
  let cleanStep;
  if (fraction < 1.5) cleanStep = 1;
  else if (fraction < 3.5) cleanStep = 2;
  else if (fraction < 7.5) cleanStep = 5;
  else cleanStep = 10;
  
  const step = cleanStep * Math.pow(10, exponent);
  
  const ticks = [0];
  
  // Go up from 0
  let current = step;
  while (ticks[ticks.length - 1] < finalMax - 1e-9) {
    ticks.push(current);
    current += step;
  }
  
  // Go down from 0
  current = -step;
  while (ticks[0] > finalMin + 1e-9) {
    ticks.unshift(current);
    current -= step;
  }
  
  return ticks;
}

export default function MobileResults({
  simulation,
  timeline,
  activeChart,
  setActiveChart,
  
  // Legacy:
  chartData: legacyChartData,
  activeResults: legacyActiveResults,
  selectedYear: legacySelectedYear,
  setSelectedYear: legacySetSelectedYear
}) {
  const chartData = simulation?.chartData ?? legacyChartData;
  const activeResults = simulation?.activeResults ?? legacyActiveResults;
  const selectedYear = timeline?.selectedYear ?? legacySelectedYear;
  const setSelectedYear = timeline?.setSelectedYear ?? legacySetSelectedYear;

  const ticks = useMemo(() => {
    let min = 0;
    let max = 100000;
    if (chartData && chartData.length) {
      chartData.forEach((row) => {
        if (activeChart === 'netWorth') {
          if (row.netWorth !== undefined) {
            if (row.netWorth < min) min = row.netWorth;
            if (row.netWorth > max) max = row.netWorth;
          }
        } else if (activeChart === 'assetsDebt') {
          if (row.assets !== undefined) {
            if (row.assets < min) min = row.assets;
            if (row.assets > max) max = row.assets;
          }
          if (row.debt !== undefined) {
            if (row.debt < min) min = row.debt;
            if (row.debt > max) max = row.debt;
          }
        } else if (activeChart === 'progress') {
          if (row.portfolio !== undefined) {
            if (row.portfolio < min) min = row.portfolio;
            if (row.portfolio > max) max = row.portfolio;
          }
          if (row.fiNumber !== undefined) {
            if (row.fiNumber < min) min = row.fiNumber;
            if (row.fiNumber > max) max = row.fiNumber;
          }
        }
      });
    }
    const range = max - min;
    const padding = range * 0.12;
    const finalMin = min < 0 ? min - padding : 0;
    const finalMax = max + padding;
    return calculateTicks(finalMin, finalMax);
  }, [chartData, activeChart]);
  return (
    <div className="mobile-chart-card-wrapper" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
      
      {/* Active Chart Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
          {activeChart === 'netWorth' ? 'Projected Net Worth' :
           activeChart === 'assetsDebt' ? 'Assets & Debt Breakdown' :
           activeChart === 'progress' ? 'Portfolio vs FI Target' :
           'Cash Flow (Income/Expenses)'}
        </span>
      </div>

      {/* Chart container */}
      <div style={{ height: '220px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            onClick={(data) => {
              if (data && data.activeLabel && setSelectedYear) {
                setSelectedYear(Number(data.activeLabel));
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey="age"
              stroke="var(--text-tertiary)"
              fontSize={9}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              fontSize={9}
              tickFormatter={formatYAxis}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
            />
            <ReferenceLine y={0} stroke="var(--text-secondary, #6b7280)" strokeWidth={1.5} strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="custom-chart-tooltip" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                      <p style={{ fontWeight: '700', marginBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Age {label}</p>
                      {payload.map((item) => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.0rem', margin: '0.1rem 0' }}>
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
            
            {activeChart === 'netWorth' && (
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke="var(--net-worth)"
                strokeWidth={2.5}
                dot={false}
              />
            )}

            {activeChart === 'assetsDebt' && (
              <>
                <Line
                  type="monotone"
                  dataKey="assets"
                  name="Assets"
                  stroke="var(--asset)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="debt"
                  name="Debt"
                  stroke="var(--debt)"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}

            {activeChart === 'progress' && (
              <>
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio Balance"
                  stroke="var(--asset)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fiNumber"
                  name="FI Target"
                  stroke="var(--target)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                {activeResults.retirementReadyAge && (
                  <ReferenceLine
                    x={activeResults.retirementReadyAge}
                    stroke="var(--success)"
                    strokeWidth={1.5}
                    label={{ value: `Age ${activeResults.retirementReadyAge} Ready`, fill: 'var(--success)', fontSize: 8, position: 'top' }}
                  />
                )}
              </>
            )}

            {activeChart === 'incomeSpending' && (
              <>
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="var(--income)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="var(--expense)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="taxes"
                  name="Taxes"
                  stroke="var(--tax)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}

            {selectedYear !== null && (
              <ReferenceLine
                x={selectedYear}
                stroke="var(--primary)"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: `Age ${selectedYear}`, fill: 'var(--primary)', fontSize: 8, position: 'top' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Dots Controls */}
      <div className="mobile-chart-dots" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
        {['netWorth', 'assetsDebt', 'progress', 'incomeSpending'].map(chart => (
          <span
            key={chart}
            className={`mobile-chart-dot ${activeChart === chart ? 'active' : ''}`}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: activeChart === chart ? 'var(--primary)' : 'rgba(255, 255, 255, 0.25)',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => setActiveChart(chart)}
          />
        ))}
      </div>
    </div>
  );
}
