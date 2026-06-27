import { buildEffectiveSimulationInputs } from '../../calculators/fire/effectiveInputs.js';
import { calculateAmortizedLoanPayoffAge } from '../../calculators/fire/debts.js';
import { TIMELINE_ITEM_KIND, TIMELINE_CATEGORY } from './timelineTypes.js';
import { getChildEventBirthAge } from '../../utils/childEventHelpers.js';

export function getEventAge(ev, fallbackAge = 35) {
  if (!ev) return fallbackAge;
  if (ev.type === 'haveChild' || ev.type === 'child' || ev.type === 'createChild') {
    return getChildEventBirthAge(ev);
  }
  const fields = [
    'age',
    'eventAge',
    'startAge',
    'targetAge',
    'changeAge',
    'purchaseAge',
    'marriageAge',
    'moveAge',
    'childAge',
    'arrivalAge',
    'claimingAge'
  ];
  for (const f of fields) {
    if (ev[f] !== undefined && ev[f] !== null && ev[f] !== '') {
      const val = Number(ev[f]);
      if (!isNaN(val)) return val;
    }
  }
  return fallbackAge;
}

/**
 * Normalizes all timeline items from current profile situation and future events.
 * Returns an array of normalized timeline items.
 * 
 * @param {Object} inputs - User's inputs (might contain lifeProfile, simple settings, etc.)
 * @returns {Array} List of normalized timeline items
 */
export function getTimelineItems(inputs) {
  if (!inputs) return [];

  if (inputs.lifePlan && (inputs.useLifeProfile || !inputs.lifePlan._isFallback)) {
    const lifePlan = inputs.lifePlan;
    const currentAge = Number(lifePlan.currentAge) || 35;
    const lifeExpectancy = Number(lifePlan.lifeExpectancy) || 85;
    const items = [];

    // 1. Process Objects -> Periods
    lifePlan.objects.forEach(obj => {
      if (obj.type === 'relationship') return; // Skip relationship objects
      if (obj.type === 'person' && (obj.role === 'self' || obj.properties?.role === 'self')) return; // Skip self person

      let category = 'relationship';
      if (obj.type === 'job') category = 'income';
      else if (obj.type === 'property') category = 'housing';
      else if (obj.type === 'child' || (obj.type === 'person' && (obj.role === 'child' || obj.properties?.role === 'child')) || obj.type === 'dependent') category = 'children';
      else if (obj.type === 'debt') category = 'debt';
      else if (obj.type === 'account' || obj.type === 'business') category = 'assets';
      else if (obj.type === 'goal') category = 'goals';

      const startAge = obj.startsAtAge !== undefined
        ? Number(obj.startsAtAge)
        : (obj.startAge !== undefined ? Number(obj.startAge) : currentAge);
      let endAge = obj.endsAtAge !== undefined
        ? (obj.endsAtAge === null ? lifeExpectancy : Number(obj.endsAtAge))
        : (obj.endAge !== undefined ? Number(obj.endAge) : lifeExpectancy);

      if (obj.type === 'job') {
        const endEv = lifePlan.events.find(e => e.objectId === obj.id && e.type === 'job.end');
        if (endEv) {
          endAge = Number(endEv.age);
        }
      } else if (obj.type === 'property') {
        const sellEv = lifePlan.events.find(e => e.objectId === obj.id && e.type === 'property.sell');
        if (sellEv) {
          endAge = Number(sellEv.age);
        }
      } else if (obj.type === 'debt') {
        const payoffEv = lifePlan.events.find(e => e.objectId === obj.id && e.type === 'debt.payoff');
        if (payoffEv) {
          endAge = Number(payoffEv.age);
        } else {
          const p = obj.properties || {};
          endAge = calculateAmortizedLoanPayoffAge(
            Number(p.balance || 0),
            Number(p.interestRate || 0),
            Number(p.monthlyPayment || 0),
            startAge
          );
        }
      } else if (obj.type === 'child' || (obj.type === 'person' && obj.properties?.role === 'child') || obj.type === 'dependent') {
        const depEndEv = lifePlan.events.find(e => e.objectId === obj.id && (e.type === 'child.dependencyEnds' || e.type === 'dependencyEnds'));
        const depEndAge = depEndEv ? Number(depEndEv.mutation?.dependencyEndAge || depEndEv.age || 18) : Number(obj.properties?.dependencyEndAge || 18);
        const includeCollege = !!obj.properties?.includeCollege;
        const collegeEnd = includeCollege ? 22 : depEndAge;
        endAge = startAge + collegeEnd;
      }

      items.push({
        id: obj.id,
        sourceId: obj.id,
        sourceType: 'lifeObject',
        kind: 'period',
        category,
        label: obj.name,
        title: obj.name,
        description: `${obj.name} lifecycle`,
        age: null,
        startAge,
        endAge,
        objectType: obj.type,
        objectId: obj.id,
        isDerived: true,
        metadata: obj.properties || {}
      });
    });

    // 2. Process Events -> Points
    lifePlan.events.forEach(ev => {
      const obj = lifePlan.objects.find(o => o.id === ev.objectId);
      let category = 'major-events';
      if (obj) {
        if (obj.type === 'job') category = 'income';
        else if (obj.type === 'property') category = 'housing';
        else if (obj.type === 'child' || (obj.type === 'person' && obj.properties?.role === 'child') || obj.type === 'dependent') category = 'children';
        else if (obj.type === 'debt') category = 'debt';
        else if (obj.type === 'account' || obj.type === 'business') category = 'assets';
        else if (obj.type === 'goal') category = 'goals';
      }

      const isIncomeEvent = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type);
      if (isIncomeEvent) {
        category = 'income';
      }

      // Point marker
      items.push({
        id: ev.id,
        sourceId: ev.id,
        sourceType: 'lifeEvent',
        kind: 'point',
        category,
        label: ev.label || ev.mutation?.name || ev.type,
        title: ev.label || ev.mutation?.name || ev.type,
        description: ev.description || ev.mutation?.description || ev.type,
        age: Number(ev.age),
        startAge: null,
        endAge: null,
        objectType: isIncomeEvent ? 'income' : (obj?.type || 'event'),
        objectId: isIncomeEvent ? ev.id : ev.objectId,
        isDerived: true,
        metadata: ev.mutation || {}
      });

      // For income events, also push a period bar starting at the event age
      if (isIncomeEvent && ev.enabled !== false) {
        items.push({
          id: `event-income-period-${ev.id}`,
          sourceId: ev.id,
          sourceType: 'lifeEvent',
          kind: 'period',
          category: 'income',
          label: ev.label || ev.mutation?.name || ev.type,
          title: ev.label || ev.mutation?.name || ev.type,
          description: ev.description || ev.mutation?.description || ev.type,
          age: null,
          startAge: Number(ev.age),
          endAge: ev.mutation?.endAge ? Number(ev.mutation.endAge) : lifeExpectancy,
          objectType: 'income',
          objectId: ev.id,
          isDerived: true,
          metadata: ev.mutation || {}
        });
      }
    });

    return items;
  }

  // 1. Normalize inputs using the shared effective inputs builder
  const effective = buildEffectiveSimulationInputs(inputs);
  const currentAge = Math.max(0, Number(effective.currentAge) || 35);
  const lifeExpectancy = Math.max(currentAge + 1, Number(effective.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(effective.targetRetirementAge) || 65);

  const items = [];


  const enabledEvents = (effective.lifeEvents || []).filter(e => e.enabled !== false);

  // 2. Relationship Status mapping
  let baselineMarried = false;
  if (inputs.useLifeProfile && inputs.lifeProfile?.household) {
    const status = inputs.lifeProfile.household.status;
    baselineMarried = status === 'married' || status === 'partnered';
  } else {
    baselineMarried = effective.filingStatus === 'married' || effective.filingStatus === 'marriedJointly' || effective.filingStatus === 'jointly';
  }

  // Find marriage events
  const marriageEvents = enabledEvents.filter(e => ['marriage', 'getMarried', 'domesticPartnership', 'relationshipBegins'].includes(e.type));
  const marriageAge = marriageEvents.length > 0 ? getEventAge(marriageEvents[0], currentAge) : null;

  if (baselineMarried) {
    items.push({
      id: 'status-relationship-married',
      sourceId: 'baseline-relationship',
      sourceType: 'baseline',
      kind: TIMELINE_ITEM_KIND.STATUS,
      category: TIMELINE_CATEGORY.RELATIONSHIP,
      label: 'Married',
      description: 'Married / Partnered status',
      age: null,
      startAge: currentAge,
      endAge: null,
      isDerived: true,
      metadata: {}
    });
  } else if (marriageAge !== null) {
    if (marriageAge > currentAge) {
      items.push({
        id: 'status-relationship-single',
        sourceId: 'baseline-relationship',
        sourceType: 'baseline',
        kind: TIMELINE_ITEM_KIND.STATUS,
        category: TIMELINE_CATEGORY.RELATIONSHIP,
        label: 'Single',
        description: 'Single status',
        age: null,
        startAge: currentAge,
        endAge: marriageAge,
        isDerived: true,
        metadata: {}
      });
      items.push({
        id: 'status-relationship-married',
        sourceId: marriageEvents[0].id || 'marriage-event',
        sourceType: 'lifeEvent',
        kind: TIMELINE_ITEM_KIND.STATUS,
        category: TIMELINE_CATEGORY.RELATIONSHIP,
        label: (marriageEvents[0].relationshipType || (marriageEvents[0].type === 'marriage' ? 'married' : 'partner')) === 'married' ? 'Married' : 'Partnered',
        description: 'Married / Partnered status',
        age: null,
        startAge: marriageAge,
        endAge: null,
        isDerived: true,
        metadata: { marriageAge }
      });
    } else {
      items.push({
        id: 'status-relationship-married',
        sourceId: marriageEvents[0].id || 'marriage-event',
        sourceType: 'lifeEvent',
        kind: TIMELINE_ITEM_KIND.STATUS,
        category: TIMELINE_CATEGORY.RELATIONSHIP,
        label: (marriageEvents[0].relationshipType || (marriageEvents[0].type === 'marriage' ? 'married' : 'partner')) === 'married' ? 'Married' : 'Partnered',
        description: 'Married / Partnered status',
        age: null,
        startAge: currentAge,
        endAge: null,
        isDerived: true,
        metadata: { marriageAge }
      });
    }
  } else {
    items.push({
      id: 'status-relationship-single',
      sourceId: 'baseline-relationship',
      sourceType: 'baseline',
      kind: TIMELINE_ITEM_KIND.STATUS,
      category: TIMELINE_CATEGORY.RELATIONSHIP,
      label: 'Single',
      description: 'Single status',
      age: null,
      startAge: currentAge,
      endAge: null,
      isDerived: true,
      metadata: {}
    });
  }

  // Add partner period bar in legacy mode
  let hasPartner = false;
  let partnerStartAge = currentAge;
  let partnerName = 'Partner';

  if (baselineMarried) {
    hasPartner = true;
    partnerStartAge = currentAge;
  } else if (marriageAge !== null) {
    hasPartner = true;
    partnerStartAge = marriageAge;
  }

  if (hasPartner) {
    if (marriageEvents.length > 0 && marriageEvents[0].spouseName) {
      partnerName = marriageEvents[0].spouseName;
    }
    items.push({
      id: 'period-relationship-partner',
      sourceId: 'spouse-partner',
      sourceType: 'lifeObject',
      kind: TIMELINE_ITEM_KIND.PERIOD,
      category: TIMELINE_CATEGORY.RELATIONSHIP,
      label: partnerName,
      description: `${partnerName} lifecycle`,
      age: null,
      startAge: partnerStartAge,
      endAge: lifeExpectancy,
      objectType: 'person',
      objectId: 'spouse-partner',
      isDerived: true,
      metadata: {}
    });
  }

  // 3. Housing Status mapping
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

  const buyHouseEvents = enabledEvents.filter(e => e.type === 'buyHouse' || e.type === 'homePurchase' || e.type === 'buyHome');
  const sellHouseEvents = enabledEvents.filter(e => e.type === 'sellHouse');

  const buyAge = buyHouseEvents.length > 0 ? getEventAge(buyHouseEvents[0], currentAge) : null;
  const sellAge = sellHouseEvents.length > 0 ? getEventAge(sellHouseEvents[0], currentAge) : null;

  if (baselineOwn) {
    const homeownerEnd = sellAge !== null && sellAge > currentAge ? sellAge : null;
    items.push({
      id: 'status-housing-owner',
      sourceId: 'baseline-housing',
      sourceType: 'baseline',
      kind: TIMELINE_ITEM_KIND.STATUS,
      category: TIMELINE_CATEGORY.HOUSING,
      label: 'Homeowner',
      description: 'Own home',
      age: null,
      startAge: currentAge,
      endAge: homeownerEnd,
      isDerived: true,
      metadata: {}
    });
    if (homeownerEnd !== null) {
      items.push({
        id: 'status-housing-renting-post-sale',
        sourceId: sellHouseEvents[0].id || 'sell-house-event',
        sourceType: 'lifeEvent',
        kind: TIMELINE_ITEM_KIND.STATUS,
        category: TIMELINE_CATEGORY.HOUSING,
        label: 'Renting',
        description: 'Rent home after selling',
        age: null,
        startAge: homeownerEnd,
        endAge: null,
        isDerived: true,
        metadata: {}
      });
    }
  } else {
    // Starts as renter
    if (buyAge !== null) {
      if (buyAge > currentAge) {
        items.push({
          id: 'status-housing-renting',
          sourceId: 'baseline-housing',
          sourceType: 'baseline',
          kind: TIMELINE_ITEM_KIND.STATUS,
          category: TIMELINE_CATEGORY.HOUSING,
          label: 'Renting',
          description: 'Rent home',
          age: null,
          startAge: currentAge,
          endAge: buyAge,
          isDerived: true,
          metadata: {}
        });

        const homeownerEnd = sellAge !== null && sellAge > buyAge ? sellAge : null;
        items.push({
          id: 'status-housing-owner',
          sourceId: buyHouseEvents[0].id || 'buy-house-event',
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.STATUS,
          category: TIMELINE_CATEGORY.HOUSING,
          label: 'Homeowner',
          description: 'Own home',
          age: null,
          startAge: buyAge,
          endAge: homeownerEnd,
          isDerived: true,
          metadata: { buyAge }
        });

        if (homeownerEnd !== null) {
          items.push({
            id: 'status-housing-renting-post-sale',
            sourceId: sellHouseEvents[0].id || 'sell-house-event',
            sourceType: 'lifeEvent',
            kind: TIMELINE_ITEM_KIND.STATUS,
            category: TIMELINE_CATEGORY.HOUSING,
            label: 'Renting',
            description: 'Rent home after selling',
            age: null,
            startAge: homeownerEnd,
            endAge: null,
            isDerived: true,
            metadata: {}
          });
        }
      } else {
        // buyAge is in past or today
        const homeownerEnd = sellAge !== null && sellAge > currentAge ? sellAge : null;
        items.push({
          id: 'status-housing-owner',
          sourceId: buyHouseEvents[0].id || 'buy-house-event',
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.STATUS,
          category: TIMELINE_CATEGORY.HOUSING,
          label: 'Homeowner',
          description: 'Own home',
          age: null,
          startAge: currentAge,
          endAge: homeownerEnd,
          isDerived: true,
          metadata: { buyAge }
        });
        if (homeownerEnd !== null) {
          items.push({
            id: 'status-housing-renting-post-sale',
            sourceId: sellHouseEvents[0].id || 'sell-house-event',
            sourceType: 'lifeEvent',
            kind: TIMELINE_ITEM_KIND.STATUS,
            category: TIMELINE_CATEGORY.HOUSING,
            label: 'Renting',
            description: 'Rent home after selling',
            age: null,
            startAge: homeownerEnd,
            endAge: null,
            isDerived: true,
            metadata: {}
          });
        }
      }
    } else {
      // Renting indefinitely
      items.push({
        id: 'status-housing-renting',
        sourceId: 'baseline-housing',
        sourceType: 'baseline',
        kind: TIMELINE_ITEM_KIND.STATUS,
        category: TIMELINE_CATEGORY.HOUSING,
        label: 'Renting',
        description: 'Rent home',
        age: null,
        startAge: currentAge,
        endAge: null,
        isDerived: true,
        metadata: {}
      });
    }
  }

  // 4. Current Income List items (Baseline & Income phases)
  if (effective.incomeList && effective.incomeList.length > 0) {
    effective.incomeList.forEach(inc => {
      const incStart = inc.startAge !== undefined ? Number(inc.startAge) : currentAge;
      const incEnd = inc.endAge !== undefined ? Number(inc.endAge) : targetRetirementAge;
      items.push({
        id: `income-period-${inc.id}`,
        sourceId: inc.id,
        sourceType: 'income',
        kind: TIMELINE_ITEM_KIND.PERIOD,
        category: TIMELINE_CATEGORY.INCOME,
        label: inc.name || 'Salary / Main Income',
        description: `Income of ${inc.amount || 0} (${inc.growthRate * 100}% growth)`,
        age: null,
        startAge: incStart,
        endAge: incEnd,
        isDerived: inc.isDerived || false,
        metadata: { ...inc }
      });
    });
  } else {
    // Fallback to simpleIncome if no incomeList
    const simpleIncomeAmount = Number(effective.simpleIncome) || 0;
    if (simpleIncomeAmount > 0) {
      items.push({
        id: 'income-period-simple',
        sourceId: 'simpleIncome',
        sourceType: 'income',
        kind: TIMELINE_ITEM_KIND.PERIOD,
        category: TIMELINE_CATEGORY.INCOME,
        label: 'Salary / Main Income',
        description: `Main salary income`,
        age: null,
        startAge: currentAge,
        endAge: targetRetirementAge,
        isDerived: true,
        metadata: { amount: simpleIncomeAmount }
      });
    }
  }

  // 5. Current Debt List items
  if (effective.debtList && effective.debtList.length > 0) {
    effective.debtList.forEach(debt => {
      const start = debt.startAge !== undefined ? Number(debt.startAge) : currentAge;
      const balance = Number(debt.balance) || 0;
      const apr = Number(debt.interestRate) || 0;
      const monthlyPayment = debt.frequency === 'monthly' ? (Number(debt.payment) || 0) : (Number(debt.payment) || 0) / 12;
      const payoffAge = calculateAmortizedLoanPayoffAge(balance, apr, monthlyPayment, start);

      items.push({
        id: `debt-period-${debt.id}`,
        sourceId: debt.id,
        sourceType: 'debt',
        kind: TIMELINE_ITEM_KIND.PERIOD,
        category: TIMELINE_CATEGORY.DEBT,
        label: debt.name || 'Loan',
        description: `Debt: ${debt.name || 'Loan'}`,
        age: null,
        startAge: start,
        endAge: payoffAge,
        isDerived: debt.isDerived || false,
        metadata: { ...debt }
      });
    });
  }

  // 5c. Pre-existing house asset mortgages
  if (effective.houseAssets) {
    effective.houseAssets.forEach(h => {
      if (h.hasMortgage && h.mortgage) {
        const balance = Number(h.mortgage.balance) || 0;
        const apr = Number(h.mortgage.rate !== undefined ? h.mortgage.rate : (h.mortgage.interestRate !== undefined ? h.mortgage.interestRate : 6.5));
        const termYears = Number(h.mortgage.term !== undefined ? h.mortgage.term : (h.mortgage.loanTerm !== undefined ? h.mortgage.loanTerm : 30));
        const startAge = currentAge;
        const payoffAge = startAge + termYears;

        // Check if we already have this mortgage in debtList to avoid duplicates
        const exists = (effective.debtList || []).some(d => d.id === `derived-mortgage` || d.id === `mortgage-existing-${h.id}`);
        if (!exists) {
          items.push({
            id: `debt-period-mortgage-existing-${h.id}`,
            sourceId: h.id,
            sourceType: 'houseAsset',
            kind: TIMELINE_ITEM_KIND.PERIOD,
            category: TIMELINE_CATEGORY.DEBT,
            label: `${h.name || 'Home'} Mortgage`,
            description: `Pre-existing mortgage on ${h.name || 'home'}`,
            age: null,
            startAge: startAge,
            endAge: payoffAge,
            isDerived: true,
            metadata: {
              ...h.mortgage,
              type: 'mortgage',
              balance,
              interestRate: apr,
              payment: h.mortgage.monthlyPayment || h.mortgage.payment || 0
            }
          });
        }
      }
    });
  }

  // 5b. Safe fallback for other current children lists if not already mapped via effective.lifeEvents
  const userChildren = inputs.children || [];
  if (Array.isArray(userChildren)) {
    userChildren.forEach((child, index) => {
      const childAge = Number(child.age || 0);
      const birthAge = currentAge - childAge;
      const childId = child.id || `child-inputs-${index}`;
      
      // Check if we already have a child event matching this ID or birth age to avoid duplicates
      const exists = enabledEvents.some(e => e.id === childId || ((e.type === 'haveChild' || e.type === 'child') && getEventAge(e, currentAge) === birthAge));
      if (!exists) {
        items.push({
          id: `event-child-point-${childId}`,
          sourceId: childId,
          sourceType: 'child',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.CHILDREN,
          label: child.name || `Child ${index + 1}`,
          description: 'Child arrival',
          age: birthAge,
          startAge: null,
          endAge: null,
          isDerived: true,
          metadata: { ...child }
        });

        const dependentYears = child.includeCollege ? 22 : 18;
        items.push({
          id: `event-child-dependent-period-${childId}`,
          sourceId: childId,
          sourceType: 'child',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.CHILDREN,
          label: child.name ? `${child.name} (Dependent)` : `Child ${index + 1} (Dependent)`,
          description: `Dependent years (up to age ${dependentYears})`,
          age: null,
          startAge: birthAge,
          endAge: birthAge + dependentYears,
          isDerived: true,
          metadata: { ...child }
        });
      }
    });
  }

  // 6. Existing Life Events Mapping
  enabledEvents.forEach(event => {
    const age = getEventAge(event, currentAge);

    if (event.isDerived) {
      const originalExists = enabledEvents.some(e => 
        !e.isDerived && 
        e.type === event.type && 
        getEventAge(e, currentAge) === age
      );
      if (originalExists) return;
    }

    switch (event.type) {
      case 'marriage':
      case 'getMarried':
      case 'domesticPartnership':
      case 'relationshipBegins':
        const lowerType = event.type.toLowerCase();
        items.push({
          id: `event-${lowerType === 'getmarried' ? 'marriage' : lowerType}-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.RELATIONSHIP,
          label: event.name || (event.type === 'marriage' || event.type === 'getMarried' ? 'Marriage' : (event.type === 'domesticPartnership' ? 'Domestic Partnership' : 'Relationship Begins')),
          description: event.type === 'marriage' || event.type === 'getMarried' ? 'Wedding ceremony and marriage event' : (event.type === 'domesticPartnership' ? 'Domestic partnership start' : 'Relationship begins event'),
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });
        break;

      case 'buyHouse':
      case 'homePurchase':
      case 'buyHome':
        const buyLabelName = event.name ? event.name.replace(/^Buy\s+/i, '') : 'Home Purchase';
        items.push({
          id: `event-buyhouse-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.HOUSING,
          label: buyLabelName,
          description: `Buy home for ${event.homePrice || event.purchasePrice || 0}`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        // Add mortgage period if it exists and has a positive loan amount
        const p = Number(event.homePrice !== undefined ? event.homePrice : (event.purchasePrice !== undefined ? event.purchasePrice : 0)) || 0;
        const dp = Number(event.downPayment) || 0;
        const isCash = dp >= p || event.purchaseType === 'cash';
        if (!isCash && p > dp) {
          const termYears = Number(event.loanTerm !== undefined ? event.loanTerm : (event.loanTermYears !== undefined ? event.loanTermYears : 30));
          items.push({
            id: `event-buyhouse-mortgage-period-${event.id}`,
            sourceId: event.id,
            sourceType: 'lifeEvent',
            kind: TIMELINE_ITEM_KIND.PERIOD,
            category: TIMELINE_CATEGORY.DEBT,
            label: event.name ? `${event.name} Mortgage` : 'Home Mortgage',
            description: `Mortgage term: ${termYears} years`,
            age: null,
            startAge: age,
            endAge: age + termYears,
            isDerived: true,
            metadata: { ...event, borrowingType: 'mortgage', type: 'mortgage' }
          });
        }
        break;

      case 'sellHouse':
        items.push({
          id: `event-sellhouse-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.HOUSING,
          label: event.name || 'Home Sale',
          description: `Sell home`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });
        break;

      case 'haveChild':
      case 'child':
      case 'createChild':
        const childLabelName = event.name ? event.name.replace(/^Child:\s*/i, '') : '';
        items.push({
          id: `event-child-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.CHILDREN,
          label: childLabelName || 'Child Arrival',
          description: `Child arrival event`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        const dependentYears = event.includeCollege ? 22 : 18;
        items.push({
          id: `event-child-dependent-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.CHILDREN,
          label: childLabelName ? `${childLabelName} (Dependent)` : 'Child Dependent Period',
          description: `Dependent years (up to age ${dependentYears})`,
          age: null,
          startAge: age,
          endAge: age + dependentYears,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'socialSecurity':
        // Claiming social security creates a period of retirement income
        items.push({
          id: `event-socialsecurity-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.INCOME,
          label: event.name || 'Social Security',
          description: `Social Security Benefit claiming at age ${age}`,
          age: null,
          startAge: age,
          endAge: null,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'careerChange':
      case 'incomeChange':
        items.push({
          id: `event-incomechange-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.INCOME,
          label: event.name || 'Income Change',
          description: 'Career or job income change point',
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        items.push({
          id: `event-incomechange-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.INCOME,
          label: event.name ? `Income Phase: ${event.name}` : `Income Phase: ${age}+`,
          description: `Income adjustment phase starting at ${age}`,
          age: null,
          startAge: age,
          endAge: event.endAge ? Number(event.endAge) : null,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'sabbatical':
        items.push({
          id: `event-sabbatical-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.MAJOR_EVENT,
          label: event.name || 'Sabbatical',
          description: 'Sabbatical starting point',
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        items.push({
          id: `event-sabbatical-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.MAJOR_EVENT,
          label: event.name || 'Sabbatical',
          description: `Sabbatical period from age ${age} to ${event.endAge || age}`,
          age: null,
          startAge: age,
          endAge: event.endAge ? Number(event.endAge) : age,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'college':
        items.push({
          id: `event-college-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.EDUCATION,
          label: event.name || 'College',
          description: 'College start point',
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        const collegeEnd = event.endAge ? Number(event.endAge) : age + 4;
        items.push({
          id: `event-college-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.EDUCATION,
          label: event.name || 'College',
          description: `College period from age ${age} to ${collegeEnd}`,
          age: null,
          startAge: age,
          endAge: collegeEnd,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'borrowing':
        items.push({
          id: `event-borrowing-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.DEBT,
          label: event.name || 'Borrowing',
          description: `New borrowing: ${event.balance || 0}`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });

        const bBalance = Number(event.balance) || 0;
        const bApr = Number(event.interestRate) || 0;
        const bMonthlyPayment = Number(event.minPayment) || 0;
        const bPayoffAge = calculateAmortizedLoanPayoffAge(bBalance, bApr, bMonthlyPayment, age);

        items.push({
          id: `event-borrowing-period-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.PERIOD,
          category: TIMELINE_CATEGORY.DEBT,
          label: event.name || 'Borrowing Paydown',
          description: `Paydown term from age ${age} to ${bPayoffAge}`,
          age: null,
          startAge: age,
          endAge: bPayoffAge,
          isDerived: true,
          metadata: { ...event }
        });
        break;

      case 'retire':
        items.push({
          id: `event-retire-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.MAJOR_EVENT,
          label: event.name || 'Retirement',
          description: `Retirement target at age ${age}`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });
        break;

      case 'windfall':
        items.push({
          id: `event-windfall-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.MAJOR_EVENT,
          label: event.name || 'Windfall',
          description: `Windfall of ${event.amount || 0}`,
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });
        break;

      default:
        // Default: Map unknown events to point markers
        // Avoid adding points for derived events like derived-marriage/derived-mortgage/etc. if they are handled separately
        if (!event.id || (!event.id.startsWith('derived-') && !event.id.startsWith('simple-'))) {
          items.push({
            id: `event-unknown-point-${event.id || 'unknown'}`,
            sourceId: event.id || null,
            sourceType: 'lifeEvent',
            kind: TIMELINE_ITEM_KIND.POINT,
            category: TIMELINE_CATEGORY.MAJOR_EVENT,
            label: event.name || 'Life Event',
            description: `Event of type: ${event.type}`,
            age: age,
            startAge: null,
            endAge: null,
            isDerived: event.isDerived || false,
            metadata: { ...event }
          });
        }
        break;
    }
  });

  return items;
}

/**
 * Returns point items occurring at a specific age.
 * 
 * @param {Object} inputs - User's inputs
 * @param {number} age - The exact age to query
 * @returns {Array} List of active point events
 */
export function getActiveEventsAtAge(inputs, age) {
  const items = getTimelineItems(inputs);
  const targetAge = Number(age);
  return items.filter(item => item.kind === TIMELINE_ITEM_KIND.POINT && item.age === targetAge);
}

/**
 * Returns period/status items active at a specific age.
 * Uses exclusive endAge boundary: active if startAge <= age && (endAge == null || age < endAge)
 * 
 * @param {Object} inputs - User's inputs
 * @param {number} age - The age to query
 * @returns {Array} List of active period or status items
 */
export function getActivePeriodsAtAge(inputs, age) {
  const items = getTimelineItems(inputs);
  const targetAge = Number(age);
  return items.filter(item => 
    (item.kind === TIMELINE_ITEM_KIND.PERIOD || item.kind === TIMELINE_ITEM_KIND.STATUS) &&
    item.startAge <= targetAge &&
    (item.endAge === null || item.endAge === undefined || targetAge < item.endAge)
  );
}
