export function handleMarriageAssetInjection(age, marriageAge, balances, spouseCash, spouseInvestments, spouseRetirement, nominalFactor, dynamicMilestones, formatCurrency) {
  balances.cash += spouseCash * nominalFactor;
  balances.brokerage += spouseInvestments * nominalFactor;
  balances.trad401k += spouseRetirement * nominalFactor;
}

export function handleWeddingCost(age, weddingAge, weddingCost, nominalFactor, deductFromLiquidAssets, state, dynamicMilestones, formatCurrency, marriageEvent, activeLoans) {
  const totalCost = weddingCost * nominalFactor;
  const { balances, customAssets } = state;
  
  // Calculate total liquid assets before deduction
  const customAssetsSum = (customAssets || []).reduce((sum, ca) => sum + ca.balance, 0);
  const totalLiquidAssets = (balances.cash || 0) + 
                            (balances.emergencyFund || 0) + 
                            (balances.brokerage || 0) + 
                            (balances.trad401k || 0) + 
                            (balances.tradIra || 0) + 
                            (balances.rothIra || 0) + 
                            (balances.hsa || 0) + 
                            (balances.other || 0) + 
                            customAssetsSum;

  let financedAmount = 0;
  let paidFromSavings = totalCost;

  const isFinanced = ['debt', 'finance', 'financed', 'loan'].includes(marriageEvent?.weddingFundingMethod);
  if (marriageEvent && isFinanced) {
    const isEntire = ['finance', 'financed', 'loan'].includes(marriageEvent.weddingFundingMethod);
    if (isEntire) {
      financedAmount = totalCost;
      paidFromSavings = 0;
    } else {
      financedAmount = Math.max(0, totalCost - totalLiquidAssets);
      paidFromSavings = totalCost - financedAmount;
    }
  }

  state.weddingFinancedAmount = financedAmount;
  state.weddingPaidFromSavings = paidFromSavings;

  const leftoverWedding = deductFromLiquidAssets(paidFromSavings, age, state);
  if (leftoverWedding > 0.01) {
    state.cumulativeShortfall += leftoverWedding;
  }

  dynamicMilestones.push({
    age,
    label: financedAmount > 0 
      ? `Wedding Cost: -${formatCurrency(paidFromSavings)} (Financed: ${formatCurrency(financedAmount)})`
      : `Wedding Cost: -${formatCurrency(paidFromSavings)}`,
    type: 'wedding',
    isMilestone: false
  });

  if (financedAmount > 0) {
    const interestRate = (marriageEvent.weddingInterestRate !== undefined ? Number(marriageEvent.weddingInterestRate) : 7) / 100;
    const timelineYears = marriageEvent.weddingPayoffTimeline !== undefined ? Number(marriageEvent.weddingPayoffTimeline) : 10;
    const hasPaymentPlan = marriageEvent.weddingHasPaymentPlan !== undefined ? !!marriageEvent.weddingHasPaymentPlan : true;

    let payment = 0;
    if (hasPaymentPlan) {
      // Amortize over timelineYears
      const r = interestRate / 12;
      const termMonths = timelineYears * 12;
      if (r === 0) {
        payment = (financedAmount / termMonths) * 12;
      } else {
        payment = ((financedAmount * r) / (1 - Math.pow(1 + r, -termMonths))) * 12;
      }
    } else {
      // Minimum/default payment: 1% of starting balance monthly (12% annually)
      payment = (financedAmount * 0.01) * 12;
    }

    const currentAge = state.currentAge !== undefined ? state.currentAge : weddingAge;
    const startYear = weddingAge - currentAge;

    activeLoans.push({
      id: 'wedding-debt',
      name: 'Wedding Debt',
      sourceEventId: marriageEvent ? marriageEvent.id : 'marriage-wedding-debt',
      type: 'weddingDebt',
      originalBalance: financedAmount,
      balance: financedAmount,
      interestRate,
      payment,
      extraPayment: 0,
      frequency: 'monthly',
      paydownPlanEnabled: false,
      startAge: weddingAge,
      startYear: startYear,
      payoffYears: timelineYears,
      totalInterestPaid: 0,
      payoffAge: null
    });
  }
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
