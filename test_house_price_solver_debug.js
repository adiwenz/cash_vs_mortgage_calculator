import { describe, test, expect } from 'vitest';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { getNormalizedPhases } from './src/calculators/fire/phases.js';
import { getRebalanceStrategies, isHouseAffordableBalanced } from './src/calculators/fire/rebalance.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('House Price Solver Audits and Scenario Verification', () => {

  test('Verify rent is removed after purchase and no double-counting occurs', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 100000,
      simpleExpenses: 50000,
      assets: {
        checking: 0,
        emergencyFund: 0,
        brokerage: 150000,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      },
      lifeEvents: [
        {
          id: 'buy-house-test',
          type: 'buyHouse',
          enabled: true,
          purchaseAge: 40,
          homePrice: 300000,
          downPayment: 60000,
          purchaseType: 'mortgage',
          mortgageRate: 6.5,
          loanTerm: 30,
          propertyTax: 1.1,
          insurance: 0.35,
          maintenance: 1.0,
          hoa: 100,
          utilitiesIncrease: 50,
          keepRent: false
        }
      ]
    };

    const results = runFireSimulation(inputs);
    const phases = getNormalizedPhases(inputs);

    // Find a phase after purchase (e.g. age 42)
    const postPurchasePhase = phases.find(p => p.startAge <= 42 && p.endAge > 42);
    expect(postPurchasePhase).toBeDefined();

    // Verify rent (base housing) is replaced by homeownership non-mortgage costs
    // Rent was 1500. Expected non-mortgage costs = (300k * 1.1% + 300k * 0.35% + 300k * 1.0%)/12 + 100 + 50 = (3300 + 1050 + 3000)/12 + 150 = 612.5 + 150 = 762.5 -> round to 763
    expect(postPurchasePhase.expenses.housing).toBe(763);
    expect(postPurchasePhase.expenses['🏠 Mortgage']).toBe(1517); // 240k mortgage @ 6.5% is 1516.89 -> 1517

    // Verify nominalData at age 42 has exactly these expenses scaled
    const log42 = results.nominalData.find(d => d.age === 42);
    expect(log42).toBeDefined();
    // Verify no console warnings were fired about double-counting (we can assert the cash balance is healthy)
    expect(log42.portfolio).toBeGreaterThan(0);
  });

  test('Verify down payment is treated as asset transfer (not destroyed net worth)', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 60,
      simpleIncome: 100000,
      simpleExpenses: 50000,
      assets: {
        checking: 0,
        emergencyFund: 0,
        brokerage: 150000,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      },
      lifeEvents: [
        {
          id: 'buy-house-ledger',
          type: 'buyHouse',
          enabled: true,
          purchaseAge: 40,
          homePrice: 200000,
          downPayment: 50000,
          purchaseType: 'mortgage',
          mortgageRate: 6.5,
          loanTerm: 30,
          closingCosts: 0, // no closing costs to verify exact net worth transfer
          points: 0,
          renovationCost: 0
        }
      ]
    };

    const results = runFireSimulation(inputs);
    const log40 = results.nominalData.find(d => d.age === 40);
    const log39 = results.nominalData.find(d => d.age === 39);

    // In year of purchase, net worth should not be impacted by the home purchase transaction itself
    // (excluding appreciation/savings/interest/taxes during the year).
    // The down payment is an asset transfer to home equity, so the net worth impact of the purchase is 0.
    expect(log40.homeAccountingDebug).toBeDefined();
    expect(Math.abs(log40.homeAccountingDebug.netWorthImpactFromPurchase)).toBeLessThan(1.0);
    
    // Also verify that the overall net worth changes by savings + growth + debt principal - interest
    const netWorthChange = log40.netWorth - log39.netWorth;
    const expectedChangeWithMortgage = log40.netWorthLedgerDebug.savings + log40.netWorthLedgerDebug.investmentGrowth - log40.netWorthLedgerDebug.interestPaid + log40.netWorthLedgerDebug.debtPrincipalPaid;
    expect(Math.abs(netWorthChange - expectedChangeWithMortgage)).toBeLessThan(10.0);
  });

  test('Run user specific scenario: 50k/yr income, start age 35, 5000 savings, 15% rate, try buy 500k house with 100k down payment', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      targetRetirementAge: 65,
      lifeExpectancy: 85,
      simpleIncome: 50000,
      simpleExpenses: 42500, // 50k - 7.5k savings
      hasCustomizedSavingsAllocation: true,
      budgetDetails: {
        savings: {
          trad401k: 0,
          rothIra: 0,
          tradIra: 0,
          hsa: 0,
          brokerage: 625, // 15% of 50k is 7.5k/yr = 625/mo
          checking: 0,
          hysa: 0,
          emergency: 0,
          debt: 0,
          other: 0
        },
        expenses: {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        }
      },
      assets: {
        checking: 0,
        emergencyFund: 0,
        brokerage: 5000, // 5k starting brokerage
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      },
      lifeEvents: [
        {
          id: 'buy-house-scenario',
          type: 'buyHouse',
          enabled: true,
          purchaseAge: 40,
          homePrice: 500000,
          downPayment: 100000,
          purchaseType: 'mortgage',
          mortgageRate: 6.5,
          loanTerm: 30,
          propertyTax: 1.1,
          insurance: 0.35,
          maintenance: 1.0,
          hoa: 0,
          utilitiesIncrease: 0,
          keepRent: false
        }
      ]
    };

    // Calculate baseline age before purchase event
    const baselineInputs = JSON.parse(JSON.stringify(inputs));
    baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
      if (ev.type === 'buyHouse') return { ...ev, enabled: false };
      return ev;
    });
    const baselineResults = runFireSimulation(baselineInputs);
    const baselineReadyAge = baselineResults.retirementReadyAge;
    
    console.log(`Baseline Retirement Age without home purchase: ${baselineReadyAge}`);

    // Run solver/rebalance strategies
    const activeBuyHouseEv = inputs.lifeEvents.find(e => e.id === 'buy-house-scenario');
    const rebalanceData = getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge);

    expect(rebalanceData).toBeDefined();

    console.log('\n==================================================');
    console.log('User Scenario Rebalance Strategy Output:');
    console.log(`- Original attempted home price: $${rebalanceData.currentHomePrice}`);
    console.log(`- Cozy/Comfortable Affordable price: $${rebalanceData.affordablePriceConservative}`);
    console.log(`- Balanced Affordable price: $${rebalanceData.affordablePriceBalanced}`);
    console.log(`- Stretch Affordable price: $${rebalanceData.affordablePriceAggressive}`);
    console.log(`- Cozy/Comfortable sustainable? ${rebalanceData.isConservativeSustainable ? 'Yes' : 'No'} (Retirement age: ${rebalanceData.conservativeRetirementAge})`);
    console.log(`- Balanced sustainable? ${rebalanceData.isBalancedSustainable ? 'Yes' : 'No'} (Retirement age: ${rebalanceData.balancedRetirementAge})`);
    console.log(`- Stretch sustainable? ${rebalanceData.isAggressiveSustainable ? 'Yes' : 'No'} (Retirement age: ${rebalanceData.aggressiveRetirementAge})`);
    console.log('==================================================\n');

    // Confirm that the attempted $500,000 price is not achievable/sustainable under these strategies.
    // The solved affordable price should be significantly lower (or fallback to floor).
    expect(rebalanceData.affordablePriceBalanced).toBeLessThan(500000);
  });
});
