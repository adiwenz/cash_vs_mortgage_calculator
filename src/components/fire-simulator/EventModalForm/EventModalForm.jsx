import { useState, useEffect, useMemo } from 'react';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall,
  getSimulatedRetirementAge
} from '../houseAffordabilityUtils';

import EventTypeHeader from './EventTypeHeader';
import HouseFields from './HouseFields';
import ChildFields from './ChildFields';
import MarriageFields from './MarriageFields';
import DebtFields from './DebtFields';
import CareerFields from './CareerFields';
import RetirementFields from './RetirementFields';
import GenericEventFields from './GenericEventFields';
import RecommendationFooter from './RecommendationFooter';
import IncomeChangeImpactPreview from './IncomeChangeImpactPreview';

export default function EventModalForm({
  simulation,
  scenario,
  eventController,
  budgetController,
  recommendationController,
  // Fallbacks for testing/legacy support:
  activeResults: legacyActiveResults,
  baselineResults: legacyBaselineResults,
  tempSocialSecurityDetails: legacyTempSS,
  inputs: legacyInputs,
  editingEvent: legacyEditingEvent,
  setEditingEvent: legacySetEditingEvent,
  isFullPartnerProfileOpen: legacyIsFullPartnerOpen,
  setIsFullPartnerProfileOpen: legacySetIsFullPartnerOpen,
  isZeroSpendingConfirmed: legacyIsZeroSpending,
  setIsZeroSpendingConfirmed: legacySetIsZeroSpending,
  isPartnerZeroSpendingConfirmed: legacyIsPartnerZeroSpending,
  setIsPartnerZeroSpendingConfirmed: legacySetIsPartnerZeroSpending,
  handleDeleteEvent: legacyDeleteEvent,
  handleSaveEvent: legacySaveEvent,
  handleSetBudgetClick: legacySetBudgetClick,
  setIsBudgetOpenFromMarriageWizard: legacySetIsBudgetOpen,
  setShowImprovementModal: legacySetShowImprovement
}) {
  const activeResults = simulation?.activeResults ?? legacyActiveResults;
  const baselineResults = simulation?.baselineResults ?? legacyBaselineResults;
  const tempSocialSecurityDetails = simulation?.tempSocialSecurityDetails ?? legacyTempSS;

  const inputs = scenario?.inputs ?? legacyInputs;

  const editingEvent = eventController?.editingEvent ?? legacyEditingEvent;
  const setEditingEvent = eventController?.setEditingEvent ?? legacySetEditingEvent;
  const isFullPartnerProfileOpen = eventController?.isFullPartnerProfileOpen ?? legacyIsFullPartnerOpen;
  const setIsFullPartnerProfileOpen = eventController?.setIsFullPartnerProfileOpen ?? legacySetIsFullPartnerOpen;
  const isZeroSpendingConfirmed = eventController?.isZeroSpendingConfirmed ?? legacyIsZeroSpending;
  const setIsZeroSpendingConfirmed = eventController?.setIsZeroSpendingConfirmed ?? legacySetIsZeroSpending;
  const isPartnerZeroSpendingConfirmed = eventController?.isPartnerZeroSpendingConfirmed ?? legacyIsPartnerZeroSpending;
  const setIsPartnerZeroSpendingConfirmed = eventController?.setIsPartnerZeroSpendingConfirmed ?? legacySetIsPartnerZeroSpending;
  const handleDeleteEvent = eventController?.handleDeleteEvent ?? legacyDeleteEvent;
  const handleSaveEvent = eventController?.handleSaveEvent ?? legacySaveEvent;

  const handleSetBudgetClick = budgetController?.handleSetBudgetClick ?? legacySetBudgetClick;
  const setIsBudgetOpenFromMarriageWizard = budgetController?.setIsBudgetOpenFromMarriageWizard ?? legacySetIsBudgetOpen;

  const setShowImprovementModal = recommendationController?.setShowImprovementModal ?? legacySetShowImprovement;

  // Reset recommendationApplied if a new cash shortfall is created
  useEffect(() => {
    if (editingEvent && editingEvent.type === 'buyHouse' && editingEvent.recommendationApplied) {
      const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
      const simulationResults = activeResults || baselineResults;
      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
      const totalCashRequired = calculateTotalCashRequired(editingEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      if (cashShortfall > 0) {
        setEditingEvent(prev => ({
          ...prev,
          recommendationApplied: false
        }));
      }
    }
  }, [
    editingEvent?.homePrice,
    editingEvent?.downPayment,
    editingEvent?.purchaseAge,
    editingEvent?.age,
    editingEvent?.recommendationApplied,
    inputs,
    activeResults,
    baselineResults,
    setEditingEvent
  ]);

  const afterReadyAge = useMemo(() => {
    if (editingEvent?.type !== 'buyHouse') return null;
    return getSimulatedRetirementAge(inputs, editingEvent);
  }, [
    editingEvent?.type,
    inputs,
    editingEvent?.homePrice,
    editingEvent?.downPayment,
    editingEvent?.purchaseAge,
    editingEvent?.age,
    editingEvent?.mortgageRate,
    editingEvent?.loanTerm,
    editingEvent?.propertyTax,
    editingEvent?.insurance,
    editingEvent?.hoa,
    editingEvent?.utilitiesIncrease,
    editingEvent?.maintenance,
    editingEvent?.renovationCost,
    editingEvent?.appreciationRate,
    editingEvent?.sellingCost,
    editingEvent?.keepRent
  ]);

  if (!editingEvent) return null;

  const type = editingEvent.type;

  if (type === 'marriage' || type === 'domesticPartnership' || type === 'relationshipBegins') {
    return (
      <MarriageFields
        inputs={inputs}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        isFullPartnerProfileOpen={isFullPartnerProfileOpen}
        setIsFullPartnerProfileOpen={setIsFullPartnerProfileOpen}
        isZeroSpendingConfirmed={isZeroSpendingConfirmed}
        setIsZeroSpendingConfirmed={setIsZeroSpendingConfirmed}
        isPartnerZeroSpendingConfirmed={isPartnerZeroSpendingConfirmed}
        setIsPartnerZeroSpendingConfirmed={setIsPartnerZeroSpendingConfirmed}
        handleDeleteEvent={handleDeleteEvent}
        handleSaveEvent={handleSaveEvent}
        handleSetBudgetClick={handleSetBudgetClick}
        setIsBudgetOpenFromMarriageWizard={setIsBudgetOpenFromMarriageWizard}
      />
    );
  }

  return (
    <div className="modal-backdrop" onClick={() => setEditingEvent(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={type === 'buyHouse' || type === 'sellHouse' ? { maxWidth: '650px', width: '90%' } : {}}>
        <EventTypeHeader type={type} editingEvent={editingEvent} />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {type === 'careerChange' && (
            <IncomeChangeImpactPreview
              inputs={inputs}
              editingEvent={editingEvent}
            />
          )}
          {(type === 'buyHouse' || type === 'sellHouse') && (
            <HouseFields
              type={type}
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
              inputs={inputs}
              activeResults={activeResults}
              baselineResults={baselineResults}
              setShowImprovementModal={setShowImprovementModal}
            />
          )}

          {type === 'haveChild' && (
            <ChildFields
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
              inputs={inputs}
            />
          )}

          {type === 'careerChange' && (
            <CareerFields
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
            />
          )}

          {['borrowing', 'debtPayoff', 'payoffPlan'].includes(type) && (
            <DebtFields
              type={type}
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
              inputs={inputs}
            />
          )}

          {['retire', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type) && (
            <RetirementFields
              type={type}
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
              inputs={inputs}
              tempSocialSecurityDetails={tempSocialSecurityDetails}
            />
          )}

          {['move', 'windfall', 'college', 'custom'].includes(type) && (
            <GenericEventFields
              type={type}
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
            />
          )}
        </div>

        <RecommendationFooter
          type={type}
          editingEvent={editingEvent}
          inputs={inputs}
          activeResults={activeResults}
          baselineResults={baselineResults}
          afterReadyAge={afterReadyAge}
          setShowImprovementModal={setShowImprovementModal}
          handleDeleteEvent={handleDeleteEvent}
          handleSaveEvent={handleSaveEvent}
          setEditingEvent={setEditingEvent}
        />
      </div>
    </div>
  );
}
