import { syncBudgetDetails } from '../../calculators/fire/phases.js';

/**
 * Restores the single-person baseline budget when no active partner remains.
 * Resolves the baseline annual spending from spendingPhases, then computes
 * and syncs all budget/savings/allocation rules.
 */
export function restoreSinglePersonBudgetAfterPartnerRemoval(inputs, options = {}) {
  const { protectedPreDeleteSavingsRate = null } = options;
  if (!inputs) return {};

  // 1. Confirm there is no active partner.
  const hasPartner = (inputs.lifePlan?.objects || []).some(o => 
    o.type === 'person' && (o.id === 'spouse-partner' || o.role === 'partner' || o.properties?.role === 'partner')
  ) || (inputs.householdMembers || []).some(m => m.id === 'spouse');

  if (hasPartner) {
    return {};
  }

  const simpleIncome = Number(inputs.simpleIncome) || 50000;
  const spendingPhases = inputs.spendingPhases || [];

  const rateToUse = protectedPreDeleteSavingsRate !== null && protectedPreDeleteSavingsRate !== undefined
    ? protectedPreDeleteSavingsRate
    : (inputs.displayedSavingsRate && inputs.displayedSavingsRate > 0
      ? inputs.displayedSavingsRate
      : inputs.savingsRate && inputs.savingsRate > 0
        ? inputs.savingsRate
        : inputs.derivedSavingsRate && inputs.derivedSavingsRate > 0
          ? inputs.derivedSavingsRate
          : 0);

  // 2. Determine baseline annual spending
  const baselineAnnualSpending =
    spendingPhases.find(p => p.id === "spend-1")?.annualSpending
    ?? spendingPhases[0]?.annualSpending
    ?? simpleIncome * (1 - rateToUse / 100);

  // 3. Compute restored savings rate
  let restoredSavingsRate =
    simpleIncome > 0
      ? ((simpleIncome - baselineAnnualSpending) / simpleIncome) * 100
      : 0;

  // 5. Clamping
  restoredSavingsRate = Math.max(0, Math.min(100, restoredSavingsRate));
  const simpleExpenses = Math.max(0, Math.min(simpleIncome, baselineAnnualSpending));

  // 4. Rebuild all fields
  const syncResult = syncBudgetDetails(simpleIncome, simpleExpenses, inputs.budgetDetails || {});
  const budgetDetails = syncResult.budgetDetails;

  // Sync phases in budgetDetails
  if (budgetDetails.phases && budgetDetails.phases.length > 0) {
    budgetDetails.phases = budgetDetails.phases.map(p => {
      if (p.type === 'retire') return p;
      const phaseIncome = (Number(p.income) * 12) || simpleIncome;
      const phaseExpenses = phaseIncome * (1 - restoredSavingsRate / 100);
      const syncedPhase = syncBudgetDetails(phaseIncome, phaseExpenses, p);
      return {
        ...p,
        income: Math.round(phaseIncome / 12),
        expenses: syncedPhase.budgetDetails.expenses,
        savings: syncedPhase.budgetDetails.savings,
        partnerSavings: syncedPhase.budgetDetails.partnerSavings,
        savingsAllocMode: syncedPhase.budgetDetails.savingsAllocMode
      };
    });
  }

  let reconciledSpendingPhases = spendingPhases.map(p => {
    if (p.id === 'spend-1') {
      return {
        ...p,
        amount: simpleExpenses,
        annualSpending: simpleExpenses
      };
    }
    return p;
  });
  if (reconciledSpendingPhases.length > 0 && !reconciledSpendingPhases.some(p => p.id === 'spend-1')) {
    reconciledSpendingPhases[0] = {
      ...reconciledSpendingPhases[0],
      amount: simpleExpenses,
      annualSpending: simpleExpenses
    };
  } else if (reconciledSpendingPhases.length === 0) {
    reconciledSpendingPhases.push({
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: inputs.currentAge || 35,
      endAge: inputs.lifeExpectancy || 85,
      amount: simpleExpenses,
      frequency: 'yearly',
      annualSpending: simpleExpenses,
      inflationOverride: null,
      notes: 'Initial standard living expenses'
    });
  }

  const allocationRules = [
    {
      id: 'alloc-surplus',
      destination: 'brokerage',
      type: 'percentSurplus',
      value: 100,
      frequency: 'yearly',
      priority: 1,
      smartRule: { enabled: false, targetValue: 0, redirectDestination: 'brokerage' }
    }
  ];

  return {
    simpleExpenses,
    savingsRate: restoredSavingsRate,
    displayedSavingsRate: restoredSavingsRate,
    budgetDetails,
    spendingPhases: reconciledSpendingPhases,
    allocationRules,
    hasCustomizedBudget: false,
    hasCustomizedSavingsAllocation: false
  };
}
