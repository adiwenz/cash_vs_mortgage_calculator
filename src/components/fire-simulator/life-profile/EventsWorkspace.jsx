import React, { useMemo } from 'react';
import { useTimelineEvents } from '../../../hooks/useTimelineEvents';
import { findMatchingEvent } from '../../../features/fire/events/handlers/eventHandlerUtils';

function isGeneratedMainIncome(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('child-income-boost') ||
         id.startsWith('simple-inc-prechild') ||
         id.startsWith('simple-inc-worksave') ||
         id.startsWith('simple-inc-childcare') ||
         id === 'simple-inc' ||
         id === 'inc-1';
}

const getWorkspaceEventAge = (ev) => {
  if (!ev) return null;
  if (ev.type === 'haveChild' || ev.type === 'child' || ev.type === 'createChild') {
    const birthAge = ev.parentAgeAtBirth !== undefined ? ev.parentAgeAtBirth :
                     ev.birthAge !== undefined ? ev.birthAge :
                     ev.age !== undefined ? ev.age :
                     null;
    return birthAge !== null ? Number(birthAge) : null;
  }
  const fields = [
    'age',
    'eventAge',
    'startAge',
    'targetAge',
    'changeAge',
    'purchaseAge',
    'marriageAge',
    'moveAge',
    'childAge',
    'arrivalAge',
    'claimingAge',
    'ageReceived',
    'transferAge'
  ];
  for (const f of fields) {
    if (ev[f] !== undefined && ev[f] !== null && ev[f] !== '') {
      const val = Number(ev[f]);
      if (!isNaN(val)) return val;
    }
  }
  return null;
};

export default function EventsWorkspace({
  isMobile,
  inputs,
  projection,
  snapshot,
  selectedAge,
  currentAge,
  lifeExpectancy,
  onSelectedAgeChange,
  expandedCategories,
  setExpandedCategories,
  handleCreateEvent,
  handleEditRoadmapEvent,
  handleDeleteEvent,
  simulation
}) {
  // Get canonical editable events from inputs
  const canonicalEvents = useMemo(() => {
    const list = [];
    
    // 1. Life Events (user-authored)
    if (inputs.lifeEvents) {
      inputs.lifeEvents.forEach(ev => {
        if (ev.isDerived) return;
        list.push({ originalEvent: ev, sourceType: 'lifeEvent' });
      });
    }

    // 2. Income List career changes
    if (inputs.incomeList) {
      inputs.incomeList.forEach(inc => {
        if (inc.isDerived) return;
        if (isGeneratedMainIncome(inc.id)) return;
        list.push({ originalEvent: inc, sourceType: 'income' });
      });
    }

    // 3. Spending Phases lifestyle changes
    if (inputs.spendingPhases) {
      inputs.spendingPhases.forEach(phase => {
        if (phase.isDerived) return;
        if (phase.id && typeof phase.id === 'string' && (phase.id.startsWith('simple-spend') || phase.id === 'spend-1')) return;
        list.push({ originalEvent: phase, sourceType: 'spending' });
      });
    }

    return list;
  }, [inputs]);

  // Use useTimelineEvents to get display metadata (titles, icons, descriptions)
  const timelineEvents = useTimelineEvents(inputs, simulation);

  const getEventIcon = (type) => {
    if (type === 'marriage') return '💍';
    if (type === 'haveChild' || type === 'child') return '👶';
    if (['buyHouse', 'sellHouse'].includes(type)) return '🏠';
    if (type === 'college') return '🎓';
    if (type === 'sabbatical') return '🌴';
    if (type === 'socialSecurity') return '💰';
    if (type === 'pension') return '📜';
    if (type === 'rentalIncome') return '🏢';
    if (type === 'annuity') return '📈';
    if (type === 'otherRetirementIncome') return '💵';
    if (type === 'retire') return '🏖️';
    if (type === 'windfall') return '💰';
    if (type === 'assetTransfer') return '🔄';
    if (type === 'borrowing') return '💳';
    if (type === 'payoffPlan') return '🏁';
    if (type === 'lifestyle' || type === 'spending' || type === 'move') return '🏡';
    return '📅';
  };

  const getEventCategoryBg = (type) => {
    if (type === 'marriage') return '#f3e8ff'; // purple
    if (['buyHouse', 'sellHouse', 'lifestyle', 'spending', 'move'].includes(type)) return '#dcfce7'; // green
    if (['haveChild', 'child'].includes(type)) return '#ffedd5'; // orange
    if (type === 'college') return '#dbeafe'; // blue
    if (['borrowing', 'payoffPlan'].includes(type)) return '#fae8ff'; // pink
    if (['career', 'careerChange', 'sabbatical', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome', 'retire'].includes(type)) return '#ccfbf1'; // teal
    if (['windfall', 'assetTransfer'].includes(type)) return '#fef9c3'; // yellow
    return '#f3f4f6';
  };

  const getEventCategoryLabel = (type) => {
    if (type === 'marriage') return 'Relationship';
    if (['buyHouse', 'sellHouse'].includes(type)) return 'Housing';
    if (['haveChild', 'child'].includes(type)) return 'Children';
    if (type === 'college') return 'Education';
    if (['borrowing', 'payoffPlan'].includes(type)) return 'Debt';
    if (['career', 'careerChange', 'sabbatical', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome', 'retire'].includes(type)) return 'Income';
    if (['windfall', 'assetTransfer'].includes(type)) return 'Assets';
    if (['lifestyle', 'spending', 'move'].includes(type)) return 'Lifestyle';
    return 'Decision';
  };

  // Group and sort canonical events
  const sections = useMemo(() => {
    const currentAgeNum = Number(currentAge || inputs.currentAge || 35);
    
    const upcomingList = [];
    const currentList = [];
    const pastList = [];
    const unscheduledList = [];

    canonicalEvents.forEach(({ originalEvent: canEv, sourceType }) => {
      // Look up in timeline events for rich formatting metadata
      const tlEv = timelineEvents.find(t => t.originalId === canEv.id);
      
      const age = getWorkspaceEventAge(canEv);
      
      // Build display event object mapping back to original canonical event
      const displayEv = {
        id: canEv.id,
        type: canEv.type || tlEv?.type || (sourceType === 'income' ? 'careerChange' : sourceType === 'spending' ? 'move' : undefined),
        age,
        title: tlEv?.title || tlEv?.label || canEv.name || canEv.title || (canEv.type === 'marriage' ? 'Get Married' : canEv.type === 'haveChild' ? 'Have Child' : 'Life Event'),
        description: tlEv?.description || canEv.description || 'Configured life event.',
        icon: tlEv?.icon || getEventIcon(canEv.type || (sourceType === 'income' ? 'careerChange' : sourceType === 'spending' ? 'move' : undefined)),
        originalEvent: canEv
      };

      if (age === null || isNaN(age)) {
        unscheduledList.push(displayEv);
      } else if (age === currentAgeNum) {
        currentList.push(displayEv);
      } else if (age > currentAgeNum) {
        upcomingList.push(displayEv);
      } else {
        pastList.push(displayEv);
      }
    });

    // Sort ascending by age
    const sortFn = (a, b) => a.age - b.age;
    upcomingList.sort(sortFn);
    currentList.sort(sortFn);
    pastList.sort(sortFn);

    return {
      upcoming: upcomingList,
      current: currentList,
      past: pastList,
      unscheduled: unscheduledList
    };
  }, [canonicalEvents, timelineEvents, currentAge, inputs.currentAge]);

  const handleEdit = (displayEv) => {
    handleEditRoadmapEvent(displayEv.originalEvent);
  };

  const handleDelete = (displayEv) => {
    // Resolve matching event from inputs to get exact object structure
    const matched = findMatchingEvent(inputs, displayEv.originalEvent) || displayEv.originalEvent;
    handleDeleteEvent(matched);
  };

  const renderEventCard = (evt) => {
    return (
      <div 
        key={evt.id} 
        className="life-profile-list-item" 
        style={{ 
          background: '#ffffff', 
          border: '1px solid var(--border-color, #e5e7eb)', 
          borderLeft: `4px solid ${getEventCategoryBg(evt.type)}`,
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexGrow: 1, minWidth: 0 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            background: getEventCategoryBg(evt.type), 
            fontSize: '1.2rem',
            flexShrink: 0
          }}>
            {evt.icon}
          </div>
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary, #111827)' }}>
                {evt.title}
              </span>
              <span style={{ 
                fontSize: '0.72rem', 
                padding: '1px 6px', 
                borderRadius: '4px', 
                background: 'rgba(37, 99, 235, 0.08)', 
                color: '#2563eb', 
                fontWeight: '600' 
              }}>
                {evt.age !== null && !isNaN(evt.age) ? `Age ${evt.age}` : 'Unscheduled'}
              </span>
              <span style={{ 
                fontSize: '0.72rem', 
                padding: '1px 6px', 
                borderRadius: '4px', 
                background: 'var(--bg-secondary, #f9fafb)', 
                color: 'var(--text-secondary, #4b5563)', 
                fontWeight: '500',
                border: '1px solid var(--border-color, #e5e7eb)'
              }}>
                {getEventCategoryLabel(evt.type)}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #4b5563)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {evt.description}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => handleEdit(evt)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px' }}
          >
            Edit
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => handleDelete(evt)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.2)' }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (title, list, emptyText) => {
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary, #111827)', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.25rem' }}>
          {title}
        </h5>
        {list.length === 0 ? (
          emptyText ? (
            <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color, #e5e7eb)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary, #9ca3af)', fontSize: '0.8rem' }}>
              {emptyText}
            </div>
          ) : null
        ) : (
          <div>
            {list.map(renderEventCard)}
          </div>
        )}
      </div>
    );
  };

  const workspaceContent = (
    <div className="timeline-canvas-card">
      <div style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary, #111827)' }}>
          Life Events Workspace
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #4b5563)', margin: '2px 0 0 0' }}>
          Manage your future life changes and goals using existing creation/edit/delete flows.
        </p>
      </div>

      {/* Add Event Area */}
      <div style={{ background: 'var(--bg-secondary, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary, #111827)' }}>
          ➕ Add Life Decision
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('marriage')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>💍</span> Marriage
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('haveChild')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>👶</span> Child
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('buyHouse')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>🏠</span> Buy House
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('careerChange')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>💼</span> Income Change
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('windfall')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>💰</span> Windfall
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('socialSecurity')} disabled={inputs.includeSocialSecurity !== false} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>🪙</span> Social Security
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('retire')} disabled={(inputs.lifeEvents || []).some(e => e.type === 'retire')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>🏖️</span> Stop Working
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleCreateEvent('custom')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <span>➕</span> Custom Event
          </button>
        </div>
      </div>

      {/* Grouped lists */}
      {renderSection(`Current Events (Age ${currentAge})`, sections.current, 'No events at your current age.')}
      {renderSection('Upcoming Events', sections.upcoming, 'No upcoming life changes yet.')}
      {renderSection('Past Events', sections.past, 'No past events.')}
      {sections.unscheduled.length > 0 && renderSection('Unscheduled Events', sections.unscheduled, '')}
    </div>
  );

  if (isMobile) {
    return (
      <div className="timeline-mobile-snapshot-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
        {workspaceContent}
      </div>
    );
  }

  return (
    <div className="timeline-workspace-container">
      {workspaceContent}
    </div>
  );
}
