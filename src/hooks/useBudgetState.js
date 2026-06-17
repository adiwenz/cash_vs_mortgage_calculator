import { useState, useEffect } from 'react';
import { getNormalizedPhases } from '../fireCalculations';
import { calculateUSTaxForModal } from '../simulatorMathUtils';
import { calculateMarriageEstimates } from '../components/fire-simulator/helpers';

export function useBudgetState(
  scenarios,
  setScenarios,
  currentScenarioId,
  inputs,
  updateInput,
  activeResults,
  editingEvent,
  setEditingEvent,
  isBudgetOpenFromMarriageWizard,
  setIsBudgetOpenFromMarriageWizard
) {
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [activeBudgetPhase, setActiveBudgetPhase] = useState('workSave');
  const [editedPhases, setEditedPhases] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({
    needs: false,
    wants: false,
    savings: false
  });

  const [budgetGrossIncome, setBudgetGrossIncome] = useState(50000);
  const [budgetFilingStatus, setBudgetFilingStatus] = useState('single');
  const [budgetHsaCoverage, setBudgetHsaCoverage] = useState('single');
  const [savingsAllocMode, setSavingsAllocMode] = useState('fixed');
  
  const [budgetSavings, setBudgetSavings] = useState({
    trad401k: 100, rothIra: 50, tradIra: 0, hsa: 50, brokerage: 0,
    checking: 50, hysa: 50, emergency: 26, debt: 0, other: 0
  });
  
  const [budgetPartnerSavings, setBudgetPartnerSavings] = useState({
    trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0, cash: 0, debt: 0
  });

  const [budgetExpenses, setBudgetExpenses] = useState({
    housing: 1500, utilities: 300, food: 400, diningOut: 200,
    transportation: 400, healthcare: 300, leisure: 300, misc: 141
  });

  const [activeBudgetTab, setActiveBudgetTab] = useState('userSavings');
  const [budgetMonthlyIncome, setBudgetMonthlyIncome] = useState(4167);
  const [budgetMonthlySpending, setBudgetMonthlySpending] = useState(3542);
  const [budgetMonthlySavings, setBudgetMonthlySavings] = useState(625);
  const [pendingImprovement, setPendingImprovement] = useState(null);
  const [budgetDiffs, setBudgetDiffs] = useState(null);

  const handleSetBudgetClick = (initialPhaseId = null, fromMarriageWizard = false) => {
    const inp = inputs;
    const normalizedPhases = getNormalizedPhases(inp);
    
    let estimatedExpenses = null;
    let estimatedPartnerSavings = null;

    const marriageOpen = isBudgetOpenFromMarriageWizard || fromMarriageWizard;
    if (marriageOpen && editingEvent) {
      const estimates = calculateMarriageEstimates(editingEvent, inp);
      if (estimates) {
        const userExpenses = inp.budgetDetails?.expenses || {
          housing: 1500, utilities: 300, food: 400, diningOut: 200,
          transportation: 400, healthcare: 300, leisure: 300, misc: 142
        };
        
        const housingVal = userExpenses.housing !== undefined ? Number(userExpenses.housing) : 1500;
        const partnerMonthlySpend = Math.round(estimates.partnerTakeHomeRemaining / 12);
        const nonHousingCats = ['utilities', 'food', 'diningOut', 'transportation', 'healthcare', 'leisure', 'misc'];
        const userNonHousingTotal = nonHousingCats.reduce((sum, cat) => sum + (Number(userExpenses[cat]) || 0), 0);
        
        const remainingToDistribute = Math.max(0, userNonHousingTotal + partnerMonthlySpend - estimates.savingsBreakdown.total);
        
        const tempExpenses = { ...userExpenses, housing: housingVal };
        nonHousingCats.forEach(cat => {
          const spouseCatSpend = userNonHousingTotal > 0
            ? remainingToDistribute * ((Number(userExpenses[cat]) || 0) / userNonHousingTotal)
            : remainingToDistribute / nonHousingCats.length;
          tempExpenses[cat] = Math.round(spouseCatSpend);
        });
        
        estimatedExpenses = tempExpenses;
        
        const spouseMonthlySavings = Math.round(estimates.partnerSavings / 12);
        const userSavings = inp.budgetDetails?.savings || {};
        const userTotalSavings = Object.values(userSavings).reduce((sum, v) => sum + (Number(v) || 0), 0);
        
        estimatedPartnerSavings = {
          trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
          checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
        };
        
        if (userTotalSavings > 0) {
          Object.keys(userSavings).forEach(key => {
            estimatedPartnerSavings[key] = Math.round(spouseMonthlySavings * ((Number(userSavings[key]) || 0) / userTotalSavings));
          });
          
          const partnerTotalSavings = Object.values(estimatedPartnerSavings).reduce((sum, v) => sum + v, 0);
          const diff = spouseMonthlySavings - partnerTotalSavings;
          if (diff !== 0) {
            let maxKey = 'brokerage';
            Object.keys(estimatedPartnerSavings).forEach(key => {
              if (estimatedPartnerSavings[key] > (estimatedPartnerSavings[maxKey] || 0)) {
                maxKey = key;
              }
            });
            estimatedPartnerSavings[maxKey] = Math.max(0, estimatedPartnerSavings[maxKey] + diff);
          }
        } else {
          const trad401kAlloc = Math.min(1958, spouseMonthlySavings);
          estimatedPartnerSavings.trad401k = trad401kAlloc;
          estimatedPartnerSavings.checking = Math.max(0, spouseMonthlySavings - trad401kAlloc);
        }
      }
    }

    const initialEdited = {};
    normalizedPhases.forEach(p => {
      if (p.type !== 'retire' && marriageOpen && estimatedExpenses && estimatedPartnerSavings) {
        initialEdited[p.id] = { 
          ...p, 
          expenses: { ...estimatedExpenses },
          partnerSavings: { ...estimatedPartnerSavings }
        };
      } else {
        initialEdited[p.id] = { ...p };
      }
    });
    setEditedPhases(initialEdited);

    let startPhaseId = null;
    if (initialPhaseId && initialEdited[initialPhaseId]) {
      startPhaseId = initialPhaseId;
    } else {
      const currentAgeVal = Number(inp.currentAge) || 30;
      const match = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
      if (match) {
        startPhaseId = match.id;
      } else if (normalizedPhases.length > 0) {
        startPhaseId = normalizedPhases[0].id;
      }
    }

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
      setActiveBudgetPhase(startPhaseId);
      setBudgetMonthlyIncome(startPhase.income);
      setBudgetSavings(startPhase.savings);
      setBudgetPartnerSavings(startPhase.partnerSavings || {});
      setBudgetExpenses(startPhase.expenses);
      setSavingsAllocMode(startPhase.savingsAllocMode);
      
      setBudgetMonthlySpending(Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0));
      const totalSavings = startPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, startPhase.income - Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setBudgetGrossIncome(Number(inp.simpleIncome) || 50000);
    setBudgetFilingStatus(inp.filingStatus || 'single');
    setBudgetHsaCoverage(inp.budgetDetails?.hsaCoverage || 'single');
    
    setIsBudgetModalOpen(true);
  };

  const handleCloseBudgetModal = () => {
    setIsBudgetModalOpen(false);
    setPendingImprovement(null);
    setBudgetDiffs(null);
    setIsBudgetOpenFromMarriageWizard(false);
  };

  const handleSwitchBudgetPhase = (newPhaseId) => {
    if (newPhaseId === activeBudgetPhase) return;

    setEditedPhases(prev => ({
      ...prev,
      [activeBudgetPhase]: {
        ...prev[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    }));

    const nextPhase = editedPhases[newPhaseId];
    if (nextPhase) {
      setBudgetMonthlyIncome(nextPhase.income);
      setBudgetSavings(nextPhase.savings);
      setBudgetPartnerSavings(nextPhase.partnerSavings || {});
      setBudgetExpenses(nextPhase.expenses);
      setSavingsAllocMode(nextPhase.savingsAllocMode);
      setBudgetMonthlySpending(Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0));
      
      const totalSavings = nextPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, nextPhase.income - Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setActiveBudgetPhase(newPhaseId);
  };

  const handleToggleSavingsAllocMode = (newMode) => {
    if (newMode === savingsAllocMode) return;
    
    if (newMode === 'percentSurplus') {
      const totalSavings = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = totalSavings > 0 ? Math.round((val / totalSavings) * 100) : 0;
      });
      
      if (totalSavings > 0) {
        const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
        const diff = 100 - newSum;
        if (diff !== 0) {
          const keys = Object.keys(newSavings);
          let maxKey = 'brokerage';
          keys.forEach(k => {
            if (newSavings[k] > (newSavings[maxKey] || 0)) {
              maxKey = k;
            }
          });
          newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
        }
      } else {
        newSavings.brokerage = 100;
      }
      setBudgetSavings(newSavings);
    } else {
      const totalExpenses = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
      const estimatedSurplus = Math.max(0, budgetMonthlyIncome - totalExpenses);
      
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = Math.round(estimatedSurplus * (val / 100));
      });
      
      const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
      const diff = estimatedSurplus - newSum;
      if (diff !== 0) {
        const keys = Object.keys(newSavings);
        let maxKey = 'brokerage';
        keys.forEach(k => {
          if (newSavings[k] > (newSavings[maxKey] || 0)) {
            maxKey = k;
          }
        });
        newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
      }
      setBudgetSavings(newSavings);
    }
    
    setSavingsAllocMode(newMode);
  };

  const handleSaveBudget = (updatedDefaultTemplate) => {
    const finalEdited = {
      ...editedPhases,
      [activeBudgetPhase]: {
        ...editedPhases[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    };

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };
      
      newInputs.filingStatus = budgetFilingStatus;
      if (!newInputs.budgetDetails) newInputs.budgetDetails = {};
      newInputs.budgetDetails.hsaCoverage = budgetHsaCoverage;
      if (updatedDefaultTemplate) {
        newInputs.budgetDetails.defaultTemplate = updatedDefaultTemplate;
      }
      
      newInputs.budgetDetails.phases = Object.values(finalEdited).map(p => ({
        id: p.id,
        type: p.type,
        name: p.name,
        startAge: p.startAge,
        endAge: p.endAge,
        income: p.income,
        savingsAllocMode: p.savingsAllocMode,
        savings: p.savings,
        partnerSavings: p.partnerSavings,
        expenses: p.expenses
      }));

      const currentAgeVal = Number(newInputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      
      if (currentPhase) {
        const wsPhase = Object.values(finalEdited).find(p => p.type === 'workSave');
        const standardIncomeMonthly = wsPhase ? wsPhase.income : currentPhase.income;
        const childBoost = Math.max(0, currentPhase.income - standardIncomeMonthly);
        newInputs.simpleIncome = (currentPhase.income - childBoost) * 12;
        newInputs.simpleExpenses = Object.keys(currentPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (currentPhase.expenses[v] || 0), 0) * 12;
      }

      newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === inc.startAge && (p.type === 'careerChange' || p.type === 'current'));
        if (matchingPhase) {
          inc.amount = inc.frequency === 'monthly' ? matchingPhase.income : matchingPhase.income * 12;
        }
        return inc;
      });

      newInputs.spendingPhases = (newInputs.spendingPhases || []).map(sp => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === sp.startAge && p.type === 'move');
        if (matchingPhase) {
          const totalMonthlyExpenses = Object.keys(matchingPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (matchingPhase.expenses[v] || 0), 0);
          sp.amount = sp.frequency === 'monthly' ? totalMonthlyExpenses : totalMonthlyExpenses * 12;
          sp.annualSpending = totalMonthlyExpenses * 12;
        }
        return sp;
      });

      if (pendingImprovement) {
        const { scenario } = pendingImprovement;
        if (scenario.type === 'workLonger') {
          const yearsDelay = scenario.value;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type === 'retire65') {
          const target65Age = newInputs.currentAge < 65 ? 65 : newInputs.currentAge;
          newInputs.targetRetirementAge = target65Age;
        } else if (scenario.type === 'retireReadyAge') {
          newInputs.targetRetirementAge = scenario.value;
        } else if (scenario.type === 'combined') {
          const yearsDelay = scenario.value && typeof scenario.value === 'object' ? (scenario.value.delay || 0) : 0;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type.startsWith('childOffset')) {
          const boosts = scenario.incomeBoosts || [];
          newInputs.incomeList = [...(newInputs.incomeList || []), ...boosts];
        } else if (scenario.type === 'startDebtPayoff') {
          const activeLoan = scenario.activeDebts.find(d => d.type !== 'mortgage');
          if (activeLoan) {
            const payoffId = `payoff-plan-auto-${Date.now()}`;
            const payoffEvent = {
              id: payoffId,
              type: 'payoffPlan',
              borrowingId: activeLoan.id,
              extraPayment: 100,
              startAge: currentAgeVal,
              linked: true,
              enabled: true,
              name: `Payoff Plan: ${activeLoan.name}`
            };
            newInputs.lifeEvents = [...(newInputs.lifeEvents || []), payoffEvent];
          }
        } else if (scenario.type === 'increaseDebtIncome') {
          const extraIncomeItem = {
            id: `debt-income-boost-${Date.now()}`,
            name: `Extra Income (to cover debt)`,
            amount: scenario.value * 12,
            frequency: 'yearly',
            startAge: currentAgeVal,
            endAge: newInputs.targetRetirementAge || 65,
            growthRate: 0.03,
            isTaxable: true
          };
          newInputs.incomeList = [...(newInputs.incomeList || []), extraIncomeItem];
        }

        const targetRetAge = newInputs.targetRetirementAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(ev => {
          if (ev.type === 'retire') {
            return { ...ev, age: targetRetAge };
          }
          return ev;
        });
      }

      const marriageEventIdx = (newInputs.lifeEvents || []).findIndex(e => e.type === 'marriage' && e.enabled);
      if (marriageEventIdx !== -1 && currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        newInputs.lifeEvents[marriageEventIdx] = {
          ...newInputs.lifeEvents[marriageEventIdx],
          combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
        };
        const spouseIdx = (newInputs.householdMembers || []).findIndex(m => m.id === 'spouse');
        if (spouseIdx !== -1) {
          newInputs.householdMembers[spouseIdx] = {
            ...newInputs.householdMembers[spouseIdx],
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
          };
        }
      }

      return {
        ...scen,
        inputs: newInputs
      };
    }));

    if (isBudgetOpenFromMarriageWizard) {
      const currentAgeVal = Number(inputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      if (currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        setEditingEvent(prev => {
          if (!prev) return prev;
          let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
          const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
          if (initialPhase) {
            if (initialPhase.frequency === 'monthly') {
              userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
            } else if (initialPhase.frequency === 'yearly') {
              userSpendingPreRetirement = Number(initialPhase.amount) || 0;
            } else {
              userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
            }
          }
          const spousePersonalSpending = Math.round(Math.max(0, currentPhaseExpensesAnnual - userSpendingPreRetirement - (prev.housingCost !== undefined ? Number(prev.housingCost) : -6000)) / 12);
          return {
            ...prev,
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual,
            spousePersonalSpending: spousePersonalSpending
          };
        });
      }
    }

    handleCloseBudgetModal();
  };

  return {
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    activeBudgetPhase,
    setActiveBudgetPhase,
    editedPhases,
    setEditedPhases,
    expandedCategories,
    setExpandedCategories,
    budgetGrossIncome,
    setBudgetGrossIncome,
    budgetFilingStatus,
    setBudgetFilingStatus,
    budgetHsaCoverage,
    setBudgetHsaCoverage,
    savingsAllocMode,
    setSavingsAllocMode,
    budgetSavings,
    setBudgetSavings,
    budgetPartnerSavings,
    setBudgetPartnerSavings,
    budgetExpenses,
    setBudgetExpenses,
    activeBudgetTab,
    setActiveBudgetTab,
    budgetMonthlyIncome,
    setBudgetMonthlyIncome,
    budgetMonthlySpending,
    setBudgetMonthlySpending,
    budgetMonthlySavings,
    setBudgetMonthlySavings,
    pendingImprovement,
    setPendingImprovement,
    budgetDiffs,
    setBudgetDiffs,
    handleSetBudgetClick,
    handleCloseBudgetModal,
    handleSwitchBudgetPhase,
    handleToggleSavingsAllocMode,
    handleSaveBudget
  };
}
