export function hasExplicitAllocationRules(inputs) {
  const rules = inputs?.allocationRules;
  if (!rules || rules.length === 0) return false;
  if (rules.length > 1) return true;
  const rule = rules[0];
  if (
    rule.id === 'alloc-surplus' &&
    rule.destination === 'brokerage' &&
    rule.type === 'percentSurplus'
  ) {
    return false;
  }
  return true;
}

export function resolveSavingsRoutingSource(inputs) {
  if (hasExplicitAllocationRules(inputs)) {
    return 'allocation_rules';
  }

  const accounts = inputs?.lifePlan?.objects?.filter(o => o.type === 'account') || [];
  const hasContribution = accounts.some(acc => {
    const amt = Number(acc.properties?.contributionAmount);
    return !isNaN(amt) && amt > 0;
  });
  if (hasContribution) {
    return 'lifeplan_contributions';
  }

  const savings = inputs?.budgetDetails?.savings;
  let hasPositiveSavings = false;
  if (savings) {
    hasPositiveSavings = Object.values(savings).some(val => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    });
  }

  const phases = inputs?.budgetDetails?.phases || [];
  const hasPositivePhaseSavings = phases.some(p => {
    const s = p.savings || {};
    const ps = p.partnerSavings || {};
    return (
      Object.values(s).some(val => Number(val) > 0) ||
      Object.values(ps).some(val => Number(val) > 0)
    );
  });

  if (hasPositiveSavings || hasPositivePhaseSavings) {
    return 'budget_savings';
  }

  return 'default_fallback';
}
