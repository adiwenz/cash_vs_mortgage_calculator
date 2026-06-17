import { useMemo } from 'react';
import { getNormalizedPhases, runFireSimulation } from '../fireCalculations';
import { 
  calculateRetireAt65Recommendation, 
  calculateSaveMoreRecommendation, 
  calculateEarnMoreRecommendation,
  getChildCostOffsetRecommendations
} from '../recommendations';
import { getActiveDebtsForAge } from '../calculators/fire/debts';
import {
  getActiveChildrenCountAtAge,
  getChildCountIntervals,
  calculateUSTaxForModal
} from '../simulatorMathUtils';
import { isHouseAffordableBalanced, getRebalanceStrategies } from '../calculators/fire/rebalance';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export function useRecommendations(inputs, activeResults) {
  const improvementPlan = useMemo(() => {
    if (!inputs || !activeResults) return null;

    const currentAge = Number(inputs.currentAge) || 30;
    const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
    const yearsUntilRetirement = Math.max(0, targetRetirementAge - currentAge);
    const rateOfReturn = (Number(inputs.expectedReturn) || 7) / 100;
    const swr = (Number(inputs.swr) || 4) / 100;
    const marginalTaxRate = inputs.includeTaxes ? 0.25 : 0.0;

    // Run a temporary simulation with the default childcare boost enabled
    // so recommendations are calculated against the post-boost baseline.
    const recInputs = JSON.parse(JSON.stringify(inputs));
    const normPhases = getNormalizedPhases(recInputs);
    if (!recInputs.budgetDetails) recInputs.budgetDetails = {};
    recInputs.budgetDetails.phases = normPhases.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income,
      savingsAllocMode: p.smartRule || p.savingsAllocMode || 'fixed',
      savings: p.savings,
      partnerSavings: p.partnerSavings,
      expenses: p.expenses
    }));
    const recResults = runFireSimulation(recInputs);
    const currentReadyAge = recResults.retirementReadyAge;

    const retirementExpenses = recResults.annualRetirementSpending || 40000;
    const shortfall = recResults.endingSurplusShortfall < 0 ? -recResults.endingSurplusShortfall : 0;

    // Determine childcare phase and peak monthly child cost
    const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    let hasChildcarePhase = false;
    let maxChildCostsAnnual = 0;
    if (childEvents.length > 0) {
      let minChildParentAge = Infinity;
      let maxChildParentAge = -Infinity;
      childEvents.forEach(ev => {
        const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (birthAge < minChildParentAge) minChildParentAge = birthAge;
        if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
      });
      hasChildcarePhase = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAge;

      if (hasChildcarePhase) {
        for (let age = currentAge; age < targetRetirementAge; age++) {
          let yearCost = 0;
          childEvents.forEach(ev => {
            const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
            const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
            const childAge = age - birthAge;
            if (childAge >= childStartAge) {
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (childAge < maxAge) {
                const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
                const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
                const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
                const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

                let annualCost = 0;
                if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
                else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
                else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
                else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
                
                yearCost += annualCost;
              }
            }
          });
          if (yearCost > maxChildCostsAnnual) {
            maxChildCostsAnnual = yearCost;
          }
        }
      }
    }
    const maxChildCostsMonthly = Math.round(maxChildCostsAnnual / 12);

    let peakCount = 0;
    const currentAgeVal = Number(inputs.currentAge) || 30;
    const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;
    for (let age = currentAgeVal; age < targetRetAgeVal; age++) {
      const count = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
      if (count > peakCount) {
        peakCount = count;
      }
    }
    const savingIntervals = getChildCountIntervals(currentAgeVal, targetRetAgeVal, inputs.lifeEvents, inputs.incomeList);
    const peakIntervalIdx = savingIntervals.findIndex(inv => inv.childCount === peakCount);
    let ccIncomeVal = (Number(inputs.simpleIncome) || 50000) / 12;
    if (inputs.budgetDetails) {
      if (inputs.budgetDetails.childcareBudgets && peakIntervalIdx !== -1 && inputs.budgetDetails.childcareBudgets[peakIntervalIdx]) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareBudgets[peakIntervalIdx].income);
      } else if (inputs.budgetDetails.childcareIncome !== undefined) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareIncome);
      }
    }
    const wsIncomeVal = inputs.budgetDetails && inputs.budgetDetails.income !== undefined
      ? Number(inputs.budgetDetails.income)
      : (Number(inputs.simpleIncome) || 50000) / 12;
    const currentChildcareIncomeBoostMonthly = Math.max(0, ccIncomeVal - wsIncomeVal);

    const unfundedMaxChildCostsMonthly = Math.max(0, maxChildCostsMonthly - currentChildcareIncomeBoostMonthly);

    const activePhaseObj = normPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || normPhases[0];
    const activeDebts = getActiveDebtsForAge(inputs, currentAge);
    const activeDebtsTotal = activeDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const baseExpenses = Object.keys(activePhaseObj?.expenses || {}).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (activePhaseObj.expenses[v] || 0), 0);
    const activeSavings = activePhaseObj?.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(activePhaseObj?.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const activeTaxes = inputs.includeTaxes ? Math.round(calculateUSTaxForModal(activePhaseObj?.income * 12 || 0, 0, inputs.filingStatus || 'single') / 12) : 0;
    const totalAllocated = baseExpenses + activeDebtsTotal + activeSavings + activeTaxes;
    const debtDeficit = Math.max(0, totalAllocated - (activePhaseObj?.income || 0));

    const hasShortfall = recResults.endingSurplusShortfall < 0 || 
                         !recResults.moneyLasts ||
                         (recResults.retirementReadyAge && inputs.targetRetirementAge < recResults.retirementReadyAge) ||
                         hasChildcarePhase;

    const hasBuyHouse = (inputs.lifeEvents || []).some(e => e.type === 'buyHouse' && e.enabled);
    if (!hasShortfall && !hasBuyHouse && !(debtDeficit > 0)) return null;

    const currentAssets = (Number(inputs.assets?.cash) || 0) +
                          (Number(inputs.assets?.emergencyFund) || 0) +
                          (Number(inputs.assets?.brokerage) || 0) +
                          (Number(inputs.assets?.trad401k) || 0) +
                          (Number(inputs.assets?.tradIra) || 0) +
                          (Number(inputs.assets?.rothIra) || 0) +
                          (Number(inputs.assets?.hsa) || 0) +
                          (Number(inputs.assets?.other) || 0);

    const annualSavings = (Number(inputs.simpleIncome) || 0) - (Number(inputs.simpleExpenses) || 0);
    const standardMonthlySavings = Math.round(annualSavings / 12);

    const childcarePeakGrossBoost = Math.round(unfundedMaxChildCostsMonthly / (1 - marginalTaxRate));
    const childcarePeakGrossBoostZeroSavings = Math.round(Math.max(0, unfundedMaxChildCostsMonthly - standardMonthlySavings) / (1 - marginalTaxRate));

    const list = [];

    // 1. Retire at Age 65
    if (currentAge >= 65) {
      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: 'You are already age 65 or older.',
        bulletPoints: [
          'This option is not applicable because your current age is 65 or older.'
        ],
        readyAge: currentAge,
        yearsImprovement: null,
        value: 0,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    } else {
      const yearsTo65 = 65 - currentAge;
      let projectedAssetsAt65 = currentAssets * Math.pow(1 + rateOfReturn, yearsTo65);
      if (rateOfReturn > 0) {
        const fvFactor = (Math.pow(1 + rateOfReturn, yearsTo65) - 1) / rateOfReturn;
        projectedAssetsAt65 += annualSavings * fvFactor;
      } else {
        projectedAssetsAt65 += annualSavings * yearsTo65;
      }

      const targetAssetsAt65 = swr > 0 ? retirementExpenses / swr : 0;
      const newShortfall = Math.max(0, targetAssetsAt65 - projectedAssetsAt65);
      const saveMoreAmtAt65 = calculateSaveMoreRecommendation(
        newShortfall,
        rateOfReturn,
        yearsTo65,
        1.0
      );
      const hasShortfallAt65 = newShortfall > 0;

      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: hasShortfallAt65
          ? 'Delay your retirement to Age 65 and adjust your budget to save more to bridge the remaining shortfall.'
          : 'Delay your retirement to Age 65. Under your current plan, your assets are projected to fully support you at age 65 with no additional savings needed.',
        bulletPoints: [
          `Working until 65 adds ${65 - targetRetirementAge} more working/saving years to your plan.`,
          ...(hasShortfallAt65
            ? [
                `Save and invest an additional ${formatCurrency(saveMoreAmtAt65)}/year (approx. ${formatCurrency(Math.round(saveMoreAmtAt65 / 12))}/month) starting now.`,
                `This will compound over your remaining ${65 - currentAge} working years to bridge the remaining ${formatCurrency(newShortfall)} shortfall at age 65.`
              ]
            : [
                'This completely resolves your projected retirement shortfall with no other changes needed!'
              ])
        ],
        readyAge: 65,
        yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - 65) : null,
        value: saveMoreAmtAt65,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    }

    // 2. Retire at the retirement ready age
    if (currentReadyAge) {
      list.push({
        type: 'retireReadyAge',
        icon: '⏳',
        title: 'Retire at Retirement Ready Age',
        details: `Delay your retirement to Age ${currentReadyAge} (your Retirement Ready Age) so that your current saving and spending rates are sufficient to support you without any additional changes.`,
        bulletPoints: [
          `Working until Age ${currentReadyAge} allows your assets to compound for ${currentReadyAge - targetRetirementAge} more years.`,
          'No additional savings or income changes are required under your current budget.',
          'This completely resolves your projected retirement gap.'
        ],
        readyAge: currentReadyAge,
        yearsImprovement: null,
        value: currentReadyAge,
        savingsFocus: 'Retire Ready',
        savingsEffortScore: 2
      });
    }

    // 3. Retire at requested date
    const saveMoreAmt100 = calculateSaveMoreRecommendation(
      shortfall,
      rateOfReturn,
      yearsUntilRetirement,
      1.0
    );

    list.push({
      type: 'retireRequestedDate',
      icon: '🎯',
      title: 'Retire at Requested Retirement Date',
      details: `Maintain your target retirement age of Age ${targetRetirementAge} and adjust your budget to save more to bridge the shortfall.`,
      bulletPoints: [
        `Save and invest an additional ${formatCurrency(saveMoreAmt100)}/year (approx. ${formatCurrency(Math.round(saveMoreAmt100 / 12))}/month) before retirement.`,
        `This will compound over your remaining ${yearsUntilRetirement} working years at an assumed ${(rateOfReturn * 100).toFixed(0)}% annual rate of return.`,
        `This completely bridges your projected retirement gap at Age ${targetRetirementAge}.`
      ],
      readyAge: targetRetirementAge,
      yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - targetRetirementAge) : null,
      value: saveMoreAmt100,
      savingsFocus: 'Save More',
      savingsEffortScore: 3
    });

    // 4. Get a Promotion Recommendation
    const childRecommendations = getChildCostOffsetRecommendations(inputs);
    childRecommendations.forEach(rec => {
      const clonedInputs = JSON.parse(JSON.stringify(inputs));
      
      const promoEvent = {
        id: `promo-${rec.childEventId}`,
        type: 'careerChange',
        name: rec.childName ? `Promotion (${rec.childName})` : 'Get a Promotion',
        startAge: rec.parentStartAge,
        endAge: inputs.targetRetirementAge,
        growthRate: 0.03, // Saved as decimal for simulation (displayed as 3.0% in edit form)
        isTaxable: true,
        amount: rec.peakCost,
        salaryIncrease: rec.peakCost,
        incomeChangeType: 'increaseByAmount',
        permanent: true,
        parentEventId: rec.childEventId
      };

      clonedInputs.incomeList = [...(clonedInputs.incomeList || []), promoEvent];
      
      const boostResults = runFireSimulation(clonedInputs);
      const readyAge = boostResults.retirementReadyAge;
      const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;
      
      list.push({
        type: `childPromotion-${rec.childEventId}`,
        icon: '🟦',
        title: 'Get a Promotion',
        details: `Increase your income by ${formatCurrency(rec.peakCost)}/year permanently.`,
        bulletPoints: [
          `This offsets childcare costs today and helps you build additional savings after childcare expenses end.`,
          `A promotion or career advancement that offsets childcare costs and keeps your retirement plan on track. After childcare ends, the additional income becomes available for savings.`
        ],
        readyAge: readyAge || targetRetirementAge,
        yearsImprovement: yearsImprovement,
        value: rec.peakCost,
        promoEvent: promoEvent,
        savingsFocus: 'Earn More',
        savingsEffortScore: 2
      });
    });

    // 5. Homeownership tip
    const buyHouseEvs = (inputs.lifeEvents || []).filter(e => e.type === 'buyHouse' && e.enabled);
    buyHouseEvs.forEach(ev => {
      const sellEv = (inputs.lifeEvents || []).find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
      const sellAge = sellEv ? Number(sellEv.age) : Number(inputs.lifeExpectancy || 85);
      list.push({
        type: `houseSaleTip-${ev.id}`,
        icon: '🏠',
        title: 'Home ownership added',
        details: `This assumes you'll sell the home at age ${sellAge}.`,
        bulletPoints: [
          'You can drag the sale event later directly on the timeline.'
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: 0,
        savingsFocus: 'Tip',
        savingsEffortScore: 0,
        isInfoOnly: true
      });
    });

    const activeBuyHouseEv = (inputs.lifeEvents || []).find(e => e.type === 'buyHouse' && e.enabled);
    let houseDeficit = 0;
    if (activeBuyHouseEv) {
      const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);
      const housePhase = normPhases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      if (housePhase) {
        const houseDebts = getActiveDebtsForAge(inputs, purchaseAge);
        const filteredHouseDebts = houseDebts.filter(d => d.id !== 'mortgage' && d.id !== '🏠 Mortgage' && d.type !== 'mortgage');
        const houseDebtsTotal = filteredHouseDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
        const houseBaseExpenses = Object.keys(housePhase.expenses || {}).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (housePhase.expenses[v] || 0), 0);
        const houseSavings = housePhase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(housePhase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        const houseTaxes = inputs.includeTaxes ? Math.round(calculateUSTaxForModal(housePhase.income * 12 || 0, 0, inputs.filingStatus || 'single') / 12) : 0;
        const houseTotalAllocated = houseBaseExpenses + houseDebtsTotal + houseSavings + houseTaxes;
        houseDeficit = Math.max(0, houseTotalAllocated - (housePhase.income || 0));
      }
    }

    let baselineReadyAge = null;
    let housingCostChange = 0;
    let monthlySurplusChange = 0;
    let retirementReadyAgeUnchanged = true;
    let isAffordable = true;
    let isMonthlyDeficitOnly = false;
    let isRetirementImpactCreated = false;
    let rebalanceData = null;
    let isLiquidInsufficient = false;

    if (activeBuyHouseEv) {
      const purchaseAge = Number(activeBuyHouseEv.purchaseAge || activeBuyHouseEv.age || 40);
      
      // Get phases without the house event
      const baselineInputs = JSON.parse(JSON.stringify(recInputs));
      baselineInputs.lifeEvents = (baselineInputs.lifeEvents || []).map(ev => {
        if (ev.type === 'buyHouse') {
          return { ...ev, enabled: false };
        }
        return ev;
      });
      const baselineResultsSim = runFireSimulation(baselineInputs);
      baselineReadyAge = baselineResultsSim.retirementReadyAge;

      rebalanceData = getRebalanceStrategies(inputs, activeBuyHouseEv, baselineReadyAge);
      isLiquidInsufficient = !!(rebalanceData && rebalanceData.totalCashNeeded > rebalanceData.liquidFundsAvailable);

      const phasesWithHouse = normPhases;
      const phasesWithoutHouse = getNormalizedPhases(baselineInputs);
      
      const postPhase = phasesWithHouse.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      const prePhase = phasesWithoutHouse.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      
      if (postPhase && prePhase) {
        const preHousingCost = prePhase.expenses['housing'] || prePhase.expenses['rent'] || 0;
        
        const p = Number(activeBuyHouseEv.homePrice !== undefined ? activeBuyHouseEv.homePrice : (activeBuyHouseEv.purchasePrice !== undefined ? activeBuyHouseEv.purchasePrice : 0)) || 0;
        const dp = Number(activeBuyHouseEv.downPayment) || 0;
        const isCash = dp >= p || activeBuyHouseEv.purchaseType === 'cash';
        
        let monthlyPI = 0;
        let loanAmount = 0;
        if (!isCash) {
          const rate = (activeBuyHouseEv.mortgageRate !== undefined ? Number(activeBuyHouseEv.mortgageRate) : 6.5) / 100;
          const mortgageTerm = activeBuyHouseEv.loanTerm !== undefined ? Number(activeBuyHouseEv.loanTerm) : 30;
          loanAmount = Math.max(0, p - dp);
          if (loanAmount > 0 && mortgageTerm > 0) {
            const r = rate / 12;
            const n = mortgageTerm * 12;
            monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
          }
        }

        const propTaxRate = (activeBuyHouseEv.propertyTax !== undefined ? Number(activeBuyHouseEv.propertyTax) : 1.1) / 100;
        const insRate = (activeBuyHouseEv.insurance !== undefined ? Number(activeBuyHouseEv.insurance) : 0.35) / 100;
        const maintRate = (activeBuyHouseEv.maintenance !== undefined ? Number(activeBuyHouseEv.maintenance) : 1.0) / 100;
        
        const monthlyPropTax = (p * propTaxRate) / 12;
        const monthlyIns = (p * insRate) / 12;
        const monthlyMaint = (p * maintRate) / 12;
        const monthlyHoa = Number(activeBuyHouseEv.hoa) || 0;
        const monthlyUtil = Number(activeBuyHouseEv.utilitiesIncrease) || 0;
        
        let monthlyPmi = 0;
        if (!isCash && dp < p * 0.2) {
          const pmiRate = activeBuyHouseEv.pmi !== undefined ? Number(activeBuyHouseEv.pmi) : 0.5;
          monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
        }
        
        const totalMonthlyHouseCost = monthlyPI + monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi;
        const keepRent = !!activeBuyHouseEv.keepRent;
        housingCostChange = Math.round(totalMonthlyHouseCost - (keepRent ? 0 : preHousingCost));
        
        const getPhaseSurplus = (phase, inputsObj) => {
          const debts = getActiveDebtsForAge(inputsObj, phase.startAge);
          const filteredDebts = debts.filter(d => d.id !== 'mortgage' && d.id !== '🏠 Mortgage' && d.type !== 'mortgage');
          const debtsTotal = filteredDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
          const baseExpenses = Object.keys(phase.expenses || {}).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (phase.expenses[v] || 0), 0);
          const savings = phase.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
          const taxes = inputsObj.includeTaxes ? Math.round(calculateUSTaxForModal(phase.income * 12 || 0, 0, inputsObj.filingStatus || 'single') / 12) : 0;
          const totalAllocated = baseExpenses + debtsTotal + savings + taxes;
          return phase.income - totalAllocated;
        };

        const preSurplus = getPhaseSurplus(prePhase, baselineInputs);
        const postSurplus = getPhaseSurplus(postPhase, recInputs);
        monthlySurplusChange = Math.round(postSurplus - preSurplus);
      }

      isAffordable = isHouseAffordableBalanced(inputs, activeBuyHouseEv, baselineReadyAge);
      if (isLiquidInsufficient) {
        isAffordable = false;
      }
      
      if (!isAffordable) {
        const readyAge = recResults.retirementReadyAge;
        const targetRetAge = Number(inputs.targetRetirementAge) || 65;
        const retirementFailed = (readyAge && readyAge > targetRetAge) || !recResults.moneyLasts;
        const readyAgeDelayed = readyAge !== null && baselineReadyAge !== null && readyAge > baselineReadyAge + 1;
        
        if (retirementFailed || readyAgeDelayed) {
          isRetirementImpactCreated = true;
          retirementReadyAgeUnchanged = false;
        } else {
          isMonthlyDeficitOnly = true;
          retirementReadyAgeUnchanged = true;
        }
      } else {
        retirementReadyAgeUnchanged = true;
        isMonthlyDeficitOnly = false;
        isRetirementImpactCreated = false;
      }
    }

    // Generate house-related recommendations if a deficit, impact, or liquid insufficiency was created
    if (activeBuyHouseEv && (houseDeficit > 0 || isRetirementImpactCreated || isLiquidInsufficient)) {
      if (isLiquidInsufficient && rebalanceData) {
        const liquidShortfall = rebalanceData.totalCashNeeded - rebalanceData.liquidFundsAvailable;

        list.push({
          type: 'redirectSavingsDownPayment',
          icon: '💰',
          title: 'Redirect savings to down payment',
          details: 'Redirect your ongoing monthly savings to your down payment fund instead of long-term investments.',
          bulletPoints: [
            'Build your cash reserves specifically for the home purchase down payment.',
            'Focusing cash flow on the down payment helps you reach the required liquid balance faster.',
            'Avoids having to pull funds from retirement accounts.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Down Payment',
          savingsEffortScore: 1,
          priorityGroup: 1,
          isPrimary: true
        });

        list.push({
          type: 'pauseNonRetirementSavings',
          icon: '🛑',
          title: 'Pause non-retirement savings',
          details: 'Temporarily pause other non-essential savings buckets (like travel or auto funds) to prioritize your home purchase.',
          bulletPoints: [
            'Directs all available discretionary savings toward your down payment.',
            'Shortens the time needed to save up for the purchase.',
            'Can be resumed once the home purchase is complete.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Savings',
          savingsEffortScore: 1,
          priorityGroup: 1,
          isPrimary: false
        });

        list.push({
          type: 'redirectBrokerageHouseFund',
          icon: '📈',
          title: 'Redirect brokerage contributions',
          details: 'Redirect monthly contributions from your taxable brokerage account to your down payment cash fund.',
          bulletPoints: [
            'Taxable brokerage investments can be volatile; cash is safer for short-term down payment needs.',
            'Reduces investment risk for funds needed in the near term.',
            'Ensures you have liquid cash available when closing.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Brokerage',
          savingsEffortScore: 1,
          priorityGroup: 1,
          isPrimary: false
        });

        list.push({
          type: 'increaseDownPaymentIncome',
          icon: '💵',
          title: 'Increase income for down payment',
          details: 'Earn additional income to accelerate saving for your down payment shortfall.',
          bulletPoints: [
            'Additional income directly increases your liquid cash capacity.',
            'Consider side projects, bonuses, or career changes to bridge the down payment gap.',
            'Keeps your current lifestyle budget intact.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Earn More',
          savingsEffortScore: 2,
          priorityGroup: 1,
          isPrimary: false
        });

        list.push({
          type: 'delayHomePurchaseDownPayment',
          icon: '⏳',
          title: 'Delay home purchase for down payment',
          details: 'Delay your purchase timeline to allow more time for your liquid assets to grow.',
          bulletPoints: [
            'Provides more months to build up the necessary down payment cash.',
            'Allows compound growth on existing brokerage and cash assets.',
            'Lowers the required loan amount when you eventually buy.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Delay Event',
          savingsEffortScore: 2,
          priorityGroup: 1,
          isPrimary: false
        });

        list.push({
          type: 'purchaseWithPartner',
          icon: '👥',
          title: 'Purchase with a partner',
          details: 'Combine liquid assets and incomes with a spouse or co-buyer to purchase the home.',
          bulletPoints: [
            'Doubles your liquid down payment capacity.',
            'Shares transaction costs and ongoing mortgage expenses.',
            'Improves mortgage approval odds and affordability.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Co-buying',
          savingsEffortScore: 2,
          priorityGroup: 1,
          isPrimary: false
        });

        list.push({
          type: 'purchaseWithRoommate',
          icon: '🤝',
          title: 'Purchase with a roommate',
          details: 'Co-sign or rent out a room to a roommate to share down payment and monthly costs.',
          bulletPoints: [
            'Reduces your individual down payment requirement by co-owning.',
            'Rental income from a roommate offsets monthly housing costs.',
            'Makes homeownership accessible sooner.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: liquidShortfall,
          savingsFocus: 'Co-buying',
          savingsEffortScore: 2,
          priorityGroup: 1,
          isPrimary: false
        });
      }

      list.push({
        type: 'reduceHomePrice',
        icon: '📉',
        title: 'Reduce home price',
        details: 'Lower the purchase price to decrease your mortgage size and monthly payment.',
        bulletPoints: [
          'Reduce home price to eliminate the monthly deficit.',
          'This lowers the mortgage loan size, reducing your monthly payment and interest expense.',
          'Keeps your retirement timeline on track.'
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: houseDeficit,
        savingsFocus: 'Home Purchase',
        savingsEffortScore: 2,
        priorityGroup: isLiquidInsufficient ? 2 : 1,
        isPrimary: false
      });

      if (!isLiquidInsufficient) {
        list.push({
          type: 'increaseDownPayment',
          icon: '💰',
          title: 'Increase down payment',
          details: 'Put more money down upfront to decrease your mortgage size and monthly payment.',
          bulletPoints: [
            'Increase down payment to eliminate the monthly deficit.',
            'This lowers the mortgage loan size, reducing your monthly payment and interest expense.',
            'Keeps your retirement timeline on track.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: houseDeficit,
          savingsFocus: 'Home Purchase',
          savingsEffortScore: 2,
          priorityGroup: 1,
          isPrimary: false
        });
      }

      list.push({
        type: 'delayHomePurchase',
        icon: '⏳',
        title: 'Delay home purchase',
        details: 'Delay buying the house to allow your investments to compound and increase your cash/down payment.',
        bulletPoints: [
          'Delay the purchase by 3-5 years.',
          'This gives you more time to save a larger down payment, which will lower the mortgage loan amount.',
          'Reduces total interest paid over the life of the loan.'
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: houseDeficit,
        savingsFocus: 'Delay Event',
        savingsEffortScore: 2,
        priorityGroup: 1,
        isPrimary: false
      });

      if (isRetirementImpactCreated) {
        list.push({
          type: 'increaseHomeIncome',
          icon: '💰',
          title: `Increase income by $${houseDeficit}/month`,
          details: `Increase your gross monthly income by $${houseDeficit}/month ($${houseDeficit * 12}/year) to cover the mortgage deficit.`,
          bulletPoints: [
            `Earn an extra $${houseDeficit}/month ($${houseDeficit * 12}/year) gross income.`,
            `This covers the monthly deficit without changing your savings or wants allocations.`,
            `Your retirement timeline remains fully on track.`
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: houseDeficit,
          savingsFocus: 'Earn More',
          savingsEffortScore: 2,
          priorityGroup: 2,
          isPrimary: true
        });

        list.push({
          type: 'reduceWantsNeeds',
          icon: '🛒',
          title: 'Reduce spending',
          details: `Reduce your lifestyle spending in other categories by a combined $${houseDeficit}/month to free up cash flow.`,
          bulletPoints: [
            `Reduce dining out, leisure, or other Needs categories by $${houseDeficit}/month.`,
            `This fits the mortgage into your existing income without overallocating your budget.`,
            `Maintains your current savings rate and retirement ready age.`
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: houseDeficit,
          savingsFocus: 'Budget Adjust',
          savingsEffortScore: 2,
          priorityGroup: 2,
          isPrimary: false
        });

        list.push({
          type: 'extendRetirementAge',
          icon: '📅',
          title: 'Retire later',
          details: 'Work and save for longer to support the home purchase and offset the shortfall.',
          bulletPoints: [
            'Extending your target retirement age gives you more years of income to cover the mortgage.',
            'Allows your investment portfolio more time to grow and compound.',
            'Helps secure your retirement despite higher housing expenses.'
          ],
          readyAge: currentReadyAge || targetRetirementAge,
          yearsImprovement: null,
          value: houseDeficit,
          savingsFocus: 'Retire Later',
          savingsEffortScore: 3,
          priorityGroup: 3,
          isPrimary: false
        });
      }
    }

    if (debtDeficit > 0 && activeDebts.length > 0) {
      list.push({
        type: 'startDebtPayoff',
        icon: '📈',
        title: 'Start a debt payoff plan',
        details: `Create a debt payoff plan to pay down your highest-interest debts faster and eliminate the deficit.`,
        bulletPoints: [
          `Add an extra monthly payment to accelerate your payoff timeline.`,
          `Once paid off, your Needs expenses will drop, increasing your future savings.`,
          `This helps you reach financial independence sooner.`
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: debtDeficit,
        savingsFocus: 'Debt Payoff',
        savingsEffortScore: 2,
        priorityGroup: 2,
        isPrimary: false,
        activeDebts
      });

      list.push({
        type: 'increaseDebtIncome',
        icon: '💰',
        title: `Increase income by $${debtDeficit}/month`,
        details: `Increase your monthly gross income by earning extra money to fully cover your new debt obligations.`,
        bulletPoints: [
          `Earn an extra $${debtDeficit}/month ($${debtDeficit * 12}/year) gross income.`,
          `This covers the monthly deficit without changing your savings or wants allocations.`,
          `Your retirement timeline remains fully on track.`
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: debtDeficit,
        savingsFocus: 'Earn More',
        savingsEffortScore: 2,
        priorityGroup: 2,
        isPrimary: false
      });
    }

    // Set priority group 3 for general retirement recommendations
    list.forEach(item => {
      if (item.priorityGroup === undefined) {
        if (['retire65', 'retireReadyAge', 'retireRequestedDate'].includes(item.type) || item.type.startsWith('childPromotion')) {
          item.priorityGroup = 3;
          item.isPrimary = false;
        } else {
          item.priorityGroup = 3;
          item.isPrimary = false;
        }
      }
    });

    // If affordable house, return no recommendations
    let finalRankedPlan = [];
    if (!(activeBuyHouseEv && isAffordable)) {
      finalRankedPlan = list.sort((a, b) => {
        if (a.isInfoOnly && !b.isInfoOnly) return 1;
        if (!a.isInfoOnly && b.isInfoOnly) return -1;
        
        const aGroup = a.priorityGroup !== undefined ? a.priorityGroup : 3;
        const bGroup = b.priorityGroup !== undefined ? b.priorityGroup : 3;
        if (aGroup !== bGroup) {
          return aGroup - bGroup;
        }
        
        return a.savingsEffortScore - b.savingsEffortScore;
      });
    }

    return {
      rankedPlan: finalRankedPlan,
      isAffordable: activeBuyHouseEv ? isAffordable : false,
      isMonthlyDeficitOnly: activeBuyHouseEv ? isMonthlyDeficitOnly : false,
      isRetirementImpactCreated: activeBuyHouseEv ? isRetirementImpactCreated : false,
      houseDeficit: activeBuyHouseEv ? houseDeficit : 0,
      housingCostChange: activeBuyHouseEv ? housingCostChange : 0,
      monthlySurplusChange: activeBuyHouseEv ? monthlySurplusChange : 0,
      retirementReadyAgeUnchanged: activeBuyHouseEv ? retirementReadyAgeUnchanged : true,
      retirementReadyAge: recResults.retirementReadyAge,
      baselineReadyAge,
      moneyLasts: recResults.moneyLasts,
      shortfall: shortfall,
      childcarePeakGrossBoost,
      childcarePeakGrossBoostZeroSavings
    };
  }, [inputs, activeResults]);

  return {
    improvementPlan
  };
}
