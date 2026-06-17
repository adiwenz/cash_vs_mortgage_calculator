export function handleHousePurchase(age, enabledEvents, profile, purchasedProperties, deductFromLiquidAssets, state) {
  enabledEvents.forEach(ev => {
    if (ev.type === 'buyHouse' && age === Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age)) {
      const asset = (ev.houseId && profile.houseAssets)
        ? profile.houseAssets.find(h => h.id === ev.houseId)
        : ev;

      if (!asset) return;

      const p = Number(asset.homePrice !== undefined ? asset.homePrice : (asset.purchasePrice !== undefined ? asset.purchasePrice : 0)) || 0;
      const dp = Number(asset.downPayment) || 0;
      const isCash = dp >= p || asset.purchaseType === 'cash';

      const closingCostsRate = asset.closingCosts !== undefined ? Number(asset.closingCosts) : 3;
      const closingCosts = p * (closingCostsRate / 100);
      const points = asset.points !== undefined ? Number(asset.points) : 0;
      const renovationCost = asset.renovationCost !== undefined ? Number(asset.renovationCost) : 0;

      let totalCashNeeded = closingCosts + points + renovationCost;
      state.housePurchaseTransactionCosts = (state.housePurchaseTransactionCosts || 0) + totalCashNeeded;
      if (isCash) {
        totalCashNeeded += p;
      } else {
        totalCashNeeded += dp;
      }

      const houseShortfall = deductFromLiquidAssets(totalCashNeeded, age, state);
      if (houseShortfall > 0.01) {
        state.hasRunOut = true;
        if (state.runOutAge === null) {
          state.runOutAge = age;
        }
      }

      if (isCash) {
        purchasedProperties.push({
          id: asset.id || ev.id,
          purchaseAge: age,
          purchaseType: 'cash',
          homePrice: p,
          currentValue: p,
          mortgageBalance: 0,
          annualPI: 0,
          loanTerm: 0,
          propertyTaxRate: (asset.propertyTax !== undefined ? Number(asset.propertyTax) : (asset.propertyTaxRate !== undefined ? Number(asset.propertyTaxRate) : 1.1)) / 100,
          insuranceRate: (asset.insurance !== undefined ? Number(asset.insurance) : (asset.insuranceCost !== undefined ? Number(asset.insuranceCost) : 0.35)) / 100,
          maintenanceRate: (asset.maintenance !== undefined ? Number(asset.maintenance) : (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : 1.0)) / 100,
          appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
          hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
          utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
          sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
          yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
          inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3
        });
      } else {
        const rate = (asset.mortgageRate !== undefined ? Number(asset.mortgageRate) : 6.5) / 100;
        const mortgageTerm = asset.loanTerm !== undefined ? Number(asset.loanTerm) : (asset.loanTermYears !== undefined ? Number(asset.loanTermYears) : 30);
        const loanAmount = Math.max(0, p - dp);
        let annualPI = 0;

        if (loanAmount > 0 && mortgageTerm > 0) {
          const r = rate / 12;
          const n = mortgageTerm * 12;
          const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
          annualPI = monthlyPayment * 12;
        }

        purchasedProperties.push({
          id: asset.id || ev.id,
          purchaseAge: age,
          purchaseType: 'mortgage',
          homePrice: p,
          downPayment: dp,
          mortgageRate: rate,
          loanTerm: mortgageTerm,
          loanAmount,
          annualPI,
          currentValue: p,
          mortgageBalance: loanAmount,
          propertyTaxRate: (asset.propertyTax !== undefined ? Number(asset.propertyTax) : (asset.propertyTaxRate !== undefined ? Number(asset.propertyTaxRate) : 1.1)) / 100,
          insuranceRate: (asset.insurance !== undefined ? Number(asset.insurance) : (asset.insuranceCost !== undefined ? Number(asset.insuranceCost) : 0.35)) / 100,
          maintenanceRate: (asset.maintenance !== undefined ? Number(asset.maintenance) : (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : 1.0)) / 100,
          pmiRate: asset.pmi !== undefined ? Number(asset.pmi) : 0.5,
          appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
          hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
          utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
          sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
          yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
          inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3
        });
      }
    }
  });
}

export function handleHouseSale(age, currentAge, enabledEvents, purchasedProperties, state, dynamicMilestones, formatCurrency) {
  const activeProperties = [];
  const { balances } = state;
  purchasedProperties.forEach(prop => {
    let shouldSell = false;
    let sellingCostRate = prop.sellingCostRate || 6;
    let proceedsDestination = 'investments';
    let sellEvId = null;

    const sellEv = enabledEvents.find(e => e.type === 'sellHouse' && e.houseId === prop.id && age === Number(e.age));
    if (sellEv) {
      shouldSell = true;
      if (sellEv.sellingCost !== undefined) {
        sellingCostRate = Number(sellEv.sellingCost);
      }
      if (sellEv.proceedsDestination) {
        proceedsDestination = sellEv.proceedsDestination;
      }
      sellEvId = sellEv.id;
    } else {
      let saleAge = null;
      if (prop.yearsUntilSale !== undefined && prop.yearsUntilSale !== null && prop.yearsUntilSale !== '') {
        const val = Number(prop.yearsUntilSale);
        if (!isNaN(val) && val > 0) {
          if (val < currentAge) {
            saleAge = prop.purchaseAge + val;
          } else {
            saleAge = val;
          }
        }
      }
      if (saleAge !== null && age === saleAge) {
        shouldSell = true;
      }
    }

    if (shouldSell) {
      const sellingCosts = prop.currentValue * (sellingCostRate / 100);
      state.sellingCosts = (state.sellingCosts || 0) + sellingCosts;
      state.mortgagePayoffFromSale = (state.mortgagePayoffFromSale || 0) + prop.mortgageBalance;
      const netProceeds = prop.currentValue - sellingCosts - prop.mortgageBalance;
      
      if (proceedsDestination === 'cash') {
        balances.cash += netProceeds;
      } else {
        balances.brokerage += netProceeds;
      }

      dynamicMilestones.push({
        age,
        label: `Sold Home`,
        type: 'sellHouse',
        isMilestone: true,
        originalId: sellEvId || prop.id,
        description: `Sold home for ${formatCurrency(prop.currentValue)}. Net proceeds after ${sellingCostRate}% selling costs (${formatCurrency(sellingCosts)}) and mortgage payoff (${formatCurrency(prop.mortgageBalance)}) were ${formatCurrency(netProceeds)} injected into ${proceedsDestination === 'cash' ? 'cash' : 'investments'}.`
      });
    } else {
      activeProperties.push(prop);
    }
  });
  return activeProperties;
}

export function processYearlyHousingUpdates(age, currentAge, homeEquityBaseline, nominalFactor, customHouses, purchasedProperties, inflationRate) {
  let totalHomeValue = homeEquityBaseline * nominalFactor;
  customHouses.forEach(h => {
    if (age >= currentAge && (h.endAge === null || age < h.endAge)) {
      totalHomeValue += h.value;
    }
  });
  let totalMortgageBalance = 0;
  let annualHousingExpenses = 0;

  purchasedProperties.forEach(prop => {
    prop.currentValue = prop.currentValue * (1 + prop.appreciationRate);
    totalHomeValue += prop.currentValue;

    if (prop.purchaseType === 'mortgage') {
      if (age >= prop.purchaseAge && age < prop.purchaseAge + prop.loanTerm) {
        annualHousingExpenses += prop.annualPI;
        const elapsedYears = age - prop.purchaseAge;
        const r = prop.mortgageRate / 12;
        const n = prop.loanTerm * 12;
        const elapsedMonths = elapsedYears * 12;
        const remainingMonths = n - elapsedMonths;
        const pmt = prop.annualPI / 12;
        prop.mortgageBalance = r === 0 ? pmt * remainingMonths : pmt * (1 - Math.pow(1 + r, -remainingMonths)) / r;
      } else {
        prop.mortgageBalance = 0;
      }
      totalMortgageBalance += prop.mortgageBalance;
    }

    const propTax = prop.currentValue * prop.propertyTaxRate;
    const ins = prop.currentValue * prop.insuranceRate;
    const maint = prop.currentValue * prop.maintenanceRate;
    annualHousingExpenses += propTax + ins + maint;

    const propInflationRate = prop.inflation !== undefined ? (prop.inflation / 100) : inflationRate;
    const hoaCost = (prop.hoa || 0) * 12 * Math.pow(1 + propInflationRate, age - prop.purchaseAge);
    const utilitiesCost = (prop.utilitiesIncrease || 0) * 12 * Math.pow(1 + propInflationRate, age - prop.purchaseAge);
    annualHousingExpenses += hoaCost + utilitiesCost;

    if (prop.purchaseType === 'mortgage' && prop.downPayment < prop.homePrice * 0.2) {
      if (prop.mortgageBalance > prop.homePrice * 0.8) {
        const pmiCost = prop.mortgageBalance * ((prop.pmiRate || 0.5) / 100);
        annualHousingExpenses += pmiCost;
      }
    }
  });

  return {
    totalHomeValue,
    totalMortgageBalance,
    annualHousingExpenses
  };
}
