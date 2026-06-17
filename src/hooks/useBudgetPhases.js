import { useMemo } from 'react';
import { getNormalizedPhases } from '../fireCalculations';

export function useBudgetPhases(inputs) {
  const normalizedPhases = useMemo(() => {
    if (!inputs) return [];
    return getNormalizedPhases(inputs);
  }, [inputs]);

  const currentAgePhase = useMemo(() => {
    if (!inputs || normalizedPhases.length === 0) return null;
    const curAge = inputs.currentAge || 35;
    return normalizedPhases.find(p => curAge >= p.startAge && curAge < p.endAge) || normalizedPhases[0] || null;
  }, [normalizedPhases, inputs]);

  return {
    normalizedPhases,
    currentAgePhase
  };
}
