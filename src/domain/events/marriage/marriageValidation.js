export function validateWeddingCostFunding(editingEvent, inputs) {
  const userAssets = Number(inputs.assets?.cash || 0) +
                     Number(inputs.assets?.brokerage || 0) +
                     Number(inputs.assets?.trad401k || 0) +
                     Number(inputs.assets?.tradIra || 0) +
                     Number(inputs.assets?.rothIra || 0) +
                     Number(inputs.assets?.hsa || 0) +
                     Number(inputs.assets?.other || 0);

  const spouseAssets = Number(editingEvent.cash || 0) +
                       Number(editingEvent.investments || 0) +
                       Number(editingEvent.retirement || 0);

  const combinedAssets = userAssets + spouseAssets;

  const userDebt = Number(inputs.assets?.debts || 0) +
                   (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);

  const spouseDebt = Number(editingEvent.debtStudent || 0) +
                     Number(editingEvent.debtCredit || 0) +
                     Number(editingEvent.debtOther || 0);

  const combinedDebt = userDebt + spouseDebt;
  
  const weddingCost = Number(editingEvent.weddingCost || 0);
  const fundingMethod = editingEvent.weddingFundingMethod || 'savings';

  const isSavingsDisabled = weddingCost > combinedAssets;
  const fundingGap = Math.max(0, weddingCost - combinedAssets);

  const postWeddingFinancedDebt = (fundingMethod === 'debt') ? fundingGap : 0;
  const postWeddingNetWorth = combinedAssets - combinedDebt - postWeddingFinancedDebt;
  const isNetWorthBelowZero = postWeddingNetWorth < 0;

  return {
    userAssets,
    spouseAssets,
    combinedAssets,
    userDebt,
    spouseDebt,
    combinedDebt,
    isSavingsDisabled,
    fundingGap,
    postWeddingFinancedDebt,
    postWeddingNetWorth,
    isNetWorthBelowZero
  };
}
