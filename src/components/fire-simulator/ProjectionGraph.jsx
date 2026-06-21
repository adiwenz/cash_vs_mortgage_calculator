import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { formatCompactFinancial } from './helpers';

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
  handleEditRoadmapEvent,
  handleNodeDragStart,
  dragOccurredRef,
  isMobile = false,
  draggingInfo = null,
  onClusterExpandedChange,
  zoomDomain: propsZoomDomain,
  setZoomDomain: propsSetZoomDomain,
  isZoomed: propsIsZoomed,
  setIsZoomed: propsSetIsZoomed,
  chartLayout: propsChartLayout
}) {
  const chartContainerRef = useRef(null);
  const [activeTooltipCoord, setActiveTooltipCoord] = useState(null);

  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [localZoomDomain, setLocalZoomDomain] = useState(null);
  const [localIsZoomed, setLocalIsZoomed] = useState(false);

  const zoomDomain = propsZoomDomain !== undefined ? propsZoomDomain : localZoomDomain;
  const isZoomed = propsIsZoomed !== undefined ? propsIsZoomed : localIsZoomed;
  const setZoomDomain = propsSetZoomDomain !== undefined ? propsSetZoomDomain : setLocalZoomDomain;
  const setIsZoomed = propsSetIsZoomed !== undefined ? propsSetIsZoomed : setLocalIsZoomed;
  const zoomDragOccurredRef = useRef(false);

  const getActiveAge = (e) => {
    const age = Number(e?.activeLabel);
    return Number.isFinite(age) ? age : null;
  };

  const handleMouseDown = (e) => {
    if (isMobile) return;
    const age = getActiveAge(e);
    if (age !== null) {
      setRefAreaLeft(age);
      setRefAreaRight(age);
    }
  };

  const handleMouseMove = (e) => {
    if (isMobile) return;
    if (refAreaLeft !== null) {
      const age = getActiveAge(e);
      if (age !== null) {
        setRefAreaRight(age);
      }
    }
  };

  const handleMouseUp = () => {
    if (isMobile) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    if (refAreaLeft == null || refAreaRight == null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let left = refAreaLeft;
    let right = refAreaRight;
    if (left > right) {
      [left, right] = [right, left];
    }

    if (right - left >= 1) {
      setZoomDomain([left, right]);
      setIsZoomed(true);
      zoomDragOccurredRef.current = true;
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleResetZoom = (e) => {
    e.stopPropagation();
    setZoomDomain(null);
    setIsZoomed(false);
  };

  const handleChartClick = (data) => {
    if (zoomDragOccurredRef.current) {
      zoomDragOccurredRef.current = false;
      return;
    }
    if (data && data.activeLabel) {
      setSelectedYear(Number(data.activeLabel));
    }
  };

  const maxNetWorth = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    return Math.max(...chartData.map(d => Math.abs(d.netWorth ?? 0)));
  }, [chartData]);

  const resolvedYAxisWidth =
    maxNetWorth >= 1e15 ? 95 :
    maxNetWorth >= 1e12 ? 90 :
    maxNetWorth >= 1e9 ? 75 :
    65;

  const chartLayout = useMemo(() => {
    if (propsChartLayout) return propsChartLayout;
    const margin = { top: isMobile ? 15 : 20, right: 10, left: 10, bottom: 5 };
    return {
      margin,
      yAxisWidth: resolvedYAxisWidth,
      leftPlotOffset: resolvedYAxisWidth + margin.left,
      rightPlotOffset: margin.right
    };
  }, [propsChartLayout, resolvedYAxisWidth, isMobile]);

  const yAxisWidth = chartLayout.yAxisWidth;

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

  const fullMinAge = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    return Math.min(...chartData.map(d => d.age));
  }, [chartData]);

  const fullMaxAge = useMemo(() => {
    if (!chartData || chartData.length === 0) return 100;
    return Math.max(...chartData.map(d => d.age));
  }, [chartData]);

  const activeDomain = useMemo(() => {
    return zoomDomain ?? [fullMinAge, fullMaxAge];
  }, [zoomDomain, fullMinAge, fullMaxAge]);

  const topMargin = isMobile ? 15 : 20;

  return (
    <div ref={chartContainerRef} className="chart-container-inner timeline-track-inner" style={{ height: isMobile ? '240px' : '265px', cursor: 'crosshair', width: '100%', position: 'relative', zIndex: 'auto' }}>
      {!isMobile && isZoomed && (
        <button
          onClick={handleResetZoom}
          className="reset-zoom-btn"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 50,
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            borderRadius: '8px',
            background: 'var(--bg-secondary, #ffffff)',
            color: 'var(--text-primary, #1f2937)',
            border: '1px solid var(--border, #e5e7eb)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
            transition: 'all 150ms ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary, #f3f4f6)';
            e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
            e.currentTarget.style.color = 'var(--primary, #2563eb)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-secondary, #ffffff)';
            e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)';
            e.currentTarget.style.color = 'var(--text-primary, #1f2937)';
          }}
        >
          Reset zoom
        </button>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={chartLayout.margin}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            if (e && e.activeCoordinate) {
              setActiveTooltipCoord({
                x: e.activeCoordinate.x,
                y: e.activeCoordinate.y
              });
            } else {
              setActiveTooltipCoord(null);
            }
            handleMouseMove(e);
          }}
          onMouseLeave={() => {
            setActiveTooltipCoord(null);
            setRefAreaLeft(null);
            setRefAreaRight(null);
          }}
          onMouseUp={handleMouseUp}
          onClick={handleChartClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            dataKey="age"
            stroke="var(--text-tertiary)"
            fontFamily="var(--font-body)"
            fontSize={10}
            type="number"
            domain={activeDomain}
            allowDataOverflow
          />
          {refAreaLeft !== null && refAreaRight !== null && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fill="var(--primary)"
              fillOpacity={0.15}
            />
          )}
          <YAxis
            stroke="var(--text-tertiary)"
            fontFamily="var(--font-body)"
            fontSize={10}
            tickFormatter={formatCompactFinancial}
            width={yAxisWidth}
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
                        <span style={{ fontWeight: '700' }}>{formatCompactFinancial(item.value)}</span>
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
            stroke="var(--net-worth)"
            strokeWidth={2.5}
            dot={false}
            hide={!showNetWorth}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
