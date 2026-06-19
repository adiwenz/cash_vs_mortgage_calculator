import {
  getActiveChildrenCountAtAge
} from '../../simulatorMathUtils.js';

import {
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  buildSocialSecurityEarningsRecord,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge
} from './socialSecurity.js';

import {
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs
} from './normalizeInputs.js';

import {
  getPartitionedPhases,
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations
} from './phases.js';

import {
  projectYearlyBalances
} from './yearlySimulation.js';

import {
  calculateMinimumPortfolioForRetirement,
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
  buildSocialSecurityEarningsRecord,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge,
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs,
  getPartitionedPhases,
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations,
  projectYearlyBalances,
  calculateMinimumPortfolioForRetirement,
  computeRetirementResult,
  buildSimulationDebugSnapshot
};

export function getSavingsPriority(key) {
  const priorities = {
    hsa: 1,
    trad401k: 2,
    tradIra: 3,
    rothIra: 4,
    brokerage: 5,
    checking: 6,
    hysa: 7,
    emergency: 8,
    debt: 9,
    other: 10
  };
  return priorities[key] || 99;
}

export function runFireSimulation(inputs) {
  const normalizedInputs = normalizeInputsStage(inputs);
  const timelineDetails = deriveTimelineStage(normalizedInputs);
  const { profile, events } = applyEventsStage(normalizedInputs, timelineDetails);
  const phases = deriveBudgetPhasesStage(profile, events, normalizedInputs.budgetDetails?.phases);
  const plannedProjection = projectYearlyBalancesStage(profile, phases, events, normalizedInputs.targetRetirementAge);
  const readinessResult = computeReadinessStage(profile, phases, events, plannedProjection);
  return formatSimulationResultStage(readinessResult, profile, phases, plannedProjection, normalizedInputs);
}
