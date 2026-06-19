import { generateDefaultPartnerProfile } from '../../../domain/events/marriage/marriageDefaults.js';

export const EVENT_TYPES = {
  BUY_HOUSE: 'buyHouse',
  SELL_HOUSE: 'sellHouse',
  CHILD: 'haveChild',
  MARRIAGE: 'marriage',
  CAREER_CHANGE: 'careerChange',
  DEBT: 'borrowing',
  COLLEGE: 'college',
  RETIREMENT: 'retire',
  MOVE: 'move',
  CUSTOM: 'custom',
  WINDFALL: 'windfall',
  SABBATICAL: 'sabbatical',
  SOCIAL_SECURITY: 'socialSecurity',
  PENSION: 'pension',
  RENTAL_INCOME: 'rentalIncome',
  ANNUITY: 'annuity',
  OTHER_RETIREMENT_INCOME: 'otherRetirementIncome'
};

export function getDefaultEvent(type, context = {}) {
  const inputs = context.inputs || {};
  const isMobile = context.isMobile || false;
  const curAge = inputs.currentAge || 35;

  let defaults = { type };

  let targetType = type;
  if (type === 'child') targetType = 'haveChild';
  if (type === 'retirement' || type === 'workOptional') targetType = 'retire';
  if (type === 'generic') targetType = 'custom';
  if (type === 'debt') targetType = 'borrowing';

  if (targetType === 'buyHouse') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'buyHouse',
        purchaseAge: Math.min(85, curAge + 5),
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        points: 0,
        pmi: 0.5,
        closingCosts: 3,
        propertyTax: 1.1,
        insurance: 0.35,
        hoa: 0,
        maintenance: 1,
        utilitiesIncrease: 0,
        appreciationRate: 3,
        sellingCost: 6,
        currentRent: 0,
        rentGrowth: 3,
        renterInsurance: 0,
        investmentReturn: 7,
        inflation: 3
      };
    } else {
      defaults = {
        ...defaults,
        type: 'buyHouse',
        purchaseAge: 40,
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        points: 0,
        pmi: 0.5,
        closingCosts: 3,
        propertyTax: 1.1,
        insurance: 0.35,
        hoa: 0,
        maintenance: 1,
        renovationCost: 0,
        utilitiesIncrease: 0,
        appreciationRate: 3,
        sellingCost: 6,
        yearsUntilSale: '',
        currentRent: 0,
        rentGrowth: 3,
        renterInsurance: 0,
        investmentReturn: 7,
        inflation: 3,
        keepRent: false
      };
    }
  } else if (targetType === 'sellHouse') {
    defaults = {
      ...defaults,
      type: 'sellHouse',
      enabled: true,
      name: 'Sell House',
      age: curAge + 10,
      sellingCost: 6,
      proceedsDestination: 'investments'
    };
  } else if (targetType === 'haveChild') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'haveChild',
        childName: 'Child',
        childStartAge: 0,
        birthAge: curAge,
        costMethod: 'default',
        customAges0to4: 15000,
        customAges5to12: 9000,
        customAges13to18: 12000,
        customAges19to22: 20000,
        includeCollege: false
      };
    } else {
      defaults = {
        ...defaults,
        type: 'haveChild',
        childName: '',
        childStartAge: 0,
        birthAge: curAge,
        costMethod: 'default',
        customAges0to4: 15000,
        customAges5to12: 9000,
        customAges13to18: 12000,
        customAges19to22: 20000,
        includeCollege: false
      };
    }
  } else if (targetType === 'careerChange') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'careerChange',
        name: 'Senior Role',
        startAge: Math.min(85, curAge + 3),
        amount: 150000,
        growthRate: 3.5
      };
    } else {
      defaults = {
        ...defaults,
        type: 'careerChange',
        name: 'Senior Manager',
        startAge: 40,
        amount: 150000,
        growthRate: 3.5
      };
    }
  } else if (targetType === 'sabbatical') {
    defaults = {
      ...defaults,
      type: 'sabbatical',
      name: 'Sabbatical',
      startAge: Math.min(85, curAge + 5),
      endAge: Math.min(85, curAge + 6),
      incomeReduction: 100,
      spendingAdjustment: 0
    };
  } else if (targetType === 'move') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'move',
        location: 'New City',
        moveAge: Math.min(85, curAge + 5),
        newSpending: 40000,
        movingCost: 0
      };
    } else {
      defaults = {
        ...defaults,
        type: 'move',
        location: 'Dominican Republic',
        moveAge: 55,
        newSpending: 40000,
        movingCost: 0
      };
    }
  } else if (targetType === 'retire') {
    defaults = {
      ...defaults,
      type: 'retire',
      age: 55,
      spendingPercent: 70
    };
  } else if (targetType === 'windfall') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'windfall',
        ageReceived: Math.min(85, curAge + 10),
        amount: 100000,
        taxRate: 15
      };
    } else {
      defaults = {
        ...defaults,
        type: 'windfall',
        ageReceived: 50,
        amount: 100000,
        taxRate: 15
      };
    }
  } else if (targetType === 'college') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'college',
        startAge: Math.min(85, curAge + 13),
        tuitionCost: 30000,
        duration: 4
      };
    } else {
      defaults = {
        ...defaults,
        type: 'college',
        startAge: 48,
        tuitionCost: 30000,
        duration: 4
      };
    }
  } else if (targetType === 'debtPayoff') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'debtPayoff',
        payoffAge: Math.min(85, curAge + 3),
        amount: 5000
      };
    } else {
      defaults = {
        ...defaults,
        type: 'debtPayoff',
        payoffAge: 38,
        amount: 5000
      };
    }
  } else if (targetType === 'custom') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'custom',
        name: 'Custom Goal',
        age: Math.min(85, curAge + 5),
        amount: -15000
      };
    } else {
      defaults = {
        ...defaults,
        type: 'custom',
        name: 'Custom Event',
        age: 45,
        amount: -15000
      };
    }
  } else if (targetType === 'socialSecurity') {
    defaults = {
      ...defaults,
      type: 'socialSecurity',
      claimingAge: 67,
      monthlyBenefit: 2000,
      inflationAdjusted: true,
      name: 'Social Security',
      ageStartedWorking: 22
    };
  } else if (targetType === 'pension' || targetType === 'rentalIncome') {
    if (isMobile) {
      defaults = {
        ...defaults,
        type: targetType,
        claimingAge: 60,
        monthlyBenefit: 1500,
        inflationAdjusted: true,
        name: targetType === 'pension' ? 'Pension' : 'Rental Income'
      };
    } else {
      defaults = {
        ...defaults,
        type: targetType,
        claimingAge: targetType === 'pension' ? 65 : 60,
        monthlyBenefit: targetType === 'pension' ? 1000 : 1500,
        inflationAdjusted: true,
        name: targetType === 'pension' ? 'Pension' : 'Rental Income'
      };
    }
  } else if (targetType === 'annuity') {
    defaults = {
      ...defaults,
      type: 'annuity',
      claimingAge: 65,
      monthlyBenefit: 500,
      inflationAdjusted: false,
      name: 'Annuity'
    };
  } else if (targetType === 'otherRetirementIncome') {
    defaults = {
      ...defaults,
      type: 'otherRetirementIncome',
      claimingAge: 65,
      monthlyBenefit: 800,
      inflationAdjusted: true,
      name: 'Other Income'
    };
  } else if (targetType === 'marriage') {
    const defaultSpouse = generateDefaultPartnerProfile(inputs, isMobile);
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'marriage',
        age: curAge,
        ...defaultSpouse,
        housingOption: 'move',
        housingSavings: 0,
        housingCost: 0,
        lifestyleOption: 'same',
        lifestyleAdjustment: 0,
        includeWeddingCost: false,
        weddingCost: 20000,
        weddingFundingMethod: 'savings',
        weddingAge: curAge,
        filingStatus: 'jointly'
      };
    } else {
      defaults = {
        ...defaults,
        type: 'marriage',
        age: curAge,
        ...defaultSpouse,
        housingOption: 'move',
        housingSavings: 0,
        housingCost: 0,
        lifestyleOption: 'same',
        lifestyleAdjustment: 0,
        includeWeddingCost: true,
        weddingCost: 20000,
        weddingFundingMethod: 'savings',
        weddingAge: curAge,
        filingStatus: 'jointly',
        wizardStep: 1
      };
    }
  } else if (['studentLoan', 'carLoan', 'personalLoan', 'creditCard'].includes(type) || targetType === 'borrowing') {
    const borrowingType = ['studentLoan', 'carLoan', 'personalLoan', 'creditCard'].includes(type) ? type : 'studentLoan';
    if (isMobile) {
      defaults = {
        ...defaults,
        type: 'borrowing',
        borrowingType,
        startAge: curAge,
        isExisting: true,
        timing: 'current',
        payoffPlanEnabled: true,
        notes: ''
      };
      
      if (borrowingType === 'studentLoan') {
        defaults.name = 'Student Loan';
        defaults.balance = 30000;
        defaults.interestRate = 5.0;
        defaults.minPayment = 318.20;
      } else if (borrowingType === 'carLoan') {
        defaults.name = 'Car Loan';
        defaults.balance = 20000;
        defaults.interestRate = 6.0;
        defaults.isExisting = false;
        defaults.timing = 'future';
        defaults.startAge = curAge + 1;
        defaults.minPayment = 386.66;
      } else if (borrowingType === 'personalLoan') {
        defaults.name = 'Personal Loan';
        defaults.balance = 10000;
        defaults.interestRate = 8.0;
        defaults.minPayment = 313.36;
      } else if (borrowingType === 'creditCard') {
        defaults.name = 'Credit Card';
        defaults.balance = 5000;
        defaults.interestRate = 22.0;
        defaults.minPayment = 100;
      }
    } else {
      defaults = {
        ...defaults,
        type: 'borrowing',
        borrowingType,
        startAge: curAge,
        isExisting: true,
        timing: 'current',
        payoffPlanEnabled: true,
        notes: ''
      };
      
      if (borrowingType === 'studentLoan') {
        defaults.name = 'Student Loan';
        defaults.balance = 30000;
        defaults.interestRate = 5.0;
        defaults.minPayment = 318.20;
      } else if (borrowingType === 'carLoan') {
        defaults.name = 'Car Loan';
        defaults.purchasePrice = 25000;
        defaults.downPayment = 5000;
        defaults.balance = 20000;
        defaults.interestRate = 6.0;
        defaults.isExisting = false;
        defaults.timing = 'future';
        defaults.startAge = curAge + 1;
        defaults.minPayment = 386.66;
      } else if (borrowingType === 'personalLoan') {
        defaults.name = 'Personal Loan';
        defaults.balance = 10000;
        defaults.interestRate = 8.0;
        defaults.minPayment = 313.36;
      } else if (borrowingType === 'creditCard') {
        defaults.name = 'Credit Card Balance';
        defaults.balance = 5000;
        defaults.interestRate = 22.0;
        defaults.minPayment = 100;
      }
    }
  }

  return defaults;
}
