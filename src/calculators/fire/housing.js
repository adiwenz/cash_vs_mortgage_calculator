export function handleHousePurchase(age, enabledEvents, profile, purchasedProperties, deductFromLiquidAssets, state) {
  enabledEvents.forEach(ev => {
    if (ev.type === 'buyHouse' && age === Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age)) {
      const asset = (ev.houseId && profile.houseAssets)
        ? profile.houseAssets.find(h => h.id === ev.houseId)
        : ev;

      if (!asset) return;

      const p = Number(asset.homePrice !== undefined ? asset.homePrice : (asset.purchasePrice !== undefined ? asset.purchasePrice : 0)) || 0;
      let dp = Number(asset.downPayment) || 0;
      if (dp === 0 && asset.downPaymentPercent !== undefined && asset.downPaymentPercent !== null) {
        const pct = Number(asset.downPaymentPercent);
        const factor = pct > 1 ? pct / 100 : pct;
        dp = p * factor;
      }
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
        state.cumulativeShortfall = (state.cumulativeShortfall || 0) + houseShortfall;
        state.housePurchaseShortfall = (state.housePurchaseShortfall || 0) + houseShortfall;
      }

      state.purchaseDebugThisYear = {
        purchasePrice: p,
        downPaymentUsed: isCash ? p : dp,
        closingCostsPaid: closingCosts + points + renovationCost,
        mortgageOriginalBalance: isCash ? 0 : Math.max(0, p - dp)
      };

      let resolvedPropertyTaxRate = 1.1 / 100;
      if (asset.propertyTaxRate !== undefined) {
        resolvedPropertyTaxRate = Number(asset.propertyTaxRate) / 100;
      } else if (asset.propertyTaxes !== undefined && p > 0) {
        resolvedPropertyTaxRate = Number(asset.propertyTaxes) / p;
      } else if (asset.propertyTax !== undefined) {
        resolvedPropertyTaxRate = Number(asset.propertyTax) / 100;
      }

      let resolvedInsuranceRate = 0.35 / 100;
      if (asset.insuranceRate !== undefined) {
        resolvedInsuranceRate = Number(asset.insuranceRate) / 100;
      } else if (asset.insurance !== undefined) {
        const val = Number(asset.insurance);
        if (val > 10 && p > 0) {
          resolvedInsuranceRate = val / p;
        } else {
          resolvedInsuranceRate = val / 100;
        }
      } else if (asset.insuranceCost !== undefined) {
        resolvedInsuranceRate = Number(asset.insuranceCost) / 100;
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
          propertyTaxRate: resolvedPropertyTaxRate,
          insuranceRate: resolvedInsuranceRate,
          maintenanceRate: (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : (asset.maintenance !== undefined ? Number(asset.maintenance) : 1.0)) / 100,
          appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
          hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
          utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
          sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
          yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
          inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3,
          keepRent: asset.keepRent !== undefined ? !!asset.keepRent : (ev.keepRent !== undefined ? !!ev.keepRent : false)
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
          propertyTaxRate: resolvedPropertyTaxRate,
          insuranceRate: resolvedInsuranceRate,
          maintenanceRate: (asset.maintenanceRate !== undefined ? Number(asset.maintenanceRate) : (asset.maintenance !== undefined ? Number(asset.maintenance) : 1.0)) / 100,
          pmiRate: asset.pmi !== undefined ? Number(asset.pmi) : 0.5,
          appreciationRate: (asset.appreciationRate !== undefined ? Number(asset.appreciationRate) : 3.0) / 100,
          hoa: asset.hoa !== undefined ? Number(asset.hoa) : (asset.hoaCost !== undefined ? Number(asset.hoaCost) : 0),
          utilitiesIncrease: asset.utilitiesIncrease !== undefined ? Number(asset.utilitiesIncrease) : 0,
          sellingCostRate: asset.sellingCost !== undefined ? Number(asset.sellingCost) : (asset.sellingCostRate !== undefined ? Number(asset.sellingCostRate) : 6),
          yearsUntilSale: asset.yearsUntilSale !== undefined ? asset.yearsUntilSale : '',
          inflation: asset.inflation !== undefined ? Number(asset.inflation) : 3,
          keepRent: asset.keepRent !== undefined ? !!asset.keepRent : (ev.keepRent !== undefined ? !!ev.keepRent : false)
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
  let totalMortgagePrincipalPaid = 0;
  let totalMortgageInterestPaid = 0;

  // Debug variables sum
  let homeValueStart = 0;
  let homeValueEnd = 0;
  let mortgageBalanceStart = 0;
  let mortgageBalanceEnd = 0;
  let principalPaid = 0;
  let interestPaid = 0;
  let propertyTaxPaid = 0;
  let insurancePaid = 0;
  let maintenancePaid = 0;

  purchasedProperties.forEach(prop => {
    const prevVal = prop.currentValue;
    const newVal = prop.currentValue * (1 + prop.appreciationRate);
    prop.currentValue = newVal;
    totalHomeValue += prop.currentValue;

    homeValueStart += prevVal;
    homeValueEnd += newVal;

    if (prop.purchaseType === 'mortgage') {
      if (age >= prop.purchaseAge && age < prop.purchaseAge + prop.loanTerm) {
        const elapsedYears = age - prop.purchaseAge;
        const r = prop.mortgageRate / 12;
        const n = prop.loanTerm * 12;
        const pmt = prop.annualPI / 12;

        // Calculate starting balance of the year
        let startBal = 0;
        if (age === prop.purchaseAge) {
          startBal = prop.loanAmount || 0;
        } else {
          const prevElapsedMonths = elapsedYears * 12;
          const prevRemainingMonths = n - prevElapsedMonths;
          startBal = r === 0 ? pmt * prevRemainingMonths : pmt * (1 - Math.pow(1 + r, -prevRemainingMonths)) / r;
        }

        // Calculate ending balance of the year (elapsedMonths is (elapsedYears + 1) * 12)
        const elapsedMonths = (elapsedYears + 1) * 12;
        const remainingMonths = Math.max(0, n - elapsedMonths);
        prop.mortgageBalance = remainingMonths === 0 ? 0 : (r === 0 ? pmt * remainingMonths : pmt * (1 - Math.pow(1 + r, -remainingMonths)) / r);

        const pPaid = Math.max(0, startBal - prop.mortgageBalance);
        const iPaid = Math.max(0, prop.annualPI - pPaid);

        totalMortgagePrincipalPaid += pPaid;
        totalMortgageInterestPaid += iPaid;
        annualHousingExpenses += iPaid;

        mortgageBalanceStart += startBal;
        mortgageBalanceEnd += prop.mortgageBalance;
        principalPaid += pPaid;
        interestPaid += iPaid;
      } else {
        prop.mortgageBalance = 0;
      }
      totalMortgageBalance += prop.mortgageBalance;
    }

    const propTax = prop.currentValue * prop.propertyTaxRate;
    const ins = prop.currentValue * prop.insuranceRate;
    const maint = prop.currentValue * prop.maintenanceRate;
    annualHousingExpenses += propTax + ins + maint;

    propertyTaxPaid += propTax;
    insurancePaid += ins;
    maintenancePaid += maint;

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
    annualHousingExpenses,
    totalMortgagePrincipalPaid,
    annualMortgageInterest: totalMortgageInterestPaid,
    homeValueStart,
    homeValueEnd,
    mortgageBalanceStart,
    mortgageBalanceEnd,
    principalPaid,
    interestPaid,
    propertyTaxPaid,
    insurancePaid,
    maintenancePaid
  };
}
