import { useState, useRef } from 'react';
import { getDefaultEvent } from './eventDefaults.js';
import { eventSaveRouter } from './eventSaveRouter.js';

export function useEventController(
  scenarios,
  setScenarios,
  currentScenarioId,
  inputs,
  updateInput,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard,
  isMobile,
  setShowImprovementModal
) {
  const [editingEvent, setEditingEvent] = useState(null);
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [houseImpactSummary, setHouseImpactSummary] = useState(null);
  const [houseRebalanceSummary, setHouseRebalanceSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  const dragOccurredRef = useRef(false);

  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
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
    if (result.sideEffects.impactSummary) {
      if (eventToSave.type === 'haveChild') {
        setChildImpactSummary(result.sideEffects.impactSummary);
      } else if (eventToSave.type === 'buyHouse') {
        setHouseImpactSummary(result.sideEffects.impactSummary);
      }
    }
    if (result.sideEffects.rebalanceStrategies?.length > 0) {
      setHouseRebalanceSummary(result.sideEffects.rebalanceStrategies);
    } else {
      setHouseRebalanceSummary(null);
    }

    // Handle UI requests
    result.uiRequests.forEach(req => {
      if (req.type === 'showImprovementModal') {
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
    handleDeleteRoadmapEvent
  };
}
