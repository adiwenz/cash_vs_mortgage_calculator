import React, { useState, useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getActiveChildrenCountAtAge, propPIAmount } from '../../simulatorMathUtils';
import { formatCurrency, isEditableEvent, isFinancialEvent, formatCompactCurrency, getEventIcon } from './helpers';

export default function DesktopTimeline({
  inputs,
  timelineEvents,
  editingEvent,
  draggingInfo,
  dragOccurredRef,
  handleNodeDragStart,
  handleEditRoadmapEvent,
  chartLayout: propsChartLayout,
  activeDomain
}) {
  const USE_PORTAL_TOOLTIPS = true;
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = localIsExpanded;

  const [hoveredEvent, setHoveredEvent] = useState(null);

  // Clear hoveredEvent when dragging starts/is active
  useEffect(() => {
    if (draggingInfo) {
      setHoveredEvent(null);
    }
  }, [draggingInfo]);

  // Default fallback if not provided (e.g. in test rendering)
  const chartLayout = propsChartLayout || {
    margin: { top: 20, right: 10, left: 10, bottom: 5 },
    yAxisWidth: 65,
    leftPlotOffset: 75,
    rightPlotOffset: 10
  };

  const minAge = activeDomain ? activeDomain[0] : inputs.currentAge;
  const maxAge = activeDomain ? activeDomain[1] : inputs.lifeExpectancy;
  const totalYears = maxAge - minAge;

  if (totalYears <= 0) return null;

  // Compile active commitments (homeownership, childcare, marriage, etc.)
  const activeCommitments = [];

  // Homeownership spans
  inputs.lifeEvents.forEach(ev => {
    if (ev.enabled && ev.type === 'buyHouse' && ev.houseId) {
      const asset = inputs.houseAssets?.find(h => h.id === ev.houseId);
      const houseName = asset?.name || 'Primary Home';
      const buyAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
      const sellEv = inputs.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId && e.enabled);
      const sellAge = sellEv ? Number(sellEv.age) : inputs.lifeExpectancy;
      activeCommitments.push({
        id: `house-${ev.houseId}`,
        label: houseName,
        emoji: '🏠',
        startAge: buyAge,
        endAge: sellAge,
        className: 'commitment-span home'
      });
    }
  });

  // Childcare support
  const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
  if (childEvents.length > 0) {
    const activeAges = [];
    for (let age = inputs.currentAge; age < inputs.lifeExpectancy; age++) {
      if (getActiveChildrenCountAtAge(age, inputs.lifeEvents) > 0) {
        activeAges.push(age);
      }
    }
    
    const ccIntervals = [];
    if (activeAges.length > 0) {
      let start = activeAges[0];
      let prev = activeAges[0];
      for (let i = 1; i < activeAges.length; i++) {
        if (activeAges[i] === prev + 1) {
          prev = activeAges[i];
        } else {
          ccIntervals.push({ start, end: prev + 1 });
          start = activeAges[i];
          prev = activeAges[i];
        }
      }
      ccIntervals.push({ start, end: prev + 1 });
    }

    ccIntervals.forEach((interval, idx) => {
      activeCommitments.push({
        id: `childcare-${idx}`,
        label: 'Childcare & Support',
        emoji: '👶',
        startAge: interval.start,
        endAge: interval.end,
        className: 'commitment-span childcare'
      });
    });
  }

  // Marriage commitment span
  const lifeProfile = inputs.lifeProfile || {};
  const household = lifeProfile.household || {};
  const startsMarried = household.status === 'married' || household.status === 'partnered';
  const marriageEvent = inputs.lifeEvents?.find(e => e.type === 'marriage' && e.enabled);
  if (marriageEvent || startsMarried) {
    const marriageAge = startsMarried ? inputs.currentAge : Number(marriageEvent.age || marriageEvent.marriageAge || 35);
    activeCommitments.push({
      id: 'commitment-marriage',
      label: 'Married Life',
      emoji: '💍',
      startAge: marriageAge,
      endAge: inputs.lifeExpectancy,
      className: 'commitment-span marriage'
    });
  }

  // Preprocess events with display ages and positions
  const processedEvents = useMemo(() => {
    return timelineEvents.map(evt => {
      const isPrimaryDragging = !!(draggingInfo && evt.originalId && String(draggingInfo.originalId) === String(evt.originalId));
      const isLinkedDragging = !!(draggingInfo && evt.childEventId && String(draggingInfo.originalId) === String(evt.childEventId));
      const isDraggingThis = isPrimaryDragging || isLinkedDragging || !!(draggingInfo && !evt.originalId && !evt.childEventId && evt.type === 'retire' && draggingInfo.type === 'retire');

      const isSelected = !!(editingEvent && (
        (evt.originalId && String(editingEvent.id) === String(evt.originalId)) ||
        (!evt.originalId && evt.type === 'retire' && editingEvent.type === 'retire')
      ));

      const displayAge = (() => {
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

      const percent = totalYears > 0 ? ((displayAge - minAge) / totalYears) * 100 : 0;
      const isFinancial = isFinancialEvent(evt);
      const shouldPulse = window.pulseEventId && evt.originalId && String(window.pulseEventId) === String(evt.originalId);
      const bottomPos = isExpanded ? `${1 + (evt.stackIndex * 1.625)}rem` : '1rem';

      return {
        ...evt,
        isPrimaryDragging,
        isLinkedDragging,
        isDraggingThis,
        isSelected,
        displayAge,
        percent,
        isFinancial,
        shouldPulse,
        bottomPos
      };
    });
  }, [timelineEvents, draggingInfo, editingEvent, isExpanded, minAge, maxAge, totalYears]);

  // Group events by year for same-year summary markers (when collapsed)
  const groupsByYear = useMemo(() => {
    const groups = {};
    processedEvents.forEach(evt => {
      if (evt.displayAge < minAge || evt.displayAge > maxAge) return;
      const year = Math.floor(evt.displayAge);
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(evt);
    });
    return groups;
  }, [processedEvents, minAge, maxAge]);

  const cleanEvent = (e) => {
    if (!e) return e;
    const {
      isPrimaryDragging,
      isLinkedDragging,
      isDraggingThis,
      isSelected,
      displayAge,
      percent,
      isFinancial,
      shouldPulse,
      bottomPos,
      ...rest
    } = e;
    return rest;
  };

  return (
    <div className="timeline-wrapper" style={{ flexGrow: 1, overflowX: 'auto', minWidth: 0, padding: '0.5rem 0' }}>
      {/* Expand/Collapse Toggle Header */}
      <div 
        onClick={() => setLocalIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '700',
          color: 'var(--text-secondary)',
          userSelect: 'none',
          marginBottom: '0.25rem',
          marginLeft: `${chartLayout.leftPlotOffset}px`,
          width: 'fit-content',
          transition: 'color 150ms ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <span>Timeline</span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </div>

      <div className="timeline-grid" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: isExpanded ? '0.75rem' : '0.25rem' }}>
        
        {/* Layer 1: MILESTONES / EVENTS */}
        <div className="timeline-row" style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: 'none' }}>
          {isExpanded ? (
            <div style={{ 
              width: `${chartLayout.leftPlotOffset}px`, 
              minWidth: `${chartLayout.leftPlotOffset}px`, 
              paddingRight: '12px', 
              textAlign: 'right', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center',
              fontSize: '0.7rem', 
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.05em'
            }}>
              Events
            </div>
          ) : (
            <div style={{ width: `${chartLayout.leftPlotOffset}px`, minWidth: `${chartLayout.leftPlotOffset}px` }} />
          )}
          
          <div className="timeline-row-content events-row-content" style={{ flexGrow: 1, padding: 0, marginRight: `${chartLayout.rightPlotOffset}px`, height: isExpanded ? '6.5rem' : '2.5rem', position: 'relative' }}>
            <div className="timeline-track-inner" style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div className="events-axis-line" style={{ bottom: '1rem', left: 0, right: 0 }} />
              
              {/* Today Pin */}
              {inputs.currentAge >= minAge && inputs.currentAge <= maxAge && (
                <div
                  className="financial-milestone-wrapper today-pin"
                  style={{
                    left: `${((inputs.currentAge - minAge) / totalYears) * 100}%`,
                    bottom: '1rem',
                    zIndex: 100
                  }}
                >
                  <div 
                    className="financial-milestone-dot today-dot" 
                    style={{ 
                      background: 'var(--primary, #6366f1)', 
                      color: '#fff', 
                      fontSize: '0.62rem', 
                      padding: '0.12rem 0.35rem', 
                      borderRadius: '4px', 
                      height: 'auto', 
                      width: 'auto', 
                      fontWeight: '800',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    📍 TODAY
                  </div>
                </div>
              )}

              {processedEvents.map((evt, idx) => {
                if (evt.displayAge < minAge || evt.displayAge > maxAge) return null;

                const year = Math.floor(evt.displayAge);
                const group = groupsByYear[year] || [];
                const isTopEvent = group[group.length - 1] === evt;
                const isGroup = !isExpanded && group.length > 1;

                if (evt.isFinancial) {
                  return (
                    <div
                      key={idx}
                      className={`financial-milestone-wrapper ${evt.isDraggingThis ? 'dragging' : ''} ${evt.isSelected ? 'selected' : ''} ${evt.shouldPulse ? 'pulse-highlight-event' : ''}`}
                      style={{
                        left: `${evt.percent}%`,
                        bottom: evt.bottomPos
                      }}
                      onMouseDown={(e) => handleNodeDragStart(e, evt)}
                      onTouchStart={(e) => handleNodeDragStart(e, evt)}
                      onMouseEnter={(e) => {
                        if (draggingInfo) return;
                        if (isGroup) {
                          setHoveredEvent({
                            evt: null,
                            groupEvents: group,
                            target: e.currentTarget,
                            displayAge: year
                          });
                        } else {
                          setHoveredEvent({ evt, target: e.currentTarget, displayAge: evt.displayAge });
                        }
                      }}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onClick={(e) => {
                        if (dragOccurredRef.current) {
                          e.stopPropagation();
                          return;
                        }
                        if (isEditableEvent(evt)) {
                          handleEditRoadmapEvent(cleanEvent(evt));
                        }
                      }}
                    >
                      <div className="financial-milestone-dot" style={isGroup && isTopEvent ? { background: 'var(--primary, #6366f1)', color: '#ffffff', fontWeight: '800' } : {}}>
                        {isGroup && isTopEvent ? group.length : getEventIcon(evt)}
                      </div>

                      {/* Hidden text for test compatibility (since tooltips are now in a portal) */}
                      <span className="sr-only" style={{ display: 'none' }}>
                        {getEventIcon(evt)} {evt.title || evt.label}
                      </span>
                      <span className="sr-only" style={{ display: 'none' }}>
                        Age {Math.floor(evt.displayAge)} • {evt.description}
                      </span>

                      {/* Keep old tooltip markup if flag is false */}
                      {!USE_PORTAL_TOOLTIPS && !isGroup && (
                        <div className={`timeline-tooltip ${evt.percent < 20 ? 'align-left' : evt.percent > 80 ? 'align-right' : ''}`}>
                          <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                            {getEventIcon(evt)} {evt.title || evt.label}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                            <div>Age {Math.floor(evt.displayAge)} • {evt.description}</div>
                            {(() => {
                              if (evt.type === 'mortgageOff') {
                                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                if (asset) {
                                  return (
                                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                      P&I Savings: {formatCompactCurrency(propPIAmount(asset))}/yr
                                    </div>
                                  );
                                }
                              }
                              if (evt.type === 'childSupportEnds') {
                                return (
                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                                    Support expenses have ended
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Line connector down to axis */}
                      {isExpanded && evt.stackIndex > 0 && (
                        <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 1.625}rem`, bottom: `-${evt.stackIndex * 1.625}rem`, left: '50%', transform: 'translateX(-50%)' }} />
                      )}
                    </div>
                  );
                } else {
                  const wrapperClass = (evt.isMilestone || evt.type === 'retire') ? 'milestone-event' : 'standard-milestone';
                  return (
                    <div
                      key={idx}
                      className={`milestone-circle-wrapper ${wrapperClass} ${evt.isDraggingThis ? 'dragging' : ''} ${evt.isSelected ? 'selected' : ''} ${evt.shouldPulse ? 'pulse-highlight-event' : ''}`}
                      style={{
                        left: `${evt.percent}%`,
                        bottom: evt.bottomPos
                      }}
                      onMouseDown={(e) => handleNodeDragStart(e, evt)}
                      onTouchStart={(e) => handleNodeDragStart(e, evt)}
                      onMouseEnter={(e) => {
                        if (draggingInfo) return;
                        if (isGroup) {
                          setHoveredEvent({
                            evt: null,
                            groupEvents: group,
                            target: e.currentTarget,
                            displayAge: year
                          });
                        } else {
                          setHoveredEvent({ evt, target: e.currentTarget, displayAge: evt.displayAge });
                        }
                      }}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onClick={(e) => {
                        if (dragOccurredRef.current) {
                          e.stopPropagation();
                          return;
                        }
                        if (isEditableEvent(evt)) {
                          handleEditRoadmapEvent(cleanEvent(evt));
                        }
                      }}
                    >
                      <div className="milestone-glow-circle" style={isGroup && isTopEvent ? { background: 'var(--primary, #6366f1)', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
                        {isGroup && isTopEvent ? group.length : getEventIcon(evt)}
                      </div>

                      {/* Hidden text for test compatibility (since tooltips are now in a portal) */}
                      <span className="sr-only" style={{ display: 'none' }}>
                        {getEventIcon(evt)} {evt.title || evt.label}
                      </span>
                      <span className="sr-only" style={{ display: 'none' }}>
                        Age {Math.floor(evt.displayAge)} • {evt.description}
                      </span>

                      {/* Keep old tooltip markup if flag is false */}
                      {!USE_PORTAL_TOOLTIPS && !isGroup && (
                        <div className={`timeline-tooltip ${evt.percent < 20 ? 'align-left' : evt.percent > 80 ? 'align-right' : ''}`}>
                          <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                            {getEventIcon(evt)} {evt.title || evt.label}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                            <div>Age {Math.floor(evt.displayAge)} • {evt.description}</div>
                            {(() => {
                              if (evt.type === 'buyHouse') {
                                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                if (asset) {
                                  return (
                                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                      Price: {formatCompactCurrency(asset.purchasePrice || asset.homePrice || 0)}
                                      {asset.purchaseType !== 'cash' && ` (${asset.mortgageRate || 6.5}% APR)`}
                                    </div>
                                  );
                                }
                              }
                              if (evt.type === 'sellHouse') {
                                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                if (asset) {
                                  return (
                                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                      Property: {asset.name}
                                    </div>
                                  );
                                }
                              }
                              if (evt.type === 'haveChild') {
                                const ev = inputs.lifeEvents?.find(e => e.id === evt.originalId);
                                if (ev) {
                                  return (
                                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                                      Support Term: {ev.includeCollege ? 22 : 18} years
                                    </div>
                                  );
                                }
                              }
                              if (evt.type === 'marriage') {
                                return (
                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-rose)' }}>
                                    Spouse Income: {formatCompactCurrency(evt.spouseIncome)}/yr
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Line connector down to axis */}
                      {isExpanded && evt.stackIndex > 0 && (
                        <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 1.625}rem`, bottom: `-${evt.stackIndex * 1.625}rem`, left: '50%', transform: 'translateX(-50%)' }} />
                      )}
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>

        {/* Layer 2: DECISION PHASES (MARRIAGE, CHILDCARE, HOMEOWNERSHIP) */}
        {isExpanded && activeCommitments.length > 0 && (
          <div className="timeline-row phases-row" style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: 'none' }}>
            <div style={{ 
              width: `${chartLayout.leftPlotOffset}px`, 
              minWidth: `${chartLayout.leftPlotOffset}px`, 
              paddingRight: '12px', 
              textAlign: 'right', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center',
              fontSize: '0.7rem', 
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.05em'
            }}>
              Commitments
            </div>
            <div className="timeline-row-content phases-row-content" style={{ flexGrow: 1, padding: 0, marginRight: `${chartLayout.rightPlotOffset}px`, height: '1.75rem', position: 'relative' }}>
              <div className="timeline-track-inner" style={{ position: 'relative', width: '100%', height: '100%' }}>
                {activeCommitments.map(span => {
                  const startAge = Math.max(minAge, span.startAge);
                  const endAge = Math.min(maxAge, span.endAge);
                  if (startAge >= endAge || endAge <= minAge || startAge >= maxAge) return null;

                  const startPercent = Math.max(0, ((startAge - minAge) / totalYears) * 100);
                  const endPercent = Math.min(100, ((endAge - minAge) / totalYears) * 100);
                  const widthPercent = Math.max(2, endPercent - startPercent);

                  return (
                    <div
                      key={span.id}
                      className={span.className}
                      style={{
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`
                      }}
                    >
                      <span className="commitment-text">
                        {span.emoji} {span.label} (Ages {Math.floor(span.startAge)}–{Math.floor(span.endAge)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Layer 3: AXIS LABELS */}
        <div className="timeline-row axis-row" style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: 'none' }}>
          {isExpanded ? (
            <div style={{ 
              width: `${chartLayout.leftPlotOffset}px`, 
              minWidth: `${chartLayout.leftPlotOffset}px`, 
              paddingRight: '12px', 
              textAlign: 'right', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center',
              fontSize: '0.7rem', 
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.05em'
            }}>
              Age
            </div>
          ) : (
            <div style={{ width: `${chartLayout.leftPlotOffset}px`, minWidth: `${chartLayout.leftPlotOffset}px` }} />
          )}
          <div className="timeline-row-content axis-row-content" style={{ flexGrow: 1, padding: 0, marginRight: `${chartLayout.rightPlotOffset}px`, height: '1.5rem', position: 'relative' }}>
            <div className="timeline-track-inner" style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div 
                className="axis-line" 
                style={{ 
                  position: 'absolute', 
                  top: '0px', 
                  left: 0, 
                  right: 0, 
                  height: '1px', 
                  background: 'var(--border-color)' 
                }} 
              />
              {(() => {
                const labels = [];
                const step = totalYears > 30 ? 5 : 2;
                const roundedStart = Math.ceil(minAge / step) * step;
                
                for (let age = roundedStart; age <= maxAge; age += step) {
                  const percent = ((age - minAge) / totalYears) * 100;
                  const isMajorTick = age % 10 === 0;
                  labels.push(
                    <div 
                      key={age} 
                      className="timeline-tick-new" 
                      style={{ left: `${percent}%`, top: '0px' }}
                    >
                      <div 
                        className="timeline-tick-mark-new" 
                        style={{
                          height: isMajorTick ? '8px' : '4px',
                          background: isMajorTick ? 'var(--text-secondary, #4b5563)' : 'var(--border-color)',
                          opacity: isMajorTick ? 1 : 0.8
                        }}
                      />
                      <span 
                        className="timeline-tick-label-new"
                        style={{
                          fontWeight: isMajorTick ? '700' : '600',
                          color: isMajorTick ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                          fontSize: '0.7rem',
                          marginTop: '2px',
                          display: 'block'
                        }}
                      >
                        {age}
                      </span>
                    </div>
                  );
                }
                return labels;
              })()}
            </div>
          </div>
        </div>

        {/* Centered Age Label row below the ticks */}
        <div style={{ display: 'flex', width: '100%', marginTop: '0.15rem' }}>
          <div style={{ width: `${chartLayout.leftPlotOffset}px`, minWidth: `${chartLayout.leftPlotOffset}px` }} />
          <div style={{ flexGrow: 1, marginRight: `${chartLayout.rightPlotOffset}px`, textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>
            Age
          </div>
        </div>

      </div>
      {USE_PORTAL_TOOLTIPS && hoveredEvent && (
        <TimelineTooltipPortal
          hoveredEvent={hoveredEvent}
          inputs={inputs}
        />
      )}
    </div>
  );
}

function TimelineTooltipPortal({ hoveredEvent, inputs }) {
  const { evt, groupEvents, target, displayAge } = hoveredEvent;
  const tooltipRef = useRef(null);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    arrowLeft: 0,
    isBelow: false,
    loaded: false
  });

  useLayoutEffect(() => {
    // Tweak 3: Guard against stale DOM nodes
    if (!target || !target.isConnected) return;

    const updatePosition = () => {
      if (!tooltipRef.current) return;
      if (!target || !target.isConnected) return; // Tweak 3 guard

      const tooltipEl = tooltipRef.current;
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;

      const targetRect = target.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Horizontal position: center tooltip on target
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const idealLeft = targetCenterX - tooltipWidth / 2;

      // Clamp left position to stay inside viewport (8px margin)
      const minLeft = 8;
      const maxLeft = viewportWidth - tooltipWidth - 8;
      const clampedLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));

      // Calculate arrow horizontal offset relative to the tooltip
      const arrowLeft = targetCenterX - clampedLeft;

      // Vertical position: above target by default (10px gap)
      let isBelow = false;
      let top = targetRect.top - tooltipHeight - 10;

      // Flip below if not enough room above (8px margin)
      if (targetRect.top - tooltipHeight - 10 < 8) {
        top = targetRect.bottom + 10;
        isBelow = true;
      }

      // Final clamp to keep it visible near top edge
      if (top < 8) {
        top = 8;
      }

      setCoords({
        top: top, // Tweak 1: position: fixed coordinates (no scrollY)
        left: clampedLeft, // Tweak 1: position: fixed coordinates (no scrollX)
        arrowLeft,
        isBelow,
        loaded: true
      });
    };

    updatePosition();

    // Listen to scroll (capture mode to capture container scrolls) and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [target, evt, groupEvents, displayAge]);

  // Tweak 3: Guard against stale DOM nodes
  if (!target || !target.isConnected) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      className="timeline-tooltip-portal"
      style={{
        position: 'fixed', // Tweak 1: position: fixed
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        opacity: coords.loaded ? 1 : 0,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'opacity 0.15s ease'
      }}
    >
      {evt ? (
        // Single Event Tooltip content
        <>
          <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
            {getEventIcon(evt)} {evt.title || evt.label}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
            <div>Age {Math.floor(displayAge)} • {evt.description}</div>
            {(() => {
              if (evt.type === 'mortgageOff') {
                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                if (asset) {
                  return (
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                      P&I Savings: {formatCompactCurrency(propPIAmount(asset))}/yr
                    </div>
                  );
                }
              }
              if (evt.type === 'childSupportEnds') {
                return (
                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                    Support expenses have ended
                  </div>
                );
              }
              if (evt.type === 'buyHouse') {
                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                if (asset) {
                  return (
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                      Price: {formatCompactCurrency(asset.purchasePrice || asset.homePrice || 0)} 
                      {asset.purchaseType !== 'cash' && ` (${asset.mortgageRate || 6.5}% APR)`}
                    </div>
                  );
                }
              }
              if (evt.type === 'sellHouse') {
                const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                if (asset) {
                  return (
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                      Property: {asset.name}
                    </div>
                  );
                }
              }
              if (evt.type === 'haveChild') {
                const ev = inputs.lifeEvents?.find(e => e.id === evt.originalId);
                if (ev) {
                  return (
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                      Support Term: {ev.includeCollege ? 22 : 18} years
                    </div>
                  );
                }
              }
              if (evt.type === 'marriage') {
                return (
                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-rose)' }}>
                    Spouse Income: {formatCompactCurrency(evt.spouseIncome)}/yr
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </>
      ) : (
        // Summary Marker Tooltip content
        <>
          <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.25rem', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.25rem' }}>
            📅 Age {Math.floor(displayAge)} Events ({groupEvents.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
            {[...groupEvents]
              .sort((a, b) => (a.stackIndex || 0) - (b.stackIndex || 0))
              .map((item, idx) => (
                <div key={idx} style={{ borderBottom: idx < groupEvents.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingBottom: idx < groupEvents.length - 1 ? '0.35rem' : 0 }}>
                  <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '0.74rem' }}>
                    {getEventIcon(item)} {item.title || item.label}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '0.1rem', lineHeight: '1.2' }}>
                    {item.description}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Dynamic Arrow */}
      {coords.loaded && (
        <div
          className="tooltip-portal-arrow"
          data-placement={coords.isBelow ? 'bottom' : 'top'}
          style={{
            left: `${coords.arrowLeft}px`
          }}
        />
      )}
    </div>,
    document.body
  );
}
