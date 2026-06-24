import { useState } from 'react';

/**
 * Event selection and active age state controller hook.
 */
export function useEventSelectionController() {
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeAge, setActiveAge] = useState(null);

  return {
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    setSelectedEvent,
    activeAge,
    setActiveAge
  };
}

export default useEventSelectionController;
