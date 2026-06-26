import React from 'react';
import MobileRelationshipPlanningModal from './MobileRelationshipPlanningModal';

export default function MobileMarriagePlanningModal(props) {
  const wrappedEventController = props.eventController ? {
    ...props.eventController,
    editingEvent: props.eventController.editingEvent ? {
      relationshipType: 'married',
      ...props.eventController.editingEvent
    } : props.eventController.editingEvent
  } : props.eventController;

  return (
    <MobileRelationshipPlanningModal
      {...props}
      eventController={wrappedEventController}
    />
  );
}
