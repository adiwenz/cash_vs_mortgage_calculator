import { useState } from 'react';

/**
 * Hook for managing current condition editing.
 */
export function useConditionEditingController({ inputs, updateInput }) {
  const [editingCondition, setEditingCondition] = useState(null);

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    let nextList = [...(inputs.currentConditions || [])];
    if (editingCondition.id) {
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  return {
    editingCondition,
    setEditingCondition,
    handleSaveCurrentCondition,
    handleRemoveCurrentCondition
  };
}

export default useConditionEditingController;
