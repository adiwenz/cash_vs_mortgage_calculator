import { test } from 'vitest';
import { getMappedDefaultInputs } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/test_helper.js';
import { runFireSimulation } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/index.js';
import { normalizeInputsStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/normalizeInputs.js';
import { canonicalizeSimulationInputs } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/canonicalizeSimulationInputs.js';
import { deriveTimelineStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/deriveTimeline.js';
import { applyEventsStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/applyEvents.js';
import { deriveBudgetPhasesStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/deriveBudgetPhases.js';
import { projectYearlyBalancesStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/projectYearlyBalances.js';
import { computeReadinessStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/computeReadiness.js';
import { formatSimulationResultStage } from '/Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculators/fire/pipeline/formatSimulationResult.js';
import fs from 'fs';

function runOldSimulation(inputs) {
  const normalizedInputs = normalizeInputsStage(inputs);
  const canonicalInputs = canonicalizeSimulationInputs(normalizedInputs);
  const timelineDetails = deriveTimelineStage(canonicalInputs);
  const { profile, events } = applyEventsStage(canonicalInputs, timelineDetails);
  const phases = deriveBudgetPhasesStage(profile, events, canonicalInputs.budgetDetails?.phases);
  const plannedProjection = projectYearlyBalancesStage(profile, phases, events, canonicalInputs.targetRetirementAge);
  const readinessResult = computeReadinessStage(profile, phases, events, plannedProjection);
  return formatSimulationResultStage(readinessResult, profile, phases, plannedProjection, normalizedInputs);
}

test('debug Scenario A comparison details', () => {
  const inputs = getMappedDefaultInputs();

  const oldRes = runOldSimulation(inputs);
  const newRes = runFireSimulation(inputs);

  let out = "";
  out += `OLD Ready Age: ${oldRes.retirementReadyAge}\n`;
  out += `NEW Ready Age: ${newRes.retirementReadyAge}\n\n`;

  out += "--- OLD LOGS ---\n";
  oldRes.data.slice(0, 45).forEach(d => {
    out += `Age ${d.age}: NW=${d.netWorth?.toFixed(0)}, Port=${d.portfolio?.toFixed(0)}, Exp=${d.expenses?.toFixed(0)}, Inc=${d.income?.toFixed(0)}, Debt=${d.debtBalance?.toFixed(0)}, cash=${d.cashBalance?.toFixed(0)}\n`;
  });

  out += "\n--- NEW LOGS ---\n";
  newRes.data.slice(0, 45).forEach(d => {
    out += `Age ${d.age}: NW=${d.netWorth?.toFixed(0)}, Port=${d.portfolio?.toFixed(0)}, Exp=${d.expenses?.toFixed(0)}, Inc=${d.income?.toFixed(0)}, Debt=${d.debtBalance?.toFixed(0)}, cash=${d.cashBalance?.toFixed(0)}\n`;
  });

  fs.writeFileSync('/Users/adriannawenz/code/cash_vs_mortgage_calculator/test_debug_test_9.log', out);
});
