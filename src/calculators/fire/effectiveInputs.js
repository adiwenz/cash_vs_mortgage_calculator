export function buildEffectiveSimulationInputs(inputs) {
  if (!inputs) return inputs;

  // 1. Deep clone the inputs
  const effective = JSON.parse(JSON.stringify(inputs));

  if (!effective.useLifeProfile || !effective.lifeProfile) {
    return effective;
  }

  const profile = effective.lifeProfile;
  const currentAge = Math.max(0, Number(effective.currentAge) || 35);

  // Ensure lists exist
  effective.householdMembers = effective.householdMembers || [];
  effective.houseAssets = effective.houseAssets || [];
  effective.debtList = effective.debtList || [];
  effective.incomeList = effective.incomeList || [];
  effective.lifeEvents = effective.lifeEvents || [];
  effective.assets = effective.assets || {};

  // 2. Assets mapping
  const ass = profile.assets || {};
  effective.assets = {
    ...effective.assets,
    cash: Number(ass.cash || 0),
    brokerage: Number(ass.brokerage || 0),
    trad401k: Number(ass.trad401k || 0),
    tradIra: Number(ass.tradIra || 0),
    rothIra: Number(ass.rothIra || 0),
    hsa: Number(ass.hsa || 0),
    other: Number(ass.crypto || 0) + Number(ass.businessEquity || 0)
  };

  // Sum up invested assets for simpleInvestments
  const totalAssets = Object.values(effective.assets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  effective.simpleInvestments = totalAssets;

  // 3. Household & Marriage Status
  const household = profile.household || {};
  if (household.status === 'married' || household.status === 'partnered') {
    effective.filingStatus = 'married';

    // Add spouse member to householdMembers
    const hasSpouse = effective.householdMembers.some(m => m.id === 'spouse');
    if (!hasSpouse) {
      effective.householdMembers.push({
        id: 'spouse',
        name: 'Spouse',
        activeFromDate: currentAge,
        activeUntilDate: null,
        income: Number(household.partnerIncome || 0),
        incomeGrowthRate: 0.03,
        assets: {
          cash: 0,
          investments: Number(household.partnerSavings || 0),
          retirement: Number(household.partnerRetirement || 0)
        },
        debts: {
          student: 0,
          credit: 0,
          other: Number(household.partnerDebts || 0)
        },
        savingsRate: 0,
        currentAge: currentAge,
        lifeExpectancy: Number(effective.lifeExpectancy || 85),
        spouseSocialSecurityAge: 67,
        spouseEstimatedSocialSecurityBenefit: 0,
        spouseDesiredRetirementAge: null,
        desiredRetirementAge: null,
        partnerRetiresWithUser: true,
        retirementSpendingNeed: 0,
        growthRate: 3,
        combinedSpendingAfterMarriage: 0,
        housingCost: 0,
        lifestyleAdjustment: 0
      });
    }

    // Add derived marriage event today so the simulation treats them as married
    const hasMarriageEvent = effective.lifeEvents.some(e => e.type === 'marriage');
    if (!hasMarriageEvent) {
      effective.lifeEvents.push({
        id: 'derived-marriage',
        type: 'marriage',
        enabled: true,
        name: 'Marriage',
        age: currentAge,
        spouseIncome: Number(household.partnerIncome || 0),
        incomeGrowthRate: 3,
        spouseCurrentAge: currentAge,
        spouseLifeExpectancy: Number(effective.lifeExpectancy || 85),
        isDerived: true
      });
    }
  }

  // 4. Home Status & Mortgage
  const home = profile.home || {};
  if (home.status === 'own') {
    // 4a. Update realEstate asset to homeValue
    effective.assets.realEstate = Number(home.homeValue || 0);

    // 4b. Add mortgage to debtList if balance > 0
    if (Number(home.mortgageBalance || 0) > 0) {
      const hasMortgage = effective.debtList.some(d => d.id === 'derived-mortgage');
      if (!hasMortgage) {
        effective.debtList.push({
          id: 'derived-mortgage',
          name: 'Home Mortgage',
          balance: Number(home.mortgageBalance || 0),
          interestRate: 6.5, // default
          payment: Number(home.monthlyPayment || 0),
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: currentAge,
          isDerived: true
        });
      }
    }

    // 4c. Set monthly housing expenses in budget (Property Tax + Insurance + HOA)
    const monthlyPropTax = Number(home.propertyTaxes || 0) / 12;
    const monthlyIns = Number(home.insurance || 0) / 12;
    const monthlyHoa = Number(home.hoa || 0);
    const nonMortgageHousingCost = monthlyPropTax + monthlyIns + monthlyHoa;

    effective.budgetDetails = effective.budgetDetails || {};
    effective.budgetDetails.expenses = effective.budgetDetails.expenses || {};
    effective.budgetDetails.expenses.housing = Math.round(nonMortgageHousingCost);
  } else {
    // Renter: Rent is set directly as housing expense
    effective.budgetDetails = effective.budgetDetails || {};
    effective.budgetDetails.expenses = effective.budgetDetails.expenses || {};
    effective.budgetDetails.expenses.housing = Math.round(Number(home.monthlyRent || 0));
  }

  // 5. Children mapping to haveChild lifeEvents
  if (profile.children && Array.isArray(profile.children)) {
    profile.children.forEach((child, index) => {
      const childAge = Number(child.age || 0);
      const birthAge = currentAge - childAge;
      const childId = child.id || `derived-child-${index}`;
      
      const hasChildEvent = effective.lifeEvents.some(e => e.id === childId);
      if (!hasChildEvent) {
        effective.lifeEvents.push({
          id: childId,
          type: 'haveChild',
          enabled: true,
          name: `Child: ${child.name || `Child ${index + 1}`}`,
          birthAge: birthAge,
          age: birthAge,
          childStartAge: childAge,
          includeCollege: !!child.includeCollege,
          isDerived: true
        });
      }
    });
  }

  // 6. Additional Debts mapping to debtList
  if (profile.debts && Array.isArray(profile.debts)) {
    profile.debts.forEach((debt, index) => {
      const debtId = debt.id || `derived-debt-${index}`;
      const hasDebt = effective.debtList.some(d => d.id === debtId);
      if (!hasDebt) {
        effective.debtList.push({
          id: debtId,
          name: debt.name || `Debt ${index + 1}`,
          balance: Number(debt.balance || 0),
          interestRate: Number(debt.interestRate || 0),
          payment: Number(debt.monthlyPayment || 0),
          frequency: 'monthly',
          paydownPlanEnabled: false,
          startAge: currentAge,
          isDerived: true
        });
      }
    });
  }

  // 7. Income Sources mapping to incomeList
  if (profile.incomeSources && Array.isArray(profile.incomeSources)) {
    profile.incomeSources.forEach((inc, index) => {
      const incId = inc.id || `derived-income-${index}`;
      const hasIncome = effective.incomeList.some(i => i.id === incId);
      if (!hasIncome) {
        effective.incomeList.push({
          id: incId,
          name: inc.name || `Income ${index + 1}`,
          amount: Number(inc.amount || 0),
          frequency: 'yearly',
          startAge: Number(inc.startAge !== undefined ? inc.startAge : currentAge),
          endAge: Number(inc.endAge !== undefined ? inc.endAge : effective.targetRetirementAge),
          growthRate: Number(inc.growthRate !== undefined ? inc.growthRate : 3) / 100,
          isTaxable: inc.isTaxable !== false,
          isDerived: true
        });
      }
    });
  }

  return effective;
}
