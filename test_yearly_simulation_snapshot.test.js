// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getMappedDefaultInputs } from './test_helper.js';

// Scenarios to include:
// 1. default baseline
// 2. retire today
// 3. social security enabled
// 4. house purchase
// 5. child event
// 6. marriage/spouse income
// 7. debts
// 8. taxable vs no-tax display mode

function extractLogData(log) {
  if (!log) return null;
  return {
    age: log.age,
    income: log.income,
    expenses: log.expenses,
    taxes: log.taxes,
    savings: log.savings,
    employerMatch: log.employerMatch,
    withdrawals: log.withdrawals,
    shortfall: log.shortfall,
    cumulativeShortfall: log.cumulativeShortfall,
    portfolio: log.portfolio,
    homeValue: log.homeValue,
    homeEquity: log.homeEquity,
    mortgageBalance: log.mortgageBalance,
    debtBalance: log.debtBalance,
    netWorth: log.netWorth,
    isFI: log.isFI,
    fiNumber: log.fiNumber,
    ssIncome: log.ssIncome,
    retirementReadyTarget: log.retirementReadyTarget,
    coastFireNumber: log.coastFireNumber,
    isCoastAchieved: log.isCoastAchieved,
    childCosts: log.childCosts,
    lifestyleGap: log.lifestyleGap,
    hasNetWorthLedger: !!log.netWorthLedger,
    hasNetWorthLedgerDebug: !!log.netWorthLedgerDebug,
    hasHomeAccountingDebug: !!log.homeAccountingDebug,
  };
}

function extractGoldenMetrics(results, keyAges = []) {
  const nominalData = results.nominalData || [];
  const finalYearLog = nominalData[nominalData.length - 1];

  const extractedLogs = {};
  keyAges.forEach(age => {
    const log = nominalData.find(d => d.age === age);
    if (log) {
      extractedLogs[age] = extractLogData(log);
    }
  });

  return {
    retirementReadyAge: results.retirementReadyAge,
    moneyLasts: results.moneyLasts,
    runOutAge: results.runOutAge,
    logsLength: nominalData.length,
    finalNetWorth: finalYearLog ? finalYearLog.netWorth : null,
    keyAgesLogs: extractedLogs
  };
}

describe('Yearly Simulation Golden Targeted Assertions', () => {
  // 1. default baseline
  test('Scenario 1: Default Baseline', () => {
    const inputs = getMappedDefaultInputs();
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 65, 67, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 2. retire today
  test('Scenario 2: Retire Today', () => {
    const inputs = getMappedDefaultInputs();
    inputs.targetRetirementAge = 35;
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 65, 67, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 3. social security enabled
  test('Scenario 3: Social Security Enabled', () => {
    const inputs = getMappedDefaultInputs();
    const ssEv = inputs.lifeEvents.find(e => e.type === 'socialSecurity');
    if (ssEv) {
      ssEv.enabled = true;
      ssEv.claimingAge = 62;
    }
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 62, 65, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 4. house purchase
  test('Scenario 4: House Purchase', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents.push({
      id: 'house-1',
      type: 'buyHouse',
      name: 'Buy House',
      enabled: true,
      purchaseAge: 40,
      homePrice: 300000,
      downPayment: 60000,
      purchaseType: 'mortgage',
      mortgageRate: 6.0,
      loanTerm: 30,
      propertyTaxRate: 1.2,
      insuranceRate: 0.35,
      maintenanceRate: 1.0,
      hoa: 100,
      utilitiesIncrease: 50,
      pmiRate: 0.5,
      closingCostsRate: 3.0
    });
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 40, 65, 70, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 5. child event
  test('Scenario 5: Child Event', () => {
    const inputs = getMappedDefaultInputs();
    inputs.currentConditions.push({
      id: 'child-1',
      type: 'child',
      name: 'First Child',
      monthlyAmount: 1000,
      rate: 3,
      endAge: 53 // child grows up
    });
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 45, 53, 65, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 6. marriage/spouse income
  test('Scenario 6: Marriage and Spouse Income', () => {
    const inputs = getMappedDefaultInputs();
    inputs.lifeEvents.push({
      id: 'marriage-1',
      type: 'marriage',
      name: 'Marriage',
      enabled: true,
      age: 40,
      spouseCurrentAge: 38,
      spouseLifeExpectancy: 88,
      spouseDesiredRetirementAge: 62,
      spouseIncome: 45000,
      incomeGrowthRate: 2,
      savingsRate: 15,
      cash: 10000,
      investments: 20000,
      retirement: 15000,
      debtStudent: 5000,
      debtCredit: 0,
      debtOther: 0,
      combinedSpendingAfterMarriage: 3500,
      lifestyleAdjustment: 0,
      housingSavings: 0,
      housingCost: 0,
      weddingAge: 40,
      includeWeddingCost: true,
      weddingCost: 15000
    });
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 40, 62, 65, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 7. debts
  test('Scenario 7: Debts', () => {
    const inputs = getMappedDefaultInputs();
    inputs.currentConditions.push({
      id: 'debt-1',
      type: 'debt',
      name: 'Student Loan',
      subtype: 'student',
      value: 30000,
      monthlyAmount: 300,
      rate: 4.5,
      endAge: 45
    });
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 40, 45, 65, 85]);
    expect(metrics).toMatchSnapshot();
  });

  // 8. taxable vs no-tax display mode
  test('Scenario 8: No-Tax Mode', () => {
    const inputs = getMappedDefaultInputs();
    inputs.includeTaxes = false;
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 65, 67, 85]);
    expect(metrics).toMatchSnapshot();
  });

  test('Scenario 8: Tax Mode', () => {
    const inputs = getMappedDefaultInputs();
    inputs.includeTaxes = true;
    const results = runFireSimulation(inputs);
    const metrics = extractGoldenMetrics(results, [35, 65, 67, 85]);
    expect(metrics).toMatchSnapshot();
  });
});
