import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatCurrency, formatYAxis } from './helpers';

export default function ProjectionGraph({
  chartData,
  inputs,
  displayedResults,
  showAssets,
  showDebt,
  showNetWorth,
  setSelectedYear
}) {
  return (
    <div className="chart-container-inner" style={{ height: '230px', cursor: 'crosshair', width: '100%' }}>
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
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={false}
            hide={!showNetWorth}
          />

          {/* 1. Can Stop Working Age */}
          {displayedResults.targetRetirementAge && (
            <ReferenceLine
              x={displayedResults.targetRetirementAge}
              stroke="#a855f7"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: `Work Optional: Age ${displayedResults.targetRetirementAge}`,
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
  );
}
