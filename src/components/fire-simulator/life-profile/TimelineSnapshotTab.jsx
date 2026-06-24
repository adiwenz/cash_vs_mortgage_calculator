import React from 'react';
import { ZoomOut, ZoomIn, Maximize2, Settings } from 'lucide-react';
import { getTimelineProjection, getLifeSnapshotAtAge } from '../../../models/lifeTimeline/index.js';
import { buildTimelineRows, getTimelineItemObjectKey, resolveHouseIdForEvent } from '../../../utils/timelineRowBuilder.js';

export default function TimelineSnapshotTab({
  isMobile,
  inputs,
  simulation,
  selectedAge,
  setSelectedAge,
  activeTab,
  formatCurrency,
  formatCompactCurrency,
  expandedCategories,
  setExpandedCategories
}) {
  // Derive projection and snapshot
  const projection = getTimelineProjection(inputs, { selectedAge, simulation });
  const snapshot = getLifeSnapshotAtAge(inputs, selectedAge);

  const getCategoryBg = (rowId) => {
    switch (rowId) {
      case 'relationship': return '#f3e8ff';
      case 'housing': return '#dcfce7';
      case 'children': return '#ffedd5';
      case 'education': return '#dbeafe';
      case 'debt': return '#fae8ff';
      case 'income': return '#ccfbf1';
      case 'assets': return '#fef9c3';
      default: return '#f3f4f6';
    }
  };

  const getMilestoneIcon = (category) => {
    switch (category) {
      case 'relationship': return '❤️';
      case 'housing': return '🏠';
      case 'children': return '👶';
      case 'education': return '🎓';
      case 'debt': return '💸';
      case 'income': return '💼';
      default: return '⭐️';
    }
  };

  const getMilestoneIconBg = (category) => {
    return getCategoryBg(category);
  };

  const formatRelationshipStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Single';
  };

  const formatChildrenSnapshot = (children) => {
    if (!children || children.length === 0) return 'None';
    return children.map(c => `${c.name} (Age ${Math.floor(c.age)})`).join(', ');
  };

  const formatNetWorthValue = (proj, age, fallback) => {
    const assetsRow = proj.rows.find(r => r.id === 'assets');
    const seriesItem = assetsRow?.items.find(item => item.type === 'series');
    const points = seriesItem?.metadata?.points || [];
    const pointAtAge = points.find(p => p.age === age);
    const netWorthVal = pointAtAge ? pointAtAge.value : fallback;
    return formatCurrency(netWorthVal);
  };

  const formatDebtsList = (activeDebts) => {
    if (!activeDebts || activeDebts.length === 0) return 'None';
    return activeDebts.map(d => d.name).join(', ');
  };

  const renderSnapshotRow = (icon, label, value) => {
    return (
      <div className="life-snapshot-row-item" key={label}>
        <div className="life-snapshot-row-item-left">
          <div className="life-snapshot-row-item-icon-circle">
            {icon}
          </div>
          <span className="life-snapshot-row-item-label">{label}</span>
        </div>
        <span className="life-snapshot-row-item-value">{value}</span>
      </div>
    );
  };

  const renderPeriodBar = (item, minAge, maxAge) => {
    const range = maxAge - minAge || 1;
    const start = Math.max(minAge, item.startAge);
    const end = Math.min(maxAge, item.endAge);
    if (start >= end) return null;
    const left = ((start - minAge) / range) * 100;
    const width = ((end - start) / range) * 100;
    return (
      <div 
        key={item.id}
        style={{ 
          position: 'absolute', 
          left: `${left}%`, 
          width: `${width}%`, 
          display: 'flex', 
          alignItems: 'center',
          top: '50%',
          transform: 'translateY(-50%)',
          height: '24px'
        }}
      >
        <div 
          className={`timeline-period-bar cat-${item.category}`} 
          style={{ width: '100%', position: 'relative', top: 'auto', transform: 'none' }}
          title={`${item.title} (Ages ${item.startAge}-${item.endAge})`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </span>
        </div>
        {width < 60 && !(item.id && item.id.startsWith('status-')) && (
          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginLeft: '6px', whiteSpace: 'nowrap' }}>
            Age {item.startAge}-{item.endAge}
          </span>
        )}
      </div>
    );
  };

  const renderPointMarker = (item, minAge, maxAge) => {
    const range = maxAge - minAge || 1;
    const age = item.age !== null ? item.age : item.startAge;
    if (age < minAge || age > maxAge) return null;
    const left = ((age - minAge) / range) * 100;
    return (
      <div key={item.id} className="timeline-point-marker" style={{ left: `${left}%` }}>
        <div className={`timeline-point-dot dot-${item.category}`} />
        <div className="timeline-point-label-card" style={{ bottom: '14px', zIndex: 15 }}>
          <span style={{ fontWeight: '700' }}>{item.title}</span>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>Age {age}</span>
        </div>
      </div>
    );
  };

  const renderSeriesLine = (item, minAge, maxAge) => {
    const points = item.metadata?.points || [];
    if (points.length === 0) return null;
    const values = points.map(p => p.value);
    const maxNW = Math.max(...values, 100000);
    const minNW = Math.min(...values, 0);
    const rangeNW = maxNW - minNW || 1;
    const range = maxAge - minAge || 1;
    
    const svgPoints = points.map(p => {
      const x = ((p.age - minAge) / range) * 100;
      const y = 80 - ((p.value - minNW) / rangeNW) * 60;
      return { x, y, age: p.age, value: p.value };
    });

    const lineD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = svgPoints.length > 0 
      ? `${lineD} L ${svgPoints[svgPoints.length - 1].x} 100 L ${svgPoints[0].x} 100 Z` 
      : '';

    const nodeAges = [projection.currentAge, Number(inputs.targetRetirementAge) || 65, maxAge];
    const nodes = svgPoints.filter(p => nodeAges.includes(p.age));

    return (
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill="url(#netWorthGradient)" />}
          {lineD && <path d={lineD} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3 3" />}
        </svg>
        {nodes.map(n => (
          <div 
            key={n.age} 
            style={{ 
              position: 'absolute', 
              left: `${n.x}%`, 
              top: `${n.y}%`, 
              transform: 'translate(-50%, -50%)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              zIndex: 11
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', border: '1.5px solid #ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#2563eb', background: '#ffffff', padding: '1px 3px', borderRadius: '4px', border: '1px solid #e5e7eb', marginTop: '-18px', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {formatCompactCurrency(n.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderTimelineRows = (proj, age) => {
    const minAge = proj.minAge;
    const maxAge = proj.maxAge;

    const allDescriptors = buildTimelineRows(inputs);

    // Normalize all timeline items by category ID to have objectType, objectId, and rowKey.
    const normalizedItemsByCategoryId = {};
    proj.rows.forEach(categoryRow => {
      let items = categoryRow.items || [];
      if (categoryRow.id === 'housing') {
        // Filter out status-housing- items (renting, homeowner)
        items = items.filter(item => !String(item.id || '').startsWith('status-housing-'));
      }

      normalizedItemsByCategoryId[categoryRow.id] = items.map(item => {
        const rowKey = getTimelineItemObjectKey(item, inputs);
        let objectType = null;
        let objectId = null;
        if (rowKey) {
          const parts = rowKey.split('-');
          objectType = parts[0];
          objectId = parts.slice(1).join('-');
        }
        return {
          ...item,
          objectType,
          objectId,
          rowKey
        };
      });
    });

    // Add custom ownership period bars for each house asset in the Housing category
    const housingObjects = allDescriptors.filter(d => d.type === 'object' && d.parent === 'housing');
    if (!normalizedItemsByCategoryId['housing']) {
      normalizedItemsByCategoryId['housing'] = [];
    }

    housingObjects.forEach(houseRow => {
      const houseId = houseRow.objectId;
      const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
      
      const buyEv = enabledEvents.find(e => e.type === 'buyHouse' && (e.houseId === houseId || e.id === houseId || resolveHouseIdForEvent(e, inputs) === houseId));
      const startAge = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : (buyEv.age || 35)) : (Number(inputs.currentAge) || 35);
      
      const sellEv = enabledEvents.find(e => e.type === 'sellHouse' && (e.houseId === houseId || e.id === houseId || resolveHouseIdForEvent(e, inputs) === houseId));
      const endAge = sellEv ? Number(sellEv.age || 85) : (Number(inputs.lifeExpectancy) || 85);

      if (startAge < endAge) {
        normalizedItemsByCategoryId['housing'].push({
          id: `housing-own-period-${houseId}`,
          type: 'period',
          category: 'housing',
          title: `${houseRow.label} (Owned)`,
          startAge,
          endAge,
          rowKey: houseRow.rowKey,
          objectType: 'housing',
          objectId: houseId
        });
      }
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '140px', right: 0, top: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
          {proj.currentAge >= minAge && proj.currentAge <= maxAge && (
            <div 
              style={{
                position: 'absolute',
                left: `${((proj.currentAge - minAge) / (maxAge - minAge || 1)) * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'rgba(22, 163, 74, 0.25)',
                borderLeft: '1px dashed #16a34a',
              }}
            />
          )}
        </div>

        {allDescriptors.map(descriptor => {
          if (descriptor.type === 'category') {
            const isExpanded = !!expandedCategories[descriptor.id];
            const parentItems = normalizedItemsByCategoryId[descriptor.id] || [];

            // If expanded, render only category-level items (rowKey is null)
            // If collapsed, render all items in the category
            const visibleItems = isExpanded
              ? parentItems.filter(item => !item.rowKey)
              : parentItems;

            const isAssets = descriptor.id === 'assets';
            const seriesItem = visibleItems.find(item => item.type === 'series');
            const hasSeriesData = isAssets && seriesItem && seriesItem.metadata?.points && seriesItem.metadata.points.length > 0;

            return (
              <div key={descriptor.id} className="timeline-row-track">
                <div 
                  className="timeline-row-label-col"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpandedCategories(prev => ({
                    ...prev,
                    [descriptor.id]: !prev[descriptor.id]
                  }))}
                >
                  <span style={{ fontSize: '0.65rem', width: '12px', display: 'inline-block', color: 'var(--text-secondary)' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <div className="timeline-row-icon-wrapper" style={{ background: getCategoryBg(descriptor.id) }}>
                    <span style={{ fontSize: '0.85rem' }}>{descriptor.icon}</span>
                  </div>
                  <span className="timeline-row-label-text">
                    {descriptor.label}
                    {descriptor.count > 0 && (
                      <span className="category-count-badge" style={{ color: 'var(--text-tertiary)', marginLeft: '4px', fontSize: '0.72rem' }}>
                        [{descriptor.count}]
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
                  <div className="timeline-row-baseline-track-line" />
                  
                  {isAssets ? (
                    hasSeriesData ? (
                      renderSeriesLine(seriesItem, minAge, maxAge)
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '1rem', color: 'var(--text-tertiary)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        No Net Worth projection series data available
                      </div>
                    )
                  ) : (
                    visibleItems.map(item => {
                      if (item.type === 'period') {
                        return renderPeriodBar(item, minAge, maxAge);
                      }
                      if (item.type === 'point') {
                        return renderPointMarker(item, minAge, maxAge);
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
            );
          } else if (descriptor.type === 'object') {
            const isParentExpanded = !!expandedCategories[descriptor.parent];
            if (!isParentExpanded) return null;

            const parentItems = normalizedItemsByCategoryId[descriptor.parent] || [];
            const objectItems = parentItems.filter(item => item.rowKey === descriptor.rowKey);

            return (
              <div key={descriptor.rowKey} className="timeline-row-track sub-row">
                <div className="timeline-row-label-col sub-row" style={{ paddingLeft: '1.25rem' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginRight: '6px', opacity: 0.6 }}>
                    ├─
                  </span>
                  <div className="timeline-row-icon-wrapper sub-icon" style={{ background: getCategoryBg(descriptor.parent), width: '22px', height: '22px', minWidth: '22px' }}>
                    <span style={{ fontSize: '0.7rem' }}>{descriptor.icon}</span>
                  </div>
                  <span className="timeline-row-label-text sub-label" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {descriptor.label}
                  </span>
                </div>
                
                <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
                  <div className="timeline-row-baseline-track-line" />
                  
                  {objectItems.map(item => {
                    if (item.type === 'period') {
                      return renderPeriodBar(item, minAge, maxAge);
                    }
                    if (item.type === 'point') {
                      return renderPointMarker(item, minAge, maxAge);
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderAgeAxis = (minAge, maxAge, currentAge) => {
    const range = maxAge - minAge || 1;
    const step = range > 40 ? 10 : (range > 20 ? 5 : 2);
    const startTick = Math.ceil(minAge / step) * step;
    const ticks = [];
    for (let a = startTick; a <= maxAge; a += step) {
      ticks.push(a);
    }
    return (
      <div className="timeline-row-track" style={{ height: '32px', borderBottom: '1px solid #f3f4f6', marginBottom: '8px' }}>
        <div className="timeline-row-label-col">
          <span className="timeline-row-label-text" style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Age</span>
        </div>
        <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
          {ticks.map(a => {
            const pct = ((a - minAge) / range) * 100;
            return (
              <div key={a} className="timeline-tick-new" style={{ left: `${pct}%` }}>
                <div className="timeline-tick-mark-new" />
                <span className="timeline-tick-label-new">{a}</span>
              </div>
            );
          })}
          
          {currentAge >= minAge && currentAge <= maxAge && (
            <div 
              style={{ 
                position: 'absolute', 
                left: `${((currentAge - minAge) / range) * 100}%`, 
                transform: 'translateX(-50%)', 
                top: '-14px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                zIndex: 12 
              }}
            >
              <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', marginBottom: '2px' }}>Today</span>
              <div 
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  background: '#16a34a', 
                  color: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '0.65rem', 
                  fontWeight: '800', 
                  border: '2px solid #ffffff', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)' 
                }}
              >
                {currentAge}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="timeline-workspace-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
        <div className="timeline-canvas-card" style={{ padding: '1rem' }}>
          <div className="timeline-header-section" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Timeline</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>See how the major aspects of your life change over time.</p>
          </div>
          <div className="timeline-canvas-body" style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
            <div style={{ minWidth: '600px', position: 'relative' }}>
              {renderAgeAxis(projection.minAge, projection.maxAge, projection.currentAge)}
              {renderTimelineRows(projection, selectedAge)}
            </div>
          </div>
        </div>
        
        <div className="life-snapshot-panel" style={{ padding: '1rem' }}>
          <div className="life-snapshot-header">
            <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Life Snapshot</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>View your life at any age.</p>
          </div>
          <div className="life-snapshot-age-selector-row" style={{ margin: '0.5rem 0' }}>
            <span className="age-selector-text">Age {selectedAge} {selectedAge === projection.currentAge ? '(Today)' : ''}</span>
          </div>
          <div className="life-snapshot-rows-list">
            {renderSnapshotRow('❤️', 'Relationship', formatRelationshipStatus(snapshot.relationshipStatus))}
            {renderSnapshotRow('🏠', 'Housing', snapshot.housingStatus === 'own' ? 'Homeowner' : 'Renting')}
            {renderSnapshotRow('👶', 'Children', formatChildrenSnapshot(snapshot.children))}
            {renderSnapshotRow('💼', 'Annual Income', formatCurrency(snapshot.income.annualIncome) + ' / yr')}
            {renderSnapshotRow('📈', 'Net Worth', formatNetWorthValue(projection, selectedAge, snapshot.assets.investedAssets))}
            {renderSnapshotRow('💸', 'Debts', formatDebtsList(snapshot.debts.activeDebts))}
          </div>
          
          <div className="upcoming-milestones-container">
            <h5 style={{ fontSize: '0.82rem', fontWeight: '800', margin: '0.5rem 0 0 0' }}>Upcoming Milestones</h5>
            {projection.upcomingMilestones.length === 0 ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>No upcoming milestones</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                {projection.upcomingMilestones.map(m => (
                  <div key={m.id} className="upcoming-milestone-card">
                    <div className="upcoming-milestone-icon-circle" style={{ background: getMilestoneIconBg(m.category) }}>
                      {getMilestoneIcon(m.category)}
                    </div>
                    <div className="upcoming-milestone-text-group">
                      <span className="upcoming-milestone-title-text">{m.title}</span>
                      <span className="upcoming-milestone-timing-text">Age {m.age} (In {m.age - projection.currentAge} years)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="timeline-workspace-container">
      {/* Left Column: Timeline Canvas */}
      <div className="timeline-canvas-card">
        <div className="timeline-header-section">
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Timeline</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>See how the major aspects of your life change over time.</p>
          </div>
          
          <div className="timeline-controls-row">
            <button type="button" className="timeline-btn" disabled><ZoomOut size={14} /> Zoom Out</button>
            <button type="button" className="timeline-btn" disabled><ZoomIn size={14} /> Zoom In</button>
            <button type="button" className="timeline-btn" disabled><Maximize2 size={14} /> Fit to View</button>
            <button type="button" className="timeline-btn" disabled>Legend</button>
            <button type="button" className="timeline-btn" disabled><Settings size={14} /> Settings</button>
          </div>
        </div>

        <div className="timeline-canvas-body" style={{ marginTop: '1rem' }}>
          {renderAgeAxis(projection.minAge, projection.maxAge, projection.currentAge)}
          {renderTimelineRows(projection, selectedAge)}
        </div>
      </div>

      {/* Right Column: Life Snapshot */}
      <div className="life-snapshot-panel">
        <div className="life-snapshot-header">
          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Life Snapshot</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>View your life at any age.</p>
        </div>

        {/* Selected Age Indicator */}
        <div className="life-snapshot-age-selector-row">
          <button type="button" className="age-selector-arrow-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>&larr;</button>
          <span className="age-selector-text">Age {selectedAge} {selectedAge === projection.currentAge ? '(Today)' : ''}</span>
          <button type="button" className="age-selector-arrow-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>&rarr;</button>
        </div>

        {/* Snapshot Rows */}
        <div className="life-snapshot-rows-list">
          {renderSnapshotRow('❤️', 'Relationship', formatRelationshipStatus(snapshot.relationshipStatus))}
          {renderSnapshotRow('🏠', 'Housing', snapshot.housingStatus === 'own' ? 'Homeowner' : 'Renting')}
          {renderSnapshotRow('👶', 'Children', formatChildrenSnapshot(snapshot.children))}
          {renderSnapshotRow('💼', 'Annual Income', formatCurrency(snapshot.income.annualIncome) + ' / yr')}
          {renderSnapshotRow('📈', 'Net Worth', formatNetWorthValue(projection, selectedAge, snapshot.assets.investedAssets))}
          {renderSnapshotRow('💸', 'Debts', formatDebtsList(snapshot.debts.activeDebts))}
        </div>

        {/* Upcoming Milestones */}
        <div className="upcoming-milestones-container">
          <h5 style={{ fontSize: '0.85rem', fontWeight: '800', margin: '0.5rem 0 0 0', color: 'var(--text-primary)' }}>Upcoming Milestones</h5>
          {projection.upcomingMilestones.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>No upcoming milestones</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              {projection.upcomingMilestones.map(m => (
                <div key={m.id} className="upcoming-milestone-card">
                  <div className="upcoming-milestone-icon-circle" style={{ background: getMilestoneIconBg(m.category) }}>
                    {getMilestoneIcon(m.category)}
                  </div>
                  <div className="upcoming-milestone-text-group">
                    <span className="upcoming-milestone-title-text">{m.title}</span>
                    <span className="upcoming-milestone-timing-text">Age {m.age} (In {m.age - projection.currentAge} years)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button type="button" className="timeline-btn" disabled style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}>
            View Full Events List
          </button>
        </div>
      </div>
    </div>
  );
}
