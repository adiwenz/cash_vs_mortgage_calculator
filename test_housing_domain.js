import { describe, test, expect } from 'vitest';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  calculateCashShortfall,
  calculateCashAffordableHomePrice,
  calculateAdditionalCashNeeded,
  isCashAffordable,
  getMonthlyPIForPrice,
  getHousingCostForPrice,
  getRequiredDownPaymentAndCosts,
  getSimulatedRetirementAge
} from './src/domain/housing/houseAffordability.js';
import {
  getConstraintReasonLabel,
  resolveBuyHouseEvent,
  getOldRentBeforePurchase,
  splitPhasesAtAge,
  applyBudgetAdjustmentsForLevel,
  getSimulationValidationForPrice,
  solveBisectionHomeValue,
  getRebalanceStrategies,
  isHouseAffordableBalanced
} from './src/domain/housing/houseRecommendationSolver.js';
import { runFireSimulation } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

describe('Housing Domain Math & Logic', () => {
  describe('houseAffordability', () => {
    test('calculateTotalCashRequired: calculates upfront cash required correctly', () => {
      const event = {
        homePrice: 500000,
        downPayment: 100000,
        closingCosts: 3, // 15000
        points: 1000,
        renovationCost: 20000,
        movingCost: 4000
      };
      expect(calculateTotalCashRequired(event)).toBe(140000);
    });

    test('calculateCashAffordableHomePrice: calculates max affordable price correctly', () => {
      // 50000 liquid assets, 10% down payment, 3% closing costs, 0 fixed costs
      const price = calculateCashAffordableHomePrice({
        liquidAssets: 50000,
        downPaymentPercent: 0.10,
        closingCostPercent: 0.03,
        fixedUpfrontCosts: 0
      });
      // 50000 / 0.13 = ~384615
      expect(price).toBe(384615);
    });

    test('getMonthlyPIForPrice: calculates correct mortgage payment', () => {
      const buyHouseEv = {
        homePrice: 400000,
        downPayment: 80000,
        mortgageRate: 6.0,
        loanTerm: 30
      };
      // Loan Amount = 320000. Monthly rate = 0.005. 360 months.
      // PI = 320000 * (0.005 * 1.005^360) / (1.005^360 - 1) = ~1918.56
      const pi = getMonthlyPIForPrice(400000, buyHouseEv);
      expect(Math.round(pi)).toBe(1919);
    });

    test('getHousingCostForPrice: calculates total monthly housing cost', () => {
      const buyHouseEv = {
        homePrice: 400000,
        downPayment: 80000, // 20% down, so no PMI
        mortgageRate: 6.0,
        loanTerm: 30,
        propertyTax: 1.2, // annual rate: 1.2% of 400000 / 12 = 400
        insurance: 0.3, // annual rate: 0.3% of 400000 / 12 = 100
        maintenance: 1.0, // annual rate: 1% of 400000 / 12 = ~333.33
        hoa: 150,
        utilitiesIncrease: 100
      };
      // PI = ~1919
      // Prop Tax = 400
      // Ins = 100
      // Maint = 333
      // HOA = 150
      // Util = 100
      // Total = 1919 + 400 + 100 + 333 + 150 + 100 = 3002
      const totalCost = getHousingCostForPrice(400000, buyHouseEv);
      expect(totalCost).toBe(3002);
    });
  });

  describe('houseRecommendationSolver & Reason Labels', () => {
    test('getConstraintReasonLabel: maps constraint keys to display labels', () => {
      expect(getConstraintReasonLabel('cash')).toBe('Upfront cash');
      expect(getConstraintReasonLabel('upfront cash')).toBe('Upfront cash');
      expect(getConstraintReasonLabel('monthly')).toBe('Monthly budget');
      expect(getConstraintReasonLabel('monthly budget')).toBe('Monthly budget');
      expect(getConstraintReasonLabel('retirement')).toBe('Retirement impact');
      expect(getConstraintReasonLabel('retirement impact')).toBe('Retirement impact');
      expect(getConstraintReasonLabel('both')).toBe('Both');
    });

    test('splitPhasesAtAge: correctly splits phases', () => {
      const phases = [
        { id: 'p1', startAge: 30, endAge: 40, income: 5000 }
      ];
      const result = splitPhasesAtAge(phases, 35);
      expect(result).toHaveLength(2);
      expect(result[0].endAge).toBe(35);
      expect(result[0].id).toBe('p1-pre-split');
      expect(result[1].startAge).toBe(35);
      expect(result[1].id).toBe('p1-post-split');
    });
  });

  describe('Regression Test: Solver Bug (Liquid vs Total Assets)', () => {
    test('Solver uses getAvailableLiquidAssetsBeforePurchase, constraining recommended home price under large illiquid assets', () => {
      // Create a scenario where total net worth/assets are extremely high ($2 million in trad401k)
      // But liquid assets (cash + brokerage) are very low ($10,000)
      const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
      inputs.currentAge = 35;
      inputs.targetRetirementAge = 65;
      inputs.lifeExpectancy = 85;
      inputs.expectedReturn = 7.0;
      inputs.inflationRate = 3.0;
      inputs.includeTaxes = false;
      inputs.isAdvancedMode = true;
      inputs.hasCustomizedSavingsAllocation = true;

      // Illiquid retirement assets are very high, liquid assets are very low
      inputs.assets = {
        cash: 5000,
        brokerage: 5000,
        trad401k: 2000000 // Huge retirement asset, should NOT be usable for down payment
      };

      // Set up a purchase at age 36 (1 year after currentAge)
      const purchaseAge = 36;
      inputs.budgetDetails = {
        phases: [
          {
            id: 'phase1',
            type: 'workSave',
            startAge: 35,
            endAge: purchaseAge,
            income: 5000,
            savingsAllocMode: 'fixed',
            savings: { brokerage: 1000 }, // $12,000 saved during the year
            expenses: {
              housing: 1000,
              leisure: 333,
              diningOut: 333,
              misc: 333
            }
          },
          {
            id: 'phase2',
            type: 'workSave',
            startAge: purchaseAge,
            endAge: 85,
            income: 5000,
            savingsAllocMode: 'fixed',
            savings: { brokerage: 1000 },
            expenses: {
              housing: 0,
              leisure: 333,
              diningOut: 333,
              misc: 333
            }
          }
        ]
      };

      const event = {
        id: 'buyHouse1',
        type: 'buyHouse',
        purchaseAge: purchaseAge,
        homePrice: 500000,
        downPayment: 100000,
        mortgageRate: 6.5,
        loanTerm: 30,
        closingCosts: 3,
        points: 0,
        renovationCost: 5000,
        movingCost: 3000,
        hoa: 0,
        utilitiesIncrease: 0,
        propertyTax: 1.1,
        insurance: 0.35,
        maintenance: 1.0,
        enabled: true
      };
      inputs.lifeEvents = [event];

      // Run solver
      const strategies = getRebalanceStrategies(inputs, event, 65);
      
      expect(strategies).not.toBeNull();
      
      // Verification 1: The limiting factor must be identified as 'cash' constraint
      expect(strategies.constraint).toBe('cash');

      // Verification 2: The recommended home price must be constrained by the small liquid assets
      // (Starts at $10k + ~1yr savings = ~$22k available liquid funds).
      // Down payment and closing costs for a $500k house would require > $100k, which is impossible with $22k.
      // So the recommended affordablePriceBalanced must be low (e.g. under $150k).
      // If it incorrectly used $2M total assets, it would recommend a much larger home price.
      expect(strategies.affordablePriceBalanced).toBeLessThan(150000);

      // Verification 3: Verify the liquid funds available matches ~22k, not 2M+
      expect(strategies.liquidFundsAvailable).toBeLessThan(40000);
    });
  });
});
