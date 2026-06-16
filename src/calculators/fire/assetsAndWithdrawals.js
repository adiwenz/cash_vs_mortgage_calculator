import {
  calculateUSTax,
  getMarginalTaxRate
} from '../../simulatorMathUtils.js';

export function solveTraditionalWithdrawal(remainingDeficit, maxPreTaxAvailable, I_0, standardDeduction, nominalBrackets, penaltyRate = 0.0) {
  const P = penaltyRate;
  if (remainingDeficit <= 0) return 0;
  const T_0 = calculateUSTax(I_0, standardDeduction, nominalBrackets);
  const netMax = maxPreTaxAvailable * (1 - P) - (calculateUSTax(I_0 + maxPreTaxAvailable, standardDeduction, nominalBrackets) - T_0);
  if (remainingDeficit >= netMax) {
    return maxPreTaxAvailable;
  }
  let W = remainingDeficit / (1 - P - getMarginalTaxRate(I_0, standardDeduction, nominalBrackets));
  for (let iter = 0; iter < 10; iter++) {
    const taxCurrent = calculateUSTax(I_0 + W, standardDeduction, nominalBrackets);
    const netCurrent = W * (1 - P) - (taxCurrent - T_0);
    const diff = netCurrent - remainingDeficit;
    if (Math.abs(diff) < 0.01) break;
    const marginalRate = getMarginalTaxRate(I_0 + W, standardDeduction, nominalBrackets);
    const slope = 1 - P - marginalRate;
    W -= diff / slope;
    if (W < 0) {
      W = 0;
      break;
    }
    if (W > maxPreTaxAvailable) {
      W = maxPreTaxAvailable;
      break;
    }
  }
  return W;
}

export function withdrawFromCategory(category, amountNeeded, state) {
  let remaining = amountNeeded;
  const { balances, customAssets } = state;
  const matchingCustoms = customAssets.filter(ca => {
    if (category === 'cash') return ca.type === 'checkingSavings';
    if (category === 'emergencyFund') return ca.type === 'emergencyFund';
    if (category === 'brokerage') return ca.type === 'brokerage';
    if (category === 'other') return ca.type === 'asset';
    if (ca.type === 'retirement') return ca.subtype === category;
    return false;
  });

  const baseBal = balances[category] || 0;
  const customSum = matchingCustoms.reduce((sum, ca) => sum + ca.balance, 0);
  const totalCategoryVal = baseBal + customSum;

  if (totalCategoryVal <= 0) return 0;

  const totalToWithdraw = Math.min(totalCategoryVal, remaining);
  const baseRatio = totalCategoryVal > 0 ? (baseBal / totalCategoryVal) : 0;
  const withdrawnBase = totalToWithdraw * baseRatio;
  if (balances[category] !== undefined) {
    balances[category] = Math.max(0, balances[category] - withdrawnBase);
  }

  matchingCustoms.forEach(ca => {
    const caRatio = totalCategoryVal > 0 ? (ca.balance / totalCategoryVal) : 0;
    ca.balance = Math.max(0, ca.balance - (totalToWithdraw * caRatio));
  });

  remaining -= totalToWithdraw;
  return totalToWithdraw;
}

export function coverShortfall(amountToDeduct, age, state) {
  let remaining = amountToDeduct;
  const {
    includeTaxes,
    enforceEarlyWithdrawalPenalty,
    standardDeduction,
    nominalBrackets,
    balances,
    customAssets
  } = state;
  
  const drawdownSequence = ['cash', 'emergencyFund', 'brokerage'];

  for (const key of drawdownSequence) {
    const withdrawn = withdrawFromCategory(key, remaining, state);
    remaining -= withdrawn;
    if (remaining <= 0) return 0;
  }

  if (includeTaxes) {
    const customPreTaxSum = customAssets
      .filter(ca => ca.type === 'retirement' && (ca.subtype === 'trad401k' || ca.subtype === 'tradIra'))
      .reduce((sum, ca) => sum + ca.balance, 0);
    const maxPreTaxAvailable = (balances.trad401k || 0) + (balances.tradIra || 0) + customPreTaxSum;
    if (maxPreTaxAvailable > 0 && remaining > 0) {
      const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
      const totalGrossPreTaxWithdrawal = solveTraditionalWithdrawal(
        remaining,
        maxPreTaxAvailable,
        state.taxableIncome,
        standardDeduction,
        nominalBrackets,
        pRate
      );

      const T_0 = calculateUSTax(state.taxableIncome, standardDeduction, nominalBrackets);
      const T_final = calculateUSTax(state.taxableIncome + totalGrossPreTaxWithdrawal, standardDeduction, nominalBrackets);
      const penalty = totalGrossPreTaxWithdrawal * pRate;
      const actualNetProceeds = totalGrossPreTaxWithdrawal - (T_final - T_0) - penalty;
      state.annualEarlyWithdrawalPenalties += penalty;

      let withdrawalRemaining = totalGrossPreTaxWithdrawal;
      const preTaxSequence = ['trad401k', 'tradIra'];
      for (const key of preTaxSequence) {
        const withdrawn = withdrawFromCategory(key, withdrawalRemaining, state);
        withdrawalRemaining -= withdrawn;
      }

      remaining -= actualNetProceeds;
      state.taxableIncome += totalGrossPreTaxWithdrawal;
    }
  } else {
    const preTaxSequence = ['trad401k', 'tradIra'];
    for (const key of preTaxSequence) {
      const customPreTaxSum = customAssets
        .filter(ca => ca.type === 'retirement' && ca.subtype === key)
        .reduce((sum, ca) => sum + ca.balance, 0);
      const totalAvail = (balances[key] || 0) + customPreTaxSum;
      if (totalAvail > 0) {
        const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
        const grossNeeded = remaining / (1 - pRate);
        const withdrawn = withdrawFromCategory(key, grossNeeded, state);
        const penalty = withdrawn * pRate;
        const netProceeds = withdrawn - penalty;
        remaining -= netProceeds;
        state.annualEarlyWithdrawalPenalties += penalty;
        if (remaining <= 0.01) return 0;
      }
    }
  }

  const taxFreeSequence = ['rothIra', 'hsa', 'other'];
  for (const key of taxFreeSequence) {
    const withdrawn = withdrawFromCategory(key, remaining, state);
    remaining -= withdrawn;
    if (remaining <= 0) return 0;
  }

  return remaining;
}

export function deductFromLiquidAssets(amountToDeduct, age, state) {
  let remaining = amountToDeduct;
  const { balances, customAssets, enforceEarlyWithdrawalPenalty } = state;
  const order = ['cash', 'emergencyFund', 'brokerage', 'other', 'rothIra', 'tradIra', 'trad401k', 'hsa'];
  for (const assetKey of order) {
    const customPreTaxSum = customAssets
      .filter(ca => ca.type === 'retirement' && ca.subtype === assetKey)
      .reduce((sum, ca) => sum + ca.balance, 0);
    const totalAvail = (balances[assetKey] || 0) + customPreTaxSum;
    if (totalAvail > 0) {
      if (assetKey === 'tradIra' || assetKey === 'trad401k') {
        const pRate = (enforceEarlyWithdrawalPenalty && age < 59.5) ? 0.10 : 0.0;
        const grossNeeded = remaining / (1 - pRate);
        const withdrawn = withdrawFromCategory(assetKey, grossNeeded, state);
        const penalty = withdrawn * pRate;
        const netProceeds = withdrawn - penalty;
        remaining -= netProceeds;
        state.annualEarlyWithdrawalPenalties += penalty;
      } else {
        const withdrawn = withdrawFromCategory(assetKey, remaining, state);
        remaining -= withdrawn;
      }
      if (remaining <= 0.01) break;
    }
  }
  return remaining;
}
