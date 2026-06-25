// Shared default inputs definition for the FIRE & Life Simulator
export const DEFAULT_FIRE_INPUTS = {
  currentAge: 35,
  targetRetirementAge: 65,
  lifeExpectancy: 85,
  expectedReturn: 7.0,
  postRetirementReturn: 5.0,
  inflationRate: 3.0,
  cashReturnRate: 2.0,
  lifestyleUpgrades: 0.0,
  swr: 4.0,
  includeTaxes: false,
  filingStatus: 'single',
  isAdvancedMode: false, // Simple Mode by default
  readinessCriteria: 'lastsLifeExp',
  enableHealthcareModel: true,
  preMedicarePremium: 10000,
  medicarePremium: 4000,
  simpleIncome: 50000,
  simpleExpenses: 42500,
  simpleInvestments: 5000,
  hasCustomizedSavingsAllocation: false,
  hasCustomizedBudget: false,
  schemaVersion: 1,
  childCosts: {
    ages0to4: 15000,
    ages5to12: 15000,
    ages13to18: 15000,
    ages19to22: 15000,
    includeCollege: false
  },
  assets: {
    cash: 0,
    emergencyFund: 0,
    brokerage: 5000,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    savings529: 0,
    realEstate: 0,
    other: 0,
    debts: 0
  },
  budgetDetails: {
    savings: {
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      brokerage: 625,
      checking: 0,
      hysa: 0,
      emergency: 0,
      debt: 0,
      other: 0
    },
    partnerSavings: {
      trad401k: 0,
      rothIra: 0,
      tradIra: 0,
      hsa: 0,
      brokerage: 0,
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
  incomeList: [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 50000,
      frequency: 'yearly',
      startAge: 35,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ],
  spendingPhases: [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 35,
      endAge: 85,
      amount: 42500,
      frequency: 'yearly',
      annualSpending: 42500,
      inflationOverride: null,
      notes: 'Initial standard living expenses'
    }
  ],
  allocationRules: [
    {
      id: 'alloc-surplus',
      destination: 'brokerage',
      type: 'percentSurplus',
      value: 100,
      frequency: 'yearly',
      priority: 1,
      smartRule: { enabled: false, targetValue: 0, redirectDestination: 'brokerage' }
    }
  ],
  lifeEvents: [
    {
      id: 'ss-1',
      type: 'socialSecurity',
      name: 'Social Security',
      enabled: true,
      claimingAge: 67,
      monthlyBenefit: 2000,
      inflationAdjusted: true,
      ageStartedWorking: 22
    },
    {
      id: 'retire-1',
      type: 'retire',
      name: 'Retirement',
      enabled: true,
      age: 65,
      spendingPercent: 70
    }
  ],
  debtList: [],
  currentConditions: [],
  householdMembers: [],
  houseAssets: [],
  lifeProfile: {
    household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
    home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
    children: [],
    debts: [],
    assets: { cash: 0, emergencyFund: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, savings529: 0, crypto: 0, businessEquity: 0 },
    incomeSources: []
  },
  useLifeProfile: false
};

