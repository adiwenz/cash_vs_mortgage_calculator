export function ensureScenarioArrays(inputs) {
  if (!inputs) return inputs;
  const newInputs = { ...inputs }; // Shallow copy to avoid mutation

  if (!Array.isArray(newInputs.lifeEvents)) {
    newInputs.lifeEvents = [];
  } else {
    newInputs.lifeEvents = [...newInputs.lifeEvents];
  }

  // Handle legacy house arrays
  if (!Array.isArray(newInputs.houseAssets)) {
    if (Array.isArray(newInputs.houses)) {
      newInputs.houseAssets = [...newInputs.houses];
    } else if (Array.isArray(newInputs.assets?.houses)) {
      newInputs.houseAssets = [...newInputs.assets.houses];
    } else {
      newInputs.houseAssets = [];
    }
  } else {
    newInputs.houseAssets = [...newInputs.houseAssets];
  }

  // Handle legacy income arrays
  if (!Array.isArray(newInputs.incomeList)) {
    if (Array.isArray(newInputs.incomeSources)) {
      newInputs.incomeList = [...newInputs.incomeSources];
    } else {
      newInputs.incomeList = [];
    }
  } else {
    newInputs.incomeList = [...newInputs.incomeList];
  }

  // Handle legacy debt arrays
  if (!Array.isArray(newInputs.debtList)) {
    if (Array.isArray(newInputs.debts)) {
      newInputs.debtList = [...newInputs.debts];
    } else {
      newInputs.debtList = [];
    }
  } else {
    newInputs.debtList = [...newInputs.debtList];
  }

  if (!Array.isArray(newInputs.assetList)) {
    newInputs.assetList = [];
  } else {
    newInputs.assetList = [...newInputs.assetList];
  }

  return newInputs;
}

export function ensureHouseAssetIds(inputs) {
  if (!inputs) return inputs;
  const houseAssets = inputs.houseAssets || [];
  
  // Collect existing IDs so we avoid generating duplicates
  const existingIds = new Set(houseAssets.map(h => h.id).filter(Boolean));
  
  let changed = false;
  const updatedHouseAssets = houseAssets.map((h, idx) => {
    if (!h.id) {
      changed = true;
      // Deterministic base ID
      let baseId = h.eventId || 
                   h.sourceEventId || 
                   (h.purchaseAge !== undefined && h.purchaseAge !== null ? `house-age-${h.purchaseAge}` : `house-${idx + 1}`);
      
      let candidateId = baseId;
      let counter = 1;
      while (existingIds.has(candidateId)) {
        candidateId = `${baseId}-${counter}`;
        counter++;
      }
      existingIds.add(candidateId);
      return { ...h, id: candidateId };
    }
    return h;
  });
  
  if (!changed) return inputs;
  
  return {
    ...inputs,
    houseAssets: updatedHouseAssets
  };
}

export function normalizeScenarioInputs(inputs) {
  if (!inputs) return inputs;
  let normalized = ensureScenarioArrays(inputs);
  normalized = ensureHouseAssetIds(normalized);
  return normalized;
}
