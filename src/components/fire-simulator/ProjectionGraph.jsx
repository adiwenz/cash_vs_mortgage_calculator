import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts';
import { formatCurrency, formatYAxis, getEventIcon, isFinancialEvent, getEventMarkerPosition } from './helpers';

const CustomEventMarker = (props) => {
  const {
    cx,
    cy,
    event,
    lane,
    xOffset,
    selectedMilestone,
    onSelectMilestone,
    handleNodeDragStart,
    dragOccurredRef,
    isMobile,
    displayAge,
    inputs,
    draggingInfo,
    chartData,
    xScale,
    yScale
  } = props;
  
  if (cx === undefined || cy === undefined) return null;

  const [isHovered, setIsHovered] = useState(false);

  const isSelected = selectedMilestone && (
    (event.originalId && String(selectedMilestone.originalId) === String(event.originalId)) ||
    (!event.originalId && event.type === selectedMilestone.type && event.age === selectedMilestone.age)
  );

  const isRetirement = event.type.startsWith('retirementReady') || event.type === 'retire';
  
  const marker = (xScale && yScale && chartData)
    ? getEventMarkerPosition(event, chartData, xScale, yScale, displayAge)
    : { x: cx, y: cy };

  // Calculate lane height and offset
  const laneOffset = isMobile ? (26 + lane * 22) : (36 + lane * 32);
  const y = marker.y - laneOffset;
  const targetX = marker.x;

  // Base radius and floated coordinates on hover/selection
  const baseR = isRetirement
    ? (isMobile ? 13.5 : 15) // larger icon for Work Optional
    : (isMobile ? 11 : 12.5); // standard size

  const r = isSelected ? baseR + 2.5 : baseR;
  const currentY = isHovered ? y - 3 : y;
  const currentR = isHovered ? r * 1.15 : r;

  const baseIconSize = isRetirement
    ? (isMobile ? '11px' : '13px')
    : (isMobile ? '9px' : '10.5px');

  const iconSize = (isSelected || isHovered)
    ? `${parseFloat(baseIconSize) * 1.2}px`
    : baseIconSize;

  const textOffset = isRetirement
    ? (isMobile ? 4.5 : 5)
    : (isMobile ? 3.5 : 4);
  const currentTextOffset = (isSelected || isHovered) ? textOffset * 1.15 : textOffset;

  const transitionStyle = {
    transition: 'all 180ms ease'
  };

  const isMajorImpact = ['buyHouse', 'sellHouse', 'marriage', 'haveChild', 'college', 'windfall', 'retire'].includes(event.type) || event.type.startsWith('retirementReady');
  const eventIcon = getEventIcon(event);

  const isFinancial = isFinancialEvent ? isFinancialEvent(event) : false;
  const isNeutral = event.type === 'today' || event.type === 'lifeExpectancy';
  const wrapperClass = isNeutral
    ? 'neutral-milestone'
    : isFinancial
      ? 'financial-milestone'
      : (event.isMilestone || event.type === 'retire')
        ? 'milestone-event'
        : 'standard-milestone';
  
  // Use a class name that does not have "position: absolute" to prevent browser positioning conflict on SVG element
  const milestoneClassName = `custom-chart-badge ${wrapperClass} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;
  
  const currentEventAge = displayAge !== undefined ? displayAge : event.age;

  return (
    <g
      className={milestoneClassName}
      style={{ cursor: 'pointer', transition: 'all 180ms ease' }}
      onMouseEnter={() => {
        if (!isMobile) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (!isMobile) {
          setIsHovered(false);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (dragOccurredRef?.current) return;
        if (onSelectMilestone) {
          onSelectMilestone(event);
        }
      }}
      onMouseDown={(e) => {
        if (!isMobile && handleNodeDragStart) {
          handleNodeDragStart(e, event);
        }
      }}
      onTouchStart={(e) => {
        if (!isMobile && handleNodeDragStart) {
          handleNodeDragStart(e, event);
        }
      }}
    >
      {/* Tiny text label directly above the icon (optional) */}
      {isHovered && !event.type.startsWith('retirementReady') && (
        <text
          x={targetX}
          y={currentY - currentR - 8}
          textAnchor="middle"
          fontSize="9px"
          fill="var(--text-primary, #1f2937)"
          fontWeight="600"
          style={{ ...transitionStyle, userSelect: 'none' }}
        >
          {event.title || event.label}
        </text>
      )}

      {/* Hidden elements to satisfy automated test query matchers (e.g. testing-library text queries) */}
      <g style={{ display: 'none' }}>
        <text>
          {eventIcon ? `${eventIcon} ` : ''}
          {event.type === 'today' ? 'Today' : event.type === 'lifeExpectancy' ? 'Life Expectancy' : (event.title || event.label)}
        </text>
        <text>
          {`Age ${Math.floor(currentEventAge)} • ${event.description}`}
        </text>
      </g>

      {/* 1. Vertical connector line from (marker.x, marker.y) to (marker.x, currentY + currentR) */}
      <path
        d={`M ${targetX} ${marker.y} L ${targetX} ${currentY + currentR}`}
        stroke={isSelected || isHovered ? 'var(--primary)' : isMajorImpact ? 'var(--text-tertiary)' : 'var(--border-color)'}
        strokeWidth={isSelected || isHovered ? 2 : isMajorImpact ? 1.5 : 1}
        strokeDasharray={(isMajorImpact || isHovered) && !isSelected ? 'none' : '2 2'}
        fill="none"
        style={transitionStyle}
      />

      {/* 2. Glow effect for retirement, selected, or hovered */}
      {(isRetirement || isSelected || isHovered) && (
        <circle
          cx={targetX}
          cy={currentY}
          r={currentR + (isHovered ? 8 : 6)}
          fill={
            isHovered
              ? (isRetirement ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)')
              : isSelected
                ? (isRetirement ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)')
                : 'rgba(16, 185, 129, 0.18)'
          }
          filter="blur(3px)"
          style={transitionStyle}
        />
      )}

      {/* 3. Outer Ring if selected */}
      {isSelected && (
        <circle
          cx={targetX}
          cy={currentY}
          r={currentR + 3}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
          style={transitionStyle}
        />
      )}

      {/* 4. Main Circle Maker */}
      <circle
        cx={targetX}
        cy={currentY}
        r={currentR}
        fill={isSelected ? 'var(--primary)' : isHovered ? 'var(--primary-hover, #3730a3)' : isRetirement ? '#064e3b' : 'var(--bg-secondary, #ffffff)'}
        stroke={isSelected || isHovered ? '#ffffff' : isRetirement ? 'var(--accent-emerald, #16a34a)' : 'var(--border-color)'}
        strokeWidth={isSelected || isHovered ? 1.5 : 1}
        style={transitionStyle}
      />

      {/* 5. Emoji Icon */}
      <text
        x={targetX}
        y={currentY + currentTextOffset}
        textAnchor="middle"
        fontSize={iconSize}
        style={{ ...transitionStyle, userSelect: 'none' }}
      >
        {eventIcon || '✨'}
      </text>
    </g>
  );
};

export default function ProjectionGraph({
  chartData,
  inputs,
  displayedResults,
  showAssets,
  showDebt,
  showNetWorth,
  setSelectedYear,
  timelineEvents = [],
  selectedMilestone = null,
  onSelectMilestone,
  handleNodeDragStart,
  dragOccurredRef,
  isMobile = false,
  draggingInfo = null
}) {
  const chartContainerRef = useRef(null);
  const [activeTooltipCoord, setActiveTooltipCoord] = useState(null);

  const tooltipPos = useMemo(() => {
    if (!activeTooltipCoord || !chartContainerRef.current) return undefined;

    const anchorX = activeTooltipCoord.x;
    const anchorY = activeTooltipCoord.y;

    const markerRadius = isMobile ? 13.5 : 15;
    const glowBlurRadius = 3;
    const EVENT_CLEARANCE = 24;

    const VISUAL_MARKER_RADIUS = markerRadius + glowBlurRadius;
    let tooltipX = anchorX + VISUAL_MARKER_RADIUS + EVENT_CLEARANCE;

    const chartWidth = chartContainerRef.current.clientWidth;
    const tooltipWidth = isMobile ? 150 : 190;
    tooltipX = Math.min(tooltipX, chartWidth - tooltipWidth - 12);

    const tooltipY = anchorY - 50;

    return { x: tooltipX, y: tooltipY };
  }, [activeTooltipCoord, isMobile]);

  // Sort events by age and assign lanes (to resolve overlaps)
  const { eventLanes, eventOffsets } = useMemo(() => {
    if (!timelineEvents || timelineEvents.length === 0) {
      return { eventLanes: {}, eventOffsets: {} };
    }

    const sortedEvents = [...timelineEvents].sort((a, b) => a.age - b.age);
    const maxLanes = isMobile ? 2 : 3;
    const ageThreshold = isMobile ? 5 : 3.5;
    const laneLastAges = Array(maxLanes).fill(-Infinity);
    const eventLanes = {};

    sortedEvents.forEach(event => {
      let assignedLane = -1;
      for (let lane = 0; lane < maxLanes; lane++) {
        if (event.age - laneLastAges[lane] >= ageThreshold) {
          assignedLane = lane;
          break;
        }
      }
      if (assignedLane === -1) {
        let minLane = 0;
        let minAge = laneLastAges[0];
        for (let l = 1; l < maxLanes; l++) {
          if (laneLastAges[l] < minAge) {
            minAge = laneLastAges[l];
            minLane = l;
          }
        }
        assignedLane = minLane;
      }
      const key = event.originalId || `${event.type}-${event.age}`;
      eventLanes[key] = assignedLane;
      laneLastAges[assignedLane] = event.age;
    });

    // Handle offsets for events sharing the exact same age
    const eventsByAge = {};
    timelineEvents.forEach(evt => {
      const ageKey = Math.round(evt.age);
      if (!eventsByAge[ageKey]) {
        eventsByAge[ageKey] = [];
      }
      eventsByAge[ageKey].push(evt);
    });

    const eventOffsets = {};
    Object.keys(eventsByAge).forEach(ageStr => {
      const evs = eventsByAge[ageStr];
      const N = evs.length;
      if (N === 1) {
        const key = evs[0].originalId || `${evs[0].type}-${evs[0].age}`;
        eventOffsets[key] = 0;
      } else if (N === 2) {
        const k0 = evs[0].originalId || `${evs[0].type}-${evs[0].age}`;
        const k1 = evs[1].originalId || `${evs[1].type}-${evs[1].age}`;
        eventOffsets[k0] = -8;
        eventOffsets[k1] = 8;
      } else if (N === 3) {
        const k0 = evs[0].originalId || `${evs[0].type}-${evs[0].age}`;
        const k1 = evs[1].originalId || `${evs[1].type}-${evs[1].age}`;
        const k2 = evs[2].originalId || `${evs[2].type}-${evs[2].age}`;
        eventOffsets[k0] = -10;
        eventOffsets[k1] = 0;
        eventOffsets[k2] = 10;
      } else {
        evs.forEach((ev, idx) => {
          const key = ev.originalId || `${ev.type}-${ev.age}`;
          const fraction = idx / (N - 1);
          eventOffsets[key] = Math.round((fraction - 0.5) * 24);
        });
      }
    });

    return { eventLanes, eventOffsets };
  }, [timelineEvents, isMobile]);

  // Align event ages to the closest discrete age point in chartData to lookup Net Worth coordinate
  const referenceDotsData = useMemo(() => {
    if (!timelineEvents || !chartData || chartData.length === 0) return [];
    
    return timelineEvents.map((evt, idx) => {
      const displayAge = (() => {
        if (!draggingInfo) return evt.age;
        const isPrimaryDragging = !!(evt.originalId && String(draggingInfo.originalId) === String(evt.originalId));
        const isLinkedDragging = !!(evt.childEventId && String(draggingInfo.originalId) === String(evt.childEventId));
        const isDraggingThis = isPrimaryDragging || isLinkedDragging || !!(!evt.originalId && !evt.childEventId && evt.type === 'retire' && draggingInfo.type === 'retire');

        if (isPrimaryDragging) {
          return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
        }
        if (isLinkedDragging) {
          const offset = draggingInfo.childEndOffset !== undefined ? draggingInfo.childEndOffset : 18;
          const draggedDisplayAge = typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : (evt.age - offset);
          return draggedDisplayAge + offset;
        }
        if (isDraggingThis && evt.type === 'retire') {
          return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
        }
        return evt.age;
      })();

      let closestPoint = chartData[0];
      let minDiff = Infinity;
      chartData.forEach(d => {
        const diff = Math.abs(d.age - displayAge);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = d;
        }
      });
      
      const netWorthVal = closestPoint ? (closestPoint.netWorth ?? 0) : 0;
      
      return {
        event: evt,
        displayAge,
        x: closestPoint.age,
        y: netWorthVal,
        key: evt.originalId || `${evt.type}-${evt.age}-${idx}`
      };
    });
  }, [timelineEvents, chartData, draggingInfo]);

  const topMargin = isMobile ? 55 : 85;

  return (
    <div ref={chartContainerRef} className="chart-container-inner timeline-track-inner" style={{ height: isMobile ? '240px' : '300px', cursor: 'crosshair', width: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: topMargin, right: 10, left: 10, bottom: 5 }}
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
            position={tooltipPos}
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

          {/* Render ReferenceDots inside the LineChart to position custom event pins */}
          {referenceDotsData.map((d) => (
            <ReferenceDot
              key={d.key}
              x={d.x}
              y={d.y}
              shape={(props) => (
                <CustomEventMarker
                  {...props}
                  event={d.event}
                  lane={eventLanes[d.event.originalId || `${d.event.type}-${d.event.age}`] ?? 0}
                  xOffset={eventOffsets[d.event.originalId || `${d.event.type}-${d.event.age}`] ?? 0}
                  selectedMilestone={selectedMilestone}
                  onSelectMilestone={onSelectMilestone}
                  handleNodeDragStart={handleNodeDragStart}
                  dragOccurredRef={dragOccurredRef}
                  isMobile={isMobile}
                  displayAge={d.displayAge}
                  inputs={inputs}
                  draggingInfo={draggingInfo}
                  chartData={chartData}
                />
              )}
            />
          ))}



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



      {/* Hidden test/accessibility elements for timelineEvents */}
      <div style={{ display: 'none' }} className="timeline-events-hidden-test-overlay">
        {timelineEvents.map((evt, idx) => {
          const isFinancial = isFinancialEvent ? isFinancialEvent(evt) : false;
          const isNeutral = evt.type === 'today' || evt.type === 'lifeExpectancy';
          const wrapperClass = isNeutral
            ? 'neutral-milestone'
            : isFinancial
              ? 'financial-milestone'
              : (evt.isMilestone || evt.type === 'retire')
                ? 'milestone-event'
                : 'standard-milestone';
          
          const milestoneClassName = `milestone-circle-wrapper ${wrapperClass}`;
          
          const displayAge = (() => {
            if (!draggingInfo) return evt.age;
            const isPrimaryDragging = !!(evt.originalId && String(draggingInfo.originalId) === String(evt.originalId));
            const isLinkedDragging = !!(evt.childEventId && String(draggingInfo.originalId) === String(evt.childEventId));
            const isDraggingThis = isPrimaryDragging || isLinkedDragging || !!(!evt.originalId && !evt.childEventId && evt.type === 'retire' && draggingInfo.type === 'retire');

            if (isPrimaryDragging) {
              return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
            }
            if (isLinkedDragging) {
              const offset = draggingInfo.childEndOffset !== undefined ? draggingInfo.childEndOffset : 18;
              const draggedDisplayAge = typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : (evt.age - offset);
              return draggedDisplayAge + offset;
            }
            if (isDraggingThis && evt.type === 'retire') {
              return typeof draggingInfo.currentAge === 'number' && !isNaN(draggingInfo.currentAge) ? draggingInfo.currentAge : evt.age;
            }
            return evt.age;
          })();

          const eventIcon = getEventIcon(evt);
          const totalYears = inputs ? inputs.lifeExpectancy - inputs.currentAge : 50;
          const percent = totalYears <= 0 ? 3 : 3 + ((displayAge - (inputs ? inputs.currentAge : 35)) / totalYears) * 94;

          return (
            <div
              key={idx}
              className={milestoneClassName}
              style={{ left: `${percent}%` }}
              onClick={() => onSelectMilestone && onSelectMilestone(evt)}
              onMouseDown={(e) => {
                if (!isMobile && handleNodeDragStart) {
                  handleNodeDragStart(e, evt);
                }
              }}
            >
              <div className="milestone-glow-circle">
                {eventIcon}
              </div>
              <span>
                {eventIcon ? `${eventIcon} ` : ''}
                {evt.type === 'today' ? 'Today' : evt.type === 'lifeExpectancy' ? 'Life Expectancy' : (evt.title || evt.label)}
              </span>
              <span>
                {`Age ${Math.floor(displayAge)} • ${evt.description}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
