/**
 * Retirement Profile Definition and Templates
 * Represents a person's complete financial and retirement planning profile.
 */

/**
 * @typedef {Object} AssetBalances
 * @property {number} checking - Cash/checking balances.
 * @property {number} emergencyFund - High-yield savings/emergency fund.
 * @property {number} brokerage - Taxable brokerage investment account.
 * @property {number} traditional401k - Pre-tax traditional 401(k).
 * @property {number} traditionalIRA - Pre-tax traditional IRA.
 * @property {number} rothIRA - Post-tax Roth IRA.
 * @property {number} hsa - Health Savings Account.
 * @property {number} realEstate - Real estate equity / property value.
 * @property {number} otherAssets - Other non-liquid assets.
 * @property {number} debts - Liability/debts (optional starting point, active debts tracked via debtList).
 */

/**
 * @typedef {Object} BudgetSavings
 * @property {number} traditional401k - Monthly Traditional 401(k) contributions.
 * @property {number} rothIRA - Monthly Roth IRA contributions.
 * @property {number} traditionalIRA - Monthly Traditional IRA contributions.
 * @property {number} hsa - Monthly HSA contributions.
 * @property {number} brokerage - Monthly taxable brokerage savings.
 * @property {number} checking - Monthly cash/checking allocation.
 * @property {number} highYieldSavings - Monthly high-yield savings allocation.
 * @property {number} emergencyFund - Monthly emergency fund savings.
 * @property {number} debtPaydown - Monthly additional debt payments.
 * @property {number} other - Monthly other savings/investing.
 */

/**
 * @typedef {Object} BudgetExpenses
 * @property {number} housing - Monthly housing expense (rent/mortgage).
 * @property {number} utilities - Monthly utilities (power, internet, gas).
 * @property {number} food - Monthly food / grocery / dining.
 * @property {number} transportation - Monthly auto / gas / transit.
 * @property {number} healthcare - Monthly health / dental / vision insurance and copays.
 * @property {number} leisure - Monthly entertainment / travel / shopping.
 * @property {number} miscellaneous - Monthly buffer / other expenses.
 */

/**
 * @typedef {Object} BudgetDetails
 * @property {BudgetSavings} savings - Monthly savings distribution.
 * @property {BudgetExpenses} expenses - Monthly expense distribution.
 */

/**
 * @typedef {Object} AllocationRule
 * @property {string} id - Unique rule identifier.
 * @property {string} destination - Target asset category for surplus (e.g., 'brokerage').
 * @property {string} type - Allocation type (e.g., 'percentSurplus').
 * @property {number} value - Percentage of surplus to allocate (e.g., 100).
 * @property {string} frequency - Execution frequency ('yearly' or 'monthly').
 * @property {number} priority - Application priority (lower numbers run first).
 * @property {Object} smartRule - Redirect rules if threshold is met.
 * @property {boolean} smartRule.enabled - Whether redirect is enabled.
 * @property {number} smartRule.targetValue - Threshold to trigger redirect.
 * @property {string} smartRule.redirectDestination - Alternative target destination.
 */

/**
 * @typedef {Object} IncomeStream
 * @property {string} id - Unique identifier.
 * @property {string} name - Source name.
 * @property {number} amount - Annual gross income amount.
 * @property {string} frequency - Frequency of payout ('yearly' or 'monthly').
 * @property {number} startAge - Starting age.
 * @property {number} endAge - Stopping age.
 * @property {number} growthRate - Yearly growth rate (e.g., 0.03 for 3%).
 * @property {boolean} isTaxable - Whether income is subject to income tax.
 */

/**
 * @typedef {Object} SpendingPhase
 * @property {string} id - Unique identifier.
 * @property {string} name - Phase name.
 * @property {number} startAge - Starting age.
 * @property {number} endAge - Stopping age.
 * @property {number} amount - Spending amount.
 * @property {string} frequency - Frequency of spending ('yearly' or 'monthly').
 * @property {number} annualSpending - Annualized spending amount.
 * @property {number|null} [inflationOverride] - Custom inflation rate or null.
 * @property {string} [notes] - Additional context.
 */

/**
 * @typedef {Object} LifeEvent
 * @property {string} id - Unique identifier.
 * @property {string} type - Event type (e.g. 'socialSecurity', 'retire', 'haveChild').
 * @property {string} name - Display name.
 * @property {boolean} enabled - Whether event is included in the active run.
 * @property {number} [claimingAge] - Social Security claim age (62-70).
 * @property {number} [monthlyBenefit] - Social Security monthly payout.
 * @property {boolean} [inflationAdjusted] - If benefit adjusts with CPI inflation.
 * @property {number} [age] - Age event takes place (e.g., retirement).
 * @property {number} [spendingPercent] - Retirement spending as % of pre-retirement.
 * @property {number} [birthAge] - Parent's age when child was born.
 * @property {number} [childStartAge] - Child's age at simulation start.
 * @property {string} [costMethod] - Childcost method ('default' or 'custom').
 * @property {boolean} [includeCollege] - Whether college costs are included.
 */

/**
 * @typedef {Object} RetirementProfile
 * @property {number} currentAge - Current age of the person.
 * @property {number} targetRetirementAge - Planned retirement age.
 * @property {number} lifeExpectancy - Life expectancy.
 * @property {number} expectedReturn - Pre-retirement investment return rate (%).
 * @property {number} postRetirementReturn - Post-retirement investment return rate (%).
 * @property {number} inflationRate - Annual inflation rate (%).
 * @property {number} lifestyleUpgrades - Lifestyle upgrade rate (%).
 * @property {number} swr - Safe withdrawal rate (%).
 * @property {boolean} includeTaxes - Whether tax simulations are active.
 * @property {string} filingStatus - Tax filing status ('single' or 'married').
 * @property {boolean} isAdvancedMode - If advanced mode calculations are enabled.
 * @property {string} readinessCriteria - Metric for FI ready ('lastsComfortable', 'lastsLifeExp').
 * @property {boolean} enableHealthcareModel - Whether healthcare premium overrides are active.
 * @property {number} preMedicarePremium - Annual healthcare premium cost before Medicare eligibility.
 * @property {number} medicarePremium - Annual healthcare premium cost under Medicare.
 * @property {number} simpleIncome - Current annual salary (simple mode).
 * @property {number} simpleExpenses - Current annual expenses (simple mode).
 * @property {number} simpleInvestments - Current annual investments (simple mode).
 * @property {Object} childCosts - Child cost brackets (in today's dollars).
 * @property {number} childCosts.ages0to4 - Cost per child per year for age 0-4.
 * @property {number} childCosts.ages5to12 - Cost per child per year for age 5-12.
 * @property {number} childCosts.ages13to18 - Cost per child per year for age 13-18.
 * @property {number} childCosts.ages19to22 - Cost per child per year for age 19-22.
 * @property {boolean} childCosts.includeCollege - Whether college costs are active.
 * @property {AssetBalances} assets - Starting balances for different asset classes.
 * @property {BudgetDetails} budgetDetails - Broken down monthly budget items.
 * @property {IncomeStream[]} incomeList - Collection of active income streams.
 * @property {SpendingPhase[]} spendingPhases - Collection of spending phases.
 * @property {AllocationRule[]} allocationRules - Surplus redirection logic.
 * @property {LifeEvent[]} lifeEvents - Milestones, SS claims, retirement, or child events.
 * @property {Array} debtList - Active debts and loan schedules.
 * @property {Array} currentConditions - Custom current conditions or asset overrides.
 */

/**
 * Factory to create a clean, fully populated RetirementProfile object.
 * 
 * @param {Partial<RetirementProfile>} [overrides] - Custom fields to override the default profile
 * @returns {RetirementProfile} A fully formed retirement profile
 */
export function createRetirementProfile(overrides = {}) {
  const defaults = {
    currentAge: 35,
    targetRetirementAge: 65,
    lifeExpectancy: 85,
    expectedReturn: 7.0,
    postRetirementReturn: 5.0,
    inflationRate: 3.0,
    lifestyleUpgrades: 0.0,
    swr: 4.0,
    includeTaxes: false,
    filingStatus: 'single',
    isAdvancedMode: false,
    readinessCriteria: 'lastsComfortable',
    enableHealthcareModel: true,
    preMedicarePremium: 10000,
    medicarePremium: 4000,
    simpleIncome: 50000,
    simpleExpenses: 42500,
    simpleInvestments: 5000,
    childCosts: {
      ages0to4: 15000,
      ages5to12: 15000,
      ages13to18: 15000,
      ages19to22: 15000,
      includeCollege: false
    },
    assets: {
      checking: 0,
      emergencyFund: 0,
      brokerage: 5000,
      traditional401k: 0,
      traditionalIRA: 0,
      rothIRA: 0,
      hsa: 0,
      realEstate: 0,
      otherAssets: 0,
      debts: 0
    },
    budgetDetails: {
      savings: {
        traditional401k: 200,
        rothIRA: 100,
        traditionalIRA: 0,
        hsa: 50,
        brokerage: 0,
        checking: 100,
        highYieldSavings: 100,
        emergencyFund: 75,
        debtPaydown: 0,
        other: 0
      },
      expenses: {
        housing: 1500,
        utilities: 300,
        food: 600,
        transportation: 400,
        healthcare: 300,
        leisure: 300,
        miscellaneous: 142
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
    debtList: [],
    currentConditions: [],
    houseAssets: []
  };

  // Deep clone and merge overrides
  const profile = JSON.parse(JSON.stringify(defaults));
  
  Object.keys(overrides).forEach(key => {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      profile[key] = { ...profile[key], ...overrides[key] };
    } else {
      profile[key] = overrides[key] !== undefined ? overrides[key] : profile[key];
    }
  });

  return profile;
}

/**
 * The canonical default childless retirement profile configuration.
 * Used as the baseline for FIRE calculations and regression tests.
 */
export const DEFAULT_CHILDLESS_RETIREMENT_PROFILE = createRetirementProfile();
