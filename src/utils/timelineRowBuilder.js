import { TIMELINE_CATEGORY } from '../models/lifeTimeline/timelineTypes.js';
import { getChildEventBirthAge } from './childEventHelpers.js';
import {
  getCurrentAge,
  getLifeEvents,
  getEnabledLifeEvents,
  getHouseAssets,
  getIncomeItems,
  getDebtItems,
  getHousingStatus
} from '../features/fire/scenario/index.js';

export function getObjectRowKey(objectType, id) {
  if (!objectType || !id) return null;
  return `${objectType}-${id}`;
}

export function resolveHouseIdForEvent(ev, inputs) {
  if (!ev || !inputs) return null;
  const houseAssets = getHouseAssets(inputs).filter(h => h.purchaseType !== 'rent' && h.status !== 'rent' && !h.isRenting);

  // 1. Direct match by houseId
  if (ev.houseId && getHouseAssets(inputs).some(h => h.id === ev.houseId)) {
    return ev.houseId;
  }
  // 2. Direct match by event ID
  if (getHouseAssets(inputs).some(h => h.id === ev.id)) {
    return ev.id;
  }

  // 3. Positional fallback: map the N-th buy/sell event to the N-th non-renting house asset
  const enabledEvents = getEnabledLifeEvents(inputs);
  const buyEvents = enabledEvents.filter(e => e.type === 'buyHouse' || e.type === 'homePurchase' || e.type === 'buyHome');
  const evIdx = buyEvents.findIndex(e => e.id === ev.id);
  if (evIdx !== -1 && houseAssets[evIdx]) {
    return houseAssets[evIdx].id;
  }

  // 4. Default fallback: first non-renting house asset
  if (houseAssets.length > 0) {
    return houseAssets[0].id;
  }

  return ev.houseId || ev.id;
}

export function getTimelineItemObjectKey(item, inputs) {
  if (!item) return null;

  // 1. Direct objectType + objectId on item
  if (item.objectType && item.objectId) {
    return getObjectRowKey(item.objectType, item.objectId);
  }

  // 2. sourceType + sourceId on item (if it matches a valid object type)
  if (item.sourceType && item.sourceId) {
    const objectType = mapSourceTypeToObjectType(item.sourceType, item.category);
    if (objectType && item.sourceId !== 'baseline-relationship' && item.sourceId !== 'baseline-housing') {
      if (objectType === 'housing') {
        const ev = getLifeEvents(inputs).find(e => e.id === item.sourceId);
        const resolvedId = resolveHouseIdForEvent(ev, inputs) || item.sourceId;
        return getObjectRowKey(objectType, resolvedId);
      }
      return getObjectRowKey(objectType, item.sourceId);
    }
  }

  // 3. metadata.objectType + metadata.objectId
  if (item.metadata?.objectType && item.metadata?.objectId) {
    return getObjectRowKey(item.metadata.objectType, item.metadata.objectId);
  }

  // 4. metadata specific ID fields
  if (item.metadata?.childId) {
    return getObjectRowKey('child', item.metadata.childId);
  }
  if (item.metadata?.houseId) {
    return getObjectRowKey('housing', item.metadata.houseId);
  }
  if (item.metadata?.incomeId) {
    return getObjectRowKey('income', item.metadata.incomeId);
  }
  if (item.metadata?.debtId) {
    return getObjectRowKey('debt', item.metadata.debtId);
  }

  // Check if it's a mortgage period or existing mortgage
  const idStr = String(item.id || '');
  if (idStr.startsWith('event-buyhouse-mortgage-period-')) {
    const eid = idStr.replace('event-buyhouse-mortgage-period-', '');
    const ev = getLifeEvents(inputs).find(e => e.id === eid);
    const houseId = resolveHouseIdForEvent(ev, inputs) || eid;
    return getObjectRowKey('debt', `mortgage-${houseId}`);
  }
  if (idStr.startsWith('debt-period-mortgage-existing-')) {
    const houseId = idStr.replace('debt-period-mortgage-existing-', '');
    return getObjectRowKey('debt', `mortgage-${houseId}`);
  }

  // Baseline homeowner status
  if (item.id === 'status-housing-owner' && item.sourceId === 'baseline-housing') {
    const houseAssets = getHouseAssets(inputs);
    const enabledEvents = getEnabledLifeEvents(inputs);
    const preExisting = houseAssets.filter(h => {
      const buyEvent = enabledEvents.find(e => e.type === 'buyHouse' && e.houseId === h.id);
      if (!buyEvent) return true;
      const buyAge = buyEvent.purchaseAge !== undefined ? Number(buyEvent.purchaseAge) : Number(buyEvent.age || 35);
      const currentAge = getCurrentAge(inputs);
      return buyAge <= currentAge;
    });
    const houseId = preExisting.length > 0 ? preExisting[0].id : (houseAssets[0]?.id || 'baseline-home');
    return getObjectRowKey('housing', houseId);
  }

  // Resolve via lifeEvent lookup if sourceType is lifeEvent
  if (item.sourceType === 'lifeEvent' && item.sourceId) {
    const ev = getLifeEvents(inputs).find(e => e.id === item.sourceId);
    if (ev) {
      if (ev.type === 'haveChild' || ev.type === 'child' || ev.type === 'createChild') {
        return getObjectRowKey('child', ev.id);
      }
      if (ev.type === 'buyHouse' || ev.type === 'sellHouse') {
        const resolvedId = resolveHouseIdForEvent(ev, inputs) || ev.id;
        return getObjectRowKey('housing', resolvedId);
      }
      if (ev.type === 'college' || ev.type === 'education') {
        return getObjectRowKey('education', ev.id);
      }
      if (ev.type === 'borrowing') {
        return getObjectRowKey('debt', ev.id);
      }
      if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome', 'careerChange', 'incomeChange'].includes(ev.type)) {
        return getObjectRowKey('income', ev.id);
      }
    }
  }

  // 5. Legacy parses
  // Children
  if (idStr.startsWith('event-child-point-')) {
    const cid = idStr.replace('event-child-point-', '');
    return getObjectRowKey('child', cid);
  }
  if (idStr.startsWith('event-child-dependent-period-')) {
    const cid = idStr.replace('event-child-dependent-period-', '');
    return getObjectRowKey('child', cid);
  }

  // Housing
  if (idStr.startsWith('event-buyhouse-point-')) {
    const hid = idStr.replace('event-buyhouse-point-', '');
    const ev = getLifeEvents(inputs).find(e => e.id === hid);
    const resolvedId = resolveHouseIdForEvent(ev, inputs) || hid;
    return getObjectRowKey('housing', resolvedId);
  }
  if (idStr.startsWith('event-sellhouse-point-')) {
    const hid = idStr.replace('event-sellhouse-point-', '');
    const ev = getLifeEvents(inputs).find(e => e.id === hid);
    const resolvedId = resolveHouseIdForEvent(ev, inputs) || hid;
    return getObjectRowKey('housing', resolvedId);
  }

  // Income
  if (idStr.startsWith('income-period-') && idStr !== 'income-period-simple') {
    const iid = idStr.replace('income-period-', '');
    return getObjectRowKey('income', iid);
  }
  if (idStr.startsWith('event-incomechange-point-')) {
    const iid = idStr.replace('event-incomechange-point-', '');
    return getObjectRowKey('income', iid);
  }
  if (idStr.startsWith('event-incomechange-period-')) {
    const iid = idStr.replace('event-incomechange-period-', '');
    return getObjectRowKey('income', iid);
  }
  if (idStr.startsWith('event-socialsecurity-period-')) {
    const iid = idStr.replace('event-socialsecurity-period-', '');
    return getObjectRowKey('income', iid);
  }

  // Debt
  if (idStr.startsWith('debt-period-') && !idStr.startsWith('debt-period-mortgage-existing-')) {
    const did = idStr.replace('debt-period-', '');
    return getObjectRowKey('debt', did);
  }
  if (idStr.startsWith('event-borrowing-point-')) {
    const did = idStr.replace('event-borrowing-point-', '');
    return getObjectRowKey('debt', did);
  }
  if (idStr.startsWith('event-borrowing-period-')) {
    const did = idStr.replace('event-borrowing-period-', '');
    return getObjectRowKey('debt', did);
  }

  // Education
  if (idStr.startsWith('event-college-point-')) {
    const eid = idStr.replace('event-college-point-', '');
    return getObjectRowKey('education', eid);
  }
  if (idStr.startsWith('event-college-period-')) {
    const eid = idStr.replace('event-college-period-', '');
    return getObjectRowKey('education', eid);
  }

  // Category fallback if metadata ID is generic
  if (item.metadata?.id && item.category) {
    const objectType = mapCategoryToObjectType(item.category);
    if (objectType) {
      return getObjectRowKey(objectType, item.metadata.id);
    }
  }

  return null;
}

function mapSourceTypeToObjectType(sourceType, category) {
  if (sourceType === 'child') return 'child';
  if (sourceType === 'houseAsset') return 'housing';
  if (sourceType === 'income') return 'income';
  if (sourceType === 'debt') return 'debt';
  if (sourceType === 'lifeEvent') {
    return mapCategoryToObjectType(category);
  }
  return null;
}

function mapCategoryToObjectType(category) {
  if (category === TIMELINE_CATEGORY.CHILDREN || category === 'children') return 'child';
  if (category === TIMELINE_CATEGORY.HOUSING || category === 'housing') return 'housing';
  if (category === TIMELINE_CATEGORY.INCOME || category === 'income') return 'income';
  if (category === TIMELINE_CATEGORY.DEBT || category === 'debt') return 'debt';
  if (category === TIMELINE_CATEGORY.EDUCATION || category === 'education') return 'education';
  return null;
}

export function doesItemBelongToObject(item, row) {
  if (!item || !row) return false;
  if (row.type !== 'object') return false;

  const itemKey = getTimelineItemObjectKey(item);
  if (itemKey && itemKey === row.rowKey) {
    return true;
  }

  if (row.objectType && row.objectId) {
    if (item.objectType === row.objectType && item.objectId === row.objectId) return true;
    if (item.metadata?.objectType === row.objectType && item.metadata?.objectId === row.objectId) return true;

    if (row.objectType === 'child' && (item.metadata?.childId === row.objectId || item.sourceId === row.objectId)) return true;
    if (row.objectType === 'housing' && (item.metadata?.houseId === row.objectId || item.sourceId === row.objectId)) return true;
    if (row.objectType === 'income' && (item.metadata?.incomeId === row.objectId || item.sourceId === row.objectId)) return true;
    if (row.objectType === 'debt' && (item.metadata?.debtId === row.objectId || item.sourceId === row.objectId)) return true;
  }

  return false;
}

// Normalized objects derivation helpers
function getChildObjects(inputs) {
  const children = [];
  const seenIds = new Set();

  // 1. From inputs.children
  const userChildren = inputs.children || [];
  userChildren.forEach((c, idx) => {
    const id = c.id || `child-input-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      children.push({
        id,
        name: c.name || `Child ${children.length + 1}`
      });
    }
  });

  // 2. From inputs.lifeEvents
  const enabledEvents = getEnabledLifeEvents(inputs);
  const childEvents = enabledEvents.filter(e => e.type === 'haveChild' || e.type === 'child' || e.type === 'createChild');
  childEvents.forEach((e, idx) => {
    const id = e.id || `child-event-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const name = e.childName || e.name || `Child ${children.length + 1}`;
      children.push({
        id,
        name: name.replace(/^Child:\s*/i, '') // strip "Child: " prefix
      });
    }
  });

  return children;
}

function getHousingObjects(inputs) {
  const houses = [];
  const seenIds = new Set();
  const houseAssets = getHouseAssets(inputs);

  // Check if baseline is owned
  let isBaselineOwn = false;
  if (inputs.useLifeProfile && inputs.lifeProfile?.home) {
    isBaselineOwn = getHousingStatus(inputs) === 'own';
  } else if (houseAssets.length > 0) {
    const buyHouseEvents = getEnabledLifeEvents(inputs).filter(e => e.type === 'buyHouse' || e.type === 'homePurchase' || e.type === 'buyHome');
    const hasPreExistingHouse = houseAssets.some(h => {
      const buyEvent = buyHouseEvents.find(e => e.houseId === h.id || e.id === h.id);
      if (!buyEvent) return true;
      const buyAge = buyEvent.purchaseAge !== undefined ? Number(buyEvent.purchaseAge) : Number(buyEvent.age || 35);
      const currentAge = getCurrentAge(inputs);
      return buyAge <= currentAge;
    });
    if (hasPreExistingHouse) {
      isBaselineOwn = true;
    }
  }

  const enabledEvents = getEnabledLifeEvents(inputs);
  const buyEvents = enabledEvents.filter(e => e.type === 'buyHouse' || e.type === 'homePurchase' || e.type === 'buyHome');

  houseAssets.forEach((h, idx) => {
    // 1. Skip if explicit renting/rent status
    if (h.purchaseType === 'rent' || h.status === 'rent' || h.isRenting) {
      return;
    }

    // 2. Skip if it is not pre-existing owned AND has no buy event associated with it
    const hasBuyEvent = buyEvents.some(e => e.houseId === h.id || e.id === h.id || resolveHouseIdForEvent(e, inputs) === h.id);
    if (!isBaselineOwn && !hasBuyEvent) {
      return;
    }

    const id = h.id || `house-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      houses.push({
        id,
        name: h.name || `Home ${idx + 1}`
      });
    }
  });
  return houses;
}

function getIncomeObjects(inputs) {
  const incomes = [];
  const seenIds = new Set();

  // 1. From inputs.incomeList
  const incomeList = getIncomeItems(inputs);
  incomeList.forEach((inc, idx) => {
    const id = inc.id || `income-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      incomes.push({
        id,
        name: inc.name || `Income Source ${idx + 1}`
      });
    }
  });

  // 2. Simple income fallback
  const simpleIncomeAmount = Number(inputs.simpleIncome || inputs.income) || 0;
  if (incomes.length === 0 && simpleIncomeAmount > 0) {
    const id = 'simpleIncome';
    seenIds.add(id);
    incomes.push({
      id,
      name: 'Salary / Main Income'
    });
  }

  // 3. From inputs.lifeEvents (income changes, pensions, social security, rental income)
  const enabledEvents = getEnabledLifeEvents(inputs);
  const incomeEvents = enabledEvents.filter(e => 
    ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome', 'careerChange', 'incomeChange'].includes(e.type)
  );

  incomeEvents.forEach((e, idx) => {
    const id = e.id || `income-event-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      let name = e.name;
      if (!name) {
        if (e.type === 'socialSecurity') name = 'Social Security';
        else if (e.type === 'pension') name = 'Pension';
        else if (e.type === 'rentalIncome') name = 'Rental Income';
        else if (e.type === 'annuity') name = 'Annuity';
        else if (e.type === 'otherRetirementIncome') name = 'Other Income';
        else name = `Income Phase ${idx + 1}`;
      }
      incomes.push({
        id,
        name
      });
    }
  });

  return incomes;
}

function getDebtObjects(inputs) {
  const debts = [];
  const seenIds = new Set();

  // 1. From inputs.debtList
  const debtList = getDebtItems(inputs);
  debtList.forEach((d, idx) => {
    const id = d.id || `debt-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      debts.push({
        id,
        name: d.name || `Loan ${idx + 1}`
      });
    }
  });

  // 2. From pre-existing house asset mortgages
  const houseAssets = getHouseAssets(inputs);
  houseAssets.forEach(h => {
    if (h.hasMortgage && h.mortgage) {
      const id = `derived-mortgage-${h.id}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        debts.push({
          id: `mortgage-${h.id}`, // We'll represent mortgages as mortgage-${houseId}
          name: `${h.name || 'Home'} Mortgage`
        });
      }
    }
  });

  // 3. From borrowing life events
  const enabledEvents = getEnabledLifeEvents(inputs);
  const borrowingEvents = enabledEvents.filter(e => e.type === 'borrowing');
  borrowingEvents.forEach((e, idx) => {
    const id = e.id || `borrowing-event-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      debts.push({
        id,
        name: e.name || `Borrowing ${idx + 1}`
      });
    }
  });

  return debts;
}

function getEducationObjects(inputs) {
  const edu = [];
  const seenIds = new Set();
  const enabledEvents = getEnabledLifeEvents(inputs);
  const collegeEvents = enabledEvents.filter(e => e.type === 'college' || e.type === 'education');
  collegeEvents.forEach((e, idx) => {
    const id = e.id || `edu-event-${idx}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      edu.push({
        id,
        name: e.name || `College ${idx + 1}`
      });
    }
  });
  return edu;
}

export function buildTimelineRows(inputs) {
  const actualInputs = inputs?.inputs || inputs || {};

  const createRow = ({ type, id, parent, label, icon, count, objectType, objectId }) => ({
    type,
    id,
    parent,
    label,
    icon,
    count: count !== undefined ? count : 0,
    objectType: objectType || null,
    objectId: objectId || null,
    rowKey: type === 'object' ? getObjectRowKey(objectType, objectId) : null
  });

  const rows = [];

  if (actualInputs.lifePlan) {
    const lifePlan = actualInputs.lifePlan;
    const objects = lifePlan.objects || [];

    // 1. Relationship / Household
    const people = objects.filter(o => o.type === 'person');
    rows.push(createRow({ type: 'category', id: 'relationship', parent: null, label: 'Relationship', icon: '❤️', count: people.length }));
    people.forEach(p => {
      rows.push(createRow({ type: 'object', id: p.id, parent: 'relationship', label: p.name, icon: '👤', objectType: p.type, objectId: p.id }));
    });

    // 2. Housing
    const properties = objects.filter(o => o.type === 'property');
    rows.push(createRow({ type: 'category', id: 'housing', parent: null, label: 'Housing', icon: '🏠', count: properties.length }));
    properties.forEach(p => {
      rows.push(createRow({ type: 'object', id: p.id, parent: 'housing', label: p.name, icon: '🏠', objectType: p.type, objectId: p.id }));
    });

    // 3. Children
    const children = objects.filter(o => o.type === 'child');
    rows.push(createRow({ type: 'category', id: 'children', parent: null, label: 'Children', icon: '👶', count: children.length }));
    children.forEach(c => {
      rows.push(createRow({ type: 'object', id: c.id, parent: 'children', label: c.name, icon: '👶', objectType: c.type, objectId: c.id }));
    });

    // 4. Jobs & Income
    const jobs = objects.filter(o => o.type === 'job');
    rows.push(createRow({ type: 'category', id: 'income', parent: null, label: 'Income', icon: '💼', count: jobs.length }));
    jobs.forEach(j => {
      rows.push(createRow({ type: 'object', id: j.id, parent: 'income', label: j.name, icon: '💼', objectType: j.type, objectId: j.id }));
    });

    // 5. Debt
    const debts = objects.filter(o => o.type === 'debt');
    rows.push(createRow({ type: 'category', id: 'debt', parent: null, label: 'Debt', icon: '💸', count: debts.length }));
    debts.forEach(d => {
      rows.push(createRow({ type: 'object', id: d.id, parent: 'debt', label: d.name, icon: '💸', objectType: d.type, objectId: d.id }));
    });

    // 6. Accounts / Assets
    const accounts = objects.filter(o => o.type === 'account' || o.type === 'business');
    rows.push(createRow({ type: 'category', id: 'assets', parent: null, label: 'Assets', icon: '🏦', count: accounts.length }));
    accounts.forEach(a => {
      rows.push(createRow({ type: 'object', id: a.id, parent: 'assets', label: a.name, icon: '🏦', objectType: a.type, objectId: a.id }));
    });

    // 7. Goals
    const goals = objects.filter(o => o.type === 'goal');
    rows.push(createRow({ type: 'category', id: 'goals', parent: null, label: 'Goals', icon: '🎯', count: goals.length }));
    goals.forEach(g => {
      rows.push(createRow({ type: 'object', id: g.id, parent: 'goals', label: g.name, icon: '🎯', objectType: g.type, objectId: g.id }));
    });

    // 8. Major Events
    rows.push(createRow({ type: 'category', id: 'major-events', parent: null, label: 'Major Events', icon: '⭐️', count: 0 }));

    return rows;
  }

  // Legacy fallback
  const children = getChildObjects(actualInputs);
  const housing = getHousingObjects(actualInputs);
  const income = getIncomeObjects(actualInputs);
  const debt = getDebtObjects(actualInputs);
  const education = getEducationObjects(actualInputs);

  // 1. Relationship
  rows.push(createRow({
    type: 'category',
    id: 'relationship',
    parent: null,
    label: 'Relationship',
    icon: '❤️',
    count: 0
  }));

  // 2. Housing
  rows.push(createRow({
    type: 'category',
    id: 'housing',
    parent: null,
    label: 'Housing',
    icon: '🏠',
    count: housing.length
  }));
  housing.forEach(h => {
    rows.push(createRow({
      type: 'object',
      id: h.id,
      parent: 'housing',
      label: h.name,
      icon: '🏠',
      objectType: 'housing',
      objectId: h.id
    }));
  });

  // 3. Children
  rows.push(createRow({
    type: 'category',
    id: 'children',
    parent: null,
    label: 'Children',
    icon: '👶',
    count: children.length
  }));
  children.forEach(c => {
    rows.push(createRow({
      type: 'object',
      id: c.id,
      parent: 'children',
      label: c.name,
      icon: '👶',
      objectType: 'child',
      objectId: c.id
    }));
  });

  // 4. Education
  rows.push(createRow({
    type: 'category',
    id: 'education',
    parent: null,
    label: 'Education',
    icon: '🎓',
    count: education.length
  }));
  education.forEach(e => {
    rows.push(createRow({
      type: 'object',
      id: e.id,
      parent: 'education',
      label: e.name,
      icon: '🎓',
      objectType: 'education',
      objectId: e.id
    }));
  });

  // 5. Debt
  rows.push(createRow({
    type: 'category',
    id: 'debt',
    parent: null,
    label: 'Debt',
    icon: '💸',
    count: debt.length
  }));
  debt.forEach(d => {
    rows.push(createRow({
      type: 'object',
      id: d.id,
      parent: 'debt',
      label: d.name,
      icon: '💸',
      objectType: 'debt',
      objectId: d.id
    }));
  });

  // 6. Income
  rows.push(createRow({
    type: 'category',
    id: 'income',
    parent: null,
    label: 'Income',
    icon: '💼',
    count: income.length
  }));
  income.forEach(inc => {
    rows.push(createRow({
      type: 'object',
      id: inc.id,
      parent: 'income',
      label: inc.name,
      icon: '💼',
      objectType: 'income',
      objectId: inc.id
    }));
  });

  // 7. Major Events
  rows.push(createRow({
    type: 'category',
    id: 'major-events',
    parent: null,
    label: 'Major Events',
    icon: '⭐️',
    count: 0
  }));

  // 8. Assets / Net Worth
  rows.push(createRow({
    type: 'category',
    id: 'assets',
    parent: null,
    label: 'Assets / Net Worth',
    icon: '📈',
    count: 0
  }));

  return rows;
}
