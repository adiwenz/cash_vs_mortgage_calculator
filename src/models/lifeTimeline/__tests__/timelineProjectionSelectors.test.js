import { describe, test, expect } from 'vitest';
import { getTimelineProjection } from '../timelineProjectionSelectors.js';
import { getLifeSnapshotAtAge } from '../lifeSnapshotSelectors.js';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';

describe('timelineProjectionSelectors', () => {
  test('1. Empty/null inputs return a safe projection with rows', () => {
    const projection = getTimelineProjection(null);
    expect(projection).toBeDefined();
    expect(projection.currentAge).toBe(35);
    expect(projection.minAge).toBe(35);
    expect(projection.maxAge).toBeGreaterThanOrEqual(85);
    expect(projection.rows).toHaveLength(8);
    expect(projection.rows[0].id).toBe('relationship');
    expect(projection.rows[7].id).toBe('assets');
  });

  test('2. Current age is inferred safely', () => {
    const inputs1 = { currentAge: 40 };
    expect(getTimelineProjection(inputs1).currentAge).toBe(40);

    const inputs2 = { age: 42 };
    expect(getTimelineProjection(inputs2).currentAge).toBe(42);

    const inputs3 = {
      householdModel: { people: { self: { demographics: { currentAge: 45 } } } }
    };
    expect(getTimelineProjection(inputs3).currentAge).toBe(45);
  });

  test('3. Future marriage event appears in Relationship row and upcomingMilestones', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        {
          id: 'marriage-event-1',
          type: 'marriage',
          name: 'Wedding',
          age: 40,
          enabled: true
        }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const relRow = projection.rows.find(r => r.id === 'relationship');
    expect(relRow).toBeDefined();
    
    // Check if marriage event is in items
    const marriageItem = relRow.items.find(item => item.sourceId === 'marriage-event-1' && item.type === 'point');
    expect(marriageItem).toBeDefined();
    expect(marriageItem.title).toBe('Wedding');
    expect(marriageItem.age).toBe(40);

    // Check if marriage event is in upcoming milestones
    const milestone = projection.upcomingMilestones.find(m => m.sourceId === 'marriage-event-1');
    expect(milestone).toBeDefined();
    expect(milestone.age).toBe(40);
    expect(milestone.category).toBe('relationship');
  });

  test('4. Future home purchase appears in Housing row and upcomingMilestones', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        {
          id: 'buyhouse-event-1',
          type: 'buyHouse',
          name: 'Beach House',
          age: 45,
          homePrice: 500000,
          downPayment: 100000,
          enabled: true
        }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const housingRow = projection.rows.find(r => r.id === 'housing');
    expect(housingRow).toBeDefined();

    const buyItem = housingRow.items.find(item => item.sourceId === 'buyhouse-event-1' && item.type === 'point');
    expect(buyItem).toBeDefined();
    expect(buyItem.title).toBe('Beach House');
    expect(buyItem.age).toBe(45);

    const milestone = projection.upcomingMilestones.find(m => m.sourceId === 'buyhouse-event-1');
    expect(milestone).toBeDefined();
    expect(milestone.age).toBe(45);
    expect(milestone.category).toBe('housing');
  });

  test('5. Child event appears in Children row', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 30,
      lifeEvents: [
        {
          id: 'child-event-1',
          type: 'haveChild',
          name: 'First Child',
          age: 32,
          enabled: true
        }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const childrenRow = projection.rows.find(r => r.id === 'children');
    expect(childrenRow).toBeDefined();

    const childItem = childrenRow.items.find(item => item.sourceId === 'child-event-1' && item.type === 'point');
    expect(childItem).toBeDefined();
    expect(childItem.title).toBe('First Child');
  });

  test('6. Income change appears in Income row', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        {
          id: 'incomechange-event-1',
          type: 'incomeChange',
          name: 'Big Promotion',
          age: 38,
          enabled: true
        }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const incomeRow = projection.rows.find(r => r.id === 'income');
    expect(incomeRow).toBeDefined();

    const incomeItem = incomeRow.items.find(item => item.sourceId === 'incomechange-event-1' && item.type === 'point');
    expect(incomeItem).toBeDefined();
    expect(incomeItem.title).toBe('Big Promotion');
  });

  test('7. Unsupported event with an age appears in Major Events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        {
          id: 'random-event-1',
          type: 'winLottery',
          name: 'Lottery Windfall',
          age: 50,
          enabled: true
        }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const majorRow = projection.rows.find(r => r.id === 'major-events');
    expect(majorRow).toBeDefined();

    const unknownItem = majorRow.items.find(item => item.sourceId === 'random-event-1' && item.type === 'point');
    expect(unknownItem).toBeDefined();
    expect(unknownItem.title).toBe('Lottery Windfall');
  });

  test('8. Rows are returned in stable order', () => {
    const projection = getTimelineProjection(null);
    const ids = projection.rows.map(r => r.id);
    expect(ids).toEqual([
      'relationship',
      'housing',
      'children',
      'education',
      'debt',
      'income',
      'major-events',
      'assets'
    ]);
  });

  test('9. Upcoming milestones are sorted by age', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'ev-1', type: 'marriage', age: 42, enabled: true },
        { id: 'ev-2', type: 'buyHouse', age: 38, enabled: true },
        { id: 'ev-3', type: 'windfall', age: 50, enabled: true }
      ]
    };
    const projection = getTimelineProjection(inputs);
    const ages = projection.upcomingMilestones.map(m => m.age);
    expect(ages).toEqual([38, 42, 50]);
  });

  test('10. Function does not mutate inputs', () => {
    const inputs = {
      currentAge: 35,
      lifeEvents: [{ type: 'marriage', age: 40, enabled: true }]
    };
    const inputsStr = JSON.stringify(inputs);
    getTimelineProjection(inputs);
    expect(JSON.stringify(inputs)).toBe(inputsStr);
  });

  test('11. Consistency requirement: Timeline projection and Life Snapshot must agree', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        {
          id: 'marriage-event',
          type: 'marriage',
          age: 40,
          enabled: true
        }
      ]
    };

    // 1. At age 45, relationship status in Life Snapshot is married
    const snapshot45 = getLifeSnapshotAtAge(inputs, 45);
    expect(snapshot45.relationshipStatus).toBe('married');

    // 2. Timeline projection contains a Married status period active at age 45
    const projection = getTimelineProjection(inputs);
    const relRow = projection.rows.find(r => r.id === 'relationship');
    const marriedPeriod = relRow.items.find(item => item.title === 'Married' && item.type === 'period');
    expect(marriedPeriod).toBeDefined();
    expect(marriedPeriod.startAge).toBe(40);
    expect(marriedPeriod.endAge).toBeNull();
  });
});
