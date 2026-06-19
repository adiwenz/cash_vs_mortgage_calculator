import { projectYearlyBalances as runYearlyBalances } from '../yearlySimulation.js';

export function projectYearlyBalancesStage(profile, phases, events, targetRetirementAge) {
  return runYearlyBalances(profile, phases, events, targetRetirementAge);
}
