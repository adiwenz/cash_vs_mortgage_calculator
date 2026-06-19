import { useState } from 'react';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs';

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
        return cloned;
      })()
    }
  ]);

  const updateInput = (key, value, currentScenarioId) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            [key]: value
          }
        };
      }
      return scen;
    }));
  };

  const updateAsset = (assetKey, value, currentScenarioId) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        const nextAssets = {
          ...scen.inputs.assets,
          [assetKey]: value
        };
        const total = value === null ? null : Object.values(nextAssets).reduce((sum, v) => sum + (Number(v) || 0), 0);
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
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
    const oldAge = evt.age;
    if (newAge === oldAge) return;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

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
            const updated = { ...e };
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
