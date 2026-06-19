import {
  getActiveChildrenCountAtAge,
  getSocialSecurityFactor,
  getIncomeHistory,
  calculateSocialSecurityBenefit,
  calculateAIME,
  calculatePIA,
  calculateClaimingAgeMultiplier,
  calculateTop35AverageIncome,
  validateSocialSecurityClaimAge,
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs,
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations,
  projectYearlyBalances,
  computeRetirementResult,
  runFireSimulation,
  buildSimulationDebugSnapshot
} from './calculators/fire/index.js';

// Deep imports for legacy compatibility (Option B)
import { buildSocialSecurityEarningsRecord as legacySSRecord } from './calculators/fire/socialSecurity.js';
import { getPartitionedPhases as legacyPartitionedPhases } from './calculators/fire/phases.js';
import { calculateMinimumPortfolioForRetirement as legacyMinPortfolio } from './calculators/fire/retirementReadiness.js';

/**
 * @deprecated Use corresponding socialSecurity methods directly.
 */
export const buildSocialSecurityEarningsRecord = legacySSRecord;

/**
 * @deprecated Use phases.js or normalized outputs directly.
 */
export const getPartitionedPhases = legacyPartitionedPhases;

/**
 * @deprecated Use retirementReadiness calculations internally.
 */
export const calculateMinimumPortfolioForRetirement = legacyMinPortfolio;

/**
 * @deprecated Do not use this function; it is no longer active in core calculations.
 */
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
  getProfileFromInputs,
  getEventsFromInputs,
  validateFireInputs,
  derivePhasesFromEvents,
  getNormalizedPhases,
  getPhaseChangeExplanations,
  projectYearlyBalances,
  computeRetirementResult,
  runFireSimulation,
  buildSimulationDebugSnapshot
};