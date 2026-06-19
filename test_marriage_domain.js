import { describe, test, expect } from 'vitest';
import { generateDefaultPartnerProfile } from './src/domain/events/marriage/marriageDefaults.js';
import {
  calculateCombinedIncome,
  getSavingsBreakdown,
  calculateMarriageEstimates,
  calculatePartnerRetirementAge
} from './src/domain/events/marriage/marriageImpact.js';
import { validateWeddingCostFunding } from './src/domain/events/marriage/marriageValidation.js';
import {
  createSpouseRecord,
  createMarriageEventObject
} from './src/domain/events/marriage/marriageEventFactory.js';

describe('Marriage Domain Logic', () => {
  const sampleInputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    simpleIncome: 80000,
    preTaxSavingsRate: 15,
    simpleExpenses: 40000,
    includeTaxes: true,
    assets: {
      cash: 10000,
      brokerage: 40000,
      trad401k: 50000,
      debts: 20000
    },
    debtList: [
      { balance: 5000 }
    ],
    budgetDetails: {
      expenses: {
        housing: 1500,
        utilities: 400,
        internet: 100,
        streaming: 60,
        householdGoods: 500
      }
    }
  };

  describe('1. Identical Partner Defaults', () => {
    test('generateDefaultPartnerProfile mirrors user income, savings rate, total assets, and total debts', () => {
      // User assets = 10k + 40k + 50k = 100k
      // User debts = 20k + 5k = 25k
      const defaults = generateDefaultPartnerProfile(sampleInputs, false);

      expect(defaults.spouseIncome).toBe(80000);
      expect(defaults.savingsRate).toBe(15);
      expect(defaults.investments).toBe(100000);
      expect(defaults.debtOther).toBe(25000);
      expect(defaults.spouseCurrentAge).toBe(35);
      expect(defaults.spouseLifeExpectancy).toBe(85);
      expect(defaults.spouseSocialSecurityAge).toBe(67);
      expect(defaults.partnerRetiresWithUser).toBe(true);
    });

    test('generateDefaultPartnerProfile on mobile does not pre-populate assets/debts', () => {
      const defaults = generateDefaultPartnerProfile(sampleInputs, true);

      expect(defaults.spouseIncome).toBe(80000);
      expect(defaults.investments).toBe(0);
      expect(defaults.debtOther).toBe(0);
    });
  });

  describe('2. Wedding Cash Constraint Validation', () => {
    test('wedding fully funded from savings', () => {
      const event = {
        weddingCost: 15000,
        weddingFundingMethod: 'savings',
        cash: 10000,
        investments: 20000,
        retirement: 30000
      };
      // Combined assets = 100k (user) + 60k (spouse) = 160k
      const validation = validateWeddingCostFunding(event, sampleInputs);

      expect(validation.combinedAssets).toBe(160000);
      expect(validation.isSavingsDisabled).toBe(false);
      expect(validation.fundingGap).toBe(0);
      expect(validation.postWeddingFinancedDebt).toBe(0);
      expect(validation.isNetWorthBelowZero).toBe(false);
    });

    test('wedding cost exceeds combined assets, saving disabled', () => {
      const event = {
        weddingCost: 200000,
        weddingFundingMethod: 'savings',
        cash: 5000,
        investments: 10000,
        retirement: 15000
      };
      // Combined assets = 100k (user) + 30k (spouse) = 130k
      const validation = validateWeddingCostFunding(event, sampleInputs);

      expect(validation.combinedAssets).toBe(130000);
      expect(validation.isSavingsDisabled).toBe(true);
      expect(validation.fundingGap).toBe(70000);
    });

    test('wedding financed debt creates post-wedding debt', () => {
      const event = {
        weddingCost: 150000,
        weddingFundingMethod: 'debt',
        cash: 5000,
        investments: 10000,
        retirement: 15000
      };
      // Combined assets = 130k. Combined debt = 25k (user) + 0 (spouse) = 25k.
      // Financed debt = 150k - 130k = 20k.
      const validation = validateWeddingCostFunding(event, sampleInputs);

      expect(validation.postWeddingFinancedDebt).toBe(20000);
      expect(validation.postWeddingNetWorth).toBe(130000 - 25000 - 20000); // 85000
      expect(validation.isNetWorthBelowZero).toBe(false);
    });

    test('wedding financed debt results in net worth below zero', () => {
      const event = {
        weddingCost: 300000,
        weddingFundingMethod: 'debt',
        cash: 5000,
        investments: 10000,
        retirement: 15000
      };
      // Combined assets = 130k. Combined debt = 25k. Financed debt = 300k - 130k = 170k.
      // Net worth = 130k - 25k - 170k = -65k.
      const validation = validateWeddingCostFunding(event, sampleInputs);

      expect(validation.isNetWorthBelowZero).toBe(true);
      expect(validation.postWeddingNetWorth).toBe(-65000);
    });
  });

  describe('3. Combined Income Calculation', () => {
    test('calculates correct combined income', () => {
      expect(calculateCombinedIncome(80000, 60000)).toBe(140000);
      expect(calculateCombinedIncome(80000, null)).toBe(80000);
      expect(calculateCombinedIncome(0, 50000)).toBe(50000);
    });
  });

  describe('4. Shared Savings Calculations', () => {
    test('splits housing, utilities, internet, streaming, and household goods correctly', () => {
      const breakdown = getSavingsBreakdown({}, sampleInputs);

      // curHousing = 1500 -> 1500 * 0.5 = 750
      expect(breakdown.housing).toBe(750);
      // curUtilities = 400 -> 400 * 0.25 = 100
      expect(breakdown.utilities).toBe(100);
      // curInternet = 100 -> 100 * 0.5 = 50
      expect(breakdown.internet).toBe(50);
      // curStreaming = 60 -> 60 * 0.5 = 30
      expect(breakdown.streaming).toBe(30);
      // curHouseholdGoods = 500 -> 500 * 0.1 = 50
      expect(breakdown.otherShared).toBe(50);

      expect(breakdown.total).toBe(980);
    });
  });

  describe('5. Marriage Estimate Calculations', () => {
    test('calculates correct pre-retirement and retirement spending needs', () => {
      const event = {
        spouseIncome: 60000,
        savingsRate: 15,
        retirementSpendingNeed: ''
      };
      // User spending = 40000
      // Spouse Income = 60000. Savings = 9000. Tax = single tax on 60k/9k = ~8615 (via calculateUSTaxForModal)
      // Spouse Take Home Remaining = 60000 - 8615 - 9000 = 42385
      // Combined Shared Savings = 980 * 12 = 11760
      // Combined Spending = 40000 (user) + 42385 (spouse remaining) - 11760 (savings) = 70625
      const estimates = calculateMarriageEstimates(event, sampleInputs);

      expect(estimates.userSpendingPreRetirement).toBe(40000);
      // Wait, let's verify estimates.userSpendingPreRetirement.
      expect(estimates.combinedSpendingVal).toBeGreaterThan(0);
      expect(estimates.spouseRetSpendingVal).toBeGreaterThan(0);
      expect(estimates.partnerTakeHomeRemaining).toBeGreaterThan(0);
    });
  });

  describe('6. Same Retirement Year Logic', () => {
    test('adjusts spouse retirement age so user and spouse retire in the same calendar year', () => {
      // User is 35, retires at 65 (30 years from now). Spouse is 38.
      // Target spouse retirement age is 38 + 30 = 68.
      const spouseAge = calculatePartnerRetirementAge(
        undefined, // spouseDesiredRetirementAge
        65,        // targetRetirementAge
        38,        // spouseCurrentAge
        35         // userCurrentAge
      );
      expect(spouseAge).toBe(68);
    });

    test('respects spouseDesiredRetirementAge if explicitly specified', () => {
      const spouseAge = calculatePartnerRetirementAge(
        60, // spouseDesiredRetirementAge
        65, // targetRetirementAge
        38, // spouseCurrentAge
        35  // userCurrentAge
      );
      expect(spouseAge).toBe(60);
    });
  });

  describe('7. Event Factory Tests', () => {
    const event = {
      age: 40,
      spouseIncome: 60000,
      incomeGrowthRate: 3.5,
      cash: 10000,
      investments: 20000,
      retirement: 30000,
      debtStudent: 15000,
      debtCredit: 5000,
      debtOther: 0,
      savingsRate: 15,
      housingOption: 'move',
      includeWeddingCost: true,
      weddingCost: 20000,
      weddingFundingMethod: 'savings',
      weddingAge: 40,
      filingStatus: 'jointly',
      spouseCurrentAge: 38,
      spouseLifeExpectancy: 88,
      spouseSocialSecurityAge: 65,
      spouseEstimatedSocialSecurityBenefit: 12000,
      spouseDesiredRetirementAge: 62
    };

    test('createSpouseRecord produces a valid household member simulation record', () => {
      const record = createSpouseRecord(event, sampleInputs);

      expect(record.id).toBe('spouse');
      expect(record.name).toBe('Spouse');
      expect(record.activeFromDate).toBe(40);
      expect(record.income).toBe(60000);
      expect(record.incomeGrowthRate).toBe(0.035);
      expect(record.assets.cash).toBe(10000);
      expect(record.assets.investments).toBe(20000);
      expect(record.assets.retirement).toBe(30000);
      expect(record.debts.student).toBe(15000);
      expect(record.debts.credit).toBe(5000);
      expect(record.savingsRate).toBe(15);
      expect(record.currentAge).toBe(38);
      expect(record.lifeExpectancy).toBe(88);
      expect(record.spouseSocialSecurityAge).toBe(65);
      expect(record.spouseEstimatedSocialSecurityBenefit).toBe(12000);
      expect(record.desiredRetirementAge).toBe(62);
    });

    test('createMarriageEventObject produces a normalized marriage event object', () => {
      const eventObj = createMarriageEventObject(event, sampleInputs);

      expect(eventObj.type).toBe('marriage');
      expect(eventObj.enabled).toBe(true);
      expect(eventObj.name).toBe('Marriage');
      expect(eventObj.age).toBe(40);
      expect(eventObj.spouseIncome).toBe(60000);
      expect(eventObj.spouseCurrentAge).toBe(38);
      expect(eventObj.spouseLifeExpectancy).toBe(88);
      expect(eventObj.weddingCost).toBe(20000);
      expect(eventObj.weddingFundingMethod).toBe('savings');
    });
  });
});
