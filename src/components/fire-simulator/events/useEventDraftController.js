import { useState } from 'react';

/**
 * Event draft editing state controller hook.
 */
export function useEventDraftController({
  editingEvent: passedEditingEvent,
  setEditingEvent: passedSetEditingEvent
} = {}) {
  const [localEditingEvent, setLocalEditingEvent] = useState(null);
  const editingEvent = passedEditingEvent !== undefined ? passedEditingEvent : localEditingEvent;
  const setEditingEvent = passedSetEditingEvent !== undefined ? passedSetEditingEvent : setLocalEditingEvent;

  const updateDraftField = (field, value) => {
    setEditingEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const resetDraft = () => {
    setEditingEvent(null);
  };

  return {
    editingEvent,
    setEditingEvent,
    updateDraftField,
    resetDraft
  };
}

export default useEventDraftController;
