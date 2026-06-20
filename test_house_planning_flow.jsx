// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { 
  calculateTotalCashRequired, 
  grossUpIncome,
  calculateMaxAffordableHomePrice
} from './src/domain/housing/houseAffordability.js';
import { houseEventHandler } from './src/features/fire/events/handlers/houseEventHandler.js';
import HousePlanningModal from './src/components/fire-simulator/HousePlanningModal.jsx';

describe('Home Purchase Planning Flow Tests', () => {
  beforeEach(() => {
    cleanup();
  });
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
      const rentToUse = oldHousingCost;
      let mortgageLimit = null;
      if (rentToUse > 0) {
        mortgageLimit = pAndIFractionOfPrice > 0 ? (rentToUse / pAndIFractionOfPrice) : Infinity;
      }

      const rawRecommendedPrice = mortgageLimit == null
        ? cashLimit
        : Math.min(cashLimit, mortgageLimit);
      return Math.floor(Math.max(0, rawRecommendedPrice) / 1000) * 1000;
    }

    // Scenario A: High assets ($500k), Rent = $1500, Rate = 6.5%, Term = 30 yrs, DP = 20%, CC = 3%
    // mortgageLimit should constrain: ~296,000 (1500 / (0.8 * 0.00632068) = 296,647 -> floor to 296,000)
    const priceA = computeCheaperHomePrice({
      liquidAssets: 500000,
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      oldHousingCost: 1500
    });
    expect(priceA).toBe(296000);

    // Scenario B: Low assets ($50k), Rent = $3000, Rate = 6.5%, Term = 30 yrs, DP = 20%, CC = 3%
    // cashLimit should constrain: ~204,000 (floor rounded from 204,347)
    const priceB = computeCheaperHomePrice({
      liquidAssets: 50000,
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      oldHousingCost: 3000
    });
    expect(priceB).toBe(204000);
  });

  test('7. calculateMaxAffordableHomePrice returns correct values and respects constraints', () => {
    const inputs = {
      currentAge: 35,
      assets: { cash: 100000, brokerage: 50000 }
    };
    
    const res = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 2000 } }, {
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      movingCost: 3000
    });
    
    expect(res.cashAffordablePrice).toBeGreaterThan(0);
    expect(res.monthlyAffordablePrice).toBeGreaterThan(0);
    expect(res.recommendedPrice).toBe(Math.min(res.cashAffordablePrice, res.monthlyAffordablePrice));
  });

  test('8. Missing rent returns null for monthlyAffordablePrice and falls back to cashAffordablePrice only', () => {
    const inputs = {
      currentAge: 35,
      assets: { cash: 100000, brokerage: 50000 }
    };
    
    const res = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 0 } }, {
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      movingCost: 3000
    });
    
    expect(res.monthlyAffordablePrice).toBeNull();
    const expectedCashLimit = (150000 - 3000) / 0.23;
    const expectedPrice = Math.floor(expectedCashLimit / 1000) * 1000;
    expect(res.recommendedPrice).toBe(expectedPrice);
    expect(res.recommendedPrice).not.toBe(0);
    expect(res.recommendedPrice).not.toBe(275000);
  });

  test('9. Default price changes when liquid assets change', () => {
    const inputs1 = {
      currentAge: 35,
      assets: { cash: 50000, brokerage: 0 }
    };
    const inputs2 = {
      currentAge: 35,
      assets: { cash: 150000, brokerage: 0 }
    };
    
    const res1 = calculateMaxAffordableHomePrice(inputs1, null, null, { downPaymentPct: 20 });
    const res2 = calculateMaxAffordableHomePrice(inputs2, null, null, { downPaymentPct: 20 });
    
    expect(res1.recommendedPrice).toBeLessThan(res2.recommendedPrice);
  });

  test('10. Default price changes when rent changes', () => {
    const inputs = {
      currentAge: 35,
      assets: { cash: 200000, brokerage: 100000 }
    };
    
    const resLowRent = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 1000 } }, { downPaymentPct: 20 });
    const resHighRent = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 3000 } }, { downPaymentPct: 20 });
    
    expect(resLowRent.recommendedPrice).toBeLessThan(resHighRent.recommendedPrice);
  });

  test('11. suggestedPrice uses selected downPaymentPct, reserves fixed purchase costs, and is separate from monthly limit', () => {
    const inputs = {
      currentAge: 35,
      assets: { cash: 100000, brokerage: 0 }
    };
    
    // cash = 100k, moving = 5k, renovation = 2k. remaining cash = 93k.
    // dp = 10%, closing = 3%. total denominator = 13%.
    // 93,000 / 0.13 = 715,384.6. Floor rounded to nearest 1000 is 715,000.
    const res = calculateMaxAffordableHomePrice(inputs, null, null, {
      downPaymentPct: 10,
      closingCosts: 3,
      movingCost: 5000,
      renovationCost: 2000
    });
    
    expect(res.suggestedPrice).toBe(715000);
  });

  test('12. recommendedPrice is the stricter of suggestedPrice and monthlyAffordablePrice', () => {
    const inputs = {
      currentAge: 35,
      assets: { cash: 100000, brokerage: 0 }
    };
    
    // Suggested price limit is ~421,000 (100k - 3k = 97k / 0.23 = 421.7k)
    // Low rent (1000) monthly limit is ~197,000 (1000 / 0.0050565 = 197.7k)
    const resStricterMonthly = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 1000 } }, {
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      movingCost: 3000
    });
    
    expect(resStricterMonthly.suggestedPrice).toBe(421000);
    expect(resStricterMonthly.monthlyAffordablePrice).toBe(197000);
    expect(resStricterMonthly.recommendedPrice).toBe(197000); // monthly limit is stricter

    // High rent (3000) monthly limit is ~593,000 (3000 / 0.0050565 = 593.2k)
    const resStricterCash = calculateMaxAffordableHomePrice(inputs, null, { expenses: { rent: 3000 } }, {
      downPaymentPct: 20,
      closingCosts: 3,
      mortgageRate: 6.5,
      loanTerm: 30,
      movingCost: 3000
    });
    
    expect(resStricterCash.suggestedPrice).toBe(421000);
    expect(resStricterCash.monthlyAffordablePrice).toBe(593000);
    expect(resStricterCash.recommendedPrice).toBe(421000); // cash limit is stricter
  });

  test('13. Prefills suggestedPrice based on projected liquid assets at default purchaseAge, not currentAge', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, movingCost: 0, movingCosts: 0 },
      handleSaveEvent: () => {},
      handleDeleteEvent: () => {}
    };
    const simulation = {
      nominalData: [
        { age: 34, cashBalance: 5000, brokerageBalance: 0 },
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 50000, brokerageBalance: 0 }
      ]
    };

    render(
      <HousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    const homePriceInput = screen.getByRole('textbox');
    const ageInput = screen.getByRole('spinbutton');

    // Default purchaseAge should be min(85, 35 + 5) = 40.
    expect(ageInput.value).toBe('40');
    // expected suggestedPriceRaw = 50000 (projected at 40, i.e., age 39 balance) / 0.23 = 217391.30
    // Floor rounded to nearest 1000 is 217000
    expect(homePriceInput.value).toBe('217,000');
    expect(homePriceInput.value).not.toBe('5,000');
    // If based on age 35 assets (5000): 5000 / 0.23 = 21739 -> floor rounded is 21000
    expect(homePriceInput.value).not.toBe('21,000');
  });

  test('14. Automatically updates homePrice on age change if untouched, but stays locked once touched', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 5000, brokerage: 0 }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, movingCost: 0, movingCosts: 0 },
      handleSaveEvent: () => {},
      handleDeleteEvent: () => {}
    };
    const simulation = {
      nominalData: [
        { age: 34, cashBalance: 5000, brokerageBalance: 0 },
        { age: 35, cashBalance: 5000, brokerageBalance: 0 },
        { age: 39, cashBalance: 50000, brokerageBalance: 0 },
        { age: 44, cashBalance: 80000, brokerageBalance: 0 }
      ]
    };

    render(
      <HousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    const homePriceInput = screen.getByRole('textbox');
    const ageInput = screen.getByRole('spinbutton');

    // Initially at age 40, suggestedPrice is 217000
    expect(ageInput.value).toBe('40');
    expect(homePriceInput.value).toBe('217,000');

    // Change age to 45 (projected liquid assets at 45 = age 44 balance = 80000)
    // 80000 / 0.23 = 347,826 -> cash suggested price is 347,000, but monthly affordable price is 224,000 (stricter limit)
    fireEvent.change(ageInput, { target: { value: '45' } });
    expect(homePriceInput.value).toBe('224,000');

    // Manually type/touch the homePrice
    fireEvent.change(homePriceInput, { target: { value: '500000' } });
    expect(homePriceInput.value).toBe('500,000');

    // Change age back to 40
    fireEvent.change(ageInput, { target: { value: '40' } });

    // Should remain 500,000 since isPriceTouched is true
    expect(homePriceInput.value).toBe('500,000');
  });

  test('15. Regression test: Recommended price prefill and affordability calculations with rent', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 64515, brokerage: 0 },
        budgetDetails: {
          expenses: {
            housing: 1500
          }
        }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, movingCost: 0, movingCosts: 0 },
      handleSaveEvent: () => {},
      handleDeleteEvent: () => {}
    };
    const simulation = {
      baselineResults: {
        nominalData: [
          { age: 34, cashBalance: 64515, brokerageBalance: 0 },
          { age: 35, cashBalance: 64515, brokerageBalance: 0 },
          { age: 39, cashBalance: 64515, brokerageBalance: 0 }
        ]
      }
    };

    const aff = calculateMaxAffordableHomePrice(
      scenario.inputs,
      null,
      null,
      { ...eventController.editingEvent, purchaseAge: 40, downPaymentPct: 20, closingCosts: 3 },
      simulation
    );

    // Assert suggestedPrice is around 280,000 before fixed costs (64515 / 0.23 = 280,500 -> floor to 280,000)
    expect(aff.suggestedPrice).toBe(280000);
    // Assert monthlyAffordablePrice is far above 8,000 (around 296,000)
    expect(aff.monthlyAffordablePrice).toBe(296000);
    // Assert recommendedPrice is min(suggestedPrice, monthlyAffordablePrice)
    expect(aff.recommendedPrice).toBe(280000);

    render(
      <HousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    const homePriceInput = screen.getByRole('textbox');
    // Step 1 homePrice prefill should equal recommendedPrice
    expect(homePriceInput.value).toBe('280,000');
  });

  test('16. Regression test: Missing rent falls back to suggestedPrice and shows warning', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 64515, brokerage: 0 },
        budgetDetails: {
          expenses: {
            housing: 0 // missing/0 rent
          }
        }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, movingCost: 0, movingCosts: 0 },
      handleSaveEvent: () => {},
      handleDeleteEvent: () => {}
    };
    const simulation = {
      baselineResults: {
        nominalData: [
          { age: 34, cashBalance: 64515, brokerageBalance: 0 },
          { age: 35, cashBalance: 64515, brokerageBalance: 0 },
          { age: 39, cashBalance: 64515, brokerageBalance: 0 }
        ]
      }
    };

    const aff = calculateMaxAffordableHomePrice(
      scenario.inputs,
      null,
      null,
      { ...eventController.editingEvent, purchaseAge: 40, downPaymentPct: 20, closingCosts: 3 },
      simulation
    );

    // monthlyAffordablePrice should be null
    expect(aff.monthlyAffordablePrice).toBeNull();
    // recommendedPrice should equal suggestedPrice
    expect(aff.recommendedPrice).toBe(280000);

    render(
      <HousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    const homePriceInput = screen.getByRole('textbox');
    // Step 1 homePrice prefill should not be 0
    expect(homePriceInput.value).toBe('280,000');

    // Should show rent warning
    expect(screen.getByText(/Rent is not set, so this estimate is based on available cash only/i)).toBeDefined();
  });

  test('17. Changing down payment percentage updates calculated home price in HousePlanningModal', () => {
    const scenario = {
      inputs: {
        currentAge: 35,
        assets: { cash: 64515, brokerage: 0 },
        budgetDetails: {
          expenses: {
            housing: 1500
          }
        }
      }
    };
    const eventController = {
      editingEvent: { type: 'buyHouse', isNew: true, movingCost: 0, movingCosts: 0 },
      handleSaveEvent: () => {},
      handleDeleteEvent: () => {}
    };
    const simulation = {
      baselineResults: {
        nominalData: [
          { age: 34, cashBalance: 64515, brokerageBalance: 0 },
          { age: 35, cashBalance: 64515, brokerageBalance: 0 },
          { age: 39, cashBalance: 64515, brokerageBalance: 0 }
        ]
      }
    };

    render(
      <HousePlanningModal
        scenario={scenario}
        eventController={eventController}
        simulation={simulation}
        onClose={() => {}}
      />
    );

    const homePriceInput = screen.getByRole('textbox');
    // Initial home price (with 20% down payment + 3% closing = 23% denominator): 64515 / 0.23 = 280,500 -> 280,000
    expect(homePriceInput.value).toBe('280,000');

    // Find the down payment select dropdown and change to 10%
    const dpSelect = screen.getByRole('combobox');
    fireEvent.change(dpSelect, { target: { value: '10' } });

    // With 10% down payment, monthly mortgage constraint becomes stricter:
    // 1500 rent / (0.90 * 0.00632068) = 263,680 -> 263,000 (which is stricter than cash limit of 496,000)
    expect(homePriceInput.value).toBe('263,000');
  });
});

