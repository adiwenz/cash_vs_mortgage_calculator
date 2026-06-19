import { computeRetirementResult as runReadinessCalculation } from '../retirementReadiness.js';

export function computeReadinessStage(profile, phases, events, projection) {
  return runReadinessCalculation(profile, phases, events, projection);
}
