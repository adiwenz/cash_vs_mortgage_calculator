import { buildEffectiveSimulationInputs } from '../../calculators/fire/effectiveInputs.js';
import { getActiveDebtsForAge } from '../../calculators/fire/debts.js';
import { getActiveEventsAtAge, getActivePeriodsAtAge } from './timelineSelectors.js';
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
  const currentAge = Math.max(0, Number(effective.currentAge) || 35);

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
      baselineOwn = true;
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
    partner = {
      currentAge: targetAge,
      role: 'partner',
      displayName: 'Partner'
    };
  }

  // 4. Children
  const children = [];
  const enabledEvents = (effective.lifeEvents || []).filter(e => e.enabled !== false);
  
  // Collect from lifeProfile children (which are converted to haveChild derived events) or manually entered haveChild events
  const childEvents = enabledEvents.filter(e => e.type === 'haveChild' || e.type === 'child');
  childEvents.forEach((chEvent, idx) => {
    const birthAge = chEvent.birthAge !== undefined ? Number(chEvent.birthAge) : (chEvent.age !== undefined ? Number(chEvent.age) : currentAge);
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
  let annualIncome = 0;
  
  activeIncomeItems.forEach(item => {
    const amount = Number(item.metadata?.amount || item.metadata?.value || 0);
    annualIncome += amount;
  });

  // Include partner income if married at the target age
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

  // 6. Debts
  const resolvedActiveDebts = getActiveDebtsForAge(effective, enabledEvents, targetAge);

  // 7. Assets: Baseline invested assets fallback (no future projections)
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
      activeDebts: resolvedActiveDebts
    },
    assets: {
      investedAssets: baselineInvestedAssets
    },
    activeEvents,
    activePeriods
  };
}
