import { buildEffectiveSimulationInputs } from '../../calculators/fire/effectiveInputs.js';
import { getActiveEventsAtAge, getActivePeriodsAtAge, getEventAge } from './timelineSelectors.js';
import { TIMELINE_CATEGORY } from './timelineTypes.js';

/**
 * Returns a structural life snapshot at a specific age (without financial projections).
 * 
 * @param {Object} inputs - User's inputs
 * @param {number} age - The age to query
 * @returns {Object} Structural life snapshot
 */
export function getLifeSnapshotAtAge(inputs, age) {
  const targetAge = Number(age);
  const effective = buildEffectiveSimulationInputs(inputs || {});

  // Infer currentAge defensively from currentAge, age, householdModel.people.self.age, or similar legacy fields
  let currentAge = 35;
  if (inputs) {
    if (inputs.currentAge !== undefined && inputs.currentAge !== null && inputs.currentAge !== '') {
      currentAge = Number(inputs.currentAge);
    } else if (inputs.age !== undefined && inputs.age !== null && inputs.age !== '') {
      currentAge = Number(inputs.age);
    } else if (inputs.householdModel?.people?.self?.demographics?.currentAge !== undefined && inputs.householdModel?.people?.self?.demographics?.currentAge !== null) {
      currentAge = Number(inputs.householdModel.people.self.demographics.currentAge);
    } else if (inputs.householdModel?.people?.self?.age !== undefined && inputs.householdModel?.people?.self?.age !== null) {
      currentAge = Number(inputs.householdModel.people.self.age);
    } else if (effective.currentAge !== undefined && effective.currentAge !== null) {
      currentAge = Number(effective.currentAge);
    }
  }
  if (isNaN(currentAge)) {
    currentAge = 35;
  }

  const enabledEvents = (effective.lifeEvents || []).filter(e => e.enabled !== false);
  const activeEvents = getActiveEventsAtAge(inputs, targetAge);
  const activePeriods = getActivePeriodsAtAge(inputs, targetAge);

  // 1. Relationship Status
  const activeRelationshipPeriod = activePeriods.find(p => p.category === TIMELINE_CATEGORY.RELATIONSHIP && p.kind === 'status');
  let relationshipStatus = 'single';
  if (activeRelationshipPeriod) {
    relationshipStatus = activeRelationshipPeriod.label.toLowerCase();
  } else {
    // Baseline fallback
    let baselineMarried = false;
    if (inputs.useLifeProfile && inputs.lifeProfile?.household) {
      const status = inputs.lifeProfile.household.status;
      baselineMarried = status === 'married' || status === 'partnered';
    } else {
      baselineMarried = effective.filingStatus === 'married' || effective.filingStatus === 'marriedJointly' || effective.filingStatus === 'jointly';
    }
    relationshipStatus = baselineMarried ? 'married' : 'single';
  }

  // 2. Housing Status
  const activeHousingPeriod = activePeriods.find(p => p.category === TIMELINE_CATEGORY.HOUSING && p.kind === 'status');
  let housingStatus = 'rent';
  if (activeHousingPeriod) {
    const label = activeHousingPeriod.label.toLowerCase();
    housingStatus = (label === 'homeowner' || label === 'owner' || label === 'own') ? 'own' : 'rent';
  } else {
    // Baseline fallback
    let baselineOwn = false;
    if (inputs.useLifeProfile && inputs.lifeProfile?.home) {
      baselineOwn = inputs.lifeProfile.home.status === 'own';
    } else if (effective.houseAssets && effective.houseAssets.length > 0) {
      const buyHouseEventsForCheck = enabledEvents.filter(e => e.type === 'buyHouse' || e.type === 'homePurchase' || e.type === 'buyHome');
      const hasPreExistingHouse = effective.houseAssets.some(h => {
        const buyEvent = buyHouseEventsForCheck.find(e => e.houseId === h.id || e.id === h.id);
        if (!buyEvent) return true;
        const eventAge = getEventAge(buyEvent, currentAge);
        return eventAge <= currentAge;
      });
      if (hasPreExistingHouse) {
        baselineOwn = true;
      }
    }
    housingStatus = baselineOwn ? 'own' : 'rent';
  }

  // 3. Family / People
  const self = {
    currentAge: targetAge,
    role: 'self',
    displayName: 'You'
  };

  let partner = null;
  if (relationshipStatus === 'married' || relationshipStatus === 'partnered') {
    if (inputs.householdModel?.people?.partner) {
      partner = { ...inputs.householdModel.people.partner };
    } else {
      const spouseMember = (effective.householdMembers || []).find(m => m.id === 'spouse');
      if (spouseMember) {
        partner = {
          role: 'partner',
          displayName: spouseMember.name || 'Partner',
          ...spouseMember
        };
      } else {
        partner = {
          role: 'partner',
          displayName: 'Partner'
        };
      }
    }
    if (partner) {
      let partnerAgeToday = currentAge;
      if (partner.demographics?.currentAge !== undefined && partner.demographics?.currentAge !== null) {
        partnerAgeToday = Number(partner.demographics.currentAge);
      } else if (partner.currentAge !== undefined && partner.currentAge !== null) {
        partnerAgeToday = Number(partner.currentAge);
      }
      const yearsElapsed = targetAge - currentAge;
      partner.currentAge = partnerAgeToday + yearsElapsed;
    }
  }

  // 4. Children
  const children = [];
  const childEvents = enabledEvents.filter(e => e.type === 'haveChild' || e.type === 'child' || e.type === 'createChild');
  
  childEvents.forEach((chEvent, idx) => {
    // Defensive age resolver for child arrival
    let birthAge = currentAge;
    const fields = ['birthAge', 'age', 'arrivalAge', 'childAge'];
    for (const f of fields) {
      if (chEvent[f] !== undefined && chEvent[f] !== null && chEvent[f] !== '') {
        const val = Number(chEvent[f]);
        if (!isNaN(val)) {
          birthAge = val;
          break;
        }
      }
    }
    const childAgeAtSnapshot = targetAge - birthAge;
    const dependentYears = chEvent.includeCollege ? 22 : 18;

    if (targetAge >= birthAge && childAgeAtSnapshot < dependentYears) {
      children.push({
        id: chEvent.id || `child-${idx}`,
        name: chEvent.name ? chEvent.name.replace('Child: ', '') : `Child ${idx + 1}`,
        age: childAgeAtSnapshot,
        isDependent: childAgeAtSnapshot < 18
      });
    }
  });

  // 5. Income
  const activeIncomeItems = activePeriods.filter(p => p.category === TIMELINE_CATEGORY.INCOME && p.kind === 'period');
  
  // Calculate current annual income fallback
  let currentAnnualIncome = 0;
  if (effective.incomeList && effective.incomeList.length > 0) {
    currentAnnualIncome = effective.incomeList.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  } else {
    currentAnnualIncome = Number(effective.simpleIncome) || 0;
  }

  let annualIncome = 0;
  if (activeIncomeItems.length > 0) {
    activeIncomeItems.forEach(item => {
      annualIncome += Number(item.metadata?.amount || item.metadata?.value || 0);
    });
  } else {
    annualIncome = currentAnnualIncome;
  }

  // Include partner income if married at target age
  if (relationshipStatus === 'married' || relationshipStatus === 'partnered') {
    let partnerIncome = 0;
    const spouseMember = (effective.householdMembers || []).find(m => m.id === 'spouse');
    if (spouseMember) {
      partnerIncome = Number(spouseMember.income) || 0;
    } else if (inputs.useLifeProfile && inputs.lifeProfile?.household) {
      partnerIncome = Number(inputs.lifeProfile.household.partnerIncome) || 0;
    }
    annualIncome += partnerIncome;
  }

  // 6. Debts: derive from active periods under category DEBT
  const activeDebtPeriods = activePeriods.filter(p => p.category === TIMELINE_CATEGORY.DEBT);
  const activeDebts = activeDebtPeriods.map(p => {
    const meta = p.metadata || {};
    return {
      id: p.sourceId || p.id,
      name: p.label,
      type: meta.borrowingType || meta.type || 'debt',
      monthlyPayment: Math.round(meta.payment || meta.minPayment || 0),
      icon: meta.icon || '💸',
      payoffAge: p.endAge
    };
  });

  // 7. Assets: baseline fallback (no future projections)
  const ass = effective.assets || {};
  const customAssetsStartingValue = enabledEvents
    .filter(c => c.type === 'conditionItem' && ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.subtype || c.type))
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  const baselineInvestedAssets = (Number(ass.cash) || 0) +
                       (Number(ass.emergencyFund) || 0) +
                       (Number(ass.brokerage) || 0) +
                       (Number(ass.trad401k) || 0) +
                       (Number(ass.tradIra) || 0) +
                       (Number(ass.rothIra) || 0) +
                       (Number(ass.hsa) || 0) +
                       (Number(ass.other) || 0) +
                       customAssetsStartingValue;

  return {
    age: targetAge,
    currentAge,
    relationshipStatus,
    housingStatus,
    people: {
      self,
      partner
    },
    children,
    income: {
      annualIncome,
      activeIncomeItems
    },
    debts: {
      activeDebts
    },
    assets: {
      investedAssets: baselineInvestedAssets
    },
    activeEvents,
    activePeriods
  };
}
