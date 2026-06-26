import React from 'react';
import RelationshipWizard from './RelationshipWizard';

export default function MarriageWizard(props) {
  const editingEventWithMarried = props.editingEvent 
    ? { relationshipType: 'married', ...props.editingEvent } 
    : props.editingEvent;

  return (
    <RelationshipWizard
      {...props}
      editingEvent={editingEventWithMarried}
    />
  );
}
