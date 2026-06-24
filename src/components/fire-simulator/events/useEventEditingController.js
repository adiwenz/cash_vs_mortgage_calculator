import { useState } from 'react';
import { getDefaultEvent } from '../../../features/fire/events/eventDefaults.js';
import { eventSaveRouter } from '../../../features/fire/events/eventSaveRouter.js';
import { setLastChartChangeType } from '../changeTypeTracker.js';
import { getActiveScenario } from '../../../features/fire/state/scenarioSelectors.js';

import { useEventDraftController } from './useEventDraftController.js';
import { useTimelineDragController } from './useTimelineDragController.js';
import { useConditionEditingController } from './useConditionEditingController.js';
import { useEventSelectionController } from './useEventSelectionController.js';
import {
  resolveEditingEvent,
  getEventAge,
  getEventId
} from './eventEditingUtils.js';

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
  // 1. Basic Draft State Hook
  const {
    editingEvent,
    setEditingEvent,
    resetDraft
  } = useEventDraftController({
    editingEvent: passedEditingEvent,
    setEditingEvent: passedSetEditingEvent
  });

  // 2. Selection Hook
  const {
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    setSelectedEvent,
    activeAge,
    setActiveAge
  } = useEventSelectionController();

  // 3. Workflow-specific States (remain in top-level composition for cohesion)
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [houseImpactSummary, setHouseImpactSummary] = useState(null);
  const [houseRebalanceSummary, setHouseRebalanceSummary] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  // 4. Timeline Drag Hook
  const {
    draggingInfo,
    setDraggingInfo,
    dragOccurredRef,
    handleNodeDragStart
  } = useTimelineDragController({
    inputs,
    timelineEvents,
    commitEventAgeChange,
    setNotification
  });

  // 5. Condition Editing Hook
  const {
    editingCondition,
    setEditingCondition,
    handleSaveCurrentCondition,
    handleRemoveCurrentCondition
  } = useConditionEditingController({
    inputs,
    updateInput
  });

  // Workflow Handlers
  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
      return;
    }

    if (type === 'socialSecurity') {
      const currentScen = getActiveScenario(scenarios, currentScenarioId);
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
    const eventToSave = resolveEditingEvent(passedEvent, editingEvent);
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

    const result = eventSaveRouter.routeSave(
      eventToSave,
      inputs,
      scenarios,
      currentScenarioId,
      { isRecommendationApplied }
    );

    if (!result) return;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      return {
        ...scen,
        inputs: result.updatedInputs
      };
    }));

    if (result.sideEffects.notificationMsg) {
      setNotification(result.sideEffects.notificationMsg);
      setTimeout(() => setNotification(null), 4000);
    }

    if (result.sideEffects.impactSummary) {
      if (eventToSave.type === 'haveChild') {
        setChildImpactSummary(null);
      } else if (eventToSave.type === 'buyHouse') {
        setHouseImpactSummary(null);
      }
    }
    if (result.sideEffects.rebalanceStrategies?.length > 0 && eventToSave.type !== 'buyHouse') {
      setHouseRebalanceSummary(result.sideEffects.rebalanceStrategies);
    } else {
      setHouseRebalanceSummary(null);
    }

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
    const eventToDelete = resolveEditingEvent(passedEvent, editingEvent);
    if (!eventToDelete) return;

    const age = getEventAge(eventToDelete);
    const proxyEvent = {
      originalId: eventToDelete.id,
      age: age !== null ? age : (inputs.currentAge || 35),
      type: eventToDelete.type
    };
    handleDeleteRoadmapEvent(proxyEvent);

    const deletedEventId = getEventId(eventToDelete);
    if (deletedEventId && String(deletedEventId) === String(selectedEventId)) {
      setSelectedEventId(null);
      setSelectedEvent(null);
    }

    setEditingEvent(null);

    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
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
