import React, { useState } from 'react';
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
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = localIsExpanded;

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

              {timelineEvents.map((evt, idx) => {
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

                if (displayAge < minAge || displayAge > maxAge) return null;

                const percent = totalYears > 0 ? ((displayAge - minAge) / totalYears) * 100 : 0;
                const isFinancial = isFinancialEvent(evt);
                const shouldPulse = window.pulseEventId && evt.originalId && String(window.pulseEventId) === String(evt.originalId);

                const bottomPos = isExpanded ? `${1 + (evt.stackIndex * 1.625)}rem` : '1rem';

                if (isFinancial) {
                  return (
                    <div
                      key={idx}
                      className={`financial-milestone-wrapper ${isDraggingThis ? 'dragging' : ''} ${isSelected ? 'selected' : ''} ${shouldPulse ? 'pulse-highlight-event' : ''}`}
                      style={{
                        left: `${percent}%`,
                        bottom: bottomPos
                      }}
                      onMouseDown={(e) => handleNodeDragStart(e, evt)}
                      onTouchStart={(e) => handleNodeDragStart(e, evt)}
                      onClick={(e) => {
                        if (dragOccurredRef.current) {
                          e.stopPropagation();
                          return;
                        }
                        if (isEditableEvent(evt)) {
                          handleEditRoadmapEvent(evt);
                        }
                      }}
                    >
                      <div className="financial-milestone-dot">
                        {getEventIcon(evt)}
                      </div>

                      {/* Tooltip on hover */}
                      <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                          {getEventIcon(evt)} {evt.title}
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
                            return null;
                          })()}
                        </div>
                      </div>

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
                      className={`milestone-circle-wrapper ${wrapperClass} ${isDraggingThis ? 'dragging' : ''} ${isSelected ? 'selected' : ''} ${shouldPulse ? 'pulse-highlight-event' : ''}`}
                      style={{
                        left: `${percent}%`,
                        bottom: bottomPos
                      }}
                      onMouseDown={(e) => handleNodeDragStart(e, evt)}
                      onTouchStart={(e) => handleNodeDragStart(e, evt)}
                      onClick={(e) => {
                        if (dragOccurredRef.current) {
                          e.stopPropagation();
                          return;
                        }
                        if (isEditableEvent(evt)) {
                          handleEditRoadmapEvent(evt);
                        }
                      }}
                    >
                      <div className="milestone-glow-circle">
                        {getEventIcon(evt)}
                      </div>

                      {/* Tooltip on hover */}
                      <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                          {getEventIcon(evt)} {evt.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                          <div>Age {Math.floor(displayAge)} • {evt.description}</div>
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
    </div>
  );
}
