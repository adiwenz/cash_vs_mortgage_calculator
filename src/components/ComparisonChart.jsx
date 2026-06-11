import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

// Format dollar values cleanly
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// Format short dollar labels (e.g. $1.5M, $400K)
const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

export default function ComparisonChart({ data, visibleScenarios, onToggleScenario, scenarioInfo, yAxisMax, zoomRange, onZoomChange, disabled }) {
  const [colorBlindMode, setColorBlindMode] = React.useState(false);

  // Compute intersection year
  const intersectionYear = React.useMemo(() => {
    if (!data || data.length < 2 || !visibleScenarios.cashBuyer || !visibleScenarios.mortgageBuyer) return null;
    
    for (let i = 0; i < data.length - 1; i++) {
      const rowA = data[i];
      const rowB = data[i + 1];
      
      const valA_cash = rowA.cashBuyerNW;
      const valA_mort = rowA.mortgageBuyerNW;
      const valB_cash = rowB.cashBuyerNW;
      const valB_mort = rowB.mortgageBuyerNW;
      
      const diffA = valA_cash - valA_mort;
      const diffB = valB_cash - valB_mort;
      
      if (diffA === 0) return rowA.year;
      if (diffB === 0) return rowB.year;
      
      if (diffA * diffB < 0) {
        const t = diffA / (diffA - diffB);
        const crossYear = rowA.year + t * (rowB.year - rowA.year);
        return parseFloat(crossYear.toFixed(1));
      }
    }
    return null;
  }, [data, visibleScenarios]);
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Sort payload by value descending to display the highest net worth at the top
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="custom-chart-tooltip">
          <p style={{ fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
            Year {label}
          </p>
          {sortedPayload.map((item) => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.2rem 0' }}>
              <span style={{ color: item.color, fontWeight: '500' }}>{item.name}:</span>
              <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title">Net Worth Comparison Over Time</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Adjust assumptions on the left to see changes instantly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={colorBlindMode}
              onChange={(e) => setColorBlindMode(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            👁️ Color-blind Mode
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.25rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>Zoom:</span>
            {[5, 10, 15, 30].map((years) => (
              <button
                key={years}
                onClick={() => onZoomChange(years)}
                style={{
                  background: zoomRange === years ? 'var(--primary)' : 'transparent',
                  color: zoomRange === years ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {years === 30 ? 'All (30y)' : `${years}y`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Checkbox Toggles */}
      <div className="scenario-selector-grid">
        {Object.entries(scenarioInfo).map(([key, info]) => {
          const isSelected = visibleScenarios[key];
          const displayColor = colorBlindMode
            ? (key === 'mortgageBuyer' ? '#ea580c' : '#2563eb')
            : info.color;
          return (
            <label
              key={key}
              className={`scenario-checkbox-label ${isSelected ? 'selected' : ''}`}
              style={{ borderLeft: `4px solid ${displayColor}` }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleScenario(key)}
              />
              {info.label}
            </label>
          );
        })}
      </div>

      {/* Recharts Render */}
      <div className="chart-container-inner" style={{ position: 'relative' }}>
        {disabled && (
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
              Chart disabled due to input errors. <br />
              <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                Please correct the assumptions on the left.
              </span>
            </div>
          </div>
        )}
        <div style={{ width: '100%', height: '100%', opacity: disabled ? 0.15 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                type="number"
                dataKey="year"
                domain={[0, zoomRange]}
                ticks={
                  zoomRange === 5 ? [0, 1, 2, 3, 4, 5] :
                  zoomRange === 10 ? [0, 2, 4, 6, 8, 10] :
                  zoomRange === 15 ? [0, 3, 6, 9, 12, 15] :
                  [0, 5, 10, 15, 20, 25, 30]
                }
                stroke="var(--text-tertiary)"
                fontFamily="var(--font-body)"
                fontSize={11}
                dy={10}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                fontFamily="var(--font-body)"
                fontSize={11}
                tickFormatter={formatYAxis}
                dx={-10}
                domain={[0, yAxisMax]}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {intersectionYear !== null && intersectionYear <= zoomRange && (
                <ReferenceLine
                  x={intersectionYear}
                  stroke="var(--text-secondary)"
                  strokeDasharray="5 5 1 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Break-even: Yr ${intersectionYear}`,
                    position: 'insideTopRight',
                    fill: 'var(--text-primary)',
                    fontSize: 10,
                    fontWeight: '700',
                    dy: 8,
                    dx: 4
                  }}
                />
              )}
              
              {Object.entries(scenarioInfo).map(([key, info]) => {
                if (!visibleScenarios[key]) return null;
                const isMortgage = key === 'mortgageBuyer';
                const lineColor = colorBlindMode
                  ? (isMortgage ? '#ea580c' : '#2563eb')
                  : info.color;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={info.dataKey}
                    name={info.label}
                    stroke={lineColor}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
