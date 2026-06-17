import { useState, useEffect, useRef } from 'react';
import { getNormalizedPhases, getPhaseChangeExplanations } from '../../fireCalculations';
import { calculateUSTaxForModal, getRetirementLimit, capMonthlyContribution } from '../../simulatorMathUtils';
import { formatCurrency } from './helpers';
import { getActiveDebtsForAge } from '../../calculators/fire/debts.js';
import DesktopBudgetPanel from './DesktopBudgetPanel';
import MobileBudgetPanel from './MobileBudgetPanel';

export default function BudgetModal({
  inputs,
  isBudgetOpenFromMarriageWizard,
  editingEvent,
  budgetMonthlyIncome,
  setBudgetMonthlyIncome,
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
  activeBudgetPhase,
  handleSwitchBudgetPhase,
  savingsAllocMode,
  handleToggleSavingsAllocMode,
  budgetHsaCoverage,
  setBudgetHsaCoverage,
  budgetFilingStatus,
  setBudgetFilingStatus,
  budgetMonthlySpending,
  setBudgetMonthlySpending,
  setBudgetMonthlySavings,
  pendingImprovement,
  handleCloseBudgetModal,
  handleSaveBudget,
  isMobile
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('needs');
  const [isEditingNeeds, setIsEditingNeeds] = useState(false);
  const [isEditingWants, setIsEditingWants] = useState(false);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: '' });
  const lastToastTimeRef = useRef({});
  const triggerToast = (accountKey, message) => {
    const now = Date.now();
    const lastTime = lastToastTimeRef.current[accountKey] || 0;
    if (now - lastTime > 3000) {
      lastToastTimeRef.current[accountKey] = now;
      setToast({ visible: true, message });
    }
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ visible: false, message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  useEffect(() => {
    if (!showPopover) return;
    const handleDocumentClick = () => {
      setShowPopover(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showPopover]);

  useEffect(() => {
    const activeTab = document.querySelector('.budget-modal-tab.active');
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeBudgetPhase]);
  const [defaultTemplate, setDefaultTemplate] = useState(
    inputs.budgetDetails?.defaultTemplate || { needsPct: 50, wantsPct: 30, savingsPct: 20 }
  );

  // Get normalized phases
  const normalizedPhases = getNormalizedPhases(inputs);
  const activePhaseObj = normalizedPhases.find(p => p.id === activeBudgetPhase) || normalizedPhases[0];
  const isRetirementPhase = activePhaseObj?.type === 'retire';

  const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled) || (isBudgetOpenFromMarriageWizard ? editingEvent : null);
  const isMarriedMode = isBudgetOpenFromMarriageWizard ? true : (activePhaseObj ? !!activePhaseObj.isMarried : !!marriageEvent);
  const partnerMonthlyIncome = isMarriedMode ? Math.round(Number(marriageEvent?.spouseIncome || activePhaseObj?.spouseIncome || 0) / 12) : 0;
  const combinedIncome = isMarriedMode ? (budgetMonthlyIncome + partnerMonthlyIncome) : budgetMonthlyIncome;

  const totalExpensesMonthly = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
  const activeDebtsTotal = Object.keys(budgetExpenses)
    .filter(k => k.startsWith('debt_'))
    .reduce((sum, k) => sum + (Number(budgetExpenses[k]) || 0), 0);

  const needsTotal = (Number(budgetExpenses.housing) || 0) +
                     (Number(budgetExpenses.utilities) || 0) +
                     (Number(budgetExpenses.food) || 0) +
                     (Number(budgetExpenses.transportation) || 0) +
                     (Number(budgetExpenses.healthcare) || 0) +
                     (isMarriedMode ? (Number(budgetExpenses.debt) || 0) : 0) +
                     (Number(budgetExpenses.childcare) || 0) +
                     (Number(budgetExpenses['🏠 Mortgage']) || Number(budgetExpenses['mortgage']) || 0) +
                     activeDebtsTotal;
  const wantsTotal = (Number(budgetExpenses.leisure) || 0) +
                     (Number(budgetExpenses.diningOut) || 0) +
                     (Number(budgetExpenses.misc) || 0);
  const surplusMonthly = Math.max(0, combinedIncome - totalExpensesMonthly);

  const totalUserAllocationPct = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
  const totalPartnerAllocationPct = isMarriedMode ? Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0) : 0;
  const totalAllocationPct = totalUserAllocationPct + totalPartnerAllocationPct;

  const activeDebts = getActiveDebtsForAge(inputs, activePhaseObj?.startAge || inputs.currentAge);
  const [decideLater, setDecideLater] = useState(false);

  let activeC = activePhaseObj?.childCount || 0;
  let activeChildBoost = 0;
  if (activeC > 0 && activePhaseObj) {
    const rawIncomeItem = (inputs.incomeList || []).find(inc => 
      activePhaseObj.startAge >= inc.startAge && 
      activePhaseObj.startAge < inc.endAge && 
      !inc.id.startsWith('simple-inc-childcare') && 
      !inc.id.startsWith('simple-inc-worksave') && 
      !inc.id.startsWith('simple-inc-prechild') && 
      !inc.id.startsWith('child-income-boost')
    );
    let baseSalaryMonthly;
    if (isRetirementPhase) {
      baseSalaryMonthly = activePhaseObj.ssMonthlyIncome || 0;
    } else if (rawIncomeItem) {
      baseSalaryMonthly = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
    } else {
      baseSalaryMonthly = Math.round((Number(inputs.simpleIncome) || 50000) / 12);
    }
    activeChildBoost = Math.max(0, budgetMonthlyIncome - baseSalaryMonthly);
  }

  let currentChildCostsMonthly = 0;
  if (activeC > 0 && activePhaseObj) {
    currentChildCostsMonthly = activeC * 1250;
  }

  const userAge = activePhaseObj?.startAge || inputs.currentAge || 30;
  const spouseMember = (inputs.lifeEvents || []).find(e => e.type === 'spouseMember');
  const spouseCurrentAge = spouseMember && spouseMember.currentAge !== undefined && spouseMember.currentAge !== null && spouseMember.currentAge !== ''
    ? Number(spouseMember.currentAge)
    : (marriageEvent && marriageEvent.spouseCurrentAge !== undefined ? Number(marriageEvent.spouseCurrentAge) : inputs.currentAge || 30);
  const ageDifference = spouseCurrentAge - (inputs.currentAge || 30);
  const spouseAge = userAge + ageDifference;

  const filingStatusForModal = isMarriedMode ? (marriageEvent.filingStatus || 'jointly') : budgetFilingStatus;

  const est401kMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) 
    : (budgetSavings.trad401k || 0);
  const estTradIraMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) 
    : (budgetSavings.tradIra || 0);
  const estHsaMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) 
    : (budgetSavings.hsa || 0);

  const limit401k = getRetirementLimit('401k', userAge, filingStatusForModal);
  const limitTradIra = getRetirementLimit('traditionalIRA', userAge, filingStatusForModal);
  const limitHsa = getRetirementLimit('hsa', userAge, budgetHsaCoverage === 'family' ? 'married' : 'single');

  const capped401k = Math.min(limit401k, est401kMonthly * 12);
  const cappedTradIra = Math.min(limitTradIra, estTradIraMonthly * 12);
  const cappedHsa = Math.min(limitHsa, estHsaMonthly * 12);
  let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

  if (isMarriedMode) {
    const estPartner401k = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
    const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
    const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

    const partnerLimit401k = getRetirementLimit('401k', spouseAge, filingStatusForModal);
    const partnerLimitTradIra = getRetirementLimit('traditionalIRA', spouseAge, filingStatusForModal);
    const partnerLimitHsa = getRetirementLimit('hsa', spouseAge, budgetHsaCoverage === 'family' ? 'married' : 'single');

    const partnerCapped401k = Math.min(partnerLimit401k, estPartner401k * 12);
    const partnerCappedTradIra = Math.min(partnerLimitTradIra, estPartnerTradIra * 12);
    const partnerCappedHsa = Math.min(partnerLimitHsa, estPartnerHsa * 12);
    preTaxDeductionsAnnual += partnerCapped401k + partnerCappedTradIra + partnerCappedHsa;
  }

  const annualTax = inputs.includeTaxes
    ? calculateUSTaxForModal(combinedIncome * 12, preTaxDeductionsAnnual, filingStatusForModal)
    : 0;
  const monthlyTax = Math.round(annualTax / 12);
  
  const userSavingsMonthly = savingsAllocMode === 'percentSurplus'
    ? Math.round(surplusMonthly * (totalUserAllocationPct / 100))
    : Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);

  const partnerSavingsMonthly = isMarriedMode 
    ? (savingsAllocMode === 'percentSurplus'
       ? Math.round(surplusMonthly * (totalPartnerAllocationPct / 100))
       : Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0))
    : 0;

  const combinedSavingsMonthly = userSavingsMonthly + partnerSavingsMonthly;
  const totalSavingsMonthly = combinedSavingsMonthly;
  const activeSavings = combinedSavingsMonthly;
  const activeSpending = totalExpensesMonthly > 0 ? totalExpensesMonthly : budgetMonthlySpending;
  
  const remainingMonthly = savingsAllocMode === 'percentSurplus'
    ? 100 - totalAllocationPct
    : combinedIncome - activeSavings - activeSpending - monthlyTax;
  
  const childAdjustedSavings = combinedSavingsMonthly;
  const netRemaining = combinedIncome - childAdjustedSavings - activeSpending - monthlyTax;
  
  const handleSavingsChange = (key, value, isPartner = false) => {
    const context = {
      age: isPartner ? spouseAge : userAge,
      filingStatus: filingStatusForModal,
      hsaCoverageType: budgetHsaCoverage
    };

    let finalValue = value;
    if (savingsAllocMode === 'fixed') {
      const capRes = capMonthlyContribution(key, value, context);
      if (capRes.wasCapped) {
        triggerToast(isPartner ? `partner_${key}` : key, capRes.message);
        finalValue = capRes.cappedAmount;
      }
    }

    if (isPartner) {
      setBudgetPartnerSavings(prev => ({
        ...prev,
        [key]: finalValue
      }));
    } else {
      setBudgetSavings(prev => ({
        ...prev,
        [key]: finalValue
      }));
    }
  };

  const handleAllocateRemaining = (categoryKey) => {
    const prevVal = budgetSavings[categoryKey] || 0;
    const targetVal = prevVal + remainingMonthly;
    
    let finalVal = targetVal;
    if (savingsAllocMode === 'fixed') {
      const capRes = capMonthlyContribution(categoryKey, targetVal, {
        age: userAge,
        filingStatus: filingStatusForModal,
        hsaCoverageType: budgetHsaCoverage
      });
      if (capRes.wasCapped) {
        triggerToast(categoryKey, capRes.message);
        finalVal = capRes.cappedAmount;
      }
    }
    
    setBudgetSavings(prev => ({
      ...prev,
      [categoryKey]: Math.max(0, finalVal)
    }));
  };

  const handleAutoReduceSavingsToBalance = () => {
    const priority = ['brokerage', 'other', 'checking', 'hysa', 'emergency', 'rothIra', 'tradIra', 'hsa', 'trad401k', 'debt', 'cash'];
    const newSavings = { ...budgetSavings };
    const newPartnerSavings = { ...budgetPartnerSavings };

    if (savingsAllocMode === 'percentSurplus') {
      let pctDeficit = totalAllocationPct - 100;
      if (pctDeficit <= 0) return;
      
      if (isMarriedMode) {
        for (const key of priority) {
          const val = newPartnerSavings[key] || 0;
          if (val > 0) {
            const reduceAmount = Math.min(val, pctDeficit);
            newPartnerSavings[key] = Math.max(0, parseFloat((val - reduceAmount).toFixed(4)));
            pctDeficit -= reduceAmount;
            if (pctDeficit <= 0) break;
          }
        }
      }
      if (pctDeficit > 0) {
        for (const key of priority) {
          const currentVal = newSavings[key] || 0;
          if (currentVal > 0) {
            const reduceAmount = Math.min(currentVal, pctDeficit);
            newSavings[key] = Math.max(0, parseFloat((currentVal - reduceAmount).toFixed(4)));
            pctDeficit -= reduceAmount;
            if (pctDeficit <= 0) break;
          }
        }
      }
      setBudgetSavings(newSavings);
      if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
    } else {
      let deficitAmount = Math.abs(netRemaining);
      if (deficitAmount <= 0) return;

      if (isMarriedMode) {
        for (const key of priority) {
          const val = newPartnerSavings[key] || 0;
          if (val > 0) {
            const reduceAmount = Math.min(val, deficitAmount);
            newPartnerSavings[key] = Math.max(0, Math.round(val - reduceAmount));
            deficitAmount -= reduceAmount;
            if (deficitAmount <= 0) break;
          }
        }
      }
      if (deficitAmount > 0) {
        for (const key of priority) {
          const currentVal = newSavings[key] || 0;
          if (currentVal > 0) {
            const reduceAmount = Math.min(currentVal, deficitAmount);
            newSavings[key] = Math.max(0, Math.round(currentVal - reduceAmount));
            deficitAmount -= reduceAmount;
            if (deficitAmount <= 0) break;
          }
        }
      }
      setBudgetSavings(newSavings);
      if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
    }
  };

  const handleClearNeeds = () => {
    setBudgetExpenses(prev => {
      const next = { ...prev };
      next.housing = 0;
      next.utilities = 0;
      next.food = 0;
      next.transportation = 0;
      next.healthcare = 0;
      next.debt = 0;
      next.childcare = 0;
      next['🏠 Mortgage'] = 0;
      next['mortgage'] = 0;
      Object.keys(next).forEach(key => {
        if (key.startsWith('debt_')) {
          next[key] = 0;
        }
      });
      return next;
    });
  };

  const handleClearWants = () => {
    setBudgetExpenses(prev => ({
      ...prev,
      leisure: 0,
      diningOut: 0,
      misc: 0
    }));
  };

  const handleClearSavings = () => {
    setBudgetSavings(prev => {
      const next = {};
      Object.keys(prev).forEach(k => {
        next[k] = 0;
      });
      return next;
    });
    if (isMarriedMode) {
      setBudgetPartnerSavings(prev => {
        const next = {};
        Object.keys(prev).forEach(k => {
          next[k] = 0;
        });
        return next;
      });
    }
  };

  const handleReduceWants = () => {
    const deficit = Math.abs(remainingBalance);
    if (wantsTotal <= 0) return;
    const factor = Math.max(0, (wantsTotal - deficit) / wantsTotal);
    setBudgetExpenses(prev => ({
      ...prev,
      leisure: Math.round((prev.leisure || 0) * factor),
      diningOut: Math.round((prev.diningOut || 0) * factor),
      misc: Math.round((prev.misc || 0) * factor)
    }));
  };

  const handleIncreaseIncome = () => {
    const deficit = Math.abs(remainingBalance);
    setBudgetMonthlyIncome(prev => prev + deficit);
  };

  const handleMonthlyIncomeChange = (val) => {
    const newIncome = Math.max(0, val);
    setBudgetMonthlyIncome(newIncome);

    if (totalSavingsMonthly === 0) {
      setBudgetMonthlySavings(Math.max(0, newIncome - activeSpending));
    } else if (totalExpensesMonthly === 0) {
      setBudgetMonthlySpending(Math.max(0, newIncome - totalSavingsMonthly));
    }
  };



  const activeSavingsRate = combinedIncome > 0 
    ? Math.round((activeSavings / combinedIncome) * 100) 
    : 0;

  const getEventDetails = (idOrType) => {
    const le = (inputs.lifeEvents || []).find(e => e.id === idOrType || e.type === idOrType);
    if (le) {
      let icon = '❓';
      if (le.type === 'marriage') icon = '💍';
      else if (le.type === 'buyHouse') icon = '🏠';
      else if (le.type === 'haveChild') icon = '👶';
      else if (le.type === 'careerChange') icon = '💼';
      else if (le.type === 'socialSecurity') icon = '💰';
      else if (le.type === 'pension') icon = '📜';
      else if (le.type === 'rentalIncome') icon = '🏢';
      else if (le.type === 'annuity') icon = '📈';
      else if (le.type === 'otherRetirementIncome') icon = '💵';
      else if (le.type === 'windfall') icon = '💰';
      else if (le.type === 'college') icon = '🎓';
      else if (le.type === 'debtPayoff') icon = '💸';
      else if (le.type === 'retire') icon = '🏖️';
      
      return {
        name: le.name || le.type,
        icon,
        type: le.type
      };
    }
    
    const debt = (inputs.debtList || []).find(d => d.id === idOrType);
    if (debt) {
      let icon = '💸';
      if (debt.type === 'studentLoan') icon = '🎓';
      else if (debt.type === 'carLoan') icon = '🚗';
      else if (debt.type === 'creditCard') icon = '💳';
      return {
        name: debt.name || 'Debt',
        icon,
        type: debt.type
      };
    }

    const inc = (inputs.incomeList || []).find(i => i.id === idOrType);
    if (inc) {
      return {
        name: inc.name || 'Income',
        icon: '💼',
        type: 'income'
      };
    }

    const sp = (inputs.spendingPhases || []).find(s => s.id === idOrType);
    if (sp) {
      return {
        name: sp.name || 'Spending',
        icon: '📉',
        type: 'spending'
      };
    }

    if (idOrType === 'retire') return { name: 'Retirement', icon: '🏖️', type: 'retire' };
    if (idOrType === 'socialSecurity') return { name: 'Social Security', icon: '💰', type: 'socialSecurity' };
    
    return { name: idOrType, icon: '❓', type: idOrType };
  };

  const modalTitle = activePhaseObj ? `${activePhaseObj.label} Budget` : 'Work Phase Budget';

  const getPopoverDetails = () => {
    if (!activePhaseObj) return { activeEvents: [], phaseChanges: [] };

    const activeIndex = normalizedPhases.findIndex(p => p.id === activePhaseObj.id);
    const prior = activeIndex > 0 ? normalizedPhases[activeIndex - 1] : null;

    // 1. Compile Active Events list
    const activeEventsList = [];

    // Main Income / Retirement Withdrawals
    if (activePhaseObj.type !== 'retire') {
      activeEventsList.push("Salary / Main Income");
    } else {
      activeEventsList.push("Retirement Withdrawals");
    }

    // Base spending
    activeEventsList.push("Base Lifestyle Spending");

    // Marriage
    if (activePhaseObj.isMarried) {
      activeEventsList.push("Combined Household Finances");
    }

    // Childcare
    if (activePhaseObj.childCount > 0) {
      activeEventsList.push(`Childcare (${activePhaseObj.childCount} ${activePhaseObj.childCount === 1 ? 'child' : 'children'})`);
    }

    // Active Debts
    if (activePhaseObj.activeDebts && activePhaseObj.activeDebts.length > 0) {
      activePhaseObj.activeDebts.forEach(d => {
        const typeLabel = d.type === 'studentLoan' ? 'Student loan' : d.name;
        activeEventsList.push(`${typeLabel} payments`);
      });
    }

    // Social Security
    if (activePhaseObj.ssMonthlyIncome > 0) {
      activeEventsList.push("Social Security");
    }
    if (activePhaseObj.partnerSSMonthlyIncome > 0) {
      activeEventsList.push("Spouse Social Security");
    }

    // Custom Incomes (from inputs.incomeList) active at this age
    const currentAge = activePhaseObj.startAge;
    const customIncomes = (inputs.incomeList || []).filter(inc => {
      return inc.enabled && currentAge >= Number(inc.startAge) && currentAge < Number(inc.endAge);
    });
    customIncomes.forEach(inc => {
      activeEventsList.push(inc.name || "Custom Income");
    });

    // Custom Spendings (from inputs.spendingPhases) active at this age
    const customSpendings = (inputs.spendingPhases || []).filter(sp => {
      return sp.enabled && currentAge >= Number(sp.startAge) && currentAge < Number(sp.endAge);
    });
    customSpendings.forEach(sp => {
      activeEventsList.push(sp.name || "Custom Spending");
    });

    // 2. Compile Phase Changes list
    const phaseChangesList = [];
    const explanations = getPhaseChangeExplanations(activePhaseObj, normalizedPhases);

    explanations.forEach(exp => {
      // Skip filler texts
      if (exp.text.includes("Starting phase for your financial timeline.") ||
          exp.text.includes("Transitioned to a new phase boundary")) {
        return;
      }

      // Extract amount if present in impacts
      let amount = "";
      if (exp.impacts && exp.impacts.length > 0) {
        const firstImpact = exp.impacts[0];
        const match = firstImpact.match(/([+-]\s*\$?[\d,]+(?:\/(?:month|year|mo))?)/i);
        if (match) {
          amount = match[1].replace(/\s+/g, ""); // e.g. "+$318/month" or "+$15,000/year"
        }
      }

      const textLower = exp.text.toLowerCase();
      
      // Childcare
      if (exp.type === 'childcare') {
        if (textLower.includes("start")) {
          phaseChangesList.push(`Childcare begins (${amount || '+$15,000/year'})`);
        } else {
          phaseChangesList.push(`Childcare ends (${amount || '-$15,000/year'})`);
        }
        return;
      }

      // Debt
      if (exp.type === 'debt') {
        let debtName = "Debt";
        if (textLower.includes("student loan")) {
          debtName = "Student loan";
        } else {
          const nameMatch = exp.text.match(/when\s+(.*?)\s+payments/i) || exp.text.match(/for\s+(.*?)\./i);
          if (nameMatch) {
            debtName = nameMatch[1];
            debtName = debtName.charAt(0).toUpperCase() + debtName.slice(1);
          }
        }

        if (textLower.includes("start")) {
          phaseChangesList.push(`${debtName} begins (${amount})`);
        } else {
          phaseChangesList.push(`${debtName} payoff complete (${amount})`);
        }
        return;
      }

      // Retirement
      if (exp.type === 'retirement' || textLower.includes("retirement")) {
        phaseChangesList.push("Retirement starts");
        return;
      }

      // Marriage
      if (exp.type === 'marriage' || textLower.includes("marriage") || textLower.includes("married")) {
        if (textLower.includes("marriage ends") || textLower.includes("no longer married")) {
          phaseChangesList.push("Marriage ends");
        } else {
          phaseChangesList.push("Marriage (Combined finances)");
        }
        return;
      }

      // Social Security
      if (textLower.includes("social security")) {
        if (textLower.includes("partner")) {
          phaseChangesList.push("Spouse Social Security begins");
        } else {
          phaseChangesList.push("Social Security begins");
        }
        return;
      }

      // Salary / income changes
      if (exp.type === 'income' || textLower.includes("income")) {
        if (textLower.includes("increase")) {
          phaseChangesList.push(`Salary increase (${amount})`);
        } else if (textLower.includes("decrease")) {
          phaseChangesList.push(`Salary decrease (${amount})`);
        } else if (textLower.includes("passive")) {
          phaseChangesList.push(`Passive income begins (${amount})`);
        } else {
          phaseChangesList.push(exp.text);
        }
        return;
      }

      // Fallback if not matched
      phaseChangesList.push(exp.text);
    });

    return { activeEvents: activeEventsList, phaseChanges: phaseChangesList };
  };

  const getBudgetPhaseThemeClass = (p) => {
    const label = p.label || '';
    const isRetired = p.startAge >= (inputs.targetRetirementAge || inputs.lifeExpectancy);
    const hasSS = p.activeEvents?.includes('socialSecurity') || label.includes('Social Security') || p.icon === '🏖️💰' || p.icon === '💰';
    
    if (isRetired) {
      if (hasSS) return 'theme-retired-ss'; // Emerald / Teal
      return 'theme-retired'; // Amber / Gold
    }
    
    // Working phases
    const lowerLabel = label.toLowerCase();
    const hasChildcare = lowerLabel.includes('childcare');
    const hasStudentLoan = lowerLabel.includes('student loan') || p.activeDebts?.some(d => d.type === 'studentLoan');
    const hasHouse = lowerLabel.includes('house') || lowerLabel.includes('mortgage') || p.activeDebts?.some(d => d.type === 'mortgage');
    const hasOtherDebt = p.activeDebts && p.activeDebts.length > 0;
    
    if (hasChildcare) {
      if (hasOtherDebt) return 'theme-working-childcare-debt'; // Coral / Rose
      return 'theme-working-childcare'; // Magenta / Pink-Purple
    }
    if (hasStudentLoan) return 'theme-working-student-loan'; // Purple
    if (hasHouse) return 'theme-working-house'; // Cyan / Blue
    
    return 'theme-working-standard'; // Indigo / Blue
  };

  const takeHomeIncome = inputs.includeTaxes ? (combinedIncome - monthlyTax) : combinedIncome;
  const totalAllocated = needsTotal + wantsTotal + activeSavings;
  const remainingBalance = takeHomeIncome - totalAllocated;
  const panelProps = {
    inputs,
    activePhaseObj,
    normalizedPhases,
    isMarriedMode,
    partnerMonthlyIncome,
    combinedIncome,
    needsTotal,
    wantsTotal,
    activeSavings,
    takeHomeIncome,
    activeDebts,
    activeC,
    showBreakdown,
    setShowBreakdown,
    activeBreakdownTab,
    setActiveBreakdownTab,
    isEditingNeeds,
    setIsEditingNeeds,
    isEditingWants,
    setIsEditingWants,
    isEditingSavings,
    setIsEditingSavings,
    showPopover,
    setShowPopover,
    isHovering,
    setIsHovering,
    defaultTemplate,
    budgetMonthlyIncome,
    budgetExpenses,
    setBudgetExpenses,
    budgetSavings,
    setBudgetSavings,
    budgetPartnerSavings,
    setBudgetPartnerSavings,
    activeBudgetPhase,
    handleSavingsChange,
    userAge,
    spouseAge,
    filingStatus: filingStatusForModal,
    hsaCoverageType: budgetHsaCoverage,
    handleSwitchBudgetPhase,
    savingsAllocMode,
    budgetHsaCoverage,
    pendingImprovement,
    handleCloseBudgetModal,
    handleSaveBudget,
    getPopoverDetails,
    getEventDetails,
    getBudgetPhaseThemeClass,
    totalAllocated,
    remainingBalance,
    modalTitle,
    isRetirementPhase,
    monthlyTax,
    activeSavingsRate,
    handleReduceWants,
    handleAutoReduceSavingsToBalance,
    handleIncreaseIncome,
    handleAllocateRemaining,
    handleToggleSavingsAllocMode,
    decideLater,
    setDecideLater,
    handleClearNeeds,
    handleClearWants,
    handleClearSavings
  };

  return (
    <div className="modal-backdrop" onClick={handleCloseBudgetModal}>
      <style>{`
        @keyframes toast-fade-in {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .custom-toast {
          animation: toast-fade-in 0.25s ease-out forwards;
        }
      `}</style>
      <div 
        className={isMobile ? "budget-modal-card redesigned modal-content mobile-full" : `budget-modal-card redesigned modal-content ${showBreakdown ? 'with-breakdown' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? { maxWidth: '100%', width: '100%', height: '100%', borderRadius: 0, margin: 0 } : undefined}
      >
        {isMobile ? (
          <MobileBudgetPanel {...panelProps} />
        ) : (
          <DesktopBudgetPanel {...panelProps} />
        )}
      </div>

      {toast.visible && (
        <div 
          className="custom-toast"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1100,
            fontSize: '0.9rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none'
          }}
        >
          <span>⚠️</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
