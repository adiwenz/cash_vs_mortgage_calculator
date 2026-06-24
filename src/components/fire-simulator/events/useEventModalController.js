/**
 * Modal state presentation controller hook.
 */
export function useEventModalController({ editingEvent, setEditingEvent }) {
  const isOpen = !!editingEvent;
  const isCreateMode = !!(editingEvent && (editingEvent.isNew || !editingEvent.id));
  const isEditMode = !!(editingEvent && !isCreateMode);
  const activeModalType = editingEvent ? editingEvent.type : null;

  const closeModal = () => {
    setEditingEvent(null);
  };

  return {
    isOpen,
    isCreateMode,
    isEditMode,
    activeModalType,
    closeModal
  };
}

export default useEventModalController;
