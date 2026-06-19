import { useState, useMemo } from 'react';
import { 
  runFireSimulation, 
  validateFireInputs,
  getIncomeHistory,
  calculateTop35AverageIncome,
  calculateSocialSecurityBenefit,
  calculateClaimingAgeMultiplier
} from '../../../fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';

export function useSimulationResults(inputs, scenarios, editingEvent) {
  const [displayMode, setDisplayMode] = useState('future'); // 'future' | 'today'
  const [selectedYear, setSelectedYear] = useState(null);

  // Run baseline simulation
  const baselineResults = useMemo(() => {
    const baselineInputs = scenarios.find(s => s.id === 'baseline')?.inputs || DEFAULT_FIRE_INPUTS;
    return runFireSimulation(baselineInputs);
  }, [scenarios]);

  // Run active scenario simulation
  const activeResults = useMemo(() => {
    const res = runFireSimulation(inputs);
    console.log('[FIRE Debug] RAW INPUTS:', inputs);
    const inf = (Number(inputs.inflationRate) || 3) / 100;
    const curAge = Number(inputs.currentAge) || 35;
    const logLines = [];
    res.data.forEach(d => {
      const factor = Math.pow(1 + inf, d.age - curAge);
      logLines.push(
        `Age ${d.age}: ` +
        `Income=${Math.round(d.income * factor)}, ` +
        `ChildCosts=${Math.round(d.childCosts * factor)}, ` +
        `Expenses=${Math.round(d.expenses * factor)}, ` +
        `Savings=${Math.round(d.savings * factor)}, ` +
        `Taxes=${Math.round(d.taxes * factor)}, ` +
        `Portfolio=${Math.round(d.portfolio * factor)}, ` +
        `NetWorth=${Math.round(d.netWorth * factor)}`
      );
    });
    console.log('[FIRE Debug] YEAR-BY-YEAR LOGS:\n' + logLines.join('\n'));
    return res;
  }, [inputs]);

  // Display results (future / nominal vs today / deflated)
  const displayedResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...activeResults,
      data: isNominal ? activeResults.nominalData : activeResults.deflatedData,
      retirementReadyTarget: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? activeResults.nominalRetirementReadyTargetNoSS : activeResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? activeResults.retirementReadyTargetComfortable : activeResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? activeResults.retirementReadyTargetSurvival : activeResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? activeResults.nominalPortfolioAtRetirement : activeResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? activeResults.nominalNetWorthAtRetirement : activeResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? activeResults.nominalAnnualRetirementSpending : activeResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? activeResults.nominalEndingSurplusShortfall : activeResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? activeResults.nominalRetirementIncomeSources : activeResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retireTodayTarget: activeResults.retireTodayTarget
    };
  }, [activeResults, displayMode]);

  const displayedBaselineResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...baselineResults,
      data: isNominal ? baselineResults.nominalData : baselineResults.deflatedData,
      retirementReadyTarget: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? baselineResults.nominalRetirementReadyTargetNoSS : baselineResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? baselineResults.retirementReadyTargetComfortable : baselineResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? baselineResults.retirementReadyTargetSurvival : baselineResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? baselineResults.nominalPortfolioAtRetirement : baselineResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? baselineResults.nominalNetWorthAtRetirement : baselineResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? baselineResults.nominalAnnualRetirementSpending : baselineResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? baselineResults.nominalEndingSurplusShortfall : baselineResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? baselineResults.nominalRetirementIncomeSources : baselineResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retireTodayTarget: baselineResults.retireTodayTarget
    };
  }, [baselineResults, displayMode]);

  // Construct chart datasets
  const chartData = useMemo(() => {
    if (!displayedResults.data || displayedResults.data.length === 0) return [];

    return displayedResults.data.map(row => {
      let baselineRow = displayedBaselineResults.data.find(r => r.age === row.age);
      if (!baselineRow && displayedBaselineResults.data.length > 0) {
        baselineRow = displayedBaselineResults.data[displayedBaselineResults.data.length - 1];
      }

      const assets = row.assets !== undefined ? row.assets : (row.portfolio + (row.homeValue || 0));
      const debt = row.debt !== undefined ? row.debt : ((row.debtBalance || 0) + (row.mortgageBalance || 0) + (row.cumulativeShortfall || 0));
      const netWorth = assets - debt;

      const baselineAssets = baselineRow ? (baselineRow.assets !== undefined ? baselineRow.assets : (baselineRow.portfolio + (baselineRow.homeValue || 0))) : 0;
      const baselineDebt = baselineRow ? (baselineRow.debt !== undefined ? baselineRow.debt : ((baselineRow.debtBalance || 0) + (baselineRow.mortgageBalance || 0) + (baselineRow.cumulativeShortfall || 0))) : 0;
      const baselineNetWorth = baselineRow ? (baselineAssets - baselineDebt) : 0;

      return {
        ...row,
        netWorth,
        assets,
        debt,
        baselineNetWorth: baselineNetWorth,
        baselinePortfolio: baselineRow ? baselineRow.portfolio : 0,
        fiNumber: displayedResults.fiNumber
      };
    });
  }, [displayedResults.data, displayedBaselineResults.data, displayedResults.fiNumber]);

  const baselineChartData = useMemo(() => {
    if (!displayedBaselineResults.data || displayedBaselineResults.data.length === 0) return [];

    return displayedBaselineResults.data.map(row => {
      const netWorth = row.netWorth;
      return {
        age: row.age,
        portfolio: row.portfolio,
        netWorth,
        assets: row.assets,
        debt: row.debt,
        fiNumber: displayedBaselineResults.fiNumber
      };
    });
  }, [displayedBaselineResults.data, displayedBaselineResults.fiNumber]);

  // Inputs validation
  const validation = useMemo(() => {
    return validateFireInputs(inputs);
  }, [inputs]);

  // Compute Social Security Claim Preview details
  const tempSocialSecurityDetails = useMemo(() => {
    if (!editingEvent || editingEvent.type !== 'socialSecurity') return null;

    const claimAge = Number(editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : 67);
    const useEarnings = editingEvent.useEarnings === true;

    const incomeHistory = getIncomeHistory(inputs, editingEvent);
    const { workingYears, isEligible } = calculateTop35AverageIncome(incomeHistory);

    if (useEarnings) {
      return calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: 1286,
        secondBendPoint: 7749,
        indexingMode: "simple"
      });
    } else {
      const fixedAnnual = (Number(editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 2000) || 0) * 12;
      const claimingMultiplierDetails = calculateClaimingAgeMultiplier({ claimAge, fullRetirementAge: 67 });
      let annualBenefit = fixedAnnual * claimingMultiplierDetails.multiplier;
      let adjustmentType = claimingMultiplierDetails.adjustmentType;
      let adjustmentMultiplier = claimingMultiplierDetails.multiplier;

      if (!isEligible) {
        adjustmentType = 'Not eligible';
        adjustmentMultiplier = 0;
        annualBenefit = 0;
      }

      return {
        claimAge,
        workingYears,
        isEligible,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: fixedAnnual / 12,
        claimingAgeMultiplier: adjustmentMultiplier,
        monthlyBenefit: annualBenefit / 12,
        annualBenefit,
        adjustmentType
      };
    }
  }, [inputs, editingEvent]);

  return {
    displayMode,
    setDisplayMode,
    selectedYear,
    setSelectedYear,
    baselineResults,
    activeResults,
    displayedResults,
    displayedBaselineResults,
    chartData,
    baselineChartData,
    validation,
    tempSocialSecurityDetails
  };
}
