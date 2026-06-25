import { useState } from 'react';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs';
import { syncBudgetDetails } from '../../../calculators/fire/index.js';
import { roundCurrency } from '../../../simulatorMathUtils';
import { setChildEventBirthAge } from '../../../utils/childEventHelpers.js';

export function useScenarioState() {
  const [scenarios, setScenarios] = useState([
    {
      id: 'baseline',
      name: 'Baseline Plan',
      inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
    },
    {
      id: 'compare1',
      name: 'Retire Early (Age 50)',
      inputs: (() => {
        const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
        cloned.targetRetirementAge = 50;
        cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
        cloned.incomeList = (cloned.incomeList || []).map(inc => {
          if (inc.endAge === 65) {
            return { ...inc, endAge: 50 };
          }
          return inc;
        });
        return cloned;
      })()
    }
  ]);

  const updateInput = (key, value, currentScenarioId) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        let updatedInputs = {
          ...scen.inputs,
          [key]: value
        };

        if (key === 'simpleIncome' || key === 'simpleExpenses') {
          if (key === 'simpleIncome') {
            const prevIncome = Number(scen.inputs.simpleIncome) || 0;
            const prevExpenses = Number(scen.inputs.simpleExpenses) || 0;
            const prevRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome) * 100 : 0;
            const displayedSavingsRate = Math.min(100, Math.max(0, prevRate));
            
            const monthlyIncome = roundCurrency(value / 12);
            const targetMonthlySavings = roundCurrency(monthlyIncome * (displayedSavingsRate / 100));
            
            const existingExpenses = scen.inputs.budgetDetails?.expenses || {};
            let fixedRequiredTotal = 0;
            const fixedRequiredKeys = ['housing', 'rent', 'mortgage', '🏠 Mortgage', 'healthcare', 'childcare', 'insurance'];
            Object.keys(existingExpenses).forEach(k => {
              if (fixedRequiredKeys.includes(k) || k.startsWith('debt_')) {
                fixedRequiredTotal += Number(existingExpenses[k]) || 0;
              }
            });
            fixedRequiredTotal = roundCurrency(fixedRequiredTotal);
            
            let targetSpending;
            if (fixedRequiredTotal > monthlyIncome) {
              targetSpending = fixedRequiredTotal;
            } else if (fixedRequiredTotal + targetMonthlySavings > monthlyIncome) {
              targetSpending = fixedRequiredTotal;
            } else {
              targetSpending = monthlyIncome - targetMonthlySavings;
            }
            
            updatedInputs.simpleExpenses = roundCurrency(targetSpending * 12);
          }

          // Always sync top-level budget details
          const syncResult = syncBudgetDetails(
            updatedInputs.simpleIncome,
            updatedInputs.simpleExpenses,
            updatedInputs.budgetDetails
          );
          updatedInputs.budgetDetails = syncResult.budgetDetails;

          // Reallocate all pre-retirement budget phases
          if (updatedInputs.budgetDetails.phases && updatedInputs.budgetDetails.phases.length > 0) {
            updatedInputs.budgetDetails.phases = updatedInputs.budgetDetails.phases.map(p => {
              if (p.type === 'retire') return p;

              // Scale income and expenses for this phase based on the ratio
              const phaseIncome = (Number(p.income) || 0) * 12 || Number(updatedInputs.simpleIncome);
              const phaseExpenses = (Number(updatedInputs.simpleExpenses) / Number(updatedInputs.simpleIncome || 1)) * phaseIncome;

              const syncedPhase = syncBudgetDetails(
                phaseIncome,
                phaseExpenses,
                p
              );

              const newP = {
                ...p,
                income: roundCurrency(phaseIncome / 12),
                expenses: syncedPhase.budgetDetails.expenses,
                savings: syncedPhase.budgetDetails.savings,
                partnerSavings: syncedPhase.budgetDetails.partnerSavings,
                savingsAllocMode: syncedPhase.budgetDetails.savingsAllocMode
              };

              // Recalculate expense/savings ratios and category ratios
              const resolvedIncome = Number(newP.income) || 0;
              const totalExpensesMonthly = Object.keys(newP.expenses)
                .filter(k => !k.startsWith('debt_'))
                .reduce((sum, k) => sum + (Number(newP.expenses[k]) || 0), 0);

              const userSavingsSum = Object.values(newP.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
              const partnerSavingsSum = Object.values(newP.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

              const totalSavingsMonthly = userSavingsSum + partnerSavingsSum;

              newP.expenseRatio = resolvedIncome > 0 ? (totalExpensesMonthly / resolvedIncome) : 0;
              newP.savingsRatio = resolvedIncome > 0 ? (totalSavingsMonthly / resolvedIncome) : 0;

              newP.categoryRatios = {};
              if (resolvedIncome > 0) {
                Object.keys(newP.expenses).forEach(k => {
                  newP.categoryRatios[k] = (Number(newP.expenses[k]) || 0) / resolvedIncome;
                });
                Object.keys(newP.savings || {}).forEach(k => {
                  newP.categoryRatios[`savings_${k}`] = (Number(newP.savings[k]) || 0) / resolvedIncome;
                });
                Object.keys(newP.partnerSavings || {}).forEach(k => {
                  newP.categoryRatios[`partnerSavings_${k}`] = (Number(newP.partnerSavings[k]) || 0) / resolvedIncome;
                });
              }

              return newP;
            });
          }
        }

        return {
          ...scen,
          inputs: updatedInputs
        };
      }
      return scen;
    }));
  };

  const updateAsset = (assetKey, value, currentScenarioId) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        const lifeProfile = scen.inputs.lifeProfile || {
          household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
          home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
          children: [],
          debts: [],
          assets: { cash: 0, emergencyFund: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, savings529: 0, crypto: 0, businessEquity: 0 },
          incomeSources: []
        };
        const nextLifeProfileAssets = {
          ...lifeProfile.assets,
          [assetKey]: value
        };
        const nextAssets = {
          ...scen.inputs.assets,
          [assetKey]: value
        };
        const total = value === null ? null : Object.values(nextLifeProfileAssets).reduce((sum, v) => sum + (Number(v) || 0), 0);
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            lifeProfile: {
              ...lifeProfile,
              assets: nextLifeProfileAssets
            },
            assets: nextAssets,
            simpleInvestments: total
          }
        };
      }
      return scen;
    }));
  };

  const handleDuplicateScenario = (activeScenario) => {
    if (!activeScenario) return null;
    const newId = `compare-${Date.now()}`;
    const newScenario = {
      id: newId,
      name: `${activeScenario.name} (Copy)`,
      inputs: JSON.parse(JSON.stringify(activeScenario.inputs))
    };
    setScenarios(prev => [...prev, newScenario]);
    return newId;
  };

  const handleDeleteScenario = (idToDelete, currentScenarioId, setCurrentScenarioId) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== idToDelete));
    if (currentScenarioId === idToDelete) {
      const remaining = scenarios.filter(s => s.id !== idToDelete);
      setCurrentScenarioId(remaining[0]?.id || 'baseline');
    }
  };

  const commitEventAgeChange = (evt, newAge, currentScenarioId) => {
    const eventAge = evt.age;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      const oldAge = eventAge !== undefined ? eventAge : scen.inputs.targetRetirementAge;
      if (newAge === oldAge) return scen;

      const newInputs = { ...scen.inputs };

      if (evt.type === 'socialSecurity') {
        const finalAge = Math.max(62, Math.min(70, newAge));
        newInputs.lifeEvents = (newInputs.lifeEvents || []).map(e => {
          if (e.type === 'socialSecurity') {
            return { ...e, claimingAge: finalAge, startAge: finalAge, age: finalAge };
          }
          return e;
        });
        if (newInputs.socialSecurity) {
          newInputs.socialSecurity = {
            ...newInputs.socialSecurity,
            claimingAge: finalAge,
            startAge: finalAge,
            age: finalAge
          };
        }
      } else if (evt.type === 'retire') {
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
      } else {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId) {
            const updated = { ...e };
            if (e.type === 'buyHouse') {
              updated.purchaseAge = newAge;
              updated.age = newAge;
            } else if (e.type === 'sellHouse') {
              updated.age = newAge;
            } else if (e.type === 'haveChild') {
              return setChildEventBirthAge(e, newAge);
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
              updated.age = newAge;
              if (e.marriageAge !== undefined && e.marriageAge !== null) {
                updated.marriageAge = newAge;
              }
              updated.weddingAge = newAge;

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

  return {
    scenarios,
    setScenarios,
    updateInput,
    updateAsset,
    handleDuplicateScenario,
    handleDeleteScenario,
    commitEventAgeChange
  };
}
