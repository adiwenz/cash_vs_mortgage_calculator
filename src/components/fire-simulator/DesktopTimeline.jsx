import { getActiveChildrenCountAtAge, propPIAmount } from '../../simulatorMathUtils';
import { formatCurrency, isEditableEvent, isFinancialEvent } from './helpers';

export default function DesktopTimeline({
  inputs,
  timelineEvents,
  editingEvent,
  draggingInfo,
  dragOccurredRef,
  handleNodeDragStart,
  handleEditRoadmapEvent
}) {
  const totalYears = inputs.lifeExpectancy - inputs.currentAge;
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
  const marriageEvent = inputs.lifeEvents?.find(e => e.type === 'marriage' && e.enabled);
  if (marriageEvent) {
    const marriageAge = Number(marriageEvent.age || marriageEvent.marriageAge || 35);
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
    <div className="timeline-wrapper" style={{ flexGrow: 1, overflowX: 'auto', minWidth: 0 }}>
      <div className="timeline-grid" style={{ minWidth: '850px' }}>
        
        {/* Layer 1: MILESTONES / EVENTS */}
        <div className="timeline-row">
          <div className="timeline-row-label">
            <span style={{ fontWeight: 700 }}>Events</span>
          </div>
          <div className="timeline-row-content events-row-content">
            <div className="timeline-track-inner">
              <div className="events-axis-line" />
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
                const percent = totalYears > 0 ? ((displayAge - inputs.currentAge) / totalYears) * 100 : 0;
                const isFinancial = isFinancialEvent(evt);

                if (isFinancial) {
                  return (
                    <div
                      key={idx}
                      className={`financial-milestone-wrapper ${isDraggingThis ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: `${percent}%`,
                        bottom: `${16 + (evt.stackIndex * 38)}px`
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
                        {evt.icon}
                      </div>

                      {/* Tooltip on hover */}
                      <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                          {evt.icon} {evt.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                          <div>Age {Math.floor(displayAge)} • {evt.description}</div>
                          {(() => {
                            if (evt.type === 'mortgageOff') {
                              const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                              if (asset) {
                                return (
                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                    P&I Savings: {formatCurrency(propPIAmount(asset))}/yr
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
                      {evt.stackIndex > 0 && (
                        <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 38}px`, bottom: `-${evt.stackIndex * 38}px`, left: '50%', transform: 'translateX(-50%)' }} />
                      )}
                    </div>
                  );
                } else {
                  const wrapperClass = (evt.isMilestone || evt.type === 'retire') ? 'milestone-event' : 'standard-milestone';
                  return (
                    <div
                      key={idx}
                      className={`milestone-circle-wrapper ${wrapperClass} ${isDraggingThis ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: `${percent}%`,
                        bottom: `${16 + (evt.stackIndex * 38)}px`
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
                        {evt.icon}
                      </div>

                      {/* Tooltip on hover */}
                      <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                        <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                          {evt.icon} {evt.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                          <div>Age {Math.floor(displayAge)} • {evt.description}</div>
                          {(() => {
                            if (evt.type === 'buyHouse') {
                              const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                              if (asset) {
                                return (
                                  <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                    Price: {formatCurrency(asset.purchasePrice || asset.homePrice || 0)} 
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
                                  Spouse Income: {formatCurrency(evt.spouseIncome)}/yr
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      {/* Line connector down to axis */}
                      {evt.stackIndex > 0 && (
                        <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 38}px`, bottom: `-${evt.stackIndex * 38}px`, left: '50%', transform: 'translateX(-50%)' }} />
                      )}
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>

        {/* Layer 2: DECISION PHASES (MARRIAGE, CHILDCARE, HOMEOWNERSHIP) */}
        <div className="timeline-row phases-row">
          <div className="timeline-row-label">
            <span style={{ fontWeight: 700 }}>Commitments</span>
          </div>
          <div className="timeline-row-content phases-row-content">
            <div className="timeline-track-inner" style={{ height: '36px' }}>
              {activeCommitments.map(span => {
                const startPercent = Math.max(0, ((span.startAge - inputs.currentAge) / totalYears) * 100);
                const endPercent = Math.min(100, ((span.endAge - inputs.currentAge) / totalYears) * 100);
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

        {/* Layer 3: AXIS LABELS */}
        <div className="timeline-row axis-row" style={{ borderBottom: 'none' }}>
          <div className="timeline-row-label" style={{ visibility: 'hidden' }}>Age</div>
          <div className="timeline-row-content axis-row-content">
            <div className="timeline-track-inner" style={{ height: '24px' }}>
              <div className="axis-line" />
              {(() => {
                const labels = [];
                const step = totalYears > 30 ? 5 : 2;
                const roundedStart = Math.ceil(inputs.currentAge / step) * step;
                
                for (let age = roundedStart; age <= inputs.lifeExpectancy; age += step) {
                  const percent = ((age - inputs.currentAge) / totalYears) * 100;
                  labels.push(
                    <div key={age} className="axis-label-tick" style={{ left: `${percent}%` }}>
                      <div className="tick-mark" />
                      <span className="tick-label-text">Age {age}</span>
                    </div>
                  );
                }
                return labels;
              })()}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
