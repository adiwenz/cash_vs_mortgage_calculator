import { describe, test, expect } from 'vitest';
import { runFireSimulation, getProfileFromInputs, getEventsFromInputs, buildSimulationDebugSnapshot } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('buildSimulationDebugSnapshot', () => {
  test('Debug snapshot includes all 10 new inspector properties with correct structure', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 80000,
      lifeEvents: [
        {
          id: 'ss-1',
          type: 'socialSecurity',
          name: 'Social Security',
          enabled: true,
          claimingAge: 67,
          monthlyBenefit: 2000,
          inflationAdjusted: true
        },
        {
          id: 'retire-1',
          type: 'retire',
          name: 'Retirement',
          enabled: true,
          age: 65,
          spendingPercent: 70
        }
      ]
    };

    const normalizedInputs = getProfileFromInputs(inputs);
    const events = getEventsFromInputs(inputs);
    const results = runFireSimulation(inputs);
    const yearlyTimeline = results.nominalData;

    const snapshot = buildSimulationDebugSnapshot(inputs, normalizedInputs, events, results, yearlyTimeline);

    // 1. Simulation Assumptions
    expect(snapshot.simulationAssumptions).toBeDefined();
    expect(snapshot.simulationAssumptions.currentAge).toBe(35);
    expect(snapshot.simulationAssumptions.retirementAge).toBe(65);
    expect(snapshot.simulationAssumptions.lifeExpectancy).toBe(85);
    expect(snapshot.simulationAssumptions.inflationRate).toBeDefined();
    expect(snapshot.simulationAssumptions.salaryGrowthRate).toBeDefined();
    expect(snapshot.simulationAssumptions.preRetirementReturn).toBeDefined();
    expect(snapshot.simulationAssumptions.postRetirementReturn).toBeDefined();
    expect(snapshot.simulationAssumptions.safeWithdrawalRate).toBeDefined();
    expect(snapshot.simulationAssumptions.taxMode).toBeDefined();
    expect(snapshot.simulationAssumptions.socialSecurityEnabled).toBe(true);

    // 2. Savings Allocation
    expect(snapshot.savingsAllocation).toBeDefined();
    expect(snapshot.savingsAllocation.cash).toBeDefined();
    expect(snapshot.savingsAllocation.brokerage).toBeDefined();
    expect(snapshot.savingsAllocation['401k']).toBeDefined();
    expect(snapshot.savingsAllocation.rothIRA).toBeDefined();
    expect(snapshot.savingsAllocation.hsa).toBeDefined();
    expect(snapshot.savingsAllocation.effectiveAccumulationReturn).toBeDefined();
    expect(snapshot.savingsAllocation.effectiveRetirementReturn).toBeDefined();

    // 3. Account Balances
    expect(snapshot.accountBalancesAudit).toBeDefined();
    expect(snapshot.accountBalancesAudit.cash).toBeDefined();
    expect(snapshot.accountBalancesAudit.cash.startingBalance).toBeDefined();
    expect(snapshot.accountBalancesAudit.cash.annualContribution).toBeDefined();
    expect(snapshot.accountBalancesAudit.cash.growthRate).toBeDefined();
    expect(snapshot.accountBalancesAudit.cash.retirementBalance).toBeDefined();
    expect(snapshot.accountBalancesAudit.brokerage).toBeDefined();

    // 4. Retirement Readiness Calculation
    expect(snapshot.retirementReadinessCalc).toBeDefined();
    expect(snapshot.retirementReadinessCalc.retirementSpending).toBeDefined();
    expect(snapshot.retirementReadinessCalc.socialSecurityIncome).toBeDefined();
    expect(snapshot.retirementReadinessCalc.netRequiredPortfolioIncome).toBeDefined();
    expect(snapshot.retirementReadinessCalc.safeWithdrawalRate).toBeDefined();
    expect(snapshot.retirementReadinessCalc.requiredPortfolio).toBeDefined();

    // 5. Retirement Year Snapshot
    expect(snapshot.retirementYearSnapshot).toBeDefined();
    expect(snapshot.retirementYearSnapshot.retirementAge).toBe(65);
    expect(snapshot.retirementYearSnapshot.assets).toBeDefined();
    expect(snapshot.retirementYearSnapshot.debts).toBeDefined();
    expect(snapshot.retirementYearSnapshot.netWorth).toBeDefined();
    expect(snapshot.retirementYearSnapshot.annualSpending).toBeDefined();
    expect(snapshot.retirementYearSnapshot.annualSocialSecurity).toBeDefined();
    expect(snapshot.retirementYearSnapshot.annualWithdrawalNeeded).toBeDefined();

    // 6. Withdrawal Strategy
    expect(snapshot.withdrawalStrategy).toBeDefined();
    expect(snapshot.withdrawalStrategy.withdrawalOrder).toBeDefined();
    expect(snapshot.withdrawalStrategy.withdrawalOrder).toContain('cash');
    expect(snapshot.withdrawalStrategy.yearlyWithdrawals).toBeDefined();

    // 7. Retirement Sustainability Table
    expect(snapshot.retirementSustainabilityTable).toBeDefined();
    expect(snapshot.retirementSustainabilityTable.length).toBeGreaterThan(0);
    const tableRow = snapshot.retirementSustainabilityTable[0];
    expect(tableRow.age).toBeDefined();
    expect(tableRow.startAssets).toBeDefined();
    expect(tableRow.growth).toBeDefined();
    expect(tableRow.withdrawals).toBeDefined();
    expect(tableRow.endAssets).toBeDefined();

    // 8. Account Growth Audit
    expect(snapshot.accountGrowthAudit).toBeDefined();
    expect(snapshot.accountGrowthAudit.cashGrowthRate).toBe(0.02);
    expect(snapshot.accountGrowthAudit.growthAppliedCorrectly).toBeDefined();

    // 9. Warnings Section
    expect(snapshot.warnings).toBeDefined();
    expect(Array.isArray(snapshot.warnings)).toBe(true);

    // 10. Downloadable JSON Format
    expect(snapshot.exportableJSON).toBeDefined();
    expect(snapshot.exportableJSON.inputs).toBeDefined();
    expect(snapshot.exportableJSON.events).toBeDefined();
    expect(snapshot.exportableJSON.phases).toBeDefined();
    expect(snapshot.exportableJSON.accountBalances).toBeDefined();
    expect(snapshot.exportableJSON.yearlySnapshots).toBeDefined();
    expect(snapshot.exportableJSON.retirementAnalysis).toBeDefined();
    expect(snapshot.exportableJSON.withdrawalAnalysis).toBeDefined();
  });

  test('Scenario A (100% Brokerage) vs Scenario B (100% Cash) verification', () => {
    // SCENARIO A: 100% Brokerage savings
    const inputsA = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7, // 7% pre-retirement return
      postRetirementReturn: 5,
      inflationRate: 3,
      budgetDetails: {
        savings: {
          checking: 0,
          hysa: 0,
          emergency: 0,
          brokerage: 1000, // $12,000/yr saved to Brokerage
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          hysa: 0,
          emergency: 0,
          brokerage: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      }
    };

    const normA = getProfileFromInputs(inputsA);
    const evsA = getEventsFromInputs(inputsA);
    const resA = runFireSimulation(inputsA);
    const snapA = buildSimulationDebugSnapshot(inputsA, normA, evsA, resA, resA.nominalData);

    expect(snapA.savingsAllocation.brokerage).toBe(100);
    expect(snapA.savingsAllocation.cash).toBe(0);
    expect(snapA.savingsAllocation.effectiveAccumulationReturn).toBe(0.07); // 100% * 7%

    // SCENARIO B: 100% Cash savings
    const inputsB = {
      ...DEFAULT_FIRE_INPUTS,
      hasCustomizedSavingsAllocation: true,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      expectedReturn: 7,
      postRetirementReturn: 5,
      inflationRate: 3,
      budgetDetails: {
        savings: {
          checking: 1000, // $12,000/yr saved to Cash
          hysa: 0,
          emergency: 0,
          brokerage: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        partnerSavings: {
          checking: 0,
          hysa: 0,
          emergency: 0,
          brokerage: 0,
          trad401k: 0,
          rothIra: 0,
          hsa: 0,
          tradIra: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 2000,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      }
    };

    const normB = getProfileFromInputs(inputsB);
    const evsB = getEventsFromInputs(inputsB);
    const resB = runFireSimulation(inputsB);
    const snapB = buildSimulationDebugSnapshot(inputsB, normB, evsB, resB, resB.nominalData);

    expect(snapB.savingsAllocation.cash).toBe(100);
    expect(snapB.savingsAllocation.brokerage).toBe(0);
    expect(snapB.savingsAllocation.effectiveAccumulationReturn).toBe(0.02); // 100% * 2%
    
    // Growth audit warning check: growthAppliedCorrectly should be true because cash compounds at configured rate (2%)
    expect(snapB.accountGrowthAudit.growthAppliedCorrectly).toBe(true);
    expect(snapB.warnings).toContain("100% of contributions allocated to cash");
    expect(snapB.warnings.some(w => w.includes("Cash balance is compounding at the portfolio rate"))).toBe(false);
  });
});
