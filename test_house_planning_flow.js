import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  getHousingCostForPrice, 
  grossUpIncome 
} from './src/domain/housing/houseAffordability.js';
import { houseEventHandler } from './src/features/fire/events/handlers/houseEventHandler.js';
import { runFireSimulation } from './src/fireCalculations.js';

describe('Home Purchase Planning Flow Tests', () => {
  test('1. calculateTotalCashRequired correctly calculates downpayment and closing costs', () => {
    const buyHouseEv = {
      homePrice: 500000,
      downPayment: 100000,
      closingCosts: 3,
      points: 0,
      renovationCost: 0,
      movingCosts: 3000
    };
    const totalCash = calculateTotalCashRequired(buyHouseEv);
    // 100,000 + 3% of 500,000 (15,000) + 3,000 = 118,000
    expect(totalCash).toBe(118000);
  });

  test('2. grossUpIncome calculates raise required considering progressive tax brackets', () => {
    // With net raise need of 12,000, and current gross salary of 100,000, filingStatus single:
    const netNeed = 12000;
    const currentGross = 100000;
    const filingStatus = 'single';
    
    const grossRaise = grossUpIncome(netNeed, currentGross, filingStatus);
    
    // Verify grossRaise is larger than netNeed
    expect(grossRaise).toBeGreaterThan(netNeed);
  });

  test('3. Option A Save - sets price to computed affordable price', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    const editingEvent = {
      id: 'house-option-a-test',
      type: 'buyHouse',
      homePrice: 275000,
      downPayment: 55000,
      purchaseAge: 35,
      purchaseType: 'mortgage',
      optionBSelected: false
    };

    const saveResult = houseEventHandler.save(editingEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;
    
    // Verify saved house price and down payment
    const savedAsset = updatedInputs.houseAssets.find(h => h.id === 'house-option-a-test' || h.name === 'Primary Home');
    expect(savedAsset).toBeDefined();
    expect(savedAsset.purchasePrice).toBe(275000);
    expect(savedAsset.downPayment).toBe(55000);

    // Verify NO windfall and NO promotion were created
    const hasWindfall = updatedInputs.lifeEvents.some(e => e.type === 'windfall');
    const hasPromotion = updatedInputs.incomeList?.some(i => i.name === 'Promotion');
    expect(hasWindfall).toBe(false);
    expect(hasPromotion).toBe(false);
  });

  test('4. Option B Save - keeps original price, creates shortfall windfall & raise promotion when needed', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Explicitly set assets so there's a shortfall
    inputs.assets = {
      cash: 20000,
      brokerage: 10000
    }; // Total liquid assets = 30,000
    
    const editingEvent = {
      id: 'house-option-b-test',
      type: 'buyHouse',
      homePrice: 500000,
      downPayment: 100000, // Cash required = 100,000 + 15,000 closing + 3000 moving = 118,000 (shortfall of 88,000)
      purchaseAge: 35,
      purchaseType: 'mortgage',
      optionBSelected: true,
      shortfallAmount: 88000,
      raiseAmount: 12000
    };

    const saveResult = houseEventHandler.save(editingEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;
    
    // Verify saved house price is $500,000
    const savedAsset = updatedInputs.houseAssets.find(h => h.id === 'house-option-b-test' || h.name === 'Primary Home');
    expect(savedAsset).toBeDefined();
    expect(savedAsset.purchasePrice).toBe(500000);

    // Verify windfall is created to cover shortfall
    const windfall = updatedInputs.lifeEvents.find(e => e.type === 'windfall');
    expect(windfall).toBeDefined();
    expect(windfall.amount).toBe(88000);
    expect(windfall.ageReceived).toBe(35);

    // Verify promotion is created
    const promotion = updatedInputs.incomeList.find(i => i.name === 'Promotion');
    expect(promotion).toBeDefined();
    expect(promotion.startAge).toBe(35);
  });

  test('5. Option B Save - does not create windfall or raise if not needed', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    
    // Set high assets to avoid shortfall
    inputs.assets = {
      cash: 200000,
      brokerage: 100000
    }; // Total liquid assets = 300,000 (fully covers 118,000)
    
    const editingEvent = {
      id: 'house-option-b-test-no-needs',
      type: 'buyHouse',
      homePrice: 500000,
      downPayment: 100000,
      purchaseAge: 35,
      purchaseType: 'mortgage',
      optionBSelected: true,
      shortfallAmount: 0,
      raiseAmount: 0
    };

    const saveResult = houseEventHandler.save(editingEvent, inputs);
    const updatedInputs = saveResult.updatedInputs;

    // Verify NO windfall and NO promotion were created because shortfallAmount and raiseAmount are 0
    const windfall = updatedInputs.lifeEvents.find(e => e.type === 'windfall');
    const promotion = updatedInputs.incomeList?.find(i => i.name === 'Promotion');
    expect(windfall).toBeUndefined();
    expect(promotion).toBeUndefined();
  });

  test('6. Cheaper home price calculation mathematically respects cash limits and mortgage constraints', () => {
    // Function duplicating the component logic for testing
    function computeCheaperHomePrice({
      liquidAssets,
      downPaymentPct,
      closingCosts,
      mortgageRate,
      loanTerm,
      oldHousingCost,
      renovationCost = 0,
      movingCost = 3000
    }) {
      const dpPct = downPaymentPct / 100;
      const ccPct = closingCosts / 100;
      
      // 1) Cash limit
      const denominator = dpPct + ccPct;
      let cashLimit = Infinity;
      if (denominator > 0) {
        const fixedCosts = renovationCost + movingCost;
        cashLimit = Math.max(0, (liquidAssets - fixedCosts) / denominator);
      }

      // 2) Mortgage limit
      const rate = mortgageRate / 100;
      const r = rate / 12;
      const n = loanTerm * 12;
      let factor = 0;
      if (n > 0) {
        if (r === 0) {
          factor = 1 / n;
        } else {
          factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        }
      }
      const pAndIFractionOfPrice = (1 - dpPct) * factor;
      const rentToUse = oldHousingCost > 0 ? oldHousingCost : 1500;
      const mortgageLimit = pAndIFractionOfPrice > 0 ? (rentToUse / pAndIFractionOfPrice) : Infinity;

      const maxVal = Math.min(cashLimit, mortgageLimit);
      const rounded = Math.round(Math.max(0, maxVal) / 5000) * 5000;
      if (rounded <= 10000) {
        return 275000;
      }
      return rounded;
    }

    // Scenario A: High assets ($500k), Rent = $1500, Rate = 6.5%, Term = 30 yrs, DP = 20%, CC = 3%
    // mortgageLimit should constrain: ~295,000
    const priceA = computeCheaperHomePrice({
      liquidAssets: 500000,
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      oldHousingCost: 1500
    });
    expect(priceA).toBe(295000);

    // Scenario B: Low assets ($50k), Rent = $3000, Rate = 6.5%, Term = 30 yrs, DP = 20%, CC = 3%
    // cashLimit should constrain: ~205,000
    const priceB = computeCheaperHomePrice({
      liquidAssets: 50000,
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      oldHousingCost: 3000
    });
    expect(priceB).toBe(205000);
  });
});

