import { runFireSimulation } from './src/fireCalculations.js';
import { getMappedDefaultInputs } from './test_helper.js';
import { describe, test, expect } from 'vitest';

describe('Net Worth Ledger Calculations and Reconciliation', () => {
  test('Starting balances never appear as investment growth', () => {
    const inputs = getMappedDefaultInputs();
    inputs.currentAge = 35;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 0;
    inputs.simpleExpenses = 0;
    inputs.expectedReturn = 7.0;
    inputs.inflationRate = 0.0;
    inputs.includeTaxes = false;

    // A starting portfolio of $5,000. It should grow by 7% (i.e. $350 growth), NOT show $5,000 growth!
    inputs.assets = {
      cash: 5000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      other: 0,
      debts: 0
    };
    inputs.debtList = [];
    inputs.budgetDetails = { savings: {}, partnerSavings: {}, expenses: {} };
    inputs.spendingPhases = [];
    inputs.incomeList = [];
    inputs.householdMembers = [];
    inputs.lifeEvents = [];

    const results = runFireSimulation(inputs);
    
    // Check Age 36 (Year 1, first year of growth)
    const age36 = results.nominalData.find(d => d.age === 36);
    expect(age36).toBeDefined();
    
    const ledger = age36.netWorthLedger;
    expect(ledger).toBeDefined();
    
    // Growth should be exactly 7% of $5,000 = $350
    expect(ledger.startingNetWorth).toBe(5000);
    expect(ledger.investmentGrowth).toBeCloseTo(350, 1);
    
    // Make sure starting balance of $5,000 does not appear as growth
    expect(ledger.investmentGrowth).not.toBe(5000);
  });

  test('Wedding financing creates debt but does not inflate investment growth', () => {
    const inputs = getMappedDefaultInputs();
    inputs.currentAge = 35;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 0;
    inputs.simpleExpenses = 0;
    inputs.expectedReturn = 0.0;
    inputs.inflationRate = 0.0;
    inputs.includeTaxes = false;

    inputs.assets = {
      cash: 10000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      other: 0,
      debts: 0
    };
    inputs.debtList = [];
    inputs.budgetDetails = { savings: {}, partnerSavings: {}, expenses: {} };
    inputs.spendingPhases = [];
    inputs.incomeList = [];
    inputs.householdMembers = [];

    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      age: 35,
      spouseIncome: 0,
      incomeGrowthRate: 0,
      cash: 0,
      investments: 0,
      retirement: 0,
      savingsRate: 0,
      includeWeddingCost: true,
      weddingCost: 20000,
      weddingAge: 35,
      weddingFundingMethod: 'debt',
      weddingInterestRate: 7,
      weddingPayoffTimeline: 10,
      weddingHasPaymentPlan: true
    };
    inputs.lifeEvents = [marriageEvent];

    const results = runFireSimulation(inputs);
    const age35 = results.nominalData.find(d => d.age === 35);

    // Wedding financed amount = totalCost (20000) - liquidAssets (10000) = 10000
    // Paid from savings = 10000
    const ledger = age35.netWorthLedger;
    expect(ledger).toBeDefined();
    expect(ledger.weddingFinancedAmount).toBe(10000);
    expect(ledger.weddingPaidFromSavings).toBe(10000);
    
    // Expect growth to be 0 since expectedReturn = 0 (wedding financing shouldn't inflate investment growth)
    expect(ledger.investmentGrowth).toBe(0);
  });

  test('Ledger reconciliation matches ending net worth across all years', () => {
    const inputs = getMappedDefaultInputs();
    const results = runFireSimulation(inputs);
    
    results.nominalData.forEach(d => {
      const ledger = d.netWorthLedger;
      if (!ledger) return;
      
      const debug = d.netWorthLedgerDebug;
      expect(debug).toBeDefined();
      
      // reconciliationDifference should be close to 0 (within $1)
      expect(Math.abs(debug.reconciliationDifference)).toBeLessThanOrEqual(1.0);
      
      // endingNetWorth should match the KPI netWorth
      expect(Math.abs(ledger.endingNetWorth - d.netWorth)).toBeLessThanOrEqual(1.0);
    });
  });

  test('Wedding ledger breakdown correctly displays in rows', () => {
    const inputs = getMappedDefaultInputs();
    inputs.currentAge = 35;
    inputs.lifeExpectancy = 85;
    inputs.simpleIncome = 0;
    inputs.simpleExpenses = 0;
    inputs.expectedReturn = 0.0;
    inputs.inflationRate = 0.0;
    inputs.includeTaxes = false;

    inputs.assets = {
      cash: 10000,
      emergencyFund: 0,
      brokerage: 0,
      trad401k: 0,
      tradIra: 0,
      rothIra: 0,
      hsa: 0,
      other: 0,
      debts: 0
    };
    inputs.debtList = [];
    inputs.budgetDetails = { savings: {}, partnerSavings: {}, expenses: {} };
    inputs.spendingPhases = [];
    inputs.incomeList = [];
    inputs.householdMembers = [];

    const marriageEvent = {
      id: 'marriage-1',
      type: 'marriage',
      enabled: true,
      age: 35,
      spouseIncome: 0,
      incomeGrowthRate: 0,
      cash: 0,
      investments: 0,
      retirement: 0,
      savingsRate: 0,
      includeWeddingCost: true,
      weddingCost: 20000,
      weddingAge: 35,
      weddingFundingMethod: 'debt',
      weddingInterestRate: 7,
      weddingPayoffTimeline: 10,
      weddingHasPaymentPlan: true
    };
    inputs.lifeEvents = [marriageEvent];

    const results = runFireSimulation(inputs);
    const age35 = results.nominalData.find(d => d.age === 35);
    const ledger = age35.netWorthLedger;
    
    const weddingRow = ledger.rows.find(r => r.label === 'Wedding Cost');
    expect(weddingRow).toBeDefined();
    expect(weddingRow.value).toBe(-20000);
    expect(weddingRow.expandable).toBe(true);
    expect(weddingRow.details).toBeDefined();
    expect(weddingRow.details.paidFromSavings).toBe(10000);
    expect(weddingRow.details.financed).toBe(10000);
    expect(weddingRow.details.currentDebtBalance).toBeGreaterThanOrEqual(9300); // starts at 10000, min payment made
  });
});
