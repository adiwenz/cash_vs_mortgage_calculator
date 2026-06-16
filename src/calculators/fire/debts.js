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

      return {
        id: e.id,
        name: e.name || 'Borrowing',
        startingBalance: Number(e.balance) || 0,
        balance: isExisting ? (Number(e.balance) || 0) : 0,
        interestRate: (Number(e.interestRate) || 0) / 100,
        payment: (Number(e.minPayment) || 0) * 12,
        extraPayment: extraPayment * 12,
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

  activeLoans.forEach(loan => {
    if (loan.balance > 0) {
      const interest = loan.balance * loan.interestRate;
      loan.totalInterestPaid = (loan.totalInterestPaid || 0) + interest;

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
    annualExtraPayments
  };
}
