import { normalizeSocialSecurityEvent } from './socialSecurity.js';

const parseNum = (val, defaultVal) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
};

export function getProfileFromInputs(inputs) {
  const currentAge = Math.max(0, Number(inputs.currentAge) || 30);
  const lifeExpectancy = Math.max(currentAge + 1, Number(inputs.lifeExpectancy) || 85);
  const retireEvent = (inputs.lifeEvents || []).find(e => e.type === 'retire' && e.enabled);
  const targetRetirementAge = retireEvent 
    ? Math.max(currentAge, Number(retireEvent.age) || 65) 
    : lifeExpectancy;

  let hasCustomizedSavingsAllocation = inputs.hasCustomizedSavingsAllocation;
  if (hasCustomizedSavingsAllocation === undefined) {
    hasCustomizedSavingsAllocation = false;
  }

  const accountReturnOverrides = {};
  if (inputs.lifePlan && inputs.lifePlan.objects) {
    inputs.lifePlan.objects
      .filter(o => o.type === 'account')
      .forEach(acc => {
        const type = acc.properties?.accountType || 'brokerage';
        const override = acc.properties?.expectedReturnOverride;
        if (override !== undefined && override !== null && override !== '') {
          accountReturnOverrides[type] = Number(override) / 100;
        }
      });
  }

  return {
    useLifeProfile: !!inputs.useLifeProfile,
    currentAge,
    lifeExpectancy,
    targetRetirementAge,
    hasCustomizedSavingsAllocation,
    hasCustomizedBudget: !!inputs.hasCustomizedBudget,
    expectedReturn: Math.min(0.25, Math.max(0, parseNum(inputs.expectedReturn, 7) / 100)),
    postRetirementReturn: Math.min(0.15, Math.max(0, inputs.postRetirementReturn !== undefined
      ? parseNum(inputs.postRetirementReturn, 0) / 100
      : parseNum(inputs.expectedReturn, 7) / 100)),
    inflationRate: Math.min(0.20, Math.max(0, parseNum(inputs.inflationRate, 3) / 100)),
    cashReturnRate: parseNum(inputs.cashReturnRate, 2) / 100,
    lifestyleUpgrades: parseNum(inputs.lifestyleUpgrades, 0) / 100,
    swr: parseNum(inputs.swr, 4) / 100,
    includeTaxes: !!inputs.includeTaxes,
    filingStatus: inputs.filingStatus || 'single',
    preTaxSavingsRate: inputs.preTaxSavingsRate,
    enableHealthcareModel: inputs.enableHealthcareModel !== false,
    preMedicarePremium: parseNum(inputs.preMedicarePremium, 10000),
    medicarePremium: parseNum(inputs.medicarePremium, 4000),
    simpleIncome: parseNum(inputs.simpleIncome, 50000),
    simpleExpenses: parseNum(inputs.simpleExpenses, 42500),
    simpleInvestments: parseNum(inputs.simpleInvestments, 5000),
    childCosts: inputs.childCosts || { ages0to4: 15000, ages5to12: 15000, ages13to18: 15000, ages19to22: 15000, includeCollege: false },
    assets: inputs.assets || {},
    budgetDetails: inputs.budgetDetails || {},
    skipReadyAgeSearch: inputs.skipReadyAgeSearch,
    readinessCriteria: 'lastsLifeExp',
    allocationRules: inputs.allocationRules || [],
    debtList: inputs.debtList || [],
    houseAssets: inputs.houseAssets || [],
    isAdvancedMode: inputs.isAdvancedMode === true || (inputs.allocationRules && inputs.allocationRules.length > 1),
    useLifeProfile: inputs.useLifeProfile,
    accountReturnOverrides,
    lifeEvents: (inputs.lifeEvents || []).map(e => {
      const cloned = e.type === 'socialSecurity' ? normalizeSocialSecurityEvent(e, inputs) : { ...e };
      if (cloned.growthRate !== undefined) {
        cloned.growthRate = Math.min(0.25, Math.max(0, Number(cloned.growthRate) || 0));
      }
      return cloned;
    })
  };
}

export function getEventsFromInputs(inputs) {
  const events = [];

  // 1. Standard lifeEvents
  if (inputs.lifeEvents) {
    inputs.lifeEvents.forEach(e => {
      if (e.type === 'socialSecurity') {
        events.push(normalizeSocialSecurityEvent(e, inputs));
      } else {
        events.push({ ...e });
      }
    });
  }

  // 2. Household spouse
  if (inputs.householdMembers) {
    inputs.householdMembers.forEach(m => {
      if (m.id === 'spouse') {
        events.push({
          type: 'spouseMember',
          ...m
        });
      }
    });
  }

  // 3. Income list items (career change, child boosts)
  if (inputs.incomeList) {
    inputs.incomeList.forEach(inc => {
      events.push({
        ...inc,
        type: 'incomeItem'
      });
    });
  }

  // 4. Spending phases (moves, lifestyle changes)
  if (inputs.spendingPhases) {
    inputs.spendingPhases.forEach(sp => {
      events.push({
        type: 'spendingItem',
        ...sp
      });
    });
  }

  // 5. Debt list
  if (inputs.debtList) {
    inputs.debtList.forEach(d => {
      events.push({
        type: 'debtItem',
        ...d
      });
    });
  }

  // 6. Current conditions
  if (inputs.currentConditions) {
    inputs.currentConditions.forEach(c => {
      events.push({
        type: 'conditionItem',
        ...c
      });
    });
  }

  return events;
}

export function validateFireInputs(inputs) {
  const errors = [];
  const warnings = [];

  const currentAge = Number(inputs.currentAge);
  const targetRetirementAge = inputs.targetRetirementAge ? Number(inputs.targetRetirementAge) : null;
  const lifeExpectancy = Number(inputs.lifeExpectancy);
  const expectedReturn = Number(inputs.expectedReturn);
  const inflationRate = Number(inputs.inflationRate);
  const swr = Number(inputs.swr);

  // Validation Rules
  if (isNaN(currentAge) || currentAge < 0) {
    errors.push("Current age cannot be negative.");
  }
  if (targetRetirementAge !== null && targetRetirementAge < currentAge) {
    errors.push("Target retirement age cannot be lower than your current age.");
  }
  if (isNaN(lifeExpectancy) || lifeExpectancy <= currentAge) {
    errors.push("Life expectancy must be greater than your current age.");
  }
  if (isNaN(swr) || swr <= 0) {
    errors.push("Safe withdrawal rate must be greater than 0%.");
  }
  const lifestyleUpgrades = Number(inputs.lifestyleUpgrades);
  if (isNaN(lifestyleUpgrades) || lifestyleUpgrades < 0) {
    errors.push("Lifestyle upgrades rate cannot be negative.");
  }

  // Warnings
  if (expectedReturn < inflationRate) {
    warnings.push("Your expected investment return is lower than the inflation rate. This means your investments will lose purchasing power over time.");
  }

  const postRetirementReturn = inputs.postRetirementReturn !== undefined ? Number(inputs.postRetirementReturn) : expectedReturn;
  if (postRetirementReturn < inflationRate) {
    warnings.push("Your post-retirement expected return rate is lower than the inflation rate. This means your investments will lose purchasing power in retirement.");
  }

  if (Number(inputs.currentExpenses) > Number(inputs.currentIncome)) {
    warnings.push("Your current annual expenses exceed your current annual income. This indicates deficit spending and will drain your portfolio unless you adjust your plan.");
  }

  const incomeList = inputs.incomeList || [];
  const spendingPhases = inputs.spendingPhases || [];
  const debtList = inputs.debtList || [];
  const lifeEvents = inputs.lifeEvents || [];

  incomeList.forEach((inc, i) => {
    if (inc.endAge < inc.startAge) {
      errors.push(`Income Phase #${i+1} ("${inc.name}") has an end age (${inc.endAge}) that is earlier than its start age (${inc.startAge}).`);
    }
  });

  spendingPhases.forEach((p, i) => {
    if (p.endAge < p.startAge) {
      errors.push(`Spending Phase #${i+1} ("${p.name}") has an end age (${p.endAge}) that is earlier than its start age (${p.startAge}).`);
    }
  });

  debtList.forEach((debt, i) => {
    if (debt.balance < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative balance.`);
    }
    if (debt.payment < 0) {
      errors.push(`Debt entry #${i+1} ("${debt.name}") cannot have a negative payment.`);
    }
  });

  // Verify life events
  lifeEvents.forEach((ev, i) => {
    if (ev.type === 'buyHouse' && ev.enabled) {
      const purchaseAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
      if (purchaseAge < currentAge) {
        errors.push(`Home Purchase age (${purchaseAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'sellHouse' && ev.enabled) {
      const saleAge = Number(ev.age);
      if (saleAge < currentAge) {
        errors.push(`Home Sale age (${saleAge}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'haveChild' && ev.enabled) {
      const birthAge = Number(ev.birthAge);
      const childStartAge = Number(ev.childStartAge || 0);
      if (birthAge < currentAge && childStartAge === 0) {
        errors.push(`Child birth age (${birthAge}) for event #${i+1} cannot be in the past unless the child is already born.`);
      }
    }
    if (ev.type === 'sabbatical' && ev.enabled) {
      const start = Number(ev.startAge);
      const end = Number(ev.endAge);
      if (end < start) {
        errors.push(`Sabbatical end age (${end}) for event #${i+1} cannot be earlier than start age (${start}).`);
      }
    }
    if (ev.type === 'college' && ev.enabled) {
      const start = Number(ev.startAge);
      if (start < currentAge) {
        errors.push(`College start age (${start}) for event #${i+1} cannot be in the past.`);
      }
    }
    if (ev.type === 'borrowing' && ev.enabled) {
      const balance = Number(ev.balance);
      const interestRate = Number(ev.interestRate);
      const minPayment = Number(ev.minPayment);
      if (balance < 0) {
        errors.push(`Borrowing "${ev.name}" cannot have a negative balance.`);
      }
      if (interestRate < 0) {
        errors.push(`Borrowing "${ev.name}" cannot have a negative interest rate.`);
      }
      if (minPayment < 0) {
        errors.push(`Borrowing "${ev.name}" cannot have a negative minimum payment.`);
      }

      const timing = ev.timing || (ev.isExisting !== false || Number(ev.startAge) === currentAge ? 'current' : 'future');
      const startAge = Number(ev.startAge);
      if (timing === 'future' && startAge <= currentAge) {
        errors.push(`Future borrowing "${ev.name}" start age (${startAge}) must be greater than your current age (${currentAge}).`);
      }
    }
  });

  return {
    errors,
    warnings
  };
}
