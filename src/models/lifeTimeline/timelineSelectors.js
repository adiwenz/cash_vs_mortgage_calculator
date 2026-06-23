import { buildEffectiveSimulationInputs } from '../../calculators/fire/effectiveInputs.js';
import { calculateAmortizedLoanPayoffAge } from '../../calculators/fire/debts.js';
import { TIMELINE_ITEM_KIND, TIMELINE_CATEGORY } from './timelineTypes.js';

/**
 * Normalizes all timeline items from current profile situation and future events.
 * Returns an array of normalized timeline items.
 * 
 * @param {Object} inputs - User's inputs (might contain lifeProfile, simple settings, etc.)
 * @returns {Array} List of normalized timeline items
 */
export function getTimelineItems(inputs) {
  if (!inputs) return [];

  // 1. Normalize inputs using the shared effective inputs builder
  const effective = buildEffectiveSimulationInputs(inputs);
  const currentAge = Math.max(0, Number(effective.currentAge) || 35);
  const lifeExpectancy = Math.max(currentAge + 1, Number(effective.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(effective.targetRetirementAge) || 65);

  const items = [];

  // Helper to safely resolve age
  const getEventAge = (ev) => {
    if (ev.age !== undefined && ev.age !== null && ev.age !== '') return Number(ev.age);
    if (ev.startAge !== undefined && ev.startAge !== null && ev.startAge !== '') return Number(ev.startAge);
    if (ev.purchaseAge !== undefined && ev.purchaseAge !== null && ev.purchaseAge !== '') return Number(ev.purchaseAge);
    if (ev.claimingAge !== undefined && ev.claimingAge !== null && ev.claimingAge !== '') return Number(ev.claimingAge);
    if (ev.birthAge !== undefined && ev.birthAge !== null && ev.birthAge !== '') return Number(ev.birthAge);
    return currentAge;
  };

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
  const marriageEvents = enabledEvents.filter(e => e.type === 'marriage');
  const marriageAge = marriageEvents.length > 0 ? getEventAge(marriageEvents[0]) : null;

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
        label: 'Married',
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
        label: 'Married',
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

  // 3. Housing Status mapping
  let baselineOwn = false;
  if (inputs.useLifeProfile && inputs.lifeProfile?.home) {
    baselineOwn = inputs.lifeProfile.home.status === 'own';
  } else if (effective.houseAssets && effective.houseAssets.length > 0) {
    baselineOwn = true;
  }

  const buyHouseEvents = enabledEvents.filter(e => e.type === 'buyHouse');
  const sellHouseEvents = enabledEvents.filter(e => e.type === 'sellHouse');

  const buyAge = buyHouseEvents.length > 0 ? getEventAge(buyHouseEvents[0]) : null;
  const sellAge = sellHouseEvents.length > 0 ? getEventAge(sellHouseEvents[0]) : null;

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

  // 6. Existing Life Events Mapping
  enabledEvents.forEach(event => {
    const age = getEventAge(event);

    switch (event.type) {
      case 'marriage':
        items.push({
          id: `event-marriage-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.RELATIONSHIP,
          label: event.name || 'Marriage',
          description: 'Wedding ceremony and marriage event',
          age: age,
          startAge: null,
          endAge: null,
          isDerived: event.isDerived || false,
          metadata: { ...event }
        });
        break;

      case 'buyHouse':
        items.push({
          id: `event-buyhouse-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.HOUSING,
          label: event.name || 'Home Purchase',
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
            metadata: { ...event }
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
        items.push({
          id: `event-child-point-${event.id}`,
          sourceId: event.id,
          sourceType: 'lifeEvent',
          kind: TIMELINE_ITEM_KIND.POINT,
          category: TIMELINE_CATEGORY.CHILDREN,
          label: event.name || 'Child Arrival',
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
          label: event.name ? `${event.name} (Dependent)` : 'Child Dependent Period',
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
