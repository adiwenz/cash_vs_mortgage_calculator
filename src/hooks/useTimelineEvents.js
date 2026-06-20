import { useMemo } from 'react';
import { getSocialSecurityFactor } from '../fireCalculations';
import { propPIAmount } from '../simulatorMathUtils';
import { getAssetLabel } from '../components/fire-simulator/helpers';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

function isGeneratedMainIncome(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('child-income-boost') ||
         id.startsWith('simple-inc-prechild') ||
         id.startsWith('simple-inc-worksave') ||
         id.startsWith('simple-inc-childcare') ||
         id === 'simple-inc' ||
         id === 'inc-1';
}

export function useTimelineEvents(inputs, displayedResults) {
  return useMemo(() => {
    const events = [];
    const inp = inputs;
    const calc = displayedResults;

    if (!inp || !calc) return [];

    // 1. Income Phases
    inp.incomeList.forEach(inc => {
      if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('simple-inc')) {
        return;
      }
      const isCustomCareer = !isGeneratedMainIncome(inc.id);
      const isAgeMatch = isCustomCareer
        ? (inc.startAge >= inp.currentAge && inc.startAge <= inp.lifeExpectancy)
        : (inc.startAge > inp.currentAge && inc.startAge <= inp.lifeExpectancy);

      if (isAgeMatch) {
        const isIncrease = inc.incomeChangeType === 'increaseByAmount';
        const amountVal = isIncrease 
          ? (inc.salaryIncrease !== undefined ? inc.salaryIncrease : inc.amount) 
          : (inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount);
        events.push({
          originalId: inc.id,
          age: Number(inc.startAge),
          title: `Career Phase: ${inc.name}`,
          label: inc.name,
          icon: '💼',
          type: 'career',
          description: `Started career phase "${inc.name}" earning ${isIncrease ? 'an extra ' : ''}${formatCurrency(amountVal)}/year (raises: ${(inc.growthRate * 100).toFixed(1)}%).`
        });
      }
    });

    // 2. Spending Phases
    inp.spendingPhases.forEach(phase => {
      if (phase.id && typeof phase.id === 'string' && phase.id.startsWith('simple-spend')) {
        return;
      }
      if (phase.startAge > inp.currentAge && phase.startAge <= inp.lifeExpectancy) {
        let emoji = '🏡';
        if (phase.name.toLowerCase().includes('dominican') || phase.name.toLowerCase().includes('dr')) {
          emoji = '🇩🇴';
        } else if (phase.name.toLowerCase().includes('retir')) {
          emoji = '🏖️';
        } else if (phase.name.toLowerCase().includes('child')) {
          emoji = '👶';
        }
        events.push({
          originalId: phase.id,
          age: Number(phase.startAge),
          title: `Lifestyle: ${phase.name}`,
          label: phase.name,
          icon: emoji,
          type: 'lifestyle',
          description: `Began lifestyle phase "${phase.name}" costing ${formatCurrency(phase.annualSpending)}/year (inflation override: ${phase.inflationOverride !== null ? phase.inflationOverride + '%' : 'default'})${phase.movingCost ? ` and incurred a one-time moving cost of ${formatCurrency(phase.movingCost)}` : ''}.`
        });
      }
    });

    // 3. Life Events & Asset Transfers
    inp.lifeEvents.forEach(ev => {
      if (ev.enabled) {
        const age = Number(
          ev.purchaseAge !== undefined ? ev.purchaseAge :
          ev.birthAge !== undefined ? ev.birthAge :
          ev.parentAgeAtBirth !== undefined ? ev.parentAgeAtBirth :
          ev.startAge !== undefined ? ev.startAge :
          ev.claimingAge !== undefined ? ev.claimingAge :
          ev.ageReceived !== undefined ? ev.ageReceived :
          ev.transferAge !== undefined ? ev.transferAge :
          ev.age !== undefined ? ev.age :
          35
        );
        if (age >= inp.currentAge && age <= inp.lifeExpectancy) {
          if (ev.type === 'buyHouse') {
            const asset = inp.houseAssets?.find(h => h.id === ev.houseId) || ev;
            const houseName = asset.name || 'Primary Home';
            const price = Number(asset.purchasePrice !== undefined ? asset.purchasePrice : (asset.homePrice || 500000));
            const dp = Number(asset.downPayment || 0);
            const loanTermVal = Number(asset.loanTermYears !== undefined ? asset.loanTermYears : (asset.loanTerm || 30));
            const purchaseTypeVal = asset.purchaseType || 'mortgage';

            events.push({
              originalId: ev.id,
              age,
              title: `Buy House: ${houseName}`,
              label: `Buy ${houseName}`,
              icon: '🏠',
              type: 'buyHouse',
              houseId: ev.houseId,
              description: `Purchased "${houseName}" for ${formatCurrency(price)} (${purchaseTypeVal === 'cash' ? 'Cash Purchase' : 'Mortgage with ' + formatCurrency(dp) + ' down'}).`
            });

            if (purchaseTypeVal !== 'cash') {
              const sellEv = inp.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
              const sellAge = sellEv ? Number(sellEv.age) : (age + loanTermVal);
              const payoffAge = age + loanTermVal;
              if (payoffAge <= inp.lifeExpectancy && payoffAge < sellAge) {
                events.push({
                  age: payoffAge,
                  title: `Mortgage Paid Off: ${houseName}`,
                  label: `${houseName} Paid Off`,
                  icon: '🏠',
                  type: 'mortgageOff',
                  houseId: ev.houseId,
                  isMilestone: true,
                  description: `Mortgage on "${houseName}" is fully amortized, removing P&I payment of ${formatCurrency(propPIAmount(asset))} /yr from annual expenses.`
                });
              }
            }
          } else if (ev.type === 'sellHouse') {
            const asset = inp.houseAssets?.find(h => h.id === ev.houseId);
            const houseName = asset?.name || 'Home';
            
            let currentValue = 0;
            let remainingMortgageBalance = 0;
            let netProceeds = 0;
            let yearsOwned = 0;
            
            if (asset) {
              const purchasePrice = Number(asset.purchasePrice || asset.homePrice || 0);
              const purchaseAge = Number(asset.purchaseAge || 40);
              const saleAge = Number(ev.age || 50);
              yearsOwned = Math.max(0, saleAge - purchaseAge);
              const appreciationRate = (Number(asset.appreciationRate !== undefined ? asset.appreciationRate : 3.0)) / 100;
              currentValue = purchasePrice * Math.pow(1 + appreciationRate, yearsOwned);
              
              if (asset.purchaseType !== 'cash') {
                const loanAmount = Math.max(0, purchasePrice - Number(asset.downPayment || 0));
                const rate = (Number(asset.mortgageRate !== undefined ? asset.mortgageRate : 6.5)) / 100;
                const loanTerm = Number(asset.loanTermYears || asset.loanTerm || 30);
                
                if (yearsOwned >= loanTerm) {
                  remainingMortgageBalance = 0;
                } else if (loanAmount > 0 && loanTerm > 0) {
                  const r = rate / 12;
                  const n = loanTerm * 12;
                  const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  const elapsedMonths = yearsOwned * 12;
                  const remainingMonths = n - elapsedMonths;
                  remainingMortgageBalance = r === 0 ? monthlyPayment * remainingMonths : monthlyPayment * (1 - Math.pow(1 + r, -remainingMonths)) / r;
                }
              }
              
              const sellingCostRate = Number(ev.sellingCost !== undefined ? ev.sellingCost : 6);
              const sellingCosts = currentValue * (sellingCostRate / 100);
              netProceeds = currentValue - remainingMortgageBalance - sellingCosts;
            }

            events.push({
              originalId: ev.id,
              age,
              title: `Sell House: ${houseName}`,
              label: `Sell ${houseName}`,
              icon: '🏠',
              type: 'sellHouse',
              houseId: ev.houseId,
              description: `Sold home "${houseName}" after ${yearsOwned} years for ${formatCurrency(currentValue)} (net proceeds: ${formatCurrency(netProceeds)} after mortgage payoff of ${formatCurrency(remainingMortgageBalance)} and ${ev.sellingCost || 6}% selling costs).`
            });
          } else if (ev.type === 'haveChild') {
            events.push({
              originalId: ev.id,
              age,
              title: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              label: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              icon: '👶',
              type: 'haveChild',
              description: ev.childName 
                ? `Welcomed ${ev.childName}! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
                : `Welcomed a child! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
            });
            const supportEndAge = ev.includeCollege ? 22 : 18;
            const parentAgeAtEnd = age + supportEndAge;
            if (parentAgeAtEnd <= inp.lifeExpectancy) {
              events.push({
                age: parentAgeAtEnd,
                title: ev.childName ? `Support for ${ev.childName} Ends` : `Child Expenses End`,
                label: ev.childName ? `Support for ${ev.childName} Ends` : `Child Support Ends`,
                icon: '👶',
                type: 'childSupportEnds',
                isMilestone: true,
                childEventId: ev.id,
                description: ev.childName 
                  ? `General support and childcare expenses for ${ev.childName} born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
                  : `General support and childcare expenses for child born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
              });
            }
          } else if (ev.type === 'college') {
            events.push({
              originalId: ev.id,
              age,
              title: `College Tuition Starts`,
              label: `College`,
              icon: '🎓',
              type: 'college',
              description: `Paying college tuition of ${formatCurrency(ev.tuitionCost)}/year for ${ev.duration || 4} years.`
            });
          } else if (ev.type === 'sabbatical') {
            events.push({
              originalId: ev.id,
              age,
              title: `Sabbatical Starts`,
              label: `Sabbatical`,
              icon: '🌴',
              type: 'sabbatical',
              description: `Taking a sabbatical until age ${ev.endAge} (income reduced by ${ev.incomeReduction}%).`
            });
          } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
            if (ev.type === 'socialSecurity' && inp.includeSocialSecurity === false) {
              return;
            }
            let icon = '💰';
            let label = 'Social Security';
            if (ev.type === 'pension') { icon = '📜'; label = ev.name || 'Pension'; }
            else if (ev.type === 'rentalIncome') { icon = '🏢'; label = ev.name || 'Rental Income'; }
            else if (ev.type === 'annuity') { icon = '📈'; label = ev.name || 'Annuity'; }
            else if (ev.type === 'otherRetirementIncome') { icon = '💵'; label = ev.name || 'Other Income'; }

            let desc = `Receiving ${label} of ${formatCurrency(ev.monthlyBenefit)}/month (${formatCurrency(ev.monthlyBenefit * 12)}/year).`;
            let ssTitle = label;
            if (ev.type === 'socialSecurity') {
              ssTitle = 'Social Security';
              const ss = calc.socialSecurityDetails;
              const isEligible = ss ? ss.isEligible : true;
              let annualBenefit = ss ? ss.annualBenefit : (Number(ev.monthlyBenefit) || 0) * 12 * getSocialSecurityFactor(age);
              let monthlyBenefitVal = annualBenefit / 12;
              
              if (!isEligible) {
                desc = `Not eligible for Social Security benefits. At least 10 working years are required. (Working Years: ${ss ? ss.workingYears : 0} / 10)`;
              } else {
                if (age < 62) {
                  desc = `Social Security cannot be claimed before age 62 (Benefit: $0/mo).`;
                } else {
                  const factor = getSocialSecurityFactor(age);
                  const penaltyPct = 30; // 30% early reduction
                  const bonusPct = Math.round((factor - 1) * 100);
                  
                  desc = `Receiving Social Security of ${formatCurrency(monthlyBenefitVal)}/month (${formatCurrency(annualBenefit)}/year) claimed at age ${age}. `;
                  if (age === 67) {
                    desc += `Full benefit (100%).`;
                  } else if (age < 67) {
                    desc += `Benefit is permanently reduced by ${penaltyPct}% from full benefit due to early claim.`;
                  } else {
                    desc += `Benefit is permanently increased by ${bonusPct}% from full benefit due to delayed claim (8% delayed credit per year after 67).`;
                  }
                }
              }
            }

            events.push({
              originalId: ev.id,
              age,
              title: ssTitle,
              label: ssTitle,
              icon: icon,
              type: ev.type,
              description: desc
            });
          } else if (ev.type === 'retire') {
            events.push({
              originalId: ev.id,
              age,
              title: `Stop Working Event`,
              label: `Stop Working`,
              icon: '🏖️',
              type: 'retire',
              description: `Target age to stop working. Contributions stop, and you begin drawing down from your portfolios at ${ev.spendingPercent !== undefined ? ev.spendingPercent : 70}% of your pre-retirement spending.`
            });
          } else if (ev.type === 'windfall') {
            events.push({
              originalId: ev.id,
              age,
              title: `Windfall / Inheritance`,
              label: `Windfall`,
              icon: '💰',
              type: 'windfall',
              description: `Received a one-time windfall inflow of ${formatCurrency(ev.amount)} (post-tax).`
            });
          } else if (ev.type === 'assetTransfer') {
            events.push({
              originalId: ev.id,
              age,
              title: `Asset Transfer`,
              label: `Transfer`,
              icon: '🔄',
              type: 'assetTransfer',
              description: `Moved ${formatCurrency(ev.amount)} from ${getAssetLabel(ev.fromAsset)} to ${getAssetLabel(ev.toAsset)}.`
            });
          } else if (ev.type === 'marriage') {
            const spouseAssets = (Number(ev.cash) || 0) + (Number(ev.investments) || 0) + (Number(ev.retirement) || 0);
            const spouseDebts = (Number(ev.debtStudent) || 0) + (Number(ev.debtCredit) || 0) + (Number(ev.debtOther) || 0);
            events.push({
              originalId: ev.id,
              age,
              title: `💍 Get Married`,
              label: `Get Married`,
              icon: '💍',
              type: 'marriage',
              description: `Married a spouse with ${formatCurrency(ev.spouseIncome)}/yr income, ${formatCurrency(spouseAssets)} starting assets, and ${formatCurrency(spouseDebts)} starting debts. ${ev.includeWeddingCost ? 'Wedding cost: ' + formatCurrency(ev.weddingCost) + ' at Age ' + ev.weddingAge + '.' : ''}`,
              spouseIncome: ev.spouseIncome,
              incomeGrowthRate: ev.incomeGrowthRate,
              cash: ev.cash,
              investments: ev.investments,
              retirement: ev.retirement,
              debtStudent: ev.debtStudent,
              debtCredit: ev.debtCredit,
              debtOther: ev.debtOther,
              savingsRate: ev.savingsRate,
              housingOption: ev.housingOption,
              housingSavings: ev.housingSavings,
              housingCost: ev.housingCost,
              lifestyleAdjustment: ev.lifestyleAdjustment,
              includeWeddingCost: ev.includeWeddingCost,
              weddingCost: ev.weddingCost,
              weddingAge: ev.weddingAge,
              filingStatus: ev.filingStatus
            });
          } else if (ev.type === 'borrowing') {
            events.push({
              originalId: ev.id,
              age,
              title: ev.name,
              label: ev.name,
              icon: ev.borrowingType === 'studentLoan' ? '🎓' : ev.borrowingType === 'carLoan' ? '🚗' : ev.borrowingType === 'personalLoan' ? '💸' : '💳',
              type: 'borrowing',
              description: `Took out a ${ev.name} of ${formatCurrency(ev.balance)} at ${ev.interestRate}% interest (min monthly payment: ${formatCurrency(ev.minPayment)}).`
            });
          } else if (ev.type === 'payoffPlan') {
            const payoffAge = Number(ev.payoffAge);
            if (payoffAge >= inp.currentAge && payoffAge <= inp.lifeExpectancy) {
              const borrowing = inp.lifeEvents.find(b => b.id === ev.borrowingId);
              const bName = borrowing ? borrowing.name : 'Borrowing';
              events.push({
                originalId: ev.id,
                age: payoffAge,
                title: `Payoff End: ${bName}`,
                label: `${bName} Paid Off`,
                icon: '🏁',
                type: 'payoffPlanEnd',
                description: `Payoff Plan for "${bName}" is scheduled to complete at age ${Math.round(payoffAge * 10) / 10}.`
              });
            }
          }
        }
      }
    });

    // Ensure Social Security event is always present
    if (inp.includeSocialSecurity !== false) {
      const hasSS = events.some(e => e.type === 'socialSecurity');
      if (!hasSS) {
        events.push({
          originalId: 'ss-1',
          age: 67,
          title: 'Social Security',
          label: 'Social Security',
          icon: '💰',
          type: 'socialSecurity',
          description: `Receiving Social Security benefits (default claiming age 67).`
        });
      }
    }

    // Ensure Stop Working Event is always present
    const hasRetire = events.some(e => e.type === 'retire');
    if (!hasRetire) {
      events.push({
        originalId: 'retire-1',
        age: inp.targetRetirementAge || 65,
        title: 'Stop Working Event',
        label: 'Stop Working',
        icon: '🏖️',
        type: 'retire',
        description: `Target age to stop working. Contributions stop, and you begin drawing down from your portfolios.`
      });
    }

    // Ensure Today event is always present
    const hasToday = events.some(e => e.type === 'today');
    if (!hasToday) {
      events.push({
        age: inp.currentAge,
        title: 'Today',
        label: 'Today',
        icon: '',
        type: 'today',
        isMilestone: true,
        description: `Your current situation and starting point (Age ${inp.currentAge}).`
      });
    }

    // Ensure Life Expectancy event is always present
    const hasLifeExp = events.some(e => e.type === 'lifeExpectancy');
    if (!hasLifeExp) {
      events.push({
        age: inp.lifeExpectancy,
        title: 'Life Expectancy',
        label: 'Life Expectancy',
        icon: '',
        type: 'lifeExpectancy',
        isMilestone: true,
        description: `Your life expectancy horizon (Age ${inp.lifeExpectancy}).`
      });
    }

    // 4. Mathematical Milestones (e.g. debt payoffs)
    const calculationMilestones = calc.dynamicMilestones || [];
    calculationMilestones.forEach(m => {
      if (m.type === 'sellHouse') {
        return;
      }
      if (m.type === 'debtPayoff' && inp.lifeEvents.some(e => e.type === 'borrowing' && `${e.name} Paid Off` === m.label)) {
        return;
      }
      events.push({
        age: m.age,
        title: m.label,
        label: m.label,
        icon: m.type === 'debtPayoff' ? '🛑' : m.type === 'marriage' ? '💍' : m.type === 'wedding' ? '💸' : m.type === 'assetTransfer' ? '🔄' : '📈',
        type: m.type,
        isMilestone: m.isMilestone,
        description: `Mathematical milestone: "${m.label}" was achieved.`
      });
    });

    // 5. FIRE Milestones
    if (inp.readinessCriteria === 'lastsLifeExp') {
      if (calc.retirementReadyAgeSurvival) {
        events.push({
          age: calc.retirementReadyAgeSurvival,
          title: `You're Set!`,
          label: `You're Set!`,
          icon: '🎯',
          type: 'retirementReadySurvival',
          isMilestone: true,
          description: `This milestone marks the first year where the portfolio can sustainably support spending.`
        });
      }
    } else if (inp.readinessCriteria === 'lastsComfortable') {
      if (calc.retirementReadyAgeComfortable) {
        events.push({
          age: calc.retirementReadyAgeComfortable,
          title: `You're Set!`,
          label: `You're Set!`,
          icon: '🎯',
          type: 'retirementReadyComfortable',
          isMilestone: true,
          description: `This milestone marks the first year where the portfolio can sustainably support spending.`
        });
      }
    } else {
      if (calc.retirementReadyAgeSWR) {
        events.push({
          age: calc.retirementReadyAgeSWR,
          title: `You're Set!`,
          label: `You're Set!`,
          icon: '🎯',
          type: 'retirementReadySWR',
          isMilestone: true,
          description: `This milestone marks the first year where the portfolio can sustainably support spending.`
        });
      }
    }

    if (calc.coastAge) {
      events.push({
        age: calc.coastAge,
        title: `Coast FIRE Reached`,
        label: `Coast FIRE`,
        icon: '⛵',
        type: 'coastFire',
        isMilestone: true,
        description: `You reached Coast FIRE! Your current savings will grow to cover your target retirement expenses without any additional contributions.`
      });
    }

    // Medicare Milestone
    if (inp.enableHealthcareModel !== false) {
      events.push({
        age: 65,
        title: `Medicare Eligibility`,
        label: `Medicare`,
        icon: '🏥',
        type: 'medicareEligibility',
        isMilestone: true,
        description: `You become eligible for Medicare. Healthcare costs drop from your pre-Medicare private premium (${formatCurrency(inp.preMedicarePremium || 10000)}/yr) to Medicare rates (${formatCurrency(inp.medicarePremium || 4000)}/yr).`
      });
    }

    const sorted = events.sort((a, b) => {
      if (a.age !== b.age) {
        return a.age - b.age;
      }
      const aIsMilestone = !!a.isMilestone;
      const bIsMilestone = !!b.isMilestone;
      if (aIsMilestone && !bIsMilestone) return -1;
      if (!aIsMilestone && bIsMilestone) return 1;
      return 0;
    });

    // Allocate stackIndex slots consistently for house-related events
    const houseRanges = {};
    inp.lifeEvents.forEach(ev => {
      if (ev.enabled && ev.type === 'buyHouse' && ev.houseId) {
        const buyAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
        const sellEv = inp.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
        const sellAge = sellEv ? Number(sellEv.age) : Number(inp.lifeExpectancy || 85);
        houseRanges[ev.houseId] = {
          start: Math.floor(buyAge),
          end: Math.floor(sellAge)
        };
      }
    });

    const houseSlots = {};
    const occupiedSlots = [];

    const houseIds = Object.keys(houseRanges).sort((a, b) => houseRanges[a].start - houseRanges[b].start);
    houseIds.forEach(houseId => {
      const range = houseRanges[houseId];
      let slot = 0;
      while (true) {
        if (!occupiedSlots[slot]) {
          occupiedSlots[slot] = new Set();
        }
        let isFree = true;
        for (let age = range.start; age <= range.end; age++) {
          if (occupiedSlots[slot].has(age)) {
            isFree = false;
            break;
          }
        }
        if (isFree) {
          for (let age = range.start; age <= range.end; age++) {
            occupiedSlots[slot].add(age);
          }
          houseSlots[houseId] = slot;
          break;
        }
        slot++;
      }
    });

    const deduplicatedSorted = sorted.filter((evt, index) => {
      if (evt.type === 'lifestyle' || evt.type === 'career') {
        const hasPrimaryDuplicate = sorted.some((otherEvt, otherIndex) => {
          if (otherIndex === index) return false;
          if (otherEvt.age !== evt.age) return false;
          
          const isPrimary = ['haveChild', 'marriage', 'buyHouse', 'sellHouse', 'retire', 'college', 'sabbatical', 'windfall', 'assetTransfer'].includes(otherEvt.type);
          if (!isPrimary) return false;
          
          if (otherEvt.icon === evt.icon) return true;
          if (evt.icon === '👶' && otherEvt.type === 'haveChild') return true;
          if (evt.icon === '💍' && otherEvt.type === 'marriage') return true;
          if (evt.icon === '🏠' && (otherEvt.type === 'buyHouse' || otherEvt.type === 'sellHouse')) return true;
          if ((evt.icon === '🏖️' || evt.icon === '🏖') && otherEvt.type === 'retire') return true;
          
          return false;
        });
        if (hasPrimaryDuplicate) return false;
      }
      return true;
    });

    const occupiedSlotsTimeline = [];
    // Pre-occupy house slots in occupiedSlotsTimeline
    deduplicatedSorted.forEach(evt => {
      if (evt.houseId && houseSlots[evt.houseId] !== undefined) {
        const stackIndex = houseSlots[evt.houseId];
        if (!occupiedSlotsTimeline[stackIndex]) {
          occupiedSlotsTimeline[stackIndex] = [];
        }
        occupiedSlotsTimeline[stackIndex].push(evt.age);
      }
    });

    return deduplicatedSorted.map(evt => {
      let stackIndex;
      if (evt.houseId && houseSlots[evt.houseId] !== undefined) {
        stackIndex = houseSlots[evt.houseId];
      } else {
        const age = evt.age;
        let slot = 0;
        while (true) {
          if (!occupiedSlotsTimeline[slot]) {
            occupiedSlotsTimeline[slot] = [];
          }
          const isConflict = occupiedSlotsTimeline[slot].some(existingAge => Math.abs(existingAge - age) < 3.5);
          if (!isConflict) {
            occupiedSlotsTimeline[slot].push(age);
            stackIndex = slot;
            break;
          }
          slot++;
        }
      }
      return { ...evt, stackIndex };
    });
  }, [inputs, displayedResults]);
}
