import React from 'react';
import MobileChildPlanningModal from '../MobileChildPlanningModal';
import MobileHousePlanningModal from '../MobileHousePlanningModal';
import MobileMarriagePlanningModal from '../MobileMarriagePlanningModal';
import MobileIncomeChangeModal from '../MobileIncomeChangeModal';
import MobileEventWizard from '../MobileEventWizard';
import ChildImpactModal from '../ChildImpactModal';
import BudgetModal from '../BudgetModal';
import SavingsDetailsModal from '../SavingsDetailsModal';
import { CurrentConditionModal } from '../CurrentConditionsPanel';
import RetireSoonerModal from '../RetireSoonerModal';
import LifeProfileModal from '../LifeProfileModal';
import { getEventIcon, isEditableEvent } from '../helpers';
import { getRoadmapDetails } from '../MobileTimeline';

export default function MobileModalLayer({
  scenario,
  eventController,
  simulation,
  uiState,
  budgetController,
  recommendationController,
  
  inputs,
  editingEvent,
  setEditingEvent,
  handleSaveEvent,
  handleDeleteEvent,
  getInputsWithEvent,
  baselineResults,
  handleApplyMobileRecommendation,
  improvementPlan,
  houseImpactSummary,
  setHouseImpactSummary,
  houseRebalanceSummary,
  setHouseRebalanceSummary,
  handleApplyRebalanceStrategy,
  setShowImprovementModal,
  
  childImpactSummary,
  setChildImpactSummary,
  
  isBudgetModalOpen,
  isBudgetOpenFromMarriageWizard,
  budgetMonthlyIncome,
  setBudgetMonthlyIncome,
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
  activeBudgetPhase,
  handleSwitchBudgetPhase,
  savingsAllocMode,
  handleToggleSavingsAllocMode,
  budgetScalingMode,
  handleToggleBudgetScalingMode,
  budgetHsaCoverage,
  setBudgetHsaCoverage,
  budgetFilingStatus,
  setBudgetFilingStatus,
  budgetMonthlySpending,
  setBudgetMonthlySpending,
  budgetMonthlySavings,
  setBudgetMonthlySavings,
  pendingImprovement,
  handleCloseBudgetModal,
  handleSaveBudget,
  isMobile,
  
  isSavingsDetailsOpen,
  savingsDetails,
  setSavingsDetails,
  setIsSavingsDetailsOpen,
  handleSaveSavingsDetails,
  
  editingCondition,
  setEditingCondition,
  handleSaveCurrentCondition,
  
  showImprovementModal,
  
  isLifeProfileOpen,
  setIsLifeProfileOpen,
  updateInput,
  lifeProfileTab,
  
  notification,
  
  expandedClusterEvents,
  setExpandedClusterEvents,
  handleEditRoadmapEvent,
  
  activeEventForSheet,
  setActiveEventForSheet,
  formatCurrency,
  handleDeleteRoadmapEvent
}) {
  return (
    <>
      {editingEvent && editingEvent.type === 'haveChild' ? (
        <MobileChildPlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && editingEvent.type === 'buyHouse' ? (
        <MobileHousePlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && (editingEvent.type === 'marriage' || editingEvent.type === 'get-married') ? (
        <MobileMarriagePlanningModal
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setEditingEvent(null)}
          handleSetBudgetClick={budgetController?.handleSetBudgetClick}
          setIsBudgetOpenFromMarriageWizard={budgetController?.setIsBudgetOpenFromMarriageWizard}
        />
      ) : editingEvent && editingEvent.type === 'careerChange' ? (
        <MobileIncomeChangeModal
          scenario={scenario}
          eventController={eventController}
          onClose={() => setEditingEvent(null)}
        />
      ) : editingEvent && (
        <MobileEventWizard
          scenario={scenario}
          eventController={eventController}
          simulation={simulation}
          recommendationController={recommendationController}
          inputs={inputs}
          editingEvent={editingEvent}
          setEditingEvent={setEditingEvent}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={handleDeleteEvent}
          getInputsWithEvent={getInputsWithEvent}
          baselineResults={baselineResults}
          handleApplyMobileRecommendation={handleApplyMobileRecommendation}
          improvementPlan={improvementPlan}
          houseImpactSummary={houseImpactSummary}
          setHouseImpactSummary={setHouseImpactSummary}
          houseRebalanceSummary={houseRebalanceSummary}
          setHouseRebalanceSummary={setHouseRebalanceSummary}
          handleApplyRebalanceStrategy={handleApplyRebalanceStrategy}
          setShowImprovementModal={setShowImprovementModal}
          onClose={() => setEditingEvent(null)}
        />
      )}

      <ChildImpactModal
        eventController={eventController}
        scenario={scenario}
        recommendationController={recommendationController}
        childImpactSummary={childImpactSummary}
        inputs={inputs}
        setChildImpactSummary={setChildImpactSummary}
        setEditingEvent={setEditingEvent}
        setShowImprovementModal={setShowImprovementModal}
      />
      
      {isBudgetModalOpen && (
        <BudgetModal
          scenario={scenario}
          budgetController={budgetController}
          uiState={uiState}
          eventController={eventController}
          inputs={inputs}
          isBudgetOpenFromMarriageWizard={isBudgetOpenFromMarriageWizard}
          editingEvent={editingEvent}
          budgetMonthlyIncome={budgetMonthlyIncome}
          setBudgetMonthlyIncome={setBudgetMonthlyIncome}
          budgetExpenses={budgetExpenses}
          setBudgetExpenses={setBudgetExpenses}
          budgetSavings={budgetSavings}
          setBudgetSavings={setBudgetSavings}
          budgetPartnerSavings={budgetPartnerSavings}
          setBudgetPartnerSavings={setBudgetPartnerSavings}
          activeBudgetPhase={activeBudgetPhase}
          handleSwitchBudgetPhase={handleSwitchBudgetPhase}
          savingsAllocMode={savingsAllocMode}
          handleToggleSavingsAllocMode={handleToggleSavingsAllocMode}
          budgetScalingMode={budgetScalingMode}
          handleToggleBudgetScalingMode={handleToggleBudgetScalingMode}
          budgetHsaCoverage={budgetHsaCoverage}
          setBudgetHsaCoverage={setBudgetHsaCoverage}
          budgetFilingStatus={budgetFilingStatus}
          setBudgetFilingStatus={setBudgetFilingStatus}
          budgetMonthlySpending={budgetMonthlySpending}
          setBudgetMonthlySpending={setBudgetMonthlySpending}
          budgetMonthlySavings={budgetMonthlySavings}
          setBudgetMonthlySavings={setBudgetMonthlySavings}
          pendingImprovement={pendingImprovement}
          handleCloseBudgetModal={handleCloseBudgetModal}
          handleSaveBudget={handleSaveBudget}
          isMobile={isMobile}
        />
      )}

      {isSavingsDetailsOpen && (
        <SavingsDetailsModal
          budgetController={budgetController}
          savingsDetails={savingsDetails}
          setSavingsDetails={setSavingsDetails}
          setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
          handleSaveSavingsDetails={handleSaveSavingsDetails}
        />
      )}

      <CurrentConditionModal
        uiState={uiState}
        scenario={scenario}
        editingCondition={editingCondition}
        inputs={inputs}
        setEditingCondition={setEditingCondition}
        handleSaveCurrentCondition={handleSaveCurrentCondition}
      />

      {showImprovementModal && (
        <RetireSoonerModal
          scenario={scenario}
          simulation={simulation}
          uiState={uiState}
          onClose={() => setShowImprovementModal(false)}
        />
      )}

      <LifeProfileModal
        isOpen={isLifeProfileOpen}
        onClose={() => setIsLifeProfileOpen(false)}
        inputs={inputs}
        updateInput={updateInput}
        initialTab={lifeProfileTab}
        isMobile={true}
        simulation={simulation?.activeResults}
        handleCreateEvent={eventController?.handleCreateEvent}
        handleEditRoadmapEvent={eventController?.handleEditRoadmapEvent}
        handleDeleteEvent={eventController?.handleDeleteEvent || handleDeleteEvent}
        displayMode={simulation?.displayMode}
      />

      {notification && (() => {
        const isSuccess = notification.startsWith('✓');
        return (
          <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'var(--bg-secondary, #1f2937)',
            borderLeft: isSuccess ? '4px solid var(--accent-emerald, #10b981)' : '4px solid var(--accent-rose, #f43f5e)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
            color: 'var(--text-primary, #f3f4f6)',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.375rem',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'pre-line'
          }}>
            {!isSuccess && '⚠️ '}
            {notification}
          </div>
        );
      })()}

      {/* Expanded Collapsed Cluster Events Bottom Sheet */}
      {expandedClusterEvents && (
        <div 
          className="modal-backdrop" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(10, 10, 18, 0.6)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 2500, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center',
            padding: 0
          }}
          onClick={() => setExpandedClusterEvents(null)}
        >
          <div 
            className="mobile-bottom-sheet"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.75rem',
              boxSizing: 'border-box',
              position: 'relative',
              textAlign: 'left',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

            <button 
              type="button" 
              onClick={() => setExpandedClusterEvents(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.25rem',
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
            >
              ×
            </button>

            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 1.25rem 0' }}>
              Hidden Events ({expandedClusterEvents.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {expandedClusterEvents.map((evt, idx) => (
                <div 
                  key={`${evt.originalId || evt.type}-${evt.age}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '48px',
                    borderBottom: idx < expandedClusterEvents.length - 1 ? '1px solid var(--border)' : 'none',
                    padding: '0 0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getEventIcon(evt) || '✨'}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evt.type === 'today' ? 'Today' : evt.type === 'lifeExpectancy' ? 'Life Expectancy' : (evt.title || evt.label)}
                    </span>
                  </div>
                  {isEditableEvent(evt) && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedClusterEvents(null);
                        if (handleEditRoadmapEvent) {
                          handleEditRoadmapEvent(evt);
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Event Options Bottom Sheet */}
      {activeEventForSheet && (
        <div 
          className="modal-backdrop" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(10, 10, 18, 0.6)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 2500, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center',
            padding: 0
          }}
          onClick={() => setActiveEventForSheet(null)}
        >
          <div 
            className="mobile-bottom-sheet"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.75rem',
              boxSizing: 'border-box',
              position: 'relative',
              textAlign: 'left',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

            <button 
              type="button" 
              onClick={() => setActiveEventForSheet(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.25rem',
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--text-secondary)',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
            >
              ×
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: 'var(--primary-light)', 
                border: '1px solid rgba(99, 102, 241, 0.3)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '1.6rem' 
              }}>
                {activeEventForSheet.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                  {activeEventForSheet.label || activeEventForSheet.title}
                </h3>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)', marginTop: '0.15rem', display: 'inline-block' }}>
                  Age {activeEventForSheet.age}
                </span>
              </div>
            </div>

            {(() => {
              const details = getRoadmapDetails(activeEventForSheet, formatCurrency, inputs);
              return details?.whyItMatters ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {details.whyItMatters}
                </p>
              ) : null;
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isEditableEvent(activeEventForSheet) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveEventForSheet(null);
                      handleEditRoadmapEvent(activeEventForSheet);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Edit Event Details</span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveEventForSheet(null);
                      if (window.confirm("Are you sure you want to delete this event? This will immediately remove it from your roadmap and recalculate your projection.")) {
                        if (handleDeleteEvent) {
                          handleDeleteEvent(activeEventForSheet);
                        } else if (handleDeleteRoadmapEvent) {
                          handleDeleteRoadmapEvent(activeEventForSheet);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      color: 'var(--accent-rose)',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Delete Event</span>
                    <span>→</span>
                  </button>
                </>
              ) : (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-tertiary)', 
                  textAlign: 'center', 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontWeight: '500'
                }}>
                  <span>ℹ️</span> This milestone is calculated from your plan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
