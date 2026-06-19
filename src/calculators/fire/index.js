import {
  getActiveChildrenCountAtAge
} from '../../simulatorMathUtils.js';

import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge,
  normalizeSocialSecurityEvent
} from './socialSecurity.js';

import {
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs
} from './normalizeInputs.js';

import {
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations
} from './phases.js';

import {
  projectYearlyBalances
} from './yearlySimulation.js';

import {
  computeRetirementResult
} from './retirementReadiness.js';

import {
  buildSimulationDebugSnapshot
} from './debug.js';

import { normalizeInputsStage } from './pipeline/normalizeInputs.js';
import { deriveTimelineStage } from './pipeline/deriveTimeline.js';
import { applyEventsStage } from './pipeline/applyEvents.js';
import { deriveBudgetPhasesStage } from './pipeline/deriveBudgetPhases.js';
import { projectYearlyBalancesStage } from './pipeline/projectYearlyBalances.js';
import { computeReadinessStage } from './pipeline/computeReadiness.js';
import { formatSimulationResultStage } from './pipeline/formatSimulationResult.js';

export {
  getActiveChildrenCountAtAge,
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge,
  normalizeSocialSecurityEvent,
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs,
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations,
  projectYearlyBalances,
  computeRetirementResult,
  buildSimulationDebugSnapshot
};

// getSavingsPriority is now defined and exported from fireCalculations.js for legacy compatibility

export function runFireSimulation(inputs) {
  const normalizedInputs = normalizeInputsStage(inputs);
  const timelineDetails = deriveTimelineStage(normalizedInputs);
  const { profile, events } = applyEventsStage(normalizedInputs, timelineDetails);
  const phases = deriveBudgetPhasesStage(profile, events, normalizedInputs.budgetDetails?.phases);
  const plannedProjection = projectYearlyBalancesStage(profile, phases, events, normalizedInputs.targetRetirementAge);
  const readinessResult = computeReadinessStage(profile, phases, events, plannedProjection);
  return formatSimulationResultStage(readinessResult, profile, phases, plannedProjection, normalizedInputs);
}
