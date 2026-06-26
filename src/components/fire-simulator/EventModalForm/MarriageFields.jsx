import React from 'react';
import RelationshipWizard from '../RelationshipWizard';

export default function MarriageFields({
  inputs,
  editingEvent,
  setEditingEvent,
  isFullPartnerProfileOpen,
  setIsFullPartnerProfileOpen,
  isZeroSpendingConfirmed,
  setIsZeroSpendingConfirmed,
  isPartnerZeroSpendingConfirmed,
  setIsPartnerZeroSpendingConfirmed,
  handleDeleteEvent,
  handleSaveEvent,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard
}) {
  return (
    <RelationshipWizard
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
