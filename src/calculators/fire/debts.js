import { calculateAmortizedLoanPayoffAge as domainCalculateAmortizedLoanPayoffAge } from '../../domain/debt/debtProjection.js';

export const calculateAmortizedLoanPayoffAge = domainCalculateAmortizedLoanPayoffAge;

export function getActiveDebtsForAge(profile, events, age) {
  const currentAge = Number(profile.currentAge) || 35;
  
  let resolvedEvents = events;
  
  if (typeof events === 'number' || typeof events === 'string' || events === undefined) {
    age = events !== undefined ? Number(events) : currentAge;
    resolvedEvents = profile.lifeEvents || [];
  } else if (!Array.isArray(events)) {
    resolvedEvents = profile.lifeEvents || [];
    if (typeof age === 'number' || typeof age === 'string') {
      age = Number(age);
    } else {
      age = currentAge;
    }
  } else {
    age = age !== undefined ? Number(age) : currentAge;
  }
  
  const lifeEvents = resolvedEvents || [];
  const houseAssets = profile.houseAssets || [];
  const debtList = profile.debtList || [];
  const currentConditions = lifeEvents.filter(e => e.type === 'conditionItem') || [];
  
  const activeDebts = [];
  
  // 1. Borrowing Life Events
  const borrowingEvents = lifeEvents.filter(e => e.type === 'borrowing' && e.enabled);
  borrowingEvents.forEach(e => {
    const isExisting = e.timing ? (e.timing === 'current') : (e.isExisting !== false || Number(e.startAge) === currentAge);
    const startAge = isExisting ? currentAge : (e.startAge !== undefined ? Number(e.startAge) : currentAge);
    
    // Find linked payoff plan if any
    const payoffPlan = lifeEvents.find(p => p.type === 'payoffPlan' && p.borrowingId === e.id && p.enabled);
    
    // Monthly payment calculation
    const balance = Number(e.balance) || 0;
    const apr = Number(e.interestRate) || 0;
    const r = apr / 100 / 12;
    
    let monthlyPayment = Number(e.minPayment) || 0;
    
    if (e.borrowingType === 'creditCard') {
      if (payoffPlan) {
        monthlyPayment = (Number(e.minPayment) || 0) + (Number(payoffPlan.extraPayment) || 0);
      }
    } else {
      // Amortized payment if minPayment is 0
      if (monthlyPayment <= 0 && balance > 0) {
        let termYears = 10;
        if (e.borrowingType === 'carLoan') termYears = 5;
        else if (e.borrowingType === 'personalLoan') termYears = 3;
        
        const termMonths = termYears * 12;
        if (r === 0) {
          monthlyPayment = balance / termMonths;
        } else {
          monthlyPayment = (balance * r) / (1 - Math.pow(1 + r, -termMonths));
        }
      }
    }
    
    // Payoff age
    const payoffAge = calculateAmortizedLoanPayoffAge(balance, apr, monthlyPayment, startAge);
    
    if (age >= startAge && age < payoffAge) {
      let icon = '💸';
      if (e.borrowingType === 'creditCard') icon = '💳';
      else if (e.borrowingType === 'studentLoan') icon = '🎓';
      else if (e.borrowingType === 'carLoan') icon = '🚗';
      else if (e.borrowingType === 'personalLoan') icon = '💸';
      
      activeDebts.push({
        id: e.id,
        name: e.name || 'Borrowing',
        type: e.borrowingType,
        monthlyPayment: Math.round(monthlyPayment),
        icon,
        payoffAge
      });
    }
  });
  
  // 2. Custom Debts from currentConditions
  const customDebts = currentConditions.filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0);
  customDebts.forEach(c => {
    const balance = Number(c.value) || 0;
    const apr = Number(c.rate) || 0;
    const monthlyPayment = Number(c.monthlyAmount) || 0;
    const startAge = currentAge;
    
    const payoffAge = c.endAge ? Number(c.endAge) : calculateAmortizedLoanPayoffAge(balance, apr, monthlyPayment, startAge);
    
    if (age >= startAge && age < payoffAge) {
      activeDebts.push({
        id: c.id || `custom-debt-${c.subtype || 'debt'}`,
        name: c.name || c.subtype || 'Debt',
        type: c.subtype || 'debt',
        monthlyPayment: Math.round(monthlyPayment),
        icon: '💸',
        payoffAge
      });
    }
  });
  
  // 3. Base Active Loans (debtList)
  debtList.forEach(d => {
    const balance = Number(d.balance) || 0;
    const apr = Number(d.interestRate) || 0;
    const monthlyPayment = d.frequency === 'monthly' ? (Number(d.payment) || 0) : (Number(d.payment) || 0) / 12;
    const startAge = d.startAge !== undefined ? Number(d.startAge) : currentAge;
    
    const payoffAge = calculateAmortizedLoanPayoffAge(balance, apr, monthlyPayment, startAge);
    
    if (age >= startAge && age < payoffAge) {
      activeDebts.push({
        id: d.id || `debt-list-${d.name}`,
        name: d.name || 'Loan',
        type: 'loan',
        monthlyPayment: Math.round(monthlyPayment),
        icon: '💸',
        payoffAge
      });
    }
  });
  
  // 4. Mortgages (Pre-existing houseAssets and buyHouse events)
  // 4a. Pre-existing house assets
  houseAssets.forEach(h => {
    if (h.hasMortgage && h.mortgage) {
      const balance = Number(h.mortgage.balance) || 0;
      const apr = Number(h.mortgage.rate !== undefined ? h.mortgage.rate : (h.mortgage.interestRate !== undefined ? h.mortgage.interestRate : 6.5));
      const termYears = Number(h.mortgage.term !== undefined ? h.mortgage.term : (h.mortgage.loanTerm !== undefined ? h.mortgage.loanTerm : (h.mortgage.loanTermYears !== undefined ? h.mortgage.loanTermYears : 30)));
      const startAge = currentAge;
      
      let monthlyPayment = Number(h.mortgage.monthlyPayment || h.mortgage.payment) || 0;
      if (monthlyPayment <= 0 && balance > 0) {
        const r = apr / 100 / 12;
        const termMonths = termYears * 12;
        if (r === 0) {
          monthlyPayment = balance / termMonths;
        } else {
          monthlyPayment = (balance * r) / (1 - Math.pow(1 + r, -termMonths));
        }
      }
      
      const payoffAge = startAge + termYears;
      
      // Check if there's a sellHouse event for this house asset
      const sellEv = lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === h.id && e.enabled);
      const endAge = sellEv ? Number(sellEv.age) : payoffAge;
      
      if (age >= startAge && age < endAge) {
        activeDebts.push({
          id: `mortgage-existing-${h.id}`,
          name: `${h.name || 'Home'} Mortgage`,
          type: 'mortgage',
          monthlyPayment: Math.round(monthlyPayment),
          icon: '🏠',
          payoffAge: endAge
        });
      }
    }
  });
  
  // 4b. Future house purchases with mortgages
  const buyHouseEvents = lifeEvents.filter(e => e.type === 'buyHouse' && e.enabled);
  buyHouseEvents.forEach(ev => {
    const asset = (ev.houseId && houseAssets) ? houseAssets.find(h => h.id === ev.houseId) : ev;
    if (!asset) return;
    
    const p = Number(asset.homePrice !== undefined ? asset.homePrice : (asset.purchasePrice !== undefined ? asset.purchasePrice : 0)) || 0;
    const dp = Number(asset.downPayment) || 0;
    const isCash = dp >= p || asset.purchaseType === 'cash';
    
    if (!isCash) {
      const startAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
      const apr = Number(asset.mortgageRate !== undefined ? asset.mortgageRate : 6.5);
      const termYears = Number(asset.loanTerm !== undefined ? asset.loanTerm : (asset.loanTermYears !== undefined ? asset.loanTermYears : 30));
      const loanAmount = p - dp;
      
      let monthlyPayment = 0;
      if (loanAmount > 0 && termYears > 0) {
        const r = apr / 100 / 12;
        const termMonths = termYears * 12;
        if (r === 0) {
          monthlyPayment = loanAmount / termMonths;
        } else {
          monthlyPayment = (loanAmount * r) / (1 - Math.pow(1 + r, -termMonths));
        }
      }
      
      const payoffAge = startAge + termYears;
      
      // Check if there is a sellHouse event for this house
      const sellEv = lifeEvents.find(e => e.type === 'sellHouse' && (e.houseId === ev.id || (ev.houseId && e.houseId === ev.houseId)) && e.enabled);
      const endAge = sellEv ? Number(sellEv.age) : payoffAge;
      
      if (age >= startAge && age < endAge) {
        activeDebts.push({
          id: `mortgage-future-${ev.id}`,
          name: `${ev.name || 'Home'} Mortgage`,
          type: 'mortgage',
          monthlyPayment: Math.round(monthlyPayment),
          icon: '🏠',
          payoffAge: endAge
        });
      }
    }
  });

  // 5. Wedding/Marriage Financed Debt
  const marriageEvents = lifeEvents.filter(e => e.type === 'marriage' && e.enabled && e.includeWeddingCost && ['debt', 'finance', 'financed', 'loan'].includes(e.weddingFundingMethod));
  marriageEvents.forEach(me => {
    const startAge = me.weddingAge !== undefined ? Number(me.weddingAge) : (me.age !== undefined ? Number(me.age) : currentAge);
    
    // Calculate total liquid assets before deduction
    const userAssets = (profile.assets?.cash || 0) + 
                       (profile.assets?.emergencyFund || 0) + 
                       (profile.assets?.brokerage || 0) + 
                       (profile.assets?.trad401k || 0) + 
                       (profile.assets?.tradIra || 0) + 
                       (profile.assets?.rothIra || 0) + 
                       (profile.assets?.hsa || 0) + 
                       (profile.assets?.other || 0);
    const spouseAssets = Number(me.cash || 0) + Number(me.investments || 0) + Number(me.retirement || 0);
    const totalLiquidAssets = userAssets + spouseAssets;
    
    const inflationRateVal = (profile.inflationRate !== undefined ? Number(profile.inflationRate) : 3) / 100;
    const nominalFactor = Math.pow(1 + inflationRateVal, Math.max(0, startAge - currentAge));
    const totalCost = (Number(me.weddingCost) || 0) * nominalFactor;
    
    const isEntire = ['finance', 'financed', 'loan'].includes(me.weddingFundingMethod);
    const financedAmount = isEntire ? totalCost : Math.max(0, totalCost - totalLiquidAssets);
    
    if (financedAmount > 0) {
      const apr = me.weddingInterestRate !== undefined ? Number(me.weddingInterestRate) : 7;
      const timelineYears = me.weddingPayoffTimeline !== undefined ? Number(me.weddingPayoffTimeline) : 10;
      const hasPaymentPlan = me.weddingHasPaymentPlan !== undefined ? !!me.weddingHasPaymentPlan : true;
      
      const r = apr / 100 / 12;
      let monthlyPayment = 0;
      if (hasPaymentPlan) {
        const termMonths = timelineYears * 12;
        if (r === 0) {
          monthlyPayment = financedAmount / termMonths;
        } else {
          monthlyPayment = (financedAmount * r) / (1 - Math.pow(1 + r, -termMonths));
        }
      } else {
        monthlyPayment = financedAmount * 0.01;
      }
      
      const payoffAge = calculateAmortizedLoanPayoffAge(financedAmount, apr, monthlyPayment, startAge);
      
      if (age >= startAge && age < payoffAge) {
        activeDebts.push({
          id: `wedding-debt-${me.id}`,
          name: 'Wedding Debt',
          type: 'weddingDebt',
          monthlyPayment: Math.round(monthlyPayment),
          icon: '💸',
          payoffAge
        });
      }
    }
  });
  
  return activeDebts;
}

export function initializeActiveLoans(profile, currentConditions, currentAge) {
  const customDebts = currentConditions
    .filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0)
    .map(c => ({
      id: c.id || `custom-debt-${Date.now()}`,
      name: c.name || c.subtype || 'Debt',
      balance: Number(c.value) || 0,
      interestRate: (Number(c.rate) || 0) / 100,
      payment: Number(c.monthlyAmount || 0) * 12,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: currentAge,
      endAge: c.endAge ? Number(c.endAge) : null
    }));

  const baseActiveLoans = (profile.debtList || []).map(d => ({
    id: d.id,
    name: d.name || 'Loan',
    balance: Number(d.balance) || 0,
    interestRate: (Number(d.interestRate) || 0) / 100,
    payment: d.frequency === 'monthly' ? (Number(d.payment) || 0) * 12 : (Number(d.payment) || 0),
    extraPayment: d.frequency === 'monthly' ? (Number(d.extraPayment) || 0) * 12 : (Number(d.extraPayment) || 0),
    frequency: d.frequency || 'monthly',
    paydownPlanEnabled: !!d.paydownPlanEnabled,
    startAge: d.startAge !== undefined ? Number(d.startAge) : currentAge
  }));

  // Add borrowing events from profile.lifeEvents
  const borrowingLoans = (profile.lifeEvents || [])
    .filter(e => e.type === 'borrowing' && e.enabled)
    .map(e => {
      const isExisting = e.timing
        ? (e.timing === 'current')
        : (e.isExisting !== false || Number(e.startAge) === currentAge);
      const startAge = isExisting ? currentAge : (e.startAge !== undefined ? Number(e.startAge) : currentAge);

      // Find linked payoff plan if any
      const payoffPlan = (profile.lifeEvents || []).find(p => p.type === 'payoffPlan' && p.borrowingId === e.id && p.enabled);
      const paydownPlanEnabled = !!payoffPlan;
      const extraPayment = payoffPlan ? (Number(payoffPlan.extraPayment) || 0) : 0;

      let payment = (Number(e.minPayment) || 0) * 12;
      
      // Amortized payment for student/car/personal loan if minPayment is 0
      if (payment <= 0 && e.borrowingType !== 'creditCard' && Number(e.balance) > 0) {
        let termYears = 10;
        if (e.borrowingType === 'carLoan') termYears = 5;
        else if (e.borrowingType === 'personalLoan') termYears = 3;
        
        const r = (Number(e.interestRate) || 0) / 100 / 12;
        const balance = Number(e.balance) || 0;
        const termMonths = termYears * 12;
        let monthlyPayment = 0;
        if (r === 0) {
          monthlyPayment = balance / termMonths;
        } else {
          monthlyPayment = (balance * r) / (1 - Math.pow(1 + r, -termMonths));
        }
        payment = monthlyPayment * 12;
      }
      
      // Credit card payoff plan handling: use payoff-plan payment instead of minimum
      let resolvedExtraPayment = extraPayment * 12;
      if (e.borrowingType === 'creditCard' && paydownPlanEnabled) {
        payment = ((Number(e.minPayment) || 0) + extraPayment) * 12;
        resolvedExtraPayment = 0; // Incorporated in main payment
      }

      return {
        id: e.id,
        name: e.name || 'Borrowing',
        startingBalance: Number(e.balance) || 0,
        balance: isExisting ? (Number(e.balance) || 0) : 0,
        interestRate: (Number(e.interestRate) || 0) / 100,
        payment,
        extraPayment: resolvedExtraPayment,
        frequency: 'monthly',
        paydownPlanEnabled,
        startAge,
        isExisting,
        isFutureBorrowing: !isExisting,
        activated: isExisting
      };
    });

  const startingLoans = [...baseActiveLoans, ...customDebts, ...borrowingLoans];
  return startingLoans.map(l => ({
    ...l,
    totalInterestPaid: 0,
    payoffAge: null
  }));
}

export function processYearlyDebtPayments(age, activeLoans, dynamicMilestones) {
  let annualMinPayments = 0;
  let annualExtraPayments = 0;
  let annualInterestPaid = 0;

  activeLoans.forEach(loan => {
    if (loan.balance > 0) {
      const interest = loan.balance * loan.interestRate;
      loan.totalInterestPaid = (loan.totalInterestPaid || 0) + interest;
      annualInterestPaid += interest;

      let minPayment = loan.payment;
      let extraPayment = 0;
      if (loan.paydownPlanEnabled && age >= loan.startAge) {
        extraPayment = loan.extraPayment;
      }

      let totalDue = loan.balance + interest;
      let actualPaidMin = 0;
      let actualPaidExtra = 0;

      if (totalDue <= minPayment) {
        actualPaidMin = totalDue;
        loan.balance = 0;
        loan.payoffAge = age;
        dynamicMilestones.push({
          age,
          label: `${loan.name} Paid Off`,
          type: 'debtPayoff',
          isMilestone: true
        });
      } else {
        actualPaidMin = minPayment;
        let remainingDue = totalDue - minPayment;
        if (remainingDue <= extraPayment) {
          actualPaidExtra = remainingDue;
          loan.balance = 0;
          loan.payoffAge = age;
          dynamicMilestones.push({
            age,
            label: `${loan.name} Paid Off`,
            type: 'debtPayoff',
            isMilestone: true
          });
        } else {
          actualPaidExtra = extraPayment;
          loan.balance = remainingDue - extraPayment;
        }
      }

      annualMinPayments += actualPaidMin;
      annualExtraPayments += actualPaidExtra;
    }
  });

  return {
    annualMinPayments,
    annualExtraPayments,
    annualInterestPaid
  };
}
