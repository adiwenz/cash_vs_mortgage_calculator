import { useState, useRef } from 'react';
import { getDefaultEvent } from './eventDefaults.js';
import { eventSaveRouter } from './eventSaveRouter.js';
import { isEditableEvent } from '../../../components/fire-simulator/helpers.js';
import { validateSocialSecurityClaimAge } from '../../../fireCalculations.js';
import { setLastChartChangeType } from '../../../components/fire-simulator/changeTypeTracker';

export function useEventEditingController({
  scenarios,
  setScenarios,
  currentScenarioId,
  inputs,
  updateInput,
  timelineEvents = [],
  isMobile,
  setShowImprovementModal,
  commitEventAgeChange,
  editingEvent: passedEditingEvent,
  setEditingEvent: passedSetEditingEvent
}) {
  const [localEditingEvent, setLocalEditingEvent] = useState(null);
  const editingEvent = passedEditingEvent !== undefined ? passedEditingEvent : localEditingEvent;
  const setEditingEvent = passedSetEditingEvent !== undefined ? passedSetEditingEvent : setLocalEditingEvent;

  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [houseImpactSummary, setHouseImpactSummary] = useState(null);
  const [houseRebalanceSummary, setHouseRebalanceSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  const dragOccurredRef = useRef(false);

  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
      return;
    }

    if (type === 'socialSecurity') {
      const currentScen = scenarios.find(s => s.id === currentScenarioId);
      const inputsObj = currentScen ? currentScen.inputs : inputs;
      const newInputs = { ...inputsObj };
      newInputs.includeSocialSecurity = true;

      let existingEvent = (newInputs.lifeEvents || []).find(e => e.type === 'socialSecurity');
      let existingSS = newInputs.socialSecurity;
      let targetEvent = null;

      if (existingEvent) {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e =>
          e.type === 'socialSecurity' ? { ...e, enabled: true } : e
        );
        targetEvent = { ...existingEvent, enabled: true };
      }

      if (existingSS) {
        newInputs.socialSecurity = {
          ...existingSS,
          enabled: true
        };
        if (!targetEvent) {
          targetEvent = {
            ...existingSS,
            id: existingSS.id || 'ss-1',
            type: 'socialSecurity',
            enabled: true
          };
        }
      }

      if (!existingEvent && !existingSS) {
        const defaults = getDefaultEvent('socialSecurity', { inputs: newInputs, isMobile });
        newInputs.socialSecurity = {
          ...defaults,
          enabled: true
        };
        if (!newInputs.lifeEvents) {
          newInputs.lifeEvents = [];
        }
        const defaultLifeEvent = {
          ...defaults,
          id: 'ss-1',
          enabled: true
        };
        newInputs.lifeEvents.push(defaultLifeEvent);
        targetEvent = defaultLifeEvent;
      }

      setLastChartChangeType('social_security_change');
      setScenarios(prev => prev.map(scen => {
        if (scen.id !== currentScenarioId) return scen;
        return {
          ...scen,
          inputs: newInputs
        };
      }));

      setIsFullPartnerProfileOpen(false);
      setIsZeroSpendingConfirmed(false);
      setEditingEvent(targetEvent);
      return;
    }

    const defaults = getDefaultEvent(type, { inputs, isMobile: false });
    
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setEditingEvent(defaults);
  };

  const handleEditRoadmapEvent = (evt) => {
    if (!evt) return;
    const normalized = eventSaveRouter.routeEdit(evt, inputs);
    if (normalized) {
      setIsFullPartnerProfileOpen(false);
      setIsZeroSpendingConfirmed(false);
      setEditingEvent(normalized);
    }
  };

  const handleSaveEvent = (passedEvent) => {
    const isSyntheticEvent = passedEvent && (passedEvent.nativeEvent || passedEvent.preventDefault);
    const eventToSave = (passedEvent && !isSyntheticEvent) ? passedEvent : editingEvent;
    if (!eventToSave) return;

    if (eventToSave.type === 'windfall') {
      setLastChartChangeType('windfall_change');
    } else if (eventToSave.type === 'buyHouse' || eventToSave.type === 'sellHouse') {
      setLastChartChangeType('home_value_change');
    } else if (eventToSave.type === 'socialSecurity') {
      setLastChartChangeType('social_security_change');
    } else {
      const isNew = !inputs.lifeEvents?.some(e => e.id === eventToSave.id) &&
                    !inputs.spendingPhases?.some(p => p.id === eventToSave.id) &&
                    !inputs.incomeList?.some(i => i.id === eventToSave.id);
      setLastChartChangeType(isNew ? 'event_add' : 'event_value_change');
    }

    const isRecommendationApplied = eventToSave.recommendationApplied === true;

    // Dispatches to router
    const result = eventSaveRouter.routeSave(
      eventToSave,
      inputs,
      scenarios,
      currentScenarioId,
      { isRecommendationApplied }
    );

    if (!result) return;

    // Apply updated scenarios
    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      return {
        ...scen,
        inputs: result.updatedInputs
      };
    }));

    // Handle side effects
    if (result.sideEffects.notificationMsg) {
      setNotification(result.sideEffects.notificationMsg);
      setTimeout(() => setNotification(null), 4000);
    }

    if (result.sideEffects.impactSummary) {
      if (eventToSave.type === 'haveChild') {
        // Bypassed: ChildPlanningModal handles affordability check inline
        setChildImpactSummary(null);
      } else if (eventToSave.type === 'buyHouse') {
        // Bypassed: HousePlanningModal handles affordability check inline
        setHouseImpactSummary(null);
      }
    }
    if (result.sideEffects.rebalanceStrategies?.length > 0 && eventToSave.type !== 'buyHouse') {
      setHouseRebalanceSummary(result.sideEffects.rebalanceStrategies);
    } else {
      setHouseRebalanceSummary(null);
    }

    // Handle UI requests
    result.uiRequests.forEach(req => {
      if (req.type === 'showImprovementModal' && eventToSave.type !== 'buyHouse') {
        setShowImprovementModal(req.value);
      }
    });

    if (!isMobile) {
      setEditingEvent(null);
    }
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  const handleDeleteRoadmapEvent = (evt) => {
    if (!evt || evt.isMilestone) return;

    // Route delete
    const result = eventSaveRouter.routeDelete(evt, inputs);
    if (!result) return;

    setLastChartChangeType('event_remove');
    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      return {
        ...scen,
        inputs: result.updatedInputs
      };
    }));
  };

  const handleDeleteEvent = (passedEvent) => {
    const isSyntheticEvent = passedEvent && (passedEvent.nativeEvent || passedEvent.preventDefault);
    const eventToDelete = (passedEvent && !isSyntheticEvent) ? passedEvent : editingEvent;
    if (!eventToDelete) return;
    const proxyEvent = {
      originalId: eventToDelete.id,
      age: Number(eventToDelete.age || eventToDelete.startAge || eventToDelete.purchaseAge || eventToDelete.birthAge || eventToDelete.claimingAge || eventToDelete.ageReceived),
      type: eventToDelete.type
    };
    handleDeleteRoadmapEvent(proxyEvent);

    const deletedEventId = eventToDelete.id || eventToDelete.originalId;
    if (deletedEventId && String(deletedEventId) === String(selectedEventId)) {
      setSelectedEventId(null);
      setSelectedEvent(null);
    }

    if (deletedEventId && String(deletedEventId) === String(editingEvent?.id)) {
      setEditingEvent(null);
    } else {
      setEditingEvent(null);
    }

    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    let nextList = [...(inputs.currentConditions || [])];
    if (editingCondition.id) {
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  const handleNodeDragStart = (e, evt) => {
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    const track = e.currentTarget.closest('.timeline-track-inner') || e.currentTarget.closest('.mobile-roadmap-scroll-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = typeof evt.age === 'number' && !isNaN(evt.age) ? evt.age : (inputs.currentAge || 35);

    let childEndOffset = 0;
    if (evt.type === 'haveChild') {
      const linkedEndEvent = timelineEvents.find(e => e.type === 'childSupportEnds' && String(e.childEventId) === String(evt.originalId));
      if (linkedEndEvent) {
        childEndOffset = linkedEndEvent.age - evt.age;
      } else {
        const lifeEv = inputs.lifeEvents?.find(e => e.id === evt.originalId);
        childEndOffset = lifeEv?.includeCollege ? 22 : 18;
      }
    }

    dragOccurredRef.current = false;

    setLastChartChangeType('event_drag');
    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX,
      childEndOffset
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      const rawAge = Math.round(initialAge + deltaYears);
      let newAge = rawAge;

      if (evt.type === 'socialSecurity') {
        newAge = Math.max(62, Math.min(70, newAge));
      } else if (evt.type === 'buyHouse' && evt.houseId) {
        const sellEv = inputs.lifeEvents?.find(e => e.type === 'sellHouse' && e.houseId === evt.houseId);
        const maxLimit = sellEv ? Number(sellEv.age) - 1 : maxAge;
        newAge = Math.max(minAge, Math.min(maxLimit, newAge));
      } else if (evt.type === 'sellHouse' && evt.houseId) {
        const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === evt.houseId);
        const minLimit = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) + 1 : minAge;
        newAge = Math.max(minLimit, Math.min(maxAge, newAge));
      } else if (evt.type === 'haveChild') {
        const offset = childEndOffset || 18;
        newAge = Math.max(minAge, Math.min(maxAge - offset, newAge));
      } else {
        newAge = Math.max(minAge, Math.min(maxAge, newAge));
      }

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      setDraggingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentAge: newAge,
          rawAge: rawAge
        };
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);

      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const valSS = validateSocialSecurityClaimAge(rawAge);
            targetAge = valSS.validAge;
            if (valSS.wasClamped) {
              setNotification(valSS.message);
              setTimeout(() => setNotification(null), 2000);
            }
          }
          setLastChartChangeType('event_timing_change');
          commitEventAgeChange(evt, targetAge);
        }
        return null;
      });

      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  return {
    editingEvent,
    setEditingEvent,
    childImpactSummary,
    setChildImpactSummary,
    houseImpactSummary,
    setHouseImpactSummary,
    houseRebalanceSummary,
    setHouseRebalanceSummary,
    editingCondition,
    setEditingCondition,
    draggingInfo,
    setDraggingInfo,
    notification,
    setNotification,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    setSelectedEvent,
    isFullPartnerProfileOpen,
    setIsFullPartnerProfileOpen,
    isZeroSpendingConfirmed,
    setIsZeroSpendingConfirmed,
    isPartnerZeroSpendingConfirmed,
    setIsPartnerZeroSpendingConfirmed,
    dragOccurredRef,
    handleCreateEvent,
    handleEditRoadmapEvent,
    handleSaveEvent,
    handleDeleteEvent,
    handleDeleteRoadmapEvent,
    handleSaveCurrentCondition,
    handleRemoveCurrentCondition,
    handleNodeDragStart
  };
}

export default useEventEditingController;
