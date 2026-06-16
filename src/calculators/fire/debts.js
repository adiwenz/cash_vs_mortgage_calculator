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

  const startingLoans = [...baseActiveLoans, ...customDebts];
  return startingLoans.map(l => ({
    ...l,
    totalInterestPaid: 0,
    payoffAge: null
  }));
}

export function processYearlyDebtPayments(age, activeLoans, dynamicMilestones) {
  let annualDebtPayments = 0;
  activeLoans.forEach(loan => {
    if (loan.balance > 0) {
      const interest = loan.balance * loan.interestRate;
      loan.totalInterestPaid = (loan.totalInterestPaid || 0) + interest;
      
      let totalPayment = loan.payment;
      if (loan.paydownPlanEnabled && age >= loan.startAge) {
        totalPayment += loan.extraPayment;
      }

      let actualPaid;
      if (loan.balance + interest <= totalPayment) {
        actualPaid = loan.balance + interest;
        loan.balance = 0;
        loan.payoffAge = age;
        dynamicMilestones.push({
          age,
          label: `${loan.name} Paid Off`,
          type: 'debtPayoff',
          isMilestone: true
        });
      } else {
        actualPaid = totalPayment;
        loan.balance = loan.balance + interest - actualPaid;
      }
      annualDebtPayments += actualPaid;
    }
  });
  return annualDebtPayments;
}
