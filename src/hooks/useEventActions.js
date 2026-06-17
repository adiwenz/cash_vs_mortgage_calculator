import { useState, useRef } from 'react';
import { runFireSimulation } from '../fireCalculations';
import { calculateMarriageEstimates } from '../components/fire-simulator/helpers';
import { derivePhasesFromEvents } from '../calculators/fire/phases';

export function useEventActions(
  scenarios,
  setScenarios,
  currentScenarioId,
  inputs,
  updateInput,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard,
  isMobile,
  setShowImprovementModal
) {
  const [hookEditingEvent, setEditingEvent] = useState(null);
  const editingEvent = hookEditingEvent;
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  const dragOccurredRef = useRef(false);

  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
      return;
    }
    let defaults = { type };
    const curAge = inputs.currentAge || 35;
    
    if (type === 'buyHouse') {
      defaults = {
        ...defaults,
        purchaseAge: 40,
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        points: 0,
        pmi: 0.5,
        closingCosts: 3,
        propertyTax: 1.1,
        insurance: 0.35,
        hoa: 0,
        maintenance: 1,
        renovationCost: 0,
        utilitiesIncrease: 0,
        appreciationRate: 3,
        sellingCost: 6,
        yearsUntilSale: '',
        currentRent: 0,
        rentGrowth: 3,
        renterInsurance: 0,
        investmentReturn: 7,
        inflation: 3,
        keepRent: false
      };
    } else if (type === 'haveChild') {
      defaults = {
        ...defaults,
        childName: '',
        childStartAge: 0,
        birthAge: inputs.currentAge || 35,
        costMethod: 'default',
        customAges0to4: 15000,
        customAges5to12: 9000,
        customAges13to18: 12000,
        customAges19to22: 20000,
        includeCollege: false
      };
    } else if (type === 'careerChange') {
      defaults = { ...defaults, name: 'Senior Manager', startAge: 40, amount: 150000, growthRate: 3.5 };
    } else if (type === 'move') {
      defaults = { ...defaults, location: 'Dominican Republic', moveAge: 55, newSpending: 40000, movingCost: 0 };
    } else if (type === 'retire') {
      defaults = { ...defaults, age: 55, spendingPercent: 70 };
    } else if (type === 'windfall') {
      defaults = { ...defaults, ageReceived: 50, amount: 100000, taxRate: 15 };
    } else if (type === 'college') {
      defaults = { ...defaults, startAge: 48, tuitionCost: 30000, duration: 4 };
    } else if (type === 'debtPayoff') {
      defaults = { ...defaults, payoffAge: 38, amount: 5000 };
    } else if (type === 'custom') {
      defaults = { ...defaults, name: 'Custom Event', age: 45, amount: -15000 };
    } else if (type === 'socialSecurity') {
      defaults = { ...defaults, claimingAge: 67, monthlyBenefit: 2000, inflationAdjusted: true, name: 'Social Security', ageStartedWorking: 22 };
    } else if (type === 'pension') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 1000, inflationAdjusted: true, name: 'Pension' };
    } else if (type === 'rentalIncome') {
      defaults = { ...defaults, claimingAge: 60, monthlyBenefit: 1500, inflationAdjusted: true, name: 'Rental Income' };
    } else if (type === 'annuity') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 500, inflationAdjusted: false, name: 'Annuity' };
    } else if (type === 'otherRetirementIncome') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 800, inflationAdjusted: true, name: 'Other Income' };
    } else if (type === 'marriage') {
      const userIncome = Number(inputs.simpleIncome) || 50000;
      const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
      const userAssets = (Number(inputs.assets?.cash) || 0) +
                         (Number(inputs.assets?.brokerage) || 0) +
                         (Number(inputs.assets?.trad401k) || 0) +
                         (Number(inputs.assets?.tradIra) || 0) +
                         (Number(inputs.assets?.rothIra) || 0) +
                         (Number(inputs.assets?.hsa) || 0) +
                         (Number(inputs.assets?.other) || 0);
      const userDebt = (Number(inputs.assets?.debts) || 0) +
                       (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);

      defaults = {
        ...defaults,
        age: inputs.currentAge || 35,
        spouseIncome: userIncome,
        incomeGrowthRate: 3,
        cash: 0,
        investments: userAssets,
        retirement: 0,
        debtStudent: 0,
        debtCredit: 0,
        debtOther: userDebt,
        savingsRate: userSavingsRate,
        housingOption: 'move',
        housingSavings: 0,
        housingCost: 0,
        lifestyleOption: 'same',
        lifestyleAdjustment: 0,
        includeWeddingCost: true,
        weddingCost: 20000,
        weddingFundingMethod: 'savings',
        weddingAge: inputs.currentAge || 35,
        filingStatus: 'jointly',
        wizardStep: 1,
        spouseCurrentAge: inputs.currentAge || 35,
        spouseLifeExpectancy: inputs.lifeExpectancy || 85,
        spouseSocialSecurityAge: 67,
        spouseEstimatedSocialSecurityBenefit: 0,
        spouseDesiredRetirementAge: '',
        retirementSpendingNeed: '',
        partnerRetiresWithUser: true
      };
    } else if (['studentLoan', 'carLoan', 'personalLoan', 'creditCard'].includes(type)) {
      defaults = {
        ...defaults,
        type: 'borrowing',
        borrowingType: type,
        startAge: curAge,
        isExisting: true,
        timing: 'current',
        payoffPlanEnabled: true,
        notes: ''
      };
      
      if (type === 'studentLoan') {
        defaults.name = 'Student Loan';
        defaults.balance = 30000;
        defaults.interestRate = 5.0;
        defaults.minPayment = 318.20;
      } else if (type === 'carLoan') {
        defaults.name = 'Car Loan';
        defaults.purchasePrice = 25000;
        defaults.downPayment = 5000;
        defaults.balance = 20000;
        defaults.interestRate = 6.0;
        defaults.isExisting = false;
        defaults.timing = 'future';
        defaults.startAge = curAge + 1;
        defaults.minPayment = 386.66;
      } else if (type === 'personalLoan') {
        defaults.name = 'Personal Loan';
        defaults.balance = 10000;
        defaults.interestRate = 8.0;
        defaults.minPayment = 313.36;
      } else if (type === 'creditCard') {
        defaults.name = 'Credit Card Balance';
        defaults.balance = 5000;
        defaults.interestRate = 22.0;
        defaults.minPayment = 100;
      }
    }
    
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setEditingEvent(defaults);
  };

  const handleEditRoadmapEvent = (evt) => {
    if (!evt) return;
    
    let baseEvent = null;
    if (evt.originalId) {
      baseEvent = inputs.lifeEvents.find(e => e.id === evt.originalId);
      if (!baseEvent) {
        baseEvent = inputs.spendingPhases.find(p => p.id === evt.originalId);
      }
      if (!baseEvent) {
        baseEvent = inputs.incomeList.find(i => i.id === evt.originalId);
      }
    } else {
      baseEvent = inputs.lifeEvents.find(e => e.type === evt.type && (e.age === evt.age || e.purchaseAge === evt.age || e.birthAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age));
    }

    if (baseEvent) {
      setIsFullPartnerProfileOpen(false);
      setIsZeroSpendingConfirmed(false);
      
      if (baseEvent.type === 'marriage') {
        setEditingEvent({
          ...baseEvent,
          age: Number(baseEvent.age),
          spouseIncome: Number(baseEvent.spouseIncome || 0),
          incomeGrowthRate: Number(baseEvent.incomeGrowthRate || 3),
          cash: Number(baseEvent.cash || 0),
          investments: Number(baseEvent.investments || 0),
          retirement: Number(baseEvent.retirement || 0),
          debtStudent: Number(baseEvent.debtStudent || 0),
          debtCredit: Number(baseEvent.debtCredit || 0),
          debtOther: Number(baseEvent.debtOther || 0),
          savingsRate: Number(baseEvent.savingsRate || 0),
          housingOption: baseEvent.housingOption || 'move',
          housingSavings: Number(baseEvent.housingSavings || 0),
          housingCost: Number(baseEvent.housingCost || 0),
          lifestyleOption: baseEvent.lifestyleOption || 'same',
          lifestyleAdjustment: Number(baseEvent.lifestyleAdjustment || 0),
          includeWeddingCost: !!baseEvent.includeWeddingCost,
          weddingCost: Number(baseEvent.weddingCost || 0),
          weddingFundingMethod: baseEvent.weddingFundingMethod || 'savings',
          weddingAge: Number(baseEvent.weddingAge || baseEvent.age),
          filingStatus: baseEvent.filingStatus || 'jointly',
          spouseCurrentAge: baseEvent.spouseCurrentAge !== undefined ? Number(baseEvent.spouseCurrentAge) : Number(baseEvent.age),
          spouseLifeExpectancy: baseEvent.spouseLifeExpectancy !== undefined ? Number(baseEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
          spouseSocialSecurityAge: baseEvent.spouseSocialSecurityAge !== undefined ? Number(baseEvent.spouseSocialSecurityAge) : 67,
          spouseEstimatedSocialSecurityBenefit: baseEvent.spouseEstimatedSocialSecurityBenefit !== undefined ? Number(baseEvent.spouseEstimatedSocialSecurityBenefit) : 0,
          spouseDesiredRetirementAge: baseEvent.spouseDesiredRetirementAge !== undefined ? Number(baseEvent.spouseDesiredRetirementAge) : null,
          desiredRetirementAge: baseEvent.spouseDesiredRetirementAge !== undefined ? Number(baseEvent.spouseDesiredRetirementAge) : null,
          partnerRetiresWithUser: baseEvent.partnerRetiresWithUser !== false,
          retirementSpendingNeed: baseEvent.retirementSpendingNeed !== undefined ? Number(baseEvent.retirementSpendingNeed) : null,
          combinedSpendingAfterMarriage: baseEvent.combinedSpendingAfterMarriage !== undefined ? Number(baseEvent.combinedSpendingAfterMarriage) : null
        });
      } else if (baseEvent.type === 'buyHouse') {
        const asset = inputs.houseAssets?.find(h => h.id === baseEvent.houseId);
        setEditingEvent({
          ...baseEvent,
          ...asset,
          homePrice: asset ? asset.purchasePrice : 500000,
          downPayment: asset ? asset.downPayment : 100000,
          mortgageRate: asset ? asset.mortgageRate : 6.5,
          loanTerm: asset ? asset.loanTermYears : 30,
          appreciationRate: asset ? asset.appreciationRate : 3.0,
          sellingCost: asset ? asset.sellingCostRate : 6,
          purchaseAge: baseEvent.purchaseAge || baseEvent.age
        });
      } else if (baseEvent.type === 'borrowing') {
        const payoff = inputs.lifeEvents.find(e => e.type === 'payoffPlan' && e.borrowingId === baseEvent.id);
        setEditingEvent({
          ...baseEvent,
          interestRate: baseEvent.interestRate !== undefined ? baseEvent.interestRate : 5.0,
          minPayment: baseEvent.minPayment !== undefined ? baseEvent.minPayment : 100,
          payoffPlanEnabled: !!payoff,
          extraPayment: payoff ? payoff.extraPayment : 100,
          targetPayoffAge: payoff ? payoff.targetPayoffAge : null
        });
      } else if (baseEvent.type === 'payoffPlan') {
        setEditingEvent({
          ...baseEvent
        });
      } else {
        const isFromIncomeList = inputs.incomeList?.some(i => i.id === baseEvent.id);
        const isFromSpendingPhases = inputs.spendingPhases?.some(p => p.id === baseEvent.id);
        
        let extraFields = {};
        if (isFromSpendingPhases) {
          let location = baseEvent.location;
          if (!location && baseEvent.name && baseEvent.name.startsWith("Moved to ")) {
            location = baseEvent.name.substring("Moved to ".length);
          }
          extraFields = {
            location: location || 'New City',
            moveAge: baseEvent.moveAge !== undefined ? baseEvent.moveAge : baseEvent.startAge,
            newSpending: baseEvent.newSpending !== undefined ? baseEvent.newSpending : baseEvent.annualSpending,
            movingCost: baseEvent.movingCost !== undefined ? baseEvent.movingCost : 0
          };
        }

        setEditingEvent({
          ...baseEvent,
          ...extraFields,
          type: isFromIncomeList ? 'careerChange' : (isFromSpendingPhases ? 'move' : baseEvent.type),
          growthRate: isFromIncomeList && baseEvent.growthRate !== undefined ? Number(baseEvent.growthRate) * 100 : baseEvent.growthRate
        });
      }
    } else if (evt.type === 'retire') {
      setIsFullPartnerProfileOpen(false);
      setIsZeroSpendingConfirmed(false);
      setEditingEvent({
        id: 'retire',
        type: 'retire',
        age: Number(evt.age),
        spendingPercent: evt.spendingPercent !== undefined ? evt.spendingPercent : 70
      });
    }
  };

  const handleSaveEvent = (passedEvent) => {
    const isSyntheticEvent = passedEvent && (passedEvent.nativeEvent || passedEvent.preventDefault);
    const editingEvent = (passedEvent && !isSyntheticEvent) ? passedEvent : hookEditingEvent;
    if (!editingEvent) return;
    const type = editingEvent.type;
    
    let beforeReadyAge = null;
    let afterReadyAge = null;
    let avgAnnualChildCost = 0;

    if (type === 'haveChild') {
      const currentScenObj = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
      const beforeRes = runFireSimulation(currentScenObj.inputs);
      beforeReadyAge = beforeRes.retirementReadyAge;

      const startAge = editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0;
      const includeCollege = !!editingEvent.includeCollege;
      const maxAge = includeCollege ? 22 : 18;
      let totalCost = 0;
      let activeYears = 0;
      for (let childAge = startAge; childAge < maxAge; childAge++) {
        const ages0to4 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges0to4 !== undefined ? Number(editingEvent.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
        const ages5to12 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges5to12 !== undefined ? Number(editingEvent.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
        const ages13to18 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges13to18 !== undefined ? Number(editingEvent.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
        const ages19to22 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

        if (childAge >= 0 && childAge <= 4) {
          totalCost += ages0to4;
        } else if (childAge >= 5 && childAge <= 12) {
          totalCost += ages5to12;
        } else if (childAge >= 13 && childAge <= 18) {
          totalCost += ages13to18;
        } else if (childAge >= 19 && childAge <= 22) {
          totalCost += ages19to22;
        }
        activeYears++;
      }
      avgAnnualChildCost = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;
    }

    let savedEvent = null;
    let updatedInputs = null;
    const nextScenarios = scenarios.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      
      let newInputs = { ...scen.inputs };
      updatedInputs = newInputs;
      
      if (editingEvent.id) {
        const oldEvent = newInputs.lifeEvents.find(e => e.id === editingEvent.id);
        if (oldEvent && oldEvent.type === 'haveChild') {
          const birthAgeVal = Number(editingEvent.birthAge !== undefined ? editingEvent.birthAge : editingEvent.parentAgeAtBirth) || 30;
          const childStartAgeVal = Number(editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0);
          const includeCollegeVal = !!editingEvent.includeCollege;
          const maxAgeVal = includeCollegeVal ? 22 : 18;
          
          const childCostsInput = newInputs.childCosts || inputs.childCosts;
          const ages0to4Val = editingEvent.costMethod === 'custom' ? (editingEvent.customAges0to4 !== undefined ? Number(editingEvent.customAges0to4) : 15000) : (childCostsInput?.ages0to4 !== undefined ? Number(childCostsInput.ages0to4) : 15000);
          const ages5to12Val = editingEvent.costMethod === 'custom' ? (editingEvent.customAges5to12 !== undefined ? Number(editingEvent.customAges5to12) : 15000) : (childCostsInput?.ages5to12 !== undefined ? Number(childCostsInput.ages5to12) : 15000);
          const ages13to18Val = editingEvent.costMethod === 'custom' ? (editingEvent.customAges13to18 !== undefined ? Number(editingEvent.customAges13to18) : 15000) : (childCostsInput?.ages13to18 !== undefined ? Number(childCostsInput.ages13to18) : 15000);
          const ages19to22Val = editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : (childCostsInput?.ages19to22 !== undefined ? Number(childCostsInput.ages19to22) : 15000);
          
          const costsVal = [];
          if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
          if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
          if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
          if (includeCollegeVal && childStartAgeVal <= 22 && maxAgeVal >= 19) costsVal.push(ages19to22Val);
          
          const peakCostVal = Math.max(...costsVal, 0);
          const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

          newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
            if (inc.id === oldEvent.linkedEventId || inc.parentEventId === oldEvent.id || inc.id === editingEvent.linkedEventId || inc.parentEventId === editingEvent.id) {
              return {
                ...inc,
                startAge: newPromoStartAgeVal,
                salaryIncrease: peakCostVal,
                name: editingEvent.childName ? `Promotion (${editingEvent.childName})` : 'Get a Promotion'
              };
            }
            return inc;
          });
        }
        if (newInputs.lifeEvents.some(e => e.id === editingEvent.id)) {
          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== editingEvent.id);
        } else {
          const matchSpend = newInputs.spendingPhases.find(p => p.id === editingEvent.id);
          if (matchSpend) {
            const remaining = newInputs.spendingPhases.filter(p => p.id !== editingEvent.id);
            newInputs.spendingPhases = remaining.map(p => {
              if (p.endAge === matchSpend.startAge) {
                return { ...p, endAge: matchSpend.endAge };
              }
              return p;
            });
          } else {
            const matchInc = newInputs.incomeList.find(i => i.id === editingEvent.id);
            if (matchInc) {
              const remaining = newInputs.incomeList.filter(i => i.id !== editingEvent.id);
              newInputs.incomeList = remaining.map(i => {
                if (i.endAge === matchInc.startAge) {
                  return { ...i, endAge: matchInc.endAge };
                }
                return i;
              });
            }
          }
        }
      }
      
      if (type === 'retire') {
        newInputs.targetRetirementAge = editingEvent.age;
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.type !== 'retire');
        let newEventObj = {
          id: editingEvent.id && editingEvent.id !== 'retire' ? editingEvent.id : `retire-${Date.now()}`,
          type: 'retire',
          enabled: true,
          name: 'Retirement',
          age: editingEvent.age,
          spendingPercent: editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70
        };
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      } else if (type === 'move') {
        const newPhase = {
          id: editingEvent.id && editingEvent.id !== 'move' ? editingEvent.id : `spend-${Date.now()}`,
          name: `Moved to ${editingEvent.location}`,
          startAge: editingEvent.moveAge,
          endAge: newInputs.lifeExpectancy,
          amount: editingEvent.newSpending,
          frequency: 'yearly',
          annualSpending: editingEvent.newSpending,
          inflationOverride: null,
          notes: `Lifestyle after moving to ${editingEvent.location}`,
          location: editingEvent.location,
          moveAge: editingEvent.moveAge,
          newSpending: editingEvent.newSpending,
          movingCost: Number(editingEvent.movingCost) || 0
        };
        const updatedPhases = newInputs.spendingPhases.map(p => {
          if (p.startAge < editingEvent.moveAge && p.endAge > editingEvent.moveAge) {
            return { ...p, endAge: editingEvent.moveAge };
          }
          return p;
        });
        newInputs.spendingPhases = [...updatedPhases, newPhase];
      } else if (type === 'careerChange') {
        const newInc = {
          id: editingEvent.id && editingEvent.id !== 'careerChange' ? editingEvent.id : `inc-${Date.now()}`,
          name: editingEvent.name,
          amount: editingEvent.amount,
          frequency: 'yearly',
          startAge: editingEvent.startAge,
          endAge: newInputs.targetRetirementAge,
          growthRate: (editingEvent.growthRate !== undefined ? Number(editingEvent.growthRate) : 3.0) / 100,
          isTaxable: true,
          
          incomeChangeType: editingEvent.incomeChangeType || 'newIncomeLevel',
          salaryIncrease: editingEvent.incomeChangeType === 'increaseByAmount' 
            ? (editingEvent.salaryIncrease !== undefined ? Number(editingEvent.salaryIncrease) : Number(editingEvent.amount))
            : undefined,
          permanent: editingEvent.permanent !== undefined ? !!editingEvent.permanent : false,
          parentEventId: editingEvent.parentEventId || null
        };
        const updatedIncome = newInputs.incomeList.map(inc => {
          if (inc.startAge < editingEvent.startAge && inc.endAge > editingEvent.startAge) {
            return { ...inc, endAge: editingEvent.startAge };
          }
          return inc;
        });
        newInputs.incomeList = [...updatedIncome, newInc];
      } else if (type === 'buyHouse') {
        const houseId = editingEvent.houseId || `house-${Date.now()}`;
        const houseAssetObj = {
          id: houseId,
          name: editingEvent.name || 'Primary Home',
          purchasePrice: Number(editingEvent.homePrice),
          downPayment: Number(editingEvent.downPayment),
          purchaseType: editingEvent.purchaseType || 'mortgage',
          mortgageRate: editingEvent.mortgageRate !== undefined ? Number(editingEvent.mortgageRate) : 6.5,
          loanTermYears: editingEvent.loanTerm !== undefined ? Number(editingEvent.loanTerm) : 30,
          points: editingEvent.points !== undefined ? Number(editingEvent.points) : 0,
          pmi: editingEvent.pmi !== undefined ? Number(editingEvent.pmi) : 0.5,
          closingCosts: editingEvent.closingCosts !== undefined ? Number(editingEvent.closingCosts) : 3,
          propertyTaxRate: editingEvent.propertyTax !== undefined ? Number(editingEvent.propertyTax) : 1.1,
          insuranceCost: editingEvent.insurance !== undefined ? Number(editingEvent.insurance) : 0.35,
          hoaCost: editingEvent.hoa !== undefined ? Number(editingEvent.hoa) : 0,
          maintenanceRate: editingEvent.maintenance !== undefined ? Number(editingEvent.maintenance) : 1.0,
          renovationCost: editingEvent.renovationCost !== undefined ? Number(editingEvent.renovationCost) : 0,
          utilitiesIncrease: editingEvent.utilitiesIncrease !== undefined ? Number(editingEvent.utilitiesIncrease) : 0,
          appreciationRate: editingEvent.appreciationRate !== undefined ? Number(editingEvent.appreciationRate) : 3.0,
          sellingCostRate: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          investmentReturn: editingEvent.investmentReturn !== undefined ? Number(editingEvent.investmentReturn) : 7,
          inflation: editingEvent.inflation !== undefined ? Number(editingEvent.inflation) : 3,
          currentRent: editingEvent.currentRent !== undefined ? Number(editingEvent.currentRent) : 0,
          rentGrowth: editingEvent.rentGrowth !== undefined ? Number(editingEvent.rentGrowth) : 3,
          renterInsurance: editingEvent.renterInsurance !== undefined ? Number(editingEvent.renterInsurance) : 0,
          keepRent: editingEvent.keepRent !== undefined ? !!editingEvent.keepRent : false
        };

        if (!newInputs.houseAssets) {
          newInputs.houseAssets = [];
        }
        if (newInputs.houseAssets.some(h => h.id === houseId)) {
          newInputs.houseAssets = newInputs.houseAssets.map(h => h.id === houseId ? houseAssetObj : h);
        } else {
          newInputs.houseAssets = [...newInputs.houseAssets, houseAssetObj];
        }

        const buyEvId = editingEvent.id && editingEvent.id.startsWith('buy-') ? editingEvent.id : `buy-${Date.now()}`;
        const buyEvObj = {
          id: buyEvId,
          type: 'buyHouse',
          enabled: true,
          name: 'Buy House',
          purchaseAge: Number(editingEvent.purchaseAge),
          age: Number(editingEvent.purchaseAge),
          houseId: houseId,
          keepRent: editingEvent.keepRent !== undefined ? !!editingEvent.keepRent : false
        };

        const existingSell = newInputs.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === houseId);
        const purchaseAgeNum = Number(editingEvent.purchaseAge);
        let defaultSellAge = Number(newInputs.lifeExpectancy || 85);
        if (defaultSellAge <= purchaseAgeNum) {
          defaultSellAge = purchaseAgeNum + 10;
        }

        const sellEvObj = existingSell ? {
          ...existingSell,
          age: Number(existingSell.age) <= purchaseAgeNum ? purchaseAgeNum + 10 : Number(existingSell.age),
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : existingSell.sellingCost
        } : {
          id: `sell-${Date.now()}`,
          type: 'sellHouse',
          enabled: true,
          name: 'Sell House',
          age: defaultSellAge,
          houseId: houseId,
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          proceedsDestination: 'investments'
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== buyEvId && e.id !== sellEvObj.id && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, buyEvObj, sellEvObj];
        
        savedEvent = buyEvObj;
      } else if (type === 'sellHouse') {
        const sellEvId = editingEvent.id && editingEvent.id.startsWith('sell-') ? editingEvent.id : `sell-${Date.now()}`;
        const sellEvObj = {
          id: sellEvId,
          type: 'sellHouse',
          enabled: true,
          name: 'Sell House',
          age: Number(editingEvent.age),
          houseId: editingEvent.houseId,
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          proceedsDestination: editingEvent.proceedsDestination || 'investments'
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== sellEvId && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, sellEvObj];

        if (newInputs.houseAssets) {
          newInputs.houseAssets = newInputs.houseAssets.map(h => {
            if (h.id === editingEvent.houseId) {
              return { ...h, sellingCostRate: Number(editingEvent.sellingCost) };
            }
            return h;
          });
        }

        savedEvent = sellEvObj;
      } else if (type === 'borrowing') {
        const calculatePayoffAgeInline = (balance, apr, monthlyPayment, extraPayment, startAge) => {
          const r = (apr / 100) / 12;
          const pmt = monthlyPayment + extraPayment;
          if (balance <= 0) return startAge;
          if (pmt <= 0) return Infinity;
          if (pmt <= balance * r) return Infinity;
          if (r === 0) {
            return startAge + (balance / pmt) / 12;
          }
          const months = Math.log(pmt / (pmt - r * balance)) / Math.log(1 + r);
          return startAge + months / 12;
        };

        const borrowId = editingEvent.id && editingEvent.id.startsWith('borrowing-') ? editingEvent.id : `borrowing-${Date.now()}`;
        const newEventObj = {
          id: borrowId,
          type: 'borrowing',
          enabled: true,
          borrowingType: editingEvent.borrowingType,
          name: editingEvent.name || 'Borrowing',
          balance: Number(editingEvent.balance) || 0,
          interestRate: Number(editingEvent.interestRate) || 0,
          minPayment: Number(editingEvent.minPayment) || 0,
          startAge: editingEvent.timing === 'current' ? newInputs.currentAge : (Number(editingEvent.startAge) || (newInputs.currentAge + 1)),
          notes: editingEvent.notes || '',
          isExisting: editingEvent.timing === 'current',
          timing: editingEvent.timing || (editingEvent.isExisting !== false ? 'current' : 'future'),
          payoffPlanEnabled: !!editingEvent.payoffPlanEnabled
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== borrowId && e.id !== editingEvent.id);

        if (newEventObj.payoffPlanEnabled) {
          const existingPayoff = newInputs.lifeEvents.find(e => e.type === 'payoffPlan' && e.borrowingId === borrowId);
          const extraPmt = existingPayoff ? (Number(existingPayoff.extraPayment) || 0) : 100;
          const linkedVal = existingPayoff ? existingPayoff.linked !== false : true;

          const startAgeForPayoff = linkedVal ? newEventObj.startAge : (existingPayoff ? Number(existingPayoff.startAge) : newEventObj.startAge);
          const payoffAge = calculatePayoffAgeInline(newEventObj.balance, newEventObj.interestRate, newEventObj.minPayment, extraPmt, startAgeForPayoff);

          const payoffObj = {
            id: existingPayoff ? existingPayoff.id : `payoffPlan-${Date.now()}`,
            type: 'payoffPlan',
            enabled: true,
            name: `Payoff Plan: ${newEventObj.name}`,
            borrowingId: borrowId,
            linked: linkedVal,
            extraPayment: extraPmt,
            startAge: startAgeForPayoff,
            payoffAge: payoffAge,
            notes: existingPayoff ? existingPayoff.notes || '' : ''
          };

          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffObj.id && !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
          newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj, payoffObj];
        } else {
          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
          newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
        }

        savedEvent = newEventObj;
      } else if (type === 'payoffPlan') {
        const calculatePayoffAgeInline = (balance, apr, monthlyPayment, extraPayment, startAge) => {
          const r = (apr / 100) / 12;
          const pmt = monthlyPayment + extraPayment;
          if (balance <= 0) return startAge;
          if (pmt <= 0) return Infinity;
          if (pmt <= balance * r) return Infinity;
          if (r === 0) {
            return startAge + (balance / pmt) / 12;
          }
          const months = Math.log(pmt / (pmt - r * balance)) / Math.log(1 + r);
          return startAge + months / 12;
        };

        const payoffId = editingEvent.id && editingEvent.id.startsWith('payoffPlan-') ? editingEvent.id : `payoffPlan-${Date.now()}`;
        const borrowing = newInputs.lifeEvents.find(b => b.id === editingEvent.borrowingId);
        
        let startAge = Number(editingEvent.startAge);
        if (editingEvent.linked !== false && borrowing) {
          startAge = Number(borrowing.startAge);
        }

        const balance = borrowing ? Number(borrowing.balance) || 0 : 0;
        const interestRate = borrowing ? Number(borrowing.interestRate) || 0 : 0;
        const minPayment = borrowing ? Number(borrowing.minPayment) || 0 : 0;
        const extraPayment = Number(editingEvent.extraPayment) || 0;

        let payoffAge = calculatePayoffAgeInline(balance, interestRate, minPayment, extraPayment, startAge);

        if (editingEvent.targetPayoffAge && editingEvent.targetPayoffAge > startAge) {
          payoffAge = Number(editingEvent.targetPayoffAge);
        }

        const newEventObj = {
          id: payoffId,
          type: 'payoffPlan',
          enabled: true,
          name: editingEvent.name || 'Payoff Plan',
          borrowingId: editingEvent.borrowingId,
          linked: editingEvent.linked !== false,
          extraPayment: extraPayment,
          startAge: startAge,
          payoffAge: payoffAge,
          targetPayoffAge: editingEvent.targetPayoffAge || null,
          notes: editingEvent.notes || ''
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffId && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];

        savedEvent = newEventObj;
      } else {
        const isRetIncomeType = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type);
        let defaultName = 'Other Income';
        if (type === 'socialSecurity') defaultName = 'Social Security';
        else if (type === 'pension') defaultName = 'Pension';
        else if (type === 'rentalIncome') defaultName = 'Rental Income';
        else if (type === 'annuity') defaultName = 'Annuity';

        let newEventObj = {
          id: editingEvent.id && !['haveChild', 'college', 'windfall', 'debtPayoff', 'custom', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(editingEvent.id)
            ? editingEvent.id
            : `${type}-${Date.now()}`,
          type,
          enabled: true,
          name: type === 'haveChild' ? 'Have a Child' : type === 'college' ? 'College' : type === 'windfall' ? 'Windfall' : isRetIncomeType ? (editingEvent.name || defaultName) : editingEvent.name
        };
        
        if (type === 'haveChild') {
          newEventObj = {
            ...newEventObj,
            childName: editingEvent.childName || '',
            linkedEventId: editingEvent.linkedEventId || null,
            childStartAge: editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0,
            birthAge: editingEvent.birthAge !== undefined ? editingEvent.birthAge : newInputs.currentAge,
            costMethod: editingEvent.costMethod || 'default',
            customAges0to4: editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000,
            customAges5to12: editingEvent.customAges5to12 !== undefined ? editingEvent.customAges5to12 : 9000,
            customAges13to18: editingEvent.customAges13to18 !== undefined ? editingEvent.customAges13to18 : 12000,
            customAges19to22: editingEvent.customAges19to22 !== undefined ? editingEvent.customAges19to22 : 20000,
            includeCollege: !!editingEvent.includeCollege
          };
        } else if (type === 'college') {
          newEventObj = {
            ...newEventObj,
            startAge: editingEvent.startAge,
            tuitionCost: editingEvent.tuitionCost,
            duration: editingEvent.duration
          };
        } else if (type === 'windfall') {
          newEventObj = {
            ...newEventObj,
            ageReceived: editingEvent.ageReceived,
            amount: editingEvent.amount,
            taxRate: editingEvent.taxRate
          };
        } else if (type === 'debtPayoff') {
          newEventObj = {
            ...newEventObj,
            payoffAge: editingEvent.payoffAge,
            amount: editingEvent.amount
          };
        } else if (isRetIncomeType) {
          let claimingAge = editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65);
          if (type === 'socialSecurity') {
            claimingAge = Math.max(62, Math.min(70, claimingAge));
          }
          newEventObj = {
            ...newEventObj,
            claimingAge,
            startAge: claimingAge,
            age: claimingAge,
            monthlyBenefit: editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000,
            inflationAdjusted: editingEvent.inflationAdjusted !== false,
            useEarnings: editingEvent.useEarnings === true,
            ageStartedWorking: editingEvent.ageStartedWorking !== undefined ? Number(editingEvent.ageStartedWorking) : 22
          };
        } else if (type === 'custom') {
          newEventObj = {
            ...newEventObj,
            age: editingEvent.age,
            amount: editingEvent.amount
          };
        } else if (type === 'marriage') {
          const estimates = calculateMarriageEstimates(editingEvent, newInputs);
          const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
          const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;
          const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
          const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;

          newEventObj = {
            ...newEventObj,
            age: Number(editingEvent.age),
            spouseIncome: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3),
            cash: Number(editingEvent.cash || 0),
            investments: Number(editingEvent.investments || 0),
            retirement: Number(editingEvent.retirement || 0),
            debtStudent: Number(editingEvent.debtStudent || 0),
            debtCredit: Number(editingEvent.debtCredit || 0),
            debtOther: Number(editingEvent.debtOther || 0),
            savingsRate: Number(editingEvent.savingsRate),
            housingOption: estimates ? estimates.housingOption : 'move',
            housingSavings: 0,
            housingCost: housingCostAmount,
            lifestyleOption: estimates ? estimates.lifestyleOption : 'same',
            lifestyleAdjustment: lifestyleAdjustmentAmount,
            includeWeddingCost: !!editingEvent.includeWeddingCost,
            weddingCost: Number(editingEvent.weddingCost),
            weddingFundingMethod: editingEvent.weddingFundingMethod || 'savings',
            weddingAge: Number(editingEvent.weddingAge),
            filingStatus: editingEvent.filingStatus || 'jointly',
            spouseCurrentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            spouseLifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            spouseDesiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            partnerRetiresWithUser: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            combinedSpendingAfterMarriage: combinedSpendingVal
          };
          
          let nextHouseholdMembers = [...(newInputs.householdMembers || [])];
          const spouseIdx = nextHouseholdMembers.findIndex(m => m.id === 'spouse');
          const spouseRecord = {
            id: 'spouse',
            name: 'Spouse',
            activeFromDate: Number(editingEvent.age),
            activeUntilDate: null,
            income: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3) / 100,
            assets: {
              cash: Number(editingEvent.cash || 0),
              investments: Number(editingEvent.investments || 0),
              retirement: Number(editingEvent.retirement || 0)
            },
            debts: {
              student: Number(editingEvent.debtStudent || 0),
              credit: Number(editingEvent.debtCredit || 0),
              other: Number(editingEvent.debtOther || 0)
            },
            savingsRate: Number(editingEvent.savingsRate),
            currentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            spouseDesiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            partnerRetiresWithUser: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            growthRate: Number(editingEvent.incomeGrowthRate || 3),
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount,
            lifestyleAdjustment: lifestyleAdjustmentAmount
          };
          if (spouseIdx !== -1) {
            nextHouseholdMembers[spouseIdx] = spouseRecord;
          } else {
            nextHouseholdMembers.push(spouseRecord);
          }
          newInputs.householdMembers = nextHouseholdMembers;
        }
        
        savedEvent = newEventObj;
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      }

      if (type === 'haveChild') {
        const afterRes = runFireSimulation(newInputs);
        afterReadyAge = afterRes.retirementReadyAge;
      }
      
      return {
        ...scen,
        inputs: newInputs
      };
    });

    setScenarios(nextScenarios);

    if (type === 'buyHouse' && updatedInputs && setShowImprovementModal) {
      const purchaseAge = Number(editingEvent.purchaseAge || editingEvent.age);
      const phases = derivePhasesFromEvents(updatedInputs, updatedInputs.lifeEvents, updatedInputs.budgetDetails?.phases || []);
      const activePhase = phases.find(p => purchaseAge >= p.startAge && purchaseAge < p.endAge);
      if (activePhase) {
        const totalExpenses = Object.values(activePhase.expenses || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const totalIncome = Number(activePhase.income) || 0;
        if (totalIncome - totalExpenses < 0) {
          setShowImprovementModal(true);
        }
      }
    }

    if (type === 'haveChild' && savedEvent) {
      const diff = (afterReadyAge && beforeReadyAge) ? (afterReadyAge - beforeReadyAge) : 0;
      setChildImpactSummary({
        beforeAge: beforeReadyAge,
        afterAge: afterReadyAge,
        diffYears: diff,
        annualSpending: avgAnnualChildCost,
        event: savedEvent
      });
    }
    
    if (!isMobile) {
      setEditingEvent(null);
    }
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  const handleDeleteRoadmapEvent = (evt) => {
    if (!evt || evt.isMilestone) return;
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      setScenarios(prev => prev.map(scen => {
        if (scen.id !== currentScenarioId) return scen;
        
        let newEvents = scen.inputs.lifeEvents.filter(e => e.id !== matchEvent.id);
        let newAssets = scen.inputs.houseAssets || [];
        let newIncomes = scen.inputs.incomeList || [];

        if (matchEvent.type === 'buyHouse' || matchEvent.type === 'sellHouse') {
          const houseId = matchEvent.houseId;
          if (houseId) {
            newEvents = scen.inputs.lifeEvents.filter(e => e.houseId !== houseId);
            newAssets = (scen.inputs.houseAssets || []).filter(h => h.id !== houseId);
          }
        }
        if (matchEvent.type === 'borrowing') {
          newEvents = newEvents.filter(e => !(e.type === 'payoffPlan' && e.borrowingId === matchEvent.id));
        }
        if (matchEvent.type === 'payoffPlan') {
          newEvents = newEvents.map(e => {
            if (e.id === matchEvent.borrowingId && e.type === 'borrowing') {
              return { ...e, payoffPlanEnabled: false };
            }
            return e;
          });
        }
        if (matchEvent.type === 'haveChild') {
          newIncomes = newIncomes.filter(i => i.id !== matchEvent.linkedEventId && i.parentEventId !== matchEvent.id);
        }

        let newInputs = {
          ...scen.inputs,
          lifeEvents: newEvents,
          houseAssets: newAssets,
          incomeList: newIncomes
        };

        if (evt.type === 'retire') {
          newInputs.targetRetirementAge = scen.inputs.lifeExpectancy;
        }
        if (matchEvent.type === 'marriage') {
          newInputs.householdMembers = (scen.inputs.householdMembers || []).filter(m => m.id !== 'spouse');
        }

        return {
          ...scen,
          inputs: newInputs
        };
      }));
      return;
    }
    const matchSpend = inputs.spendingPhases.find(p => p.id === evt.originalId || p.startAge === evt.age);
    if (matchSpend && inputs.spendingPhases.length > 1) {
      const remaining = inputs.spendingPhases.filter(p => p.id !== matchSpend.id);
      const updated = remaining.map(p => {
        if (p.endAge === matchSpend.startAge) {
          return { ...p, endAge: matchSpend.endAge };
        }
        return p;
      });
      updateInput('spendingPhases', updated);
      return;
    }
    const matchInc = inputs.incomeList.find(i => i.id === evt.originalId || i.startAge === evt.age);
    if (matchInc && inputs.incomeList.length > 1) {
      const remaining = inputs.incomeList.filter(i => i.id !== matchInc.id);
      const updated = remaining.map(i => {
        if (i.endAge === matchInc.startAge) {
          return { ...i, endAge: matchInc.endAge };
        }
        return i;
      });
      updateInput('incomeList', updated);
      return;
    }
  };

  const handleDeleteEvent = (passedEvent) => {
    const isSyntheticEvent = passedEvent && (passedEvent.nativeEvent || passedEvent.preventDefault);
    const editingEvent = (passedEvent && !isSyntheticEvent) ? passedEvent : hookEditingEvent;
    if (!editingEvent) return;
    const proxyEvent = {
      originalId: editingEvent.id,
      age: Number(editingEvent.age || editingEvent.startAge || editingEvent.purchaseAge || editingEvent.birthAge || editingEvent.claimingAge || editingEvent.ageReceived),
      type: editingEvent.type
    };
    handleDeleteRoadmapEvent(proxyEvent);
    setEditingEvent(null);
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  return {
    editingEvent,
    setEditingEvent,
    childImpactSummary,
    setChildImpactSummary,
    editingCondition,
    setEditingCondition,
    draggingInfo,
    setDraggingInfo,
    notification,
    setNotification,
    isFullPartnerProfileOpen,
    setIsFullPartnerProfileOpen,
    isZeroSpendingConfirmed,
    setIsZeroSpendingConfirmed,
    isPartnerZeroSpendingConfirmed,
    setIsPartnerZeroSpendingConfirmed,
    dragOccurredRef,
    handleCreateEvent,
    handleEditRoadmapEvent,
    handleSaveEvent,
    handleDeleteEvent,
    handleDeleteRoadmapEvent
  };
}
