import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
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

export default function ComparisonChart({ data, visibleScenarios, onToggleScenario, scenarioInfo, yAxisMax, zoomRange, onZoomChange }) {
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

      {/* Scenario Checkbox Toggles */}
      <div className="scenario-selector-grid">
        {Object.entries(scenarioInfo).map(([key, info]) => {
          const isSelected = visibleScenarios[key];
          return (
            <label
              key={key}
              className={`scenario-checkbox-label ${isSelected ? 'selected' : ''}`}
              style={{ borderLeft: `4px solid ${info.color}` }}
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
      <div className="chart-container-inner">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="year"
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
            
            {Object.entries(scenarioInfo).map(([key, info]) => {
              if (!visibleScenarios[key]) return null;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={info.dataKey}
                  name={info.label}
                  stroke={info.color}
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
  );
}
