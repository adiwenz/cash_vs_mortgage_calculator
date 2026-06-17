/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useFireSimulation } from '../hooks/useFireSimulation';
import { useTimelineEvents } from '../hooks/useTimelineEvents';
import { useBudgetPhases } from '../hooks/useBudgetPhases';
import { useRecommendations } from '../hooks/useRecommendations';
import { useBudgetState } from '../hooks/useBudgetState';
import { useEventActions } from '../hooks/useEventActions';

import DesktopFireSimulatorView from './fire-simulator/DesktopFireSimulatorView';
import MobileFireSimulatorView from './fire-simulator/MobileFireSimulatorView';

import { isEditableEvent, calculateMarriageEstimates } from './fire-simulator/helpers';
import { 
  validateSocialSecurityClaimAge, 
  getIncomeHistory, 
  calculateTop35AverageIncome, 
  calculateSocialSecurityBenefit, 
  calculateClaimingAgeMultiplier,
  getNormalizedPhases
} from '../fireCalculations';
import { calculateUSTaxForModal } from '../simulatorMathUtils';
import './FireSimulator.css';

export default function FireSimulator() {
  const [activeStep, setActiveStep] = useState(1);
  const [isBudgetOpenFromMarriageWizard, setIsBudgetOpenFromMarriageWizard] = useState(false);
  const [isSavingsDetailsOpen, setIsSavingsDetailsOpen] = useState(false);
  const [savingsDetails, setSavingsDetails] = useState({
    cash: 0,
    emergencyFund: 0,
    brokerage: 0,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    other: 0
  });

  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [wasShortfall, setWasShortfall] = useState(false);
  const lastNonZeroSavingsRateRef = useRef(15); // default to 15% pre-tax savings rate

  // 1. useFireSimulation hook
  const fireSim = useFireSimulation();
  const {
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    updateAsset,
    displayMode,
    setDisplayMode,
    selectedYear,
    setSelectedYear,
    isMobile,
    baselineResults,
    activeResults,
    displayedResults,
    displayedBaselineResults,
    chartData,
    baselineChartData,
    validation
  } = fireSim;

  // Ref to proxy circular budget calls
  const handleSetBudgetClickRef = useRef(null);

  // 2. useEventActions hook
  const eventActions = useEventActions(
    scenarios,
    setScenarios,
    currentScenarioId,
    inputs,
    updateInput,
    (phaseId) => handleSetBudgetClickRef.current?.(phaseId),
    setIsBudgetOpenFromMarriageWizard,
    isMobile
  );
  const {
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
  } = eventActions;

  // 3. useBudgetState hook
  const budgetState = useBudgetState(
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
  );
  useEffect(() => {
    handleSetBudgetClickRef.current = budgetState.handleSetBudgetClick;
  }, [budgetState.handleSetBudgetClick]);

  const {
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
  } = budgetState;

  // 4. useTimelineEvents hook
  const timelineEvents = useTimelineEvents(inputs, displayedResults);

  // 5. useBudgetPhases hook
  const { normalizedPhases, currentAgePhase } = useBudgetPhases(inputs);

  // 6. useRecommendations hook
  const { improvementPlan } = useRecommendations(inputs, activeResults);

  // Summary statistics
  const totalNetWorth = displayedResults.currentNetWorth;
  const todayLog = chartData[0] || { assets: 0, debt: 0, netWorth: 0 };
  const todayAssets = todayLog.assets || 0;
  const todayDebt = todayLog.debt || 0;
  const todayNetWorth = todayLog.netWorth !== undefined ? todayLog.netWorth : totalNetWorth;

  const handleOpenSavingsDetails = () => {
    setSavingsDetails({
      cash: Number(inputs.assets?.cash) || 0,
      emergencyFund: Number(inputs.assets?.emergencyFund) || 0,
      brokerage: Number(inputs.assets?.brokerage) || 0,
      trad401k: Number(inputs.assets?.trad401k) || 0,
      tradIra: Number(inputs.assets?.tradIra) || 0,
      rothIra: Number(inputs.assets?.rothIra) || 0,
      hsa: Number(inputs.assets?.hsa) || 0,
      other: Number(inputs.assets?.other) || 0
    });
    setIsSavingsDetailsOpen(true);
  };

  const handleSaveSavingsDetails = (newDetails) => {
    updateInput('assets', newDetails);
    const total = Object.values(newDetails).reduce((sum, val) => sum + val, 0);
    updateInput('simpleInvestments', total);
    setIsSavingsDetailsOpen(false);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    let nextList = [...(inputs.currentConditions || [])];
    if (editingCondition.id) {
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  // Drag-and-drop timeline event changes
  const commitEventAgeChange = (evt, newAge) => {
    const oldAge = evt.age;
    if (newAge === oldAge) return;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };

      if (evt.type === 'retire') {
        newInputs.targetRetirementAge = newAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.type === 'retire') {
            return { ...e, age: newAge };
          }
          return e;
        });
        newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
          if (inc.endAge === oldAge) {
            return { ...inc, endAge: newAge };
          }
          return inc;
        });
      } else if (evt.type === 'borrowing') {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId && e.type === 'borrowing') {
            return { ...e, startAge: newAge, age: newAge };
          }
          if (e.type === 'payoffPlan' && e.borrowingId === evt.originalId) {
            const updatedPayoff = { ...e };
            if (e.linked) {
              const shift = newAge - e.startAge;
              updatedPayoff.startAge = newAge;
              updatedPayoff.payoffAge = e.payoffAge + shift;
              if (updatedPayoff.targetPayoffAge) {
                updatedPayoff.targetPayoffAge = updatedPayoff.targetPayoffAge + shift;
              }
            }
            return updatedPayoff;
          }
          return e;
        });
      } else if (evt.type === 'payoffPlanEnd') {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId && e.type === 'payoffPlan') {
            const updatedPayoff = { ...e };
            const borrowing = newInputs.lifeEvents.find(b => b.id === e.borrowingId);
            if (borrowing) {
              const startAge = borrowing.startAge !== undefined ? Number(borrowing.startAge) : newInputs.currentAge;
              const targetPayoffAge = Math.max(startAge + 1, newAge);
              updatedPayoff.payoffAge = targetPayoffAge;
              updatedPayoff.targetPayoffAge = targetPayoffAge;

              const r = (Number(borrowing.interestRate) || 0) / 100 / 12;
              const n = (targetPayoffAge - startAge) * 12;
              const balance = Number(borrowing.balance) || 0;
              const minPayment = Number(borrowing.minPayment) || 0;

              let requiredTotal = 0;
              if (n > 0) {
                if (r === 0) {
                  requiredTotal = balance / n;
                } else {
                  requiredTotal = (balance * r) / (1 - Math.pow(1 + r, -n));
                }
              }
              updatedPayoff.extraPayment = Math.max(0, requiredTotal - minPayment);
            }
            return updatedPayoff;
          }
          return e;
        });
      } else if (evt.type === 'move' || evt.type === 'lifestyle') {
        newInputs.spendingPhases = newInputs.spendingPhases.map(p => {
          if (p.id === evt.originalId) {
            return { ...p, startAge: newAge };
          }
          if (p.endAge === oldAge) {
            return { ...p, endAge: newAge };
          }
          return p;
        });
      } else if (evt.type === 'careerChange' || evt.type === 'career') {
        newInputs.incomeList = newInputs.incomeList.map(i => {
          if (i.id === evt.originalId) {
            return { ...i, startAge: newAge };
          }
          if (i.endAge === oldAge) {
            return { ...i, endAge: newAge };
          }
          return i;
        });
        const draggedCareer = newInputs.incomeList.find(i => i.id === evt.originalId);
        if (draggedCareer && draggedCareer.parentEventId) {
          newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
            if (e.id === draggedCareer.parentEventId) {
              const childStartAge = Number(e.childStartAge !== undefined ? e.childStartAge : 0);
              const newBirthAge = newAge - childStartAge;
              return {
                ...e,
                birthAge: newBirthAge,
                age: newBirthAge
              };
            }
            return e;
          });
        }
      } else {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId) {
            let updated = { ...e };
            if (e.type === 'buyHouse') {
              updated.purchaseAge = newAge;
              updated.age = newAge;
            } else if (e.type === 'sellHouse') {
              updated.age = newAge;
            } else if (e.type === 'haveChild') {
              updated.birthAge = newAge;
              updated.age = newAge;
              newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
                if (inc.id === e.linkedEventId || inc.parentEventId === e.id) {
                  return {
                    ...inc,
                    startAge: newAge + (e.childStartAge || 0)
                  };
                }
                return inc;
              });
            } else if (e.type === 'college') {
              updated.startAge = newAge;
            } else if (e.type === 'sabbatical') {
              const duration = (Number(e.endAge) || 0) - (Number(e.startAge) || 0);
              updated.startAge = newAge;
              updated.endAge = newAge + duration;
            } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(e.type)) {
              let finalAge = newAge;
              if (e.type === 'socialSecurity') {
                finalAge = Math.max(62, Math.min(70, newAge));
              }
              updated.claimingAge = finalAge;
              updated.startAge = finalAge;
              updated.age = finalAge;
            } else if (e.type === 'windfall') {
              updated.ageReceived = newAge;
              updated.age = newAge;
            } else if (e.type === 'assetTransfer') {
              updated.transferAge = newAge;
            } else if (e.type === 'debtPayoff') {
              updated.payoffAge = newAge;
            } else if (e.type === 'marriage') {
              const shift = newAge - oldAge;
              updated.age = newAge;
              if (e.marriageAge !== undefined && e.marriageAge !== null) {
                updated.marriageAge = newAge;
              }
              const oldWeddingAge = (e.weddingAge !== undefined && e.weddingAge !== null && !isNaN(Number(e.weddingAge)))
                ? Number(e.weddingAge)
                : oldAge;
              updated.weddingAge = oldWeddingAge + shift;

              if (newInputs.householdMembers) {
                newInputs.householdMembers = newInputs.householdMembers.map(m => {
                  if (m.id === 'spouse') {
                    return {
                      ...m,
                      activeFromDate: newAge
                    };
                  }
                  return m;
                });
              }
            } else {
              updated.age = newAge;
            }
            return updated;
          }
          return e;
        });
      }

      return {
        ...scen,
        inputs: newInputs
      };
    }));
  };

  const handleNodeDragStart = (e, evt) => {
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    const track = e.currentTarget.closest('.timeline-track-inner') || e.currentTarget.closest('.mobile-roadmap-scroll-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = typeof evt.age === 'number' && !isNaN(evt.age) ? evt.age : (inputs.currentAge || 35);

    let childEndOffset = 0;
    if (evt.type === 'haveChild') {
      const linkedEndEvent = timelineEvents.find(e => e.type === 'childSupportEnds' && String(e.childEventId) === String(evt.originalId));
      if (linkedEndEvent) {
        childEndOffset = linkedEndEvent.age - evt.age;
      } else {
        const lifeEv = inputs.lifeEvents?.find(e => e.id === evt.originalId);
        childEndOffset = lifeEv?.includeCollege ? 22 : 18;
      }
    }

    dragOccurredRef.current = false;

    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX,
      childEndOffset
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      const rawAge = Math.round(initialAge + deltaYears);
      let newAge = rawAge;

      if (evt.type === 'socialSecurity') {
        newAge = Math.max(62, Math.min(70, newAge));
      } else if (evt.type === 'buyHouse' && evt.houseId) {
        const sellEv = inputs.lifeEvents?.find(e => e.type === 'sellHouse' && e.houseId === evt.houseId);
        const maxLimit = sellEv ? Number(sellEv.age) - 1 : maxAge;
        newAge = Math.max(minAge, Math.min(maxLimit, newAge));
      } else if (evt.type === 'sellHouse' && evt.houseId) {
        const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === evt.houseId);
        const minLimit = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) + 1 : minAge;
        newAge = Math.max(minLimit, Math.min(maxAge, newAge));
      } else if (evt.type === 'haveChild') {
        const offset = childEndOffset || 18;
        newAge = Math.max(minAge, Math.min(maxAge - offset, newAge));
      } else {
        newAge = Math.max(minAge, Math.min(maxAge, newAge));
      }

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      setDraggingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentAge: newAge,
          rawAge: rawAge
        };
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);

      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const valSS = validateSocialSecurityClaimAge(rawAge);
            targetAge = valSS.validAge;
            if (valSS.wasClamped) {
              setNotification(valSS.message);
              setTimeout(() => setNotification(null), 2000);
            }
          }
          commitEventAgeChange(evt, targetAge);
        }
        return null;
      });

      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  const handleApplyImprovementScenario = (scenario) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    let inp = scen.inputs;
    if (scenario.type.startsWith('childPromotion') || scenario.type.startsWith('childOffset')) {
      if (scenario.promoEvent) {
        inp = JSON.parse(JSON.stringify(scen.inputs));
        const remainingIncomes = (inp.incomeList || []).filter(i => i.id !== scenario.promoEvent.id);
        inp.incomeList = [...remainingIncomes, scenario.promoEvent];
        
        inp.lifeEvents = (inp.lifeEvents || []).map(ev => {
          if (ev.id === scenario.promoEvent.parentEventId) {
            return { ...ev, linkedEventId: scenario.promoEvent.id };
          }
          return ev;
        });

        setScenarios(prev => prev.map(s => {
          if (s.id !== currentScenarioId) return s;
          return { ...s, inputs: inp };
        }));

        setNotification(
          `✓ Promotion event added to your timeline\n+ $${scenario.promoEvent.salaryIncrease.toLocaleString()}/year income\nRetirement plan updated`
        );
        setTimeout(() => setNotification(null), 4000);

        setShowImprovementModal(false);
        return;
      }
    }
    const currentAgeVal = Number(inp.currentAge) || 30;
    const targetRetAgeVal = Number(inp.targetRetirementAge) || 65;

    let targetIncome = Number(inp.simpleIncome) || 50000;
    const targetFilingStatus = inp.filingStatus || 'single';
    const targetHsaCoverage = inp.budgetDetails?.hsaCoverage || 'single';

    let targetExpensesMap = {};
    let targetSavingsMap = {};

    const currentIncome = Number(inp.simpleIncome) || 0;
    const currentExpenses = Number(inp.simpleExpenses) || 0;
    const simMonthlyExpenses = currentExpenses / 12;
    const simMonthlySavings = Math.max(0, currentIncome - currentExpenses) / 12;
    const monthlyGross = Math.round(currentIncome / 12);

    if (inp.budgetDetails) {
      targetSavingsMap = { ...inp.budgetDetails.savings };
      targetExpensesMap = { ...inp.budgetDetails.expenses };

      const totalSavingsInModal = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      if (totalSavingsInModal > 0 && Math.abs(totalSavingsInModal - simMonthlySavings) > 1) {
        const savingsScale = simMonthlySavings / totalSavingsInModal;
        Object.keys(targetSavingsMap).forEach(key => {
          targetSavingsMap[key] = Math.round(targetSavingsMap[key] * savingsScale);
        });
      } else if (totalSavingsInModal === 0 && simMonthlySavings > 0) {
        targetSavingsMap.brokerage = Math.round(simMonthlySavings);
      }

      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);
      const totalExpensesInModal = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);

      if (totalExpensesInModal > 0 && Math.abs(totalExpensesInModal - availableMonthlyExpenses) > 1) {
        const expensesScale = availableMonthlyExpenses / totalExpensesInModal;
        Object.keys(targetExpensesMap).forEach(key => {
          targetExpensesMap[key] = Math.round(targetExpensesMap[key] * expensesScale);
        });
      } else if (totalExpensesInModal === 0 && availableMonthlyExpenses > 0) {
        targetExpensesMap = {
          housing: Math.round(availableMonthlyExpenses * 0.40),
          utilities: Math.round(availableMonthlyExpenses * 0.10),
          food: Math.round(availableMonthlyExpenses * 0.10),
          diningOut: Math.round(availableMonthlyExpenses * 0.05),
          transportation: Math.round(availableMonthlyExpenses * 0.10),
          healthcare: Math.round(availableMonthlyExpenses * 0.10),
          leisure: Math.round(availableMonthlyExpenses * 0.10),
          misc: Math.round(availableMonthlyExpenses * 0.05)
        };
      }

      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0 && Object.keys(targetExpensesMap).length > 0) {
        let maxKey = Object.keys(targetExpensesMap)[0];
        Object.keys(targetExpensesMap).forEach(key => {
          if (targetExpensesMap[key] > targetExpensesMap[maxKey]) {
            maxKey = key;
          }
        });
        targetExpensesMap[maxKey] = Math.max(0, targetExpensesMap[maxKey] + expenseDiff);
      }
    } else {
      const defaultSavings = {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      };
      if (inp.allocationRules && inp.allocationRules.length > 0) {
        inp.allocationRules.forEach(r => {
          const key = r.destination === 'cash' ? 'checking' :
                      r.destination === 'other' ? 'hysa' :
                      r.destination === 'emergencyFund' ? 'emergency' :
                      r.destination === 'debtPaydown' ? 'debt' : r.destination;
          if (defaultSavings[key] !== undefined) {
            if (r.type === 'fixed') {
              defaultSavings[key] = r.frequency === 'monthly' ? r.value : Math.round(r.value / 12);
            } else {
              const pool = Math.max(0, (Number(inp.simpleIncome) - Number(inp.simpleExpenses)) / 12);
              defaultSavings[key] = Math.round(pool * (r.value / 100));
            }
          }
        });
      } else {
        defaultSavings.brokerage = Math.round(simMonthlySavings);
      }
      targetSavingsMap = defaultSavings;

      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);

      targetExpensesMap = {
        housing: Math.round(availableMonthlyExpenses * 0.40),
        utilities: Math.round(availableMonthlyExpenses * 0.10),
        food: Math.round(availableMonthlyExpenses * 0.10),
        diningOut: Math.round(availableMonthlyExpenses * 0.05),
        transportation: Math.round(availableMonthlyExpenses * 0.10),
        healthcare: Math.round(availableMonthlyExpenses * 0.10),
        leisure: Math.round(availableMonthlyExpenses * 0.10),
        misc: Math.round(availableMonthlyExpenses * 0.05)
      };

      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0) {
        targetExpensesMap.housing = Math.max(0, targetExpensesMap.housing + expenseDiff);
      }
    }

    const baselineSavingsMap = { ...targetSavingsMap };
    const baselineExpensesMap = { ...targetExpensesMap };

    if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
      const additionalSavingsAnnual = scenario.value;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }
    } else if (scenario.type === 'income') {
      const grossIncreaseAnnual = scenario.value;
      const netSavingsAnnual = scenario.netSavingsValue || 0;
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'combined') {
      const additionalSavingsAnnual = scenario.value.savings;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }
      const grossIncreaseAnnual = scenario.value.income;
      const netSavingsAnnual = scenario.value.netSavings || 0;
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    }

    const diffs = { savings: {}, expenses: {} };
    Object.keys(targetSavingsMap).forEach(key => {
      const oldVal = baselineSavingsMap[key] || 0;
      const newVal = targetSavingsMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.savings[key] = newVal - oldVal;
      }
    });
    Object.keys(targetExpensesMap).forEach(key => {
      const oldVal = baselineExpensesMap[key] || 0;
      const newVal = targetExpensesMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.expenses[key] = newVal - oldVal;
      }
    });

    setBudgetDiffs(diffs);
    setBudgetGrossIncome(targetIncome);
    setBudgetFilingStatus(targetFilingStatus);
    setBudgetHsaCoverage(targetHsaCoverage);
    setBudgetSavings(targetSavingsMap);
    setBudgetExpenses(targetExpensesMap);

    const appliedWsIncome = Math.round(targetIncome / 12);
    const normalizedPhases = getNormalizedPhases(inp);
    const initialEdited = {};
    normalizedPhases.forEach(p => {
      initialEdited[p.id] = { ...p };
    });

    const currentPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
    if (currentPhase) {
      let childBoostForCurrent = 0;
      const baseSalaryMonthly = (currentPhase.startAge >= targetRetAgeVal) ? 0 : Math.round(targetIncome / 12);
      initialEdited[currentPhase.id] = {
        ...currentPhase,
        income: baseSalaryMonthly + childBoostForCurrent,
        savings: targetSavingsMap,
        expenses: targetExpensesMap,
        savingsAllocMode: inp.budgetDetails?.savingsAllocMode || 'fixed'
      };
    }
    setEditedPhases(initialEdited);

    let startPhaseId = currentPhase ? currentPhase.id : (normalizedPhases[0]?.id || null);
    setActiveBudgetPhase(startPhaseId);

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
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

    setPendingImprovement({
      scenario,
      originalInputs: inp
    });

    setShowImprovementModal(false);
    setIsBudgetModalOpen(true);
  };

  // Compute Social Security Claim Preview details
  const tempSocialSecurityDetails = useMemo(() => {
    if (!editingEvent || editingEvent.type !== 'socialSecurity') return null;
    
    const claimAge = Number(editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : 67);
    const useEarnings = editingEvent.useEarnings === true;
    
    const incomeHistory = getIncomeHistory(inputs, editingEvent);
    const { workingYears, isEligible } = calculateTop35AverageIncome(incomeHistory);
    
    if (useEarnings) {
      return calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: 1286,
        secondBendPoint: 7749,
        indexingMode: "simple"
      });
    } else {
      const fixedAnnual = (Number(editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 2000) || 0) * 12;
      const claimingMultiplierDetails = calculateClaimingAgeMultiplier({ claimAge, fullRetirementAge: 67 });
      let annualBenefit = fixedAnnual * claimingMultiplierDetails.multiplier;
      let adjustmentType = claimingMultiplierDetails.adjustmentType;
      let adjustmentMultiplier = claimingMultiplierDetails.multiplier;
      
      if (!isEligible) {
        adjustmentType = 'Not eligible';
        adjustmentMultiplier = 0;
        annualBenefit = 0;
      }
      
      return {
        claimAge,
        workingYears,
        isEligible,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: fixedAnnual / 12,
        claimingAgeMultiplier: adjustmentMultiplier,
        monthlyBenefit: annualBenefit / 12,
        annualBenefit,
        adjustmentType
      };
    }
  }, [editingEvent, inputs]);

  // Track last non-zero savings rate to preserve it during empty/zero income editing states
  useEffect(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income > 0) {
      const rate = Math.round(((income - expenses) / income) * 100);
      lastNonZeroSavingsRateRef.current = rate;
    }
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  // Prevent body scroll when modal overlays are active
  useEffect(() => {
    if (isBudgetModalOpen || showImprovementModal || editingEvent || editingCondition) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBudgetModalOpen, showImprovementModal, editingEvent, editingCondition]);

  const syncChildcarePhasesAndRules = () => {};

  const getInputsWithEvent = (baseInputs, event) => {
    let newInputs = JSON.parse(JSON.stringify(baseInputs));
    const type = event.type;
    let savedEvent = null;
    
    // 1. If editing an existing event, remove it first from the appropriate list
    if (event.id) {
      const oldEvent = newInputs.lifeEvents.find(e => e.id === event.id);
      if (oldEvent && oldEvent.type === 'haveChild') {
        const birthAgeVal = Number(event.birthAge !== undefined ? event.birthAge : event.parentAgeAtBirth) || 30;
        const childStartAgeVal = Number(event.childStartAge !== undefined ? event.childStartAge : 0);
        const includeCollegeVal = !!event.includeCollege;
        const maxAgeVal = includeCollegeVal ? 22 : 18;
        
        const childCostsInput = newInputs.childCosts || baseInputs.childCosts;
        const ages0to4Val = event.costMethod === 'custom' ? (event.customAges0to4 !== undefined ? Number(event.customAges0to4) : 15000) : (childCostsInput?.ages0to4 !== undefined ? Number(childCostsInput.ages0to4) : 15000);
        const ages5to12Val = event.costMethod === 'custom' ? (event.customAges5to12 !== undefined ? Number(event.customAges5to12) : 15000) : (childCostsInput?.ages5to12 !== undefined ? Number(childCostsInput.ages5to12) : 15000);
        const ages13to18Val = event.costMethod === 'custom' ? (event.customAges13to18 !== undefined ? Number(event.customAges13to18) : 15000) : (childCostsInput?.ages13to18 !== undefined ? Number(childCostsInput.ages13to18) : 15000);
        const ages19to22Val = event.costMethod === 'custom' ? (event.customAges19to22 !== undefined ? Number(event.customAges19to22) : 15000) : (childCostsInput?.ages19to22 !== undefined ? Number(childCostsInput.ages19to22) : 15000);
        
        const costsVal = [];
        if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
        if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
        if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
        if (includeCollegeVal && childStartAgeVal <= 22 && maxAgeVal >= 19) costsVal.push(ages19to22Val);
        
        const peakCostVal = Math.max(...costsVal, 0);
        const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

        newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
          if (inc.id === oldEvent.linkedEventId || inc.parentEventId === oldEvent.id || inc.id === event.linkedEventId || inc.parentEventId === event.id) {
            return {
              ...inc,
              startAge: newPromoStartAgeVal,
              salaryIncrease: peakCostVal,
              name: event.childName ? `Promotion (${event.childName})` : 'Get a Promotion'
            };
          }
          return inc;
        });
      }
      if (newInputs.lifeEvents.some(e => e.id === event.id)) {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== event.id);
      } else {
        const matchSpend = newInputs.spendingPhases.find(p => p.id === event.id);
        if (matchSpend) {
          const remaining = newInputs.spendingPhases.filter(p => p.id !== event.id);
          newInputs.spendingPhases = remaining.map(p => {
            if (p.endAge === matchSpend.startAge) {
              return { ...p, endAge: matchSpend.endAge };
            }
            return p;
          });
        } else {
          const matchInc = newInputs.incomeList.find(i => i.id === event.id);
          if (matchInc) {
            const remaining = newInputs.incomeList.filter(i => i.id !== event.id);
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
    
    // 2. Perform save/insert logic
    if (type === 'retire') {
      newInputs.targetRetirementAge = event.age;
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.type !== 'retire');
      let newEventObj = {
        id: event.id && event.id !== 'retire' ? event.id : `retire-${Date.now()}`,
        type: 'retire',
        enabled: true,
        name: 'Retirement',
        age: event.age,
        spendingPercent: event.spendingPercent !== undefined ? event.spendingPercent : 70
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'move') {
      const newPhase = {
        id: event.id && event.id !== 'move' ? event.id : `spend-${Date.now()}`,
        name: `Moved to ${event.location}`,
        startAge: event.moveAge,
        endAge: newInputs.lifeExpectancy,
        amount: event.newSpending,
        frequency: 'yearly',
        annualSpending: event.newSpending,
        inflationOverride: null,
        notes: `Lifestyle after moving to ${event.location}`
      };
      const updatedPhases = newInputs.spendingPhases.map(p => {
        if (p.startAge < event.moveAge && p.endAge > event.moveAge) {
          return { ...p, endAge: event.moveAge };
        }
        return p;
      });
      newInputs.spendingPhases = [...updatedPhases, newPhase];
      savedEvent = newPhase;
    } else if (type === 'careerChange') {
      const newInc = {
        id: event.id && event.id !== 'careerChange' ? event.id : `inc-${Date.now()}`,
        name: event.name,
        amount: event.amount,
        frequency: 'yearly',
        startAge: event.startAge,
        endAge: newInputs.targetRetirementAge,
        growthRate: (event.growthRate !== undefined ? Number(event.growthRate) : 3.0) / 100,
        isTaxable: true,
        
        incomeChangeType: event.incomeChangeType || 'newIncomeLevel',
        salaryIncrease: event.incomeChangeType === 'increaseByAmount' 
          ? (event.salaryIncrease !== undefined ? Number(event.salaryIncrease) : Number(event.amount))
          : undefined,
        permanent: event.permanent !== undefined ? !!event.permanent : false,
        parentEventId: event.parentEventId || null
      };
      const updatedIncome = newInputs.incomeList.map(inc => {
        if (inc.startAge < event.startAge && inc.endAge > event.startAge) {
          return { ...inc, endAge: event.startAge };
        }
        return inc;
      });
      newInputs.incomeList = [...updatedIncome, newInc];
      savedEvent = newInc;
    } else if (type === 'buyHouse') {
      const houseId = event.houseId || `house-${Date.now()}`;
      
      const houseAssetObj = {
        id: houseId,
        name: event.name || 'Primary Home',
        purchasePrice: Number(event.homePrice),
        downPayment: Number(event.downPayment),
        purchaseType: event.purchaseType || 'mortgage',
        mortgageRate: event.mortgageRate !== undefined ? Number(event.mortgageRate) : 6.5,
        loanTermYears: event.loanTerm !== undefined ? Number(event.loanTerm) : 30,
        points: event.points !== undefined ? Number(event.points) : 0,
        pmi: event.pmi !== undefined ? Number(event.pmi) : 0.5,
        closingCosts: event.closingCosts !== undefined ? Number(event.closingCosts) : 3,
        propertyTaxRate: event.propertyTax !== undefined ? Number(event.propertyTax) : 1.1,
        insuranceCost: event.insurance !== undefined ? Number(event.insurance) : 0.35,
        hoaCost: event.hoa !== undefined ? Number(event.hoa) : 0,
        maintenanceRate: event.maintenance !== undefined ? Number(event.maintenance) : 1.0,
        renovationCost: event.renovationCost !== undefined ? Number(event.renovationCost) : 0,
        utilitiesIncrease: event.utilitiesIncrease !== undefined ? Number(event.utilitiesIncrease) : 0,
        appreciationRate: event.appreciationRate !== undefined ? Number(event.appreciationRate) : 3.0,
        sellingCostRate: event.sellingCost !== undefined ? Number(event.sellingCost) : 6,
        investmentReturn: event.investmentReturn !== undefined ? Number(event.investmentReturn) : 7,
        inflation: event.inflation !== undefined ? Number(event.inflation) : 3,
        currentRent: event.currentRent !== undefined ? Number(event.currentRent) : 0,
        rentGrowth: event.rentGrowth !== undefined ? Number(event.rentGrowth) : 3,
        renterInsurance: event.renterInsurance !== undefined ? Number(event.renterInsurance) : 0
      };

      if (!newInputs.houseAssets) {
        newInputs.houseAssets = [];
      }
      if (newInputs.houseAssets.some(h => h.id === houseId)) {
        newInputs.houseAssets = newInputs.houseAssets.map(h => h.id === houseId ? houseAssetObj : h);
      } else {
        newInputs.houseAssets = [...newInputs.houseAssets, houseAssetObj];
      }

      let newEventObj = {
        id: event.id || `buy-${Date.now()}`,
        type: 'buyHouse',
        enabled: true,
        name: event.name || 'Buy Primary Home',
        age: Number(event.purchaseAge),
        homePrice: Number(event.homePrice),
        houseId
      };
      
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
      
      if (event.purchaseType === 'mortgage') {
        const principal = Math.max(0, Number(event.homePrice) - Number(event.downPayment));
        if (principal > 0) {
          const newDebt = {
            id: `mortgage-${houseId}`,
            type: 'mortgage',
            name: `Mortgage: ${event.name || 'Primary Home'}`,
            balance: principal,
            interestRate: Number(event.mortgageRate),
            payment: 0,
            frequency: 'monthly',
            extraPayment: 0,
            paydownPlanEnabled: false,
            startAge: Number(event.purchaseAge),
            houseId
          };
          
          let rateFraction = (Number(event.mortgageRate) || 6.5) / 100 / 12;
          let totalMonths = (Number(event.loanTerm) || 30) * 12;
          let monthlyPayment;
          if (rateFraction === 0) {
            monthlyPayment = principal / totalMonths;
          } else {
            monthlyPayment = principal * (rateFraction * Math.pow(1 + rateFraction, totalMonths)) / (Math.pow(1 + rateFraction, totalMonths) - 1);
          }
          newDebt.payment = Math.round(monthlyPayment);
          
          if (!newInputs.debtList) {
            newInputs.debtList = [];
          }
          newInputs.debtList = [...newInputs.debtList, newDebt];
        }
      }
    } else if (type === 'haveChild') {
      let newEventObj = {
        id: event.id || `child-${Date.now()}`,
        type: 'haveChild',
        enabled: true,
        name: event.name || 'Have a Child',
        childName: event.childName || '',
        linkedEventId: event.linkedEventId || null,
        childStartAge: event.childStartAge !== undefined ? Number(event.childStartAge) : 0,
        birthAge: event.birthAge !== undefined ? Number(event.birthAge) : newInputs.currentAge,
        costMethod: event.costMethod || 'default',
        customAges0to4: event.customAges0to4 !== undefined ? Number(event.customAges0to4) : 15000,
        customAges5to12: event.customAges5to12 !== undefined ? Number(event.customAges5to12) : 9000,
        customAges13to18: event.customAges13to18 !== undefined ? Number(event.customAges13to18) : 12000,
        customAges19to22: event.customAges19to22 !== undefined ? Number(event.customAges19to22) : 20000,
        includeCollege: !!event.includeCollege
      };
      
      const birthAgeVal = Number(newEventObj.birthAge) || 30;
      const childStartAgeVal = Number(newEventObj.childStartAge) || 0;
      const includeCollegeVal = !!newEventObj.includeCollege;
      const maxAgeVal = includeCollegeVal ? 22 : 18;
      
      const childCostsInput = newInputs.childCosts || inputs.childCosts;
      const ages0to4Val = newEventObj.costMethod === 'custom' ? (newEventObj.customAges0to4 !== undefined ? Number(newEventObj.customAges0to4) : 15000) : (childCostsInput?.ages0to4 !== undefined ? Number(childCostsInput.ages0to4) : 15000);
      const ages5to12Val = newEventObj.costMethod === 'custom' ? (newEventObj.customAges5to12 !== undefined ? Number(newEventObj.customAges5to12) : 15000) : (childCostsInput?.ages5to12 !== undefined ? Number(childCostsInput.ages5to12) : 15000);
      const ages13to18Val = newEventObj.costMethod === 'custom' ? (newEventObj.customAges13to18 !== undefined ? Number(newEventObj.customAges13to18) : 15000) : (childCostsInput?.ages13to18 !== undefined ? Number(childCostsInput.ages13to18) : 15000);
      const ages19to22Val = newEventObj.costMethod === 'custom' ? (newEventObj.customAges19to22 !== undefined ? Number(newEventObj.customAges19to22) : 15000) : (childCostsInput?.ages19to22 !== undefined ? Number(childCostsInput.ages19to22) : 15000);
      
      const costsVal = [];
      if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
      if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
      if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
      if (includeCollegeVal && childStartAgeVal <= 22 && maxAgeVal >= 19) costsVal.push(ages19to22Val);
      
      const peakCostVal = Math.max(...costsVal, 0);
      const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

      newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
        if (inc.id === event.linkedEventId || inc.parentEventId === event.id) {
          return {
            ...inc,
            startAge: newPromoStartAgeVal,
            salaryIncrease: peakCostVal,
            name: newEventObj.childName ? `Promotion (${newEventObj.childName})` : 'Get a Promotion'
          };
        }
        return inc;
      });

      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'college') {
      let newEventObj = {
        id: event.id || `college-${Date.now()}`,
        type: 'college',
        enabled: true,
        name: event.name || 'College',
        startAge: Number(event.startAge),
        tuitionCost: Number(event.tuitionCost),
        duration: Number(event.duration || 4)
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'windfall') {
      let newEventObj = {
        id: event.id || `windfall-${Date.now()}`,
        type: 'windfall',
        enabled: true,
        name: event.name || 'Windfall',
        ageReceived: Number(event.ageReceived),
        amount: Number(event.amount),
        taxRate: Number(event.taxRate !== undefined ? event.taxRate : 15)
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'debtPayoff') {
      let newEventObj = {
        id: event.id || `payoff-${Date.now()}`,
        type: 'debtPayoff',
        enabled: true,
        name: event.name || 'Debt Payoff',
        payoffAge: Number(event.payoffAge),
        amount: Number(event.amount)
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'custom') {
      let newEventObj = {
        id: event.id || `custom-${Date.now()}`,
        type: 'custom',
        enabled: true,
        name: event.name || 'Custom Event',
        age: Number(event.age),
        amount: Number(event.amount)
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'socialSecurity' || type === 'pension' || type === 'rentalIncome' || type === 'annuity' || type === 'otherRetirementIncome') {
      let defaultName = 'Other Income';
      if (type === 'socialSecurity') defaultName = 'Social Security';
      else if (type === 'pension') defaultName = 'Pension';
      else if (type === 'rentalIncome') defaultName = 'Rental Income';
      else if (type === 'annuity') defaultName = 'Annuity';

      let newEventObj = {
        id: event.id && !['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(event.id) ? event.id : `${type}-${Date.now()}`,
        type,
        enabled: true,
        name: event.name || defaultName,
        claimingAge: Number(event.claimingAge),
        monthlyBenefit: Number(event.monthlyBenefit),
        inflationAdjusted: event.inflationAdjusted !== undefined ? !!event.inflationAdjusted : true
      };
      if (type === 'socialSecurity') {
        newEventObj.ageStartedWorking = event.ageStartedWorking !== undefined ? Number(event.ageStartedWorking) : 22;
      }
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'borrowing') {
      let newEventObj = {
        id: event.id || `borrow-${Date.now()}`,
        type: 'borrowing',
        enabled: true,
        name: event.name,
        borrowingType: event.borrowingType,
        balance: Number(event.balance),
        interestRate: Number(event.interestRate),
        minPayment: Number(event.minPayment),
        startAge: Number(event.startAge),
        isExisting: !!event.isExisting,
        timing: event.timing || 'current',
        payoffPlanEnabled: !!event.payoffPlanEnabled,
        notes: event.notes || ''
      };
      
      if (event.borrowingType === 'carLoan') {
        newEventObj.purchasePrice = Number(event.purchasePrice);
        newEventObj.downPayment = Number(event.downPayment);
      }
      
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'payoffPlan') {
      let newEventObj = {
        id: event.id || `payoffplan-${Date.now()}`,
        type: 'payoffPlan',
        enabled: true,
        name: event.name || 'Payoff Plan',
        borrowingId: event.borrowingId,
        extraPayment: Number(event.extraPayment || 0),
        startAge: Number(event.startAge)
      };
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      savedEvent = newEventObj;
    } else if (type === 'marriage') {
      const spouseIncome = Number(event.spouseIncome) || 0;
      const savingsRate = Number(event.savingsRate) || 0;
      const partnerSavings = spouseIncome * (savingsRate / 100);
      
      // Calculate Estimates
      const estimates = calculateMarriageEstimates(event, newInputs);
      let combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
      let spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;
      let housingCostAmount = estimates ? estimates.housingCostAmount : 0;
      let lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;

      let newEventObj = {
        id: event.id && event.id !== 'marriage' ? event.id : `marriage-${Date.now()}`,
        type: 'marriage',
        enabled: true,
        name: 'Marriage',
        age: Number(event.age),
        spouseIncome,
        incomeGrowthRate: Number(event.incomeGrowthRate || 3),
        cash: Number(event.cash || 0),
        investments: Number(event.investments || 0),
        retirement: Number(event.retirement || 0),
        debtStudent: Number(event.debtStudent || 0),
        debtCredit: Number(event.debtCredit || 0),
        debtOther: Number(event.debtOther || 0),
        savingsRate,
        housingOption: event.housingOption || 'move',
        housingSavings: Number(event.housingSavings || 0),
        housingCost: Number(event.housingCost || 0),
        lifestyleOption: event.lifestyleOption || 'same',
        lifestyleAdjustment: Number(event.lifestyleAdjustment || 0),
        includeWeddingCost: !!event.includeWeddingCost,
        weddingCost: Number(event.weddingCost || 0),
        weddingFundingMethod: event.weddingFundingMethod || 'savings',
        weddingAge: Number(event.weddingAge || event.age),
        filingStatus: event.filingStatus || 'jointly',
        spouseCurrentAge: event.spouseCurrentAge !== undefined && event.spouseCurrentAge !== '' ? Number(event.spouseCurrentAge) : Number(event.age),
        spouseLifeExpectancy: event.spouseLifeExpectancy !== undefined && event.spouseLifeExpectancy !== '' ? Number(event.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
        spouseSocialSecurityAge: event.spouseSocialSecurityAge !== undefined && event.spouseSocialSecurityAge !== '' ? Number(event.spouseSocialSecurityAge) : 67,
        spouseEstimatedSocialSecurityBenefit: event.spouseEstimatedSocialSecurityBenefit !== undefined && event.spouseEstimatedSocialSecurityBenefit !== '' ? Number(event.spouseEstimatedSocialSecurityBenefit) : 0,
        spouseDesiredRetirementAge: event.spouseDesiredRetirementAge !== undefined && event.spouseDesiredRetirementAge !== '' && event.spouseDesiredRetirementAge !== null ? Number(event.spouseDesiredRetirementAge) : null,
        desiredRetirementAge: event.spouseDesiredRetirementAge !== undefined && event.spouseDesiredRetirementAge !== '' && event.spouseDesiredRetirementAge !== null ? Number(event.spouseDesiredRetirementAge) : null,
        partnerRetiresWithUser: true,
        retirementSpendingNeed: spouseRetSpendingVal,
        combinedSpendingAfterMarriage: combinedSpendingVal
      };
      
      let nextHouseholdMembers = [...(newInputs.householdMembers || [])];
      const spouseIdx = nextHouseholdMembers.findIndex(m => m.id === 'spouse');
      const spouseRecord = {
        id: 'spouse',
        name: 'Spouse',
        activeFromDate: Number(event.age),
        activeUntilDate: null,
        income: Number(event.spouseIncome),
        incomeGrowthRate: Number(event.incomeGrowthRate || 3) / 100,
        assets: {
          cash: Number(event.cash || 0),
          investments: Number(event.investments || 0),
          retirement: Number(event.retirement || 0)
        },
        debts: {
          student: Number(event.debtStudent || 0),
          credit: Number(event.debtCredit || 0),
          other: Number(event.debtOther || 0)
        },
        savingsRate: Number(event.savingsRate),
        currentAge: event.spouseCurrentAge !== undefined && event.spouseCurrentAge !== '' ? Number(event.spouseCurrentAge) : Number(event.age),
        lifeExpectancy: event.spouseLifeExpectancy !== undefined && event.spouseLifeExpectancy !== '' ? Number(event.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
        spouseSocialSecurityAge: event.spouseSocialSecurityAge !== undefined && event.spouseSocialSecurityAge !== '' ? Number(event.spouseSocialSecurityAge) : 67,
        spouseEstimatedSocialSecurityBenefit: event.spouseEstimatedSocialSecurityBenefit !== undefined && event.spouseEstimatedSocialSecurityBenefit !== '' ? Number(event.spouseEstimatedSocialSecurityBenefit) : 0,
        spouseDesiredRetirementAge: event.spouseDesiredRetirementAge !== undefined && event.spouseDesiredRetirementAge !== '' && event.spouseDesiredRetirementAge !== null ? Number(event.spouseDesiredRetirementAge) : null,
        desiredRetirementAge: event.spouseDesiredRetirementAge !== undefined && event.spouseDesiredRetirementAge !== '' && event.spouseDesiredRetirementAge !== null ? Number(event.spouseDesiredRetirementAge) : null,
        partnerRetiresWithUser: true,
        retirementSpendingNeed: spouseRetSpendingVal,
        growthRate: Number(event.incomeGrowthRate || 3),
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
      
      savedEvent = newEventObj;
      newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
    }

    if (type === 'haveChild') {
      syncChildcarePhasesAndRules(newInputs);
    }
    
    return { newInputs, savedEvent };
  };

  const handleApplyMobileRecommendation = (scenario) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    let newInputs = JSON.parse(JSON.stringify(scen.inputs));

    const currentAgeVal = Number(newInputs.currentAge) || 30;
    const targetRetAgeVal = Number(newInputs.targetRetirementAge) || 65;

    // 1. If child offset / promotion, add the career change event and link it
    if ((scenario.type.startsWith('childPromotion') || scenario.type.startsWith('childOffset')) && scenario.promoEvent) {
      const remainingIncomes = (newInputs.incomeList || []).filter(i => i.id !== scenario.promoEvent.id);
      newInputs.incomeList = [...remainingIncomes, scenario.promoEvent];
      
      newInputs.lifeEvents = (newInputs.lifeEvents || []).map(ev => {
        if (ev.id === scenario.promoEvent.parentEventId) {
          return { ...ev, linkedEventId: scenario.promoEvent.id };
        }
        return ev;
      });

      setNotification(
        `✓ Promotion event added to your timeline\n+ $${scenario.promoEvent.salaryIncrease.toLocaleString()}/year income\nRetirement plan updated`
      );
      setTimeout(() => setNotification(null), 4000);
    }

    // 2. Adjust target retirement age if working longer / retiring at 65/ready age
    if (scenario.type === 'workLonger') {
      const yearsDelay = scenario.value;
      newInputs.targetRetirementAge = targetRetAgeVal + yearsDelay;
    } else if (scenario.type === 'retire65') {
      const target65Age = currentAgeVal < 65 ? 65 : currentAgeVal;
      newInputs.targetRetirementAge = target65Age;
    } else if (scenario.type === 'retireReadyAge') {
      newInputs.targetRetirementAge = scenario.value;
    } else if (scenario.type === 'combined') {
      const yearsDelay = scenario.value && typeof scenario.value === 'object' ? (scenario.value.delay || 0) : 0;
      newInputs.targetRetirementAge = targetRetAgeVal + yearsDelay;
    }

    // Update retire event in lifeEvents to match new target retirement age
    const targetRetAge = newInputs.targetRetirementAge;
    newInputs.lifeEvents = (newInputs.lifeEvents || []).map(ev => {
      if (ev.type === 'retire') {
        return { ...ev, age: targetRetAge };
      }
      return ev;
    });

    // 3. For budget adjustments (savings, spending, combined, retire65 with value, retireRequestedDate)
    // We want to adjust the budget phases. Let's get the normalized phases first.
    let normPhases = getNormalizedPhases(newInputs);
    
    // Find the current budget phase
    const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];

    // Check if we need to adjust savings/expenses
    const isBudgetAdjustment = scenario.type === 'savings' || 
                               scenario.type === 'spending' || 
                               scenario.type === 'retireRequestedDate' || 
                               (scenario.type === 'retire65' && scenario.value > 0) ||
                               scenario.type === 'combined' ||
                               scenario.type === 'reduceDiscretionary' ||
                               scenario.type === 'increaseDebtIncome';

    if (isBudgetAdjustment && currentPhase) {
      let targetSavingsMap = currentPhase.savings ? { ...currentPhase.savings } : { brokerage: 0 };
      let targetExpensesMap = currentPhase.expenses ? { ...currentPhase.expenses } : {};
      let targetIncome = currentPhase.income * 12;

      if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
        const additionalSavingsAnnual = scenario.value;
        const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
        
        targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
        
        // Reduce monthly expenses by the same amount to keep it balanced
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      } else if (scenario.type === 'income') {
        const grossIncreaseAnnual = scenario.value;
        const netSavingsAnnual = scenario.netSavingsValue || 0;
        targetIncome = targetIncome + grossIncreaseAnnual;
        const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
        targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
      } else if (scenario.type === 'combined') {
        const additionalSavingsAnnual = scenario.value.savings || 0;
        const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
        targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
        
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }

        const grossIncreaseAnnual = scenario.value.income || 0;
        const netSavingsAnnual = scenario.value.netSavings || 0;
        targetIncome = targetIncome + grossIncreaseAnnual;
        const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
        targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
      } else if (scenario.type === 'reduceDiscretionary') {
        let remainingReduction = scenario.value;
        const keysToReduce = ['leisure', 'diningOut', 'misc'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      } else if (scenario.type === 'increaseDebtIncome') {
        const extraIncomeItem = {
          id: `debt-income-boost-${Date.now()}`,
          name: `Extra Income (to cover debt)`,
          amount: scenario.value * 12,
          frequency: 'yearly',
          startAge: currentAgeVal,
          endAge: targetRetAgeVal,
          growthRate: 0.03,
          isTaxable: true
        };
        newInputs.incomeList = [...(newInputs.incomeList || []), extraIncomeItem];
      }

      // Apply back to the current phase
      currentPhase.income = Math.round(targetIncome / 12);
      currentPhase.savings = targetSavingsMap;
      currentPhase.expenses = targetExpensesMap;
    }

    // 4. Save all phases back to budgetDetails.phases
    if (!newInputs.budgetDetails) newInputs.budgetDetails = {};
    newInputs.budgetDetails.phases = normPhases.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income,
      savingsAllocMode: p.savingsAllocMode || 'fixed',
      savings: p.savings,
      partnerSavings: p.partnerSavings || {},
      expenses: p.expenses
    }));

    // Synchronize back to simpleIncome, simpleExpenses, incomeList, and spendingPhases
    if (currentPhase) {
      const wsPhase = normPhases.find(p => p.type === 'workSave');
      const standardIncomeMonthly = wsPhase ? wsPhase.income : currentPhase.income;
      const childBoost = Math.max(0, currentPhase.income - standardIncomeMonthly);
      newInputs.simpleIncome = (currentPhase.income - childBoost) * 12;
      newInputs.simpleExpenses = Object.keys(currentPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (currentPhase.expenses[v] || 0), 0) * 12;
    }

    // Sync career incomes in incomeList
    newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
      if (inc.incomeChangeType === 'increaseByAmount') {
        return inc;
      }
      const matchingPhase = normPhases.find(p => p.startAge === inc.startAge && (p.type === 'careerChange' || p.type === 'current'));
      if (matchingPhase) {
        inc.amount = inc.frequency === 'monthly' ? matchingPhase.income : matchingPhase.income * 12;
      }
      return inc;
    });

    // Sync spendingPhases
    newInputs.spendingPhases = (newInputs.spendingPhases || []).map(sp => {
      const matchingPhase = normPhases.find(p => p.startAge === sp.startAge && p.type === 'move');
      if (matchingPhase) {
        const totalMonthlyExpenses = Object.keys(matchingPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (matchingPhase.expenses[v] || 0), 0);
        sp.amount = sp.frequency === 'monthly' ? totalMonthlyExpenses : totalMonthlyExpenses * 12;
        sp.annualSpending = totalMonthlyExpenses * 12;
      }
      return sp;
    });

    // Debt payoff plan scenario
    if (scenario.type === 'startDebtPayoff') {
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
    }

    // Let the single source of truth properly build childcare phases, spending phases and rules
    syncChildcarePhasesAndRules(newInputs);

    // Save changes to scenarios
    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      return {
        ...scen,
        inputs: newInputs
      };
    }));

    // Glow effect or pulse target childcare phase
    window.pulsePhaseId = 'childcare';
  };

  const sharedProps = {
    activeStep,
    setActiveStep,
    inputs,
    updateInput,
    updateAsset,
    displayMode,
    setDisplayMode,
    selectedYear,
    setSelectedYear,
    chartData,
    baselineChartData,
    validation,
    baselineResults,
    activeResults,
    displayedResults,
    displayedBaselineResults,
    
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
    handleDeleteRoadmapEvent,
    
    isBudgetModalOpen,
    setIsBudgetModalOpen,
    activeBudgetPhase,
    handleSwitchBudgetPhase,
    savingsAllocMode,
    handleToggleSavingsAllocMode,
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
    handleSaveBudget,
    
    isBudgetOpenFromMarriageWizard,
    setIsBudgetOpenFromMarriageWizard,
    isSavingsDetailsOpen,
    setIsSavingsDetailsOpen,
    savingsDetails,
    setSavingsDetails,
    handleOpenSavingsDetails,
    handleSaveSavingsDetails,
    
    timelineEvents,
    normalizedPhases,
    currentAgePhase,
    improvementPlan,
    showImprovementModal,
    setShowImprovementModal,
    handleApplyImprovementScenario,
    handleSaveCurrentCondition,
    handleRemoveCurrentCondition,
    handleNodeDragStart,
    isMobile,
    totalNetWorth,
    todayAssets,
    todayDebt,
    todayNetWorth,
    tempSocialSecurityDetails,
    lastNonZeroSavingsRateRef,
    getInputsWithEvent,
    handleApplyMobileRecommendation
  };

  return isMobile ? (
    <MobileFireSimulatorView {...sharedProps} />
  ) : (
    <DesktopFireSimulatorView {...sharedProps} />
  );
}
