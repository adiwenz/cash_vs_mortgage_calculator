import { buildEffectiveSimulationInputs } from '../../calculators/fire/effectiveInputs.js';
import { getTimelineItems } from './timelineSelectors.js';
import { TIMELINE_ITEM_KIND, TIMELINE_CATEGORY } from './timelineTypes.js';

/**
 * Derives a canonical timeline projection from normalized inputs and optional simulation data.
 * 
 * @param {Object} inputs - User's inputs (might contain lifeProfile, simple settings, etc.)
 * @param {Object} options - Options containing selectedAge or simulation data
 * @returns {Object} Canonical timeline projection
 */
export function getTimelineProjection(inputs, options = {}) {
  const effective = buildEffectiveSimulationInputs(inputs || {});

  // 1. Infer currentAge safely
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

  // 2. Normalize and retrieve raw timeline items
  const items = getTimelineItems(inputs || {});

  // 3. Resolve minAge and maxAge
  const lifeExpectancy = Math.max(currentAge + 1, Number(effective.lifeExpectancy) || 85);
  const targetRetirementAge = Math.max(currentAge, Number(effective.targetRetirementAge) || 65);

  let earliestAge = currentAge;
  let latestAge = Math.max(currentAge, lifeExpectancy, targetRetirementAge);

  items.forEach(item => {
    if (item.age !== null && item.age !== undefined) {
      earliestAge = Math.min(earliestAge, item.age);
      latestAge = Math.max(latestAge, item.age);
    }
    if (item.startAge !== null && item.startAge !== undefined) {
      earliestAge = Math.min(earliestAge, item.startAge);
      latestAge = Math.max(latestAge, item.startAge);
    }
    if (item.endAge !== null && item.endAge !== undefined) {
      earliestAge = Math.min(earliestAge, item.endAge);
      latestAge = Math.max(latestAge, item.endAge);
    }
  });

  const minAge = Math.min(currentAge, earliestAge);
  const maxAge = latestAge;

  // 4. Resolve selectedAge
  const selectedAge = options.selectedAge !== undefined && options.selectedAge !== null
    ? Number(options.selectedAge)
    : currentAge;

  // 5. Map items to canonical timeline format
  const mappedItems = items.map(item => {
    let type = 'period';
    if (item.kind === TIMELINE_ITEM_KIND.POINT) {
      type = 'point';
    } else if (item.kind === TIMELINE_ITEM_KIND.POINT_SERIES || item.kind === 'series') {
      type = 'series';
    }

    return {
      id: item.id,
      type,
      category: item.category,
      title: item.label,
      subtitle: item.description || '',
      startAge: item.startAge !== undefined ? item.startAge : null,
      endAge: item.endAge !== undefined ? item.endAge : null,
      age: item.age !== undefined ? item.age : null,
      value: item.metadata?.amount !== undefined
        ? item.metadata.amount
        : (item.metadata?.value !== undefined ? item.metadata.value : null),
      sourceType: item.sourceType || null,
      sourceId: item.sourceId || null,
      metadata: item.metadata || {}
    };
  });

  // Group items by category rows
  const relationshipItems = [];
  const housingItems = [];
  const childrenItems = [];
  const educationItems = [];
  const debtItems = [];
  const incomeItems = [];
  const majorEventsItems = [];
  const assetsItems = [];

  mappedItems.forEach(item => {
    switch (item.category) {
      case TIMELINE_CATEGORY.RELATIONSHIP:
        relationshipItems.push(item);
        break;
      case TIMELINE_CATEGORY.HOUSING:
        housingItems.push(item);
        break;
      case TIMELINE_CATEGORY.CHILDREN:
        childrenItems.push(item);
        break;
      case TIMELINE_CATEGORY.EDUCATION:
        educationItems.push(item);
        break;
      case TIMELINE_CATEGORY.DEBT:
        debtItems.push(item);
        // Include payoff events derived from debt periods with an endAge
        if (item.type === 'period' && item.endAge) {
          debtItems.push({
            id: `event-debt-payoff-${item.id}`,
            type: 'point',
            category: TIMELINE_CATEGORY.DEBT,
            title: `Payoff ${item.title}`,
            subtitle: `Paid off ${item.title}`,
            age: item.endAge,
            startAge: null,
            endAge: null,
            value: null,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            metadata: item.metadata
          });
        }
        break;
      case TIMELINE_CATEGORY.INCOME:
        incomeItems.push(item);
        break;
      case TIMELINE_CATEGORY.ASSETS:
        assetsItems.push(item);
        break;
      case TIMELINE_CATEGORY.MAJOR_EVENT:
      default:
        majorEventsItems.push(item);
        break;
    }
  });

  // 6. Build Assets / Net Worth series
  let netWorthPoints = [];
  const sim = options.simulation || (inputs && inputs.simulation);
  if (sim) {
    const dataList = sim.nominalData || sim.data || sim.logs || [];
    if (Array.isArray(dataList)) {
      netWorthPoints = dataList.map(d => ({
        age: Number(d.age),
        value: Math.round(Number(d.netWorth !== undefined ? d.netWorth : (d.portfolio !== undefined ? d.portfolio : 0)))
      }));
    }
  }

  assetsItems.push({
    id: 'assets-net-worth',
    type: 'series',
    category: TIMELINE_CATEGORY.ASSETS,
    title: 'Net Worth',
    subtitle: 'Projected net worth over time',
    startAge: minAge,
    endAge: maxAge,
    age: null,
    value: netWorthPoints.length > 0 ? netWorthPoints[0].value : null,
    sourceType: sim ? 'simulation' : 'placeholder',
    sourceId: sim ? 'net-worth-projection' : 'net-worth-placeholder',
    metadata: {
      points: netWorthPoints
    }
  });

  // 7. Group into Rows in specified order
  const rows = [
    { id: 'relationship', label: 'Relationship', category: TIMELINE_CATEGORY.RELATIONSHIP, icon: '❤️', items: relationshipItems },
    { id: 'housing', label: 'Housing', category: TIMELINE_CATEGORY.HOUSING, icon: '🏠', items: housingItems },
    { id: 'children', label: 'Children', category: TIMELINE_CATEGORY.CHILDREN, icon: '👶', items: childrenItems },
    { id: 'education', label: 'Education', category: TIMELINE_CATEGORY.EDUCATION, icon: '🎓', items: educationItems },
    { id: 'debt', label: 'Debt', category: TIMELINE_CATEGORY.DEBT, icon: '💸', items: debtItems },
    { id: 'income', label: 'Income', category: TIMELINE_CATEGORY.INCOME, icon: '💼', items: incomeItems },
    { id: 'major-events', label: 'Major Events', category: TIMELINE_CATEGORY.MAJOR_EVENT, icon: '⭐️', items: majorEventsItems },
    { id: 'assets', label: 'Assets / Net Worth', category: TIMELINE_CATEGORY.ASSETS, icon: '📈', items: assetsItems }
  ];

  // 8. Gather upcoming milestones (point events or period starts occurring after currentAge)
  const upcomingMilestones = [];
  const milestoneIds = new Set();

  const addMilestone = (id, title, age, category, sourceId, sourceType) => {
    if (age > currentAge && !milestoneIds.has(id)) {
      milestoneIds.add(id);
      upcomingMilestones.push({
        id,
        title,
        age,
        category,
        sourceId,
        sourceType
      });
    }
  };

  const milestoneRows = [
    relationshipItems,
    housingItems,
    childrenItems,
    educationItems,
    debtItems,
    incomeItems,
    majorEventsItems
  ];

  const pointCandidates = [];
  const periodCandidates = [];

  milestoneRows.forEach(rowItems => {
    rowItems.forEach(item => {
      if (item.type === 'point') {
        if (item.age !== null && item.age !== undefined) {
          pointCandidates.push(item);
        }
      } else if (item.type === 'period') {
        if (item.startAge !== null && item.startAge !== undefined) {
          periodCandidates.push(item);
        }
      }
    });
  });

  // Add point events first
  pointCandidates.forEach(item => {
    addMilestone(item.id, item.title, item.age, item.category, item.sourceId, item.sourceType);
  });

  // Add period starts if they don't duplicate a point event's sourceId
  periodCandidates.forEach(item => {
    const isBaseline = item.sourceType === 'baseline' || !item.sourceId;
    const isDuplicate = !isBaseline && upcomingMilestones.some(m => m.sourceId === item.sourceId);
    if (!isDuplicate) {
      addMilestone(`start-${item.id}`, `${item.title} (Start)`, item.startAge, item.category, item.sourceId, item.sourceType);
    }
  });

  upcomingMilestones.sort((a, b) => {
    if (a.age !== b.age) {
      return a.age - b.age;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    currentAge,
    minAge,
    maxAge,
    selectedAge,
    rows,
    upcomingMilestones
  };
}
