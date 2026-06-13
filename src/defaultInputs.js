// Shared default inputs definition for the FIRE & Life Simulator
export const DEFAULT_FIRE_INPUTS = {
  currentAge: 35,
  targetRetirementAge: 65,
  lifeExpectancy: 85,
  expectedReturn: 7.0,
  postRetirementReturn: 5.0,
  inflationRate: 3.0,
  lifestyleUpgrades: 0.0,
  swr: 4.0,
  fireMode: 'traditional',
  includeTaxes: false,
  filingStatus: 'single',
  isAdvancedMode: false, // Simple Mode by default
  readinessCriteria: 'lastsComfortable',
  enableHealthcareModel: true,
  preMedicarePremium: 10000,
  medicarePremium: 4000,
  simpleIncome: 50000,
  simpleExpenses: 42500,
  simpleInvestments: 5000,
  assets: {
    cash: 0,
    emergencyFund: 0,
    brokerage: 5000,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    realEstate: 0,
    other: 0,
    debts: 0
  },
  budgetDetails: {
    savings: {
      trad401k: 100,
      rothIra: 50,
      tradIra: 0,
      hsa: 50,
      brokerage: 0,
      checking: 50,
      hysa: 50,
      emergency: 26,
      debt: 0,
      other: 0
    },
    expenses: {
      housing: 1500,
      utilities: 300,
      food: 600,
      transportation: 400,
      healthcare: 300,
      leisure: 300,
      misc: 141
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
      id: 'alloc-1',
      destination: 'brokerage',
      type: 'percentSurplus',
      value: 100,
      frequency: 'yearly',
      priority: 1,
      smartRule: {
        enabled: false,
        targetValue: 0,
        redirectDestination: 'brokerage'
      }
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
      inflationAdjusted: true
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
  debtList: []
};
