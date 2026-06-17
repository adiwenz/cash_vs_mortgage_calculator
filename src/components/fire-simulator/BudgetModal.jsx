import { useState, useEffect } from 'react';
import { getNormalizedPhases, getPhaseChangeExplanations } from '../../fireCalculations';
import { calculateUSTaxForModal } from '../../simulatorMathUtils';
import { formatCurrency } from './helpers';
import { getActiveDebtsForAge } from '../../calculators/fire/debts.js';

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
  handleSaveBudget
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('needs');
  const [isEditingNeeds, setIsEditingNeeds] = useState(false);
  const [isEditingWants, setIsEditingWants] = useState(false);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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

  const est401kMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) 
    : (budgetSavings.trad401k || 0);
  const estTradIraMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) 
    : (budgetSavings.tradIra || 0);
  const estHsaMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) 
    : (budgetSavings.hsa || 0);

  const capped401k = Math.min(23500, est401kMonthly * 12);
  const cappedTradIra = Math.min(7000, estTradIraMonthly * 12);
  const cappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estHsaMonthly * 12);
  let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

  if (isMarriedMode) {
    const estPartner401k = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
    const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
    const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

    const partnerCapped401k = Math.min(23500, estPartner401k * 12);
    const partnerCappedTradIra = Math.min(7000, estPartnerTradIra * 12);
    const partnerCappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estPartnerHsa * 12);
    preTaxDeductionsAnnual += partnerCapped401k + partnerCappedTradIra + partnerCappedHsa;
  }

  const filingStatusForModal = isMarriedMode ? (marriageEvent.filingStatus || 'jointly') : budgetFilingStatus;
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
  
  const handleAllocateRemaining = (categoryKey) => {
    setBudgetSavings(prev => ({
      ...prev,
      [categoryKey]: Math.max(0, (prev[categoryKey] || 0) + remainingMonthly)
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



  return (
    <div className="modal-backdrop" onClick={handleCloseBudgetModal}>
      <div 
        className={`budget-modal-card redesigned modal-content ${showBreakdown ? 'with-breakdown' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="budget-modal-layout">
          


          {/* Left/Main Column */}
          <div className="budget-main-col">
            
            {/* Header */}
            <div className="budget-modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold', 
                    margin: 0, 
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    verticalAlign: 'middle'
                  }}>
                    <span>🎯 {modalTitle} {activePhaseObj && `(Age ${activePhaseObj.startAge}–${activePhaseObj.endAge})`}</span>
                    {activePhaseObj && (
                      <div 
                        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                      >
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPopover(!showPopover);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '1.2rem',
                            height: '1.2rem',
                            borderRadius: '50%',
                            transition: 'all 0.2s',
                          }}
                          className="phase-info-icon-btn"
                          aria-label="Phase Info"
                        >
                          ⓘ
                        </button>
                        
                        {(showPopover || isHovering) && (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: '0',
                              marginTop: '0.5rem',
                              zIndex: 100,
                              width: '280px',
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              padding: '0.85rem 1rem',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              textAlign: 'left',
                              lineHeight: '1.4',
                              fontWeight: 'normal'
                            }}
                            className="phase-info-popover"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ fontWeight: '600', fontSize: '0.88rem', marginBottom: '0.6rem', color: '#60a5fa' }}>
                              Why this phase exists
                            </div>
                            
                            <div style={{ marginBottom: '0.6rem' }}>
                              <div style={{ fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Active Events:</div>
                              <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                                {getPopoverDetails().activeEvents.map((evt, idx) => (
                                  <li key={idx} style={{ marginBottom: '0.15rem' }}>{evt}</li>
                                ))}
                              </ul>
                            </div>

                            {getPopoverDetails().phaseChanges.length > 0 && (
                              <div>
                                <div style={{ fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Phase Changes:</div>
                                <ul style={{ margin: 0, paddingLeft: '1.1rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                                  {getPopoverDetails().phaseChanges.map((chg, idx) => (
                                    <li key={idx} style={{ marginBottom: '0.15rem' }}>{chg}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Set your monthly plan for this phase.
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={handleCloseBudgetModal}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem' }}
                >
                  ✖
                </button>
              </div>


            </div>

            {/* Tabs for Budget Phases */}
            <div className="budget-modal-tabs">
              {normalizedPhases.map((p) => {
                const isActive = p.id === activeBudgetPhase;
                const icons = p.activeEvents && p.activeEvents.slice(0, 3).map(evId => getEventDetails(evId).icon) || [];
                const themeClass = getBudgetPhaseThemeClass(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`budget-modal-tab ${themeClass} ${isActive ? 'active' : ''}`}
                    onClick={() => handleSwitchBudgetPhase(p.id)}
                  >
                    <span className="budget-modal-tab-age">Age {p.startAge}–{p.endAge}</span>
                    <span className="budget-modal-tab-label">{icons.join('')} {p.label}</span>
                  </button>
                );
              })}
            </div>



            <div className="budget-main-scroll-body">
              {pendingImprovement && (
              <div style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  💡 Applying Recommendation: {pendingImprovement.scenario.title}
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  This scenario changes your monthly budget targets (recommended adjustment: <strong>{pendingImprovement.scenario.savingsFocus}</strong>). 
                  We have updated the gross salary and target savings, but your detailed allocations need to be aligned. Please review and adjust the categories below, then click <strong>Save Budget</strong> to apply the scenario.
                </p>
              </div>
            )}



            {/* Primary Section: Three Budget Cards */}
            <div className="budget-cards-grid">
              
              {/* Needs Card */}
              <div 
                className={`budget-card needs ${showBreakdown && activeBreakdownTab === 'needs' ? 'active' : ''}`}
                onClick={() => {
                  if (showBreakdown && activeBreakdownTab === 'needs') {
                    setShowBreakdown(false);
                  } else {
                    setShowBreakdown(true);
                    setActiveBreakdownTab('needs');
                  }
                }}
              >
                <div className="budget-card-icon-circle">🏠</div>
                <div className="budget-card-title">Needs</div>
                <div className="budget-card-amount">{formatCurrency(needsTotal)}/mo</div>
                <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0}%</div>
                <div className="budget-card-progress">
                  <div 
                    className="budget-card-progress-fill" 
                    style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0)}%` }}
                  />
                </div>
              </div>

              {/* Wants Card */}
              <div 
                className={`budget-card wants ${showBreakdown && activeBreakdownTab === 'wants' ? 'active' : ''}`}
                onClick={() => {
                  if (showBreakdown && activeBreakdownTab === 'wants') {
                    setShowBreakdown(false);
                  } else {
                    setShowBreakdown(true);
                    setActiveBreakdownTab('wants');
                  }
                }}
              >
                <div className="budget-card-icon-circle">🎉</div>
                <div className="budget-card-title">Wants</div>
                <div className="budget-card-amount">{formatCurrency(wantsTotal)}/mo</div>
                <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0}%</div>
                <div className="budget-card-progress">
                  <div 
                    className="budget-card-progress-fill" 
                    style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0)}%` }}
                  />
                </div>
              </div>

              {/* Save & Invest Card */}
              <div 
                className={`budget-card save ${showBreakdown && activeBreakdownTab === 'savings' ? 'active' : ''}`}
                onClick={() => {
                  if (showBreakdown && activeBreakdownTab === 'savings') {
                    setShowBreakdown(false);
                  } else {
                    setShowBreakdown(true);
                    setActiveBreakdownTab('savings');
                  }
                }}
              >
                <div className="budget-card-icon-circle">💰</div>
                <div className="budget-card-title">Save & Invest</div>
                <div className="budget-card-amount">
                  {isRetirementPhase ? '$0/mo' : `${formatCurrency(activeSavings)}/mo`}
                </div>
                <div className="budget-card-pct">
                  {isRetirementPhase ? '0%' : `${takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0}%`}
                </div>
                <div className="budget-card-progress">
                  <div 
                    className="budget-card-progress-fill" 
                    style={{ width: `${Math.min(100, isRetirementPhase ? 0 : (takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0))}%` }}
                  />
                </div>
              </div>

            </div>



            {/* Simplified Summary Section */}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '1rem',
                marginBottom: '1rem'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                  Monthly Take-Home Income
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {formatCurrency(takeHomeIncome)}
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                  Allocated
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {formatCurrency(totalAllocated)}/mo{' '}
                  <span style={{ fontSize: '0.9rem', color: takeHomeIncome > 0 ? (Math.round((totalAllocated / takeHomeIncome) * 100) > 100 ? 'var(--accent-rose)' : 'var(--accent-emerald)') : 'var(--text-tertiary)', fontWeight: 'bold' }}>
                    ({takeHomeIncome > 0 ? Math.round((totalAllocated / takeHomeIncome) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Status Banner */}
            <div style={{ marginBottom: '1rem' }}>
              {Math.abs(remainingBalance) <= 1 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  ✅ You’re on track. You’re saving {activeSavingsRate}% of your income.
                </div>
              ) : remainingBalance < 0 ? (
                activeDebts.length > 0 && !decideLater ? (
                  <div className="deficit-warning-box" style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <div style={{ color: 'var(--accent-rose, #f43f5e)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.15rem' }}>
                        New obligation added.
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        This plan is currently running a monthly deficit of <strong>{formatCurrency(Math.abs(remainingBalance))}</strong>.
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="list-builder-edit-btn"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                        onClick={handleReduceWants}
                      >
                        📉 Reduce Wants
                      </button>
                      <button
                        type="button"
                        className="list-builder-edit-btn"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                        onClick={handleAutoReduceSavingsToBalance}
                      >
                        ⚖️ Reduce Savings
                      </button>
                      <button
                        type="button"
                        className="list-builder-edit-btn"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--primary)', color: 'var(--primary-light, #a5b4fc)' }}
                        onClick={handleIncreaseIncome}
                      >
                        💰 Increase Income
                      </button>
                      <button
                        type="button"
                        className="list-builder-edit-btn"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        onClick={() => setDecideLater(true)}
                      >
                        ⏳ I’ll Decide Later
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>⚠️ Over budget by {formatCurrency(Math.abs(remainingBalance))}/mo.</span>
                    <button 
                      type="button"
                      className="list-builder-edit-btn" 
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', borderColor: 'var(--accent-rose)', color: '#fda4af' }}
                      onClick={handleAutoReduceSavingsToBalance}
                    >
                      ⚖️ Auto-Reduce Savings
                    </button>
                  </div>
                )
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span>💡 {formatCurrency(remainingBalance)}/mo remains unallocated.</span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button 
                      type="button" 
                      className="list-builder-edit-btn" 
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                      onClick={() => handleAllocateRemaining('hysa')}
                    >
                      📥 Put in HYSA
                    </button>
                    <button 
                      type="button" 
                      className="list-builder-edit-btn" 
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                      onClick={() => handleAllocateRemaining('brokerage')}
                    >
                      📥 Put in Brokerage
                    </button>
                  </div>
                </div>
              )}
            </div>



            {/* Warnings & Guardrails */}
            {(() => {
              const warnings = [];
              if (capped401k >= 23500 && (budgetSavings.trad401k || 0) * 12 > 23500) {
                warnings.push(`401(k) exceeds employee limit ($23,500/yr). Capping tax deduction.`);
              }
              if ((budgetSavings.tradIra || 0) * 12 + (budgetSavings.rothIra || 0) * 12 > 7000) {
                warnings.push(`Combined IRA contributions exceed the $7,000/yr limit.`);
              }
              if (cappedHsa >= (budgetHsaCoverage === 'family' ? 8300 : 4150) && (budgetSavings.hsa || 0) * 12 > (budgetHsaCoverage === 'family' ? 8300 : 4150)) {
                warnings.push(`HSA exceeds IRS limit ($${budgetHsaCoverage === 'family' ? '8,300' : '4,150'}/yr). Capping tax deduction.`);
              }
              
              if (warnings.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                  {warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                      ⚠️ {w}
                    </div>
                  ))}
                </div>
              );
            })()}
            </div>

            {/* Footer Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
                onClick={handleCloseBudgetModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                onClick={() => handleSaveBudget(defaultTemplate)}
              >
                Save Budget
              </button>
            </div>

          </div>

          {/* Right Column: Breakdown Sidebar */}
          <div className={`budget-breakdown-sidebar ${showBreakdown ? 'open' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Breakdown</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>See what's included in each category.</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowBreakdown(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}
              >
                ✖
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(85vh - 7rem)', overflowY: 'auto', paddingRight: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Needs Breakdown */}
              {(!activeBreakdownTab || activeBreakdownTab === 'needs') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>🏠 Needs</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(needsTotal)}/mo</strong>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                    {(() => {
                      const needsItems = [
                        { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                        { key: 'utilities', label: 'Utilities & Subscriptions' },
                        { key: 'food', label: 'Food (Groceries)' },
                        { key: 'transportation', label: 'Transportation / Gas / Car' },
                        { key: 'healthcare', label: 'Healthcare & Insurance' }
                      ];
                      if (isMarriedMode) {
                        needsItems.push({ key: 'debt', label: 'Debt Payments' });
                      }
                      if (activeC > 0 || (budgetExpenses.childcare && budgetExpenses.childcare > 0)) {
                        needsItems.push({ key: 'childcare', label: 'Childcare' });
                      }
                      return needsItems;
                    })().map(item => {
                      const isChildcare = item.key === 'childcare';
                      return (
                        <div 
                          key={item.key} 
                          className={`breakdown-row budget-input-row ${isChildcare ? 'childcare-locked-glow' : ''}`}
                        >
                          <span className="breakdown-row-label">
                            {isChildcare ? '👶 ' : ''}{item.label} {isChildcare && <span style={{ fontSize: '0.72rem', opacity: 0.8, marginLeft: '0.2rem' }}>🔒</span>}
                          </span>
                          {isEditingNeeds && !isChildcare ? (
                            <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                              <span className="currency-symbol">$</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                value={budgetExpenses[item.key] || 0}
                                onChange={(e) => setBudgetExpenses({
                                  ...budgetExpenses,
                                  [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                })}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="breakdown-row-dots" />
                              <span className="breakdown-row-value" style={isChildcare ? { color: 'var(--accent-amber)' } : undefined}>
                                {formatCurrency(budgetExpenses[item.key] || 0)}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {activeDebts.map(debt => (
                      <div key={debt.id} className="breakdown-row budget-input-row">
                        <span className="breakdown-row-label">{debt.icon} {debt.name}</span>
                        <div className="breakdown-row-dots" />
                        <span className="breakdown-row-value">{formatCurrency(budgetExpenses[`debt_${debt.id}`] || debt.monthlyPayment)}</span>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="breakdown-edit-link"
                      onClick={() => setIsEditingNeeds(!isEditingNeeds)}
                    >
                      {isEditingNeeds ? 'Done Editing ✓' : 'Edit Needs →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Wants Breakdown */}
              {(!activeBreakdownTab || activeBreakdownTab === 'wants') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 'bold' }}>🎉 Wants</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(wantsTotal)}/mo</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                    {[
                      { key: 'leisure', label: 'Leisure & Leisure Travel' },
                      { key: 'diningOut', label: 'Dining Out' },
                      { key: 'misc', label: 'Miscellaneous Expenses' }
                    ].map(item => (
                      <div key={item.key} className="breakdown-row budget-input-row">
                        <span className="breakdown-row-label">{item.label}</span>
                        {isEditingWants ? (
                          <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                            <span className="currency-symbol">$</span>
                            <input
                              type="number"
                              className="input-number-box"
                              style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                              value={budgetExpenses[item.key] || 0}
                              onChange={(e) => setBudgetExpenses({
                                ...budgetExpenses,
                                [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                              })}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="breakdown-row-dots" />
                            <span className="breakdown-row-value">{formatCurrency(budgetExpenses[item.key] || 0)}</span>
                          </>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      className="breakdown-edit-link"
                      onClick={() => setIsEditingWants(!isEditingWants)}
                    >
                      {isEditingWants ? 'Done Editing ✓' : 'Edit Wants →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Save & Invest Breakdown */}
              {(!activeBreakdownTab || activeBreakdownTab === 'savings') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#c084fc', fontWeight: 'bold' }}>💰 Save & Invest</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo
                    </strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                    {isRetirementPhase ? (
                      <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                        🏖️ Savings are disabled during retirement. You are now drawing down from your portfolio to fund your living expenses.
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', margin: '0.25rem 0 0.15rem 0' }}>
                          {isMarriedMode ? '👤 Your Savings' : 'Monthly Savings'}
                        </span>
                        
                        {(isMarriedMode ? [
                          { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                          { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr' },
                          { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr' },
                          { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                          { key: 'brokerage', label: 'Taxable Brokerage' },
                          { key: 'checking', label: 'Checking Account' },
                          { key: 'hysa', label: 'High-Yield Savings' },
                          { key: 'emergency', label: 'Emergency Fund' },
                          { key: 'cash', label: 'Cash Savings' },
                          { key: 'debt', label: 'Debt Paydown' },
                          { key: 'other', label: 'Other Savings' }
                        ] : [
                          { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                          { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr combined' },
                          { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr combined' },
                          { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                          { key: 'brokerage', label: 'Taxable Brokerage' },
                          { key: 'checking', label: 'Checking Account' },
                          { key: 'hysa', label: 'High-Yield Savings' },
                          { key: 'emergency', label: 'Emergency Fund' },
                          { key: 'debt', label: 'Debt Payoff' },
                          { key: 'other', label: 'Other Savings' }
                        ]).map(item => (
                          <div key={item.key} className="breakdown-row budget-input-row" style={{ minHeight: '22px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="breakdown-row-label">{item.label}</span>
                              {item.desc && !isEditingSavings && (
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                                  {item.desc}
                                </span>
                              )}
                            </div>
                            {isEditingSavings ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                                <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                                  <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                  <input
                                    type="number"
                                    className="input-number-box"
                                    style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                    value={budgetSavings[item.key] || 0}
                                    onChange={(e) => setBudgetSavings({
                                      ...budgetSavings,
                                      [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                    })}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="breakdown-row-dots" />
                                <span className="breakdown-row-value">
                                  {savingsAllocMode === 'percentSurplus' 
                                    ? `${budgetSavings[item.key] || 0}%` 
                                    : formatCurrency(budgetSavings[item.key] || 0)}
                                </span>
                              </>
                            )}
                          </div>
                        ))}

                        {isMarriedMode && (
                          <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                              👥 Partner Savings
                            </span>
                            
                            {[
                              { key: 'trad401k', label: 'Partner 401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                              { key: 'rothIra', label: 'Partner Roth IRA', desc: 'Limit $7,000/yr' },
                              { key: 'tradIra', label: 'Partner Traditional IRA', desc: 'Limit $7,000/yr' },
                              { key: 'hsa', label: 'Partner HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                              { key: 'brokerage', label: 'Partner Brokerage' },
                              { key: 'checking', label: 'Partner Checking Account' },
                              { key: 'hysa', label: 'Partner High-Yield Savings' },
                              { key: 'emergency', label: 'Partner Emergency Fund' },
                              { key: 'cash', label: 'Partner Cash Savings' },
                              { key: 'debt', label: 'Partner Other Debt' },
                              { key: 'other', label: 'Partner Other Savings' }
                            ].map(item => (
                              <div 
                                key={item.key} 
                                className="budget-input-row"
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  gap: '0.5rem',
                                  padding: '0.4rem 0.5rem'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className="breakdown-row-label">{item.label}</span>
                                  {item.desc && !isEditingSavings && (
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                                      {item.desc}
                                    </span>
                                  )}
                                </div>
                                {isEditingSavings ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                                    <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                                      <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                      <input
                                        type="number"
                                        className="input-number-box"
                                        style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                        value={budgetPartnerSavings[item.key] || 0}
                                        onChange={(e) => setBudgetPartnerSavings({
                                          ...budgetPartnerSavings,
                                          [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                        })}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="breakdown-row-dots" />
                                    <span className="breakdown-row-value">
                                      {savingsAllocMode === 'percentSurplus' 
                                        ? `${budgetPartnerSavings[item.key] || 0}%` 
                                        : formatCurrency(budgetPartnerSavings[item.key] || 0)}
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="breakdown-edit-link"
                          onClick={() => setIsEditingSavings(!isEditingSavings)}
                        >
                          {isEditingSavings ? 'Done Editing ✓' : 'Edit Savings →'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
