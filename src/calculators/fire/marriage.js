export function handleMarriageAssetInjection(age, marriageAge, balances, spouseCash, spouseInvestments, spouseRetirement, nominalFactor, dynamicMilestones, formatCurrency) {
  balances.cash += spouseCash * nominalFactor;
  balances.brokerage += spouseInvestments * nominalFactor;
  balances.trad401k += spouseRetirement * nominalFactor;
  dynamicMilestones.push({
    age,
    label: `Married! Spouse assets injected: +${formatCurrency((spouseCash + spouseInvestments + spouseRetirement) * nominalFactor)}`,
    type: 'marriage',
    isMilestone: true
  });
}

export function handleWeddingCost(age, weddingAge, weddingCost, nominalFactor, deductFromLiquidAssets, state, dynamicMilestones, formatCurrency) {
  const leftoverWedding = deductFromLiquidAssets(weddingCost * nominalFactor, age, state);
  if (leftoverWedding > 0.01) {
    state.cumulativeShortfall += leftoverWedding;
  }
  dynamicMilestones.push({
    age,
    label: `Wedding Cost: -${formatCurrency(weddingCost * nominalFactor)}`,
    type: 'wedding',
    isMilestone: false
  });
}

export function handleMarriageDebtInjection(age, marriageAge, activeLoans, spouseDebtStudent, spouseDebtCredit, spouseDebtOther, nominalFactor) {
  if (spouseDebtStudent > 0) {
    activeLoans.push({
      id: 'spouse-student',
      name: 'Spouse Student Loan',
      balance: spouseDebtStudent * nominalFactor,
      interestRate: 0.05,
      payment: Math.max(1200, spouseDebtStudent * 0.12) * nominalFactor,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: marriageAge,
      totalInterestPaid: 0,
      payoffAge: null
    });
  }
  if (spouseDebtCredit > 0) {
    activeLoans.push({
      id: 'spouse-credit',
      name: 'Spouse Credit Card',
      balance: spouseDebtCredit * nominalFactor,
      interestRate: 0.18,
      payment: Math.max(600, spouseDebtCredit * 0.24) * nominalFactor,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: marriageAge,
      totalInterestPaid: 0,
      payoffAge: null
    });
  }
  if (spouseDebtOther > 0) {
    activeLoans.push({
      id: 'spouse-other',
      name: 'Spouse Other Loan',
      balance: spouseDebtOther * nominalFactor,
      interestRate: 0.07,
      payment: Math.max(600, spouseDebtOther * 0.12) * nominalFactor,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: marriageAge,
      totalInterestPaid: 0,
      payoffAge: null
    });
  }
}
