import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts';
import { formatYAxis, getEventMarkerPosition, getEventIcon, isEditableEvent } from '../helpers';

export const CustomEventMarker = (props) => {
  const {
    cx,
    cy,
    event,
    lane,
    xOffset,
    selectedMilestone,
    onSelectMilestone,
    onSelectCluster,
    isMobile,
    xScale,
    yScale,
    chartData,
    stackIndex = 0,
    stackCount = 1,
    stackEvents = []
  } = props;
  
  if (cx === undefined || cy === undefined) return null;

  const isSelected = selectedMilestone && (
    (event.originalId && String(selectedMilestone.originalId) === String(event.originalId)) ||
    (!event.originalId && event.type === selectedMilestone.type && event.age === selectedMilestone.age)
  );

  const isRetirement = event.type.startsWith('retirementReady') || event.type === 'retire';
  
  const marker = (xScale && yScale && chartData)
    ? getEventMarkerPosition(event, chartData, xScale, yScale)
    : { x: cx, y: cy };

  // Helper to compute radius of an event
  const getEventRadius = (evt) => {
    const isRet = evt.type.startsWith('retirementReady') || evt.type === 'retire';
    return isRet ? (isMobile ? 13.5 : 15) : (isMobile ? 11 : 12.5);
  };

  // Stacking/Collapsing logic
  const topEventIndex = stackCount - 1;
  const topOffset = isMobile ? (26 + topEventIndex * 22) : (36 + topEventIndex * 32);
  const topY = marker.y - topOffset;
  const topEvent = stackEvents.length > 0 ? stackEvents[topEventIndex] : event;
  const topR = getEventRadius(topEvent);
  const stackGoesOver = stackCount > 1 && (topY - topR < 0);

  const isCollapsedCluster = stackGoesOver && stackIndex === 0 && stackEvents?.length > 1;

  if (stackGoesOver && stackIndex > 0) {
    return null;
  }

  // Calculate lane height and offset (for collapsed stacks, stackIndex/lane is 0)
  const resolvedLane = stackGoesOver ? 0 : stackIndex;
  const laneOffset = isMobile ? (26 + resolvedLane * 22) : (36 + resolvedLane * 32);
  const y = marker.y - laneOffset;
  const targetX = marker.x;

  // Base radius and coordinates
  const baseR = getEventRadius(event);
  const r = isSelected ? baseR + 1.5 : baseR;

  const baseIconSize = isRetirement
    ? (isMobile ? '11px' : '13px')
    : (isMobile ? '9px' : '10.5px');

  const iconSize = isSelected
    ? `${parseFloat(baseIconSize) * 1.15}px`
    : baseIconSize;

  const textOffset = isRetirement
    ? (isMobile ? 4.5 : 5)
    : (isMobile ? 3.5 : 4);
  const currentTextOffset = isSelected ? textOffset * 1.15 : textOffset;

  const isMajorImpact = ['buyHouse', 'sellHouse', 'marriage', 'haveChild', 'college', 'windfall', 'retire'].includes(event.type) || event.type.startsWith('retirementReady');
  const eventIcon = getEventIcon(event);

  // Styling for the badge (+N)
  const strokeColor = isSelected ? '#ffffff' : isRetirement ? 'var(--accent-emerald, #10b981)' : 'rgba(255, 255, 255, 0.25)';
  const badgeFill = isSelected ? 'var(--primary)' : isRetirement ? '#064e3b' : 'var(--bg-secondary, #1e293b)';
  const badgeStroke = strokeColor;
  const badgeTextColor = '#ffffff';

  const countText = `+${stackCount - 1}`;
  const badgeW = isMobile ? (countText.length > 2 ? 20 : 16) : (countText.length > 2 ? 24 : 18);
  const badgeH = isMobile ? 16 : 18;
  const badgeX = targetX + r + 4;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        if (isCollapsedCluster) {
          if (onSelectCluster) {
            onSelectCluster(stackEvents);
          }
        } else {
          if (onSelectMilestone) {
            onSelectMilestone(event);
          }
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* 1. Vertical connector line from (marker.x, marker.y) to (marker.x, y + r) */}
      <path
        d={`M ${targetX} ${marker.y} L ${targetX} ${y + r}`}
        stroke={isSelected ? 'var(--primary)' : isMajorImpact ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.2)'}
        strokeWidth={isSelected ? 2 : isMajorImpact ? 1.5 : 1}
        strokeDasharray={isMajorImpact && !isSelected ? 'none' : '2 2'}
        fill="none"
      />

      {/* 2. Glow effect for retirement or selected */}
      {(isRetirement || isSelected) && (
        <circle
          cx={targetX}
          cy={y}
          r={r + 6}
          fill={
            isSelected
              ? (isRetirement ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)')
              : 'rgba(16, 185, 129, 0.18)'
          }
          filter="blur(3px)"
        />
      )}

      {/* 3. Outer Ring if selected */}
      {isSelected && (
        <circle
          cx={targetX}
          cy={y}
          r={r + 4}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}

      {/* 4. Main badge circle */}
      <circle
        cx={targetX}
        cy={y}
        r={r}
        fill={badgeFill}
        stroke={badgeStroke}
        strokeWidth={isSelected ? 1.5 : 1}
      />

      {/* 5. Emoji Icon */}
      <text
        x={targetX}
        y={y + currentTextOffset}
        textAnchor="middle"
        fontSize={iconSize}
        style={{ userSelect: 'none' }}
      >
        {eventIcon || '✨'}
      </text>

      {/* 6. Collapse count badge (+N) on the right side */}
      {stackGoesOver && stackIndex === 0 && (
        <text
          x={targetX + r * 0.55}
          y={y + r + 3}
          textAnchor="start"
          fontSize={isMobile ? "9px" : "10px"}
          fontWeight="bold"
          fill={badgeTextColor}
          style={{ userSelect: 'none' }}
        >
          {countText}
        </text>
      )}
    </g>
  );
};

export default function MobileChartSection({
  chartData,
  timelineEvents,
  selectedEventIndex,
  inputs,
  ticks,
  chartContainerRef,
  setActiveTooltipCoord,
  tooltipPos,
  formatCurrency
}) {
  const selectedAge = timelineEvents[selectedEventIndex]?.age || inputs.currentAge;
  const selectedPoint = chartData.find(d => Number(d.age) === Number(selectedAge));
  
  const eventAges = Array.from(new Set([
    inputs.currentAge,
    ...timelineEvents.map(e => Number(e.age)),
    inputs.lifeExpectancy
  ])).sort((a, b) => a - b);

  return (
    <div 
      className="mobile-card" 
      style={{ 
        marginTop: '1.25rem', 
        textAlign: 'left', 
        padding: '1.25rem 1rem',
        background: '#ffffff',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            📈 Net Worth Projections
          </h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Highlighting Age {selectedAge}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--net-worth, #1e3a5f)', display: 'inline-block' }}></span>
            <span>Net Worth</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--asset, #16a34a)', display: 'inline-block' }}></span>
            <span>Assets</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '2px', background: 'var(--debt, #dc2626)', display: 'inline-block' }}></span>
            <span>Debt</span>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} style={{ height: '180px', width: '100%', marginLeft: '-15px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            onMouseMove={(e) => {
              if (e && e.activeCoordinate) {
                setActiveTooltipCoord({
                  x: e.activeCoordinate.x,
                  y: e.activeCoordinate.y
                });
              } else {
                setActiveTooltipCoord(null);
              }
            }}
            onMouseLeave={() => {
              setActiveTooltipCoord(null);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
            <XAxis
              dataKey="age"
              ticks={eventAges}
              stroke="var(--text-tertiary)"
              fontSize={8}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              fontSize={8}
              tickFormatter={formatYAxis}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
            />
            <ReferenceLine y={0} stroke="var(--text-secondary, #6b7280)" strokeWidth={1.5} strokeDasharray="3 3" />
            <Tooltip
              position={tooltipPos}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="custom-chart-tooltip" style={{ background: '#ffffff', border: '1px solid var(--border, #e5e7eb)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                      <p style={{ fontWeight: '700', marginBottom: '0.2rem', borderBottom: '1px solid var(--border, #e5e7eb)', color: 'var(--text-primary)', paddingBottom: '0.15rem' }}>Age {label}</p>
                      {payload.map((item) => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', margin: '0.05rem 0' }}>
                          <span style={{ color: item.stroke || item.color, fontWeight: '500' }}>{item.name}:</span>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(item.value)}</span>
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
              dataKey="netWorth"
              name="Net Worth"
              stroke="var(--net-worth, #1e3a5f)"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="assets"
              name="Total Assets"
              stroke="var(--asset, #16a34a)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="debt"
              name="Total Debt"
              stroke="var(--debt, #dc2626)"
              strokeWidth={2}
              dot={false}
            />

            {selectedAge !== null && (
              <>
                <ReferenceLine
                  x={selectedAge}
                  stroke="var(--primary)"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
                <ReferenceDot
                  x={selectedAge}
                  y={selectedPoint ? (selectedPoint.netWorth ?? 0) : 0}
                  r={5}
                  fill="var(--primary)"
                  stroke="#fff"
                  strokeWidth={1.5}
                  isFront={true}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
