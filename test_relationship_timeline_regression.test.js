import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getTimelineItems } from './src/models/lifeTimeline/timelineSelectors.js';
import { buildTimelineRows } from './src/utils/timelineRowBuilder.js';
import { createMarriageEventObject, createSpouseRecord } from './src/domain/events/marriage/marriageEventFactory.js';

describe('Relationship Timeline Regression', () => {
  test('generalizes marriage to domestic partnership and relationship begins for timeline selectors', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      useLifeProfile: false,
      filingStatus: 'single',
      lifeEvents: [
        { id: 'dp-1', type: 'domesticPartnership', age: 38, enabled: true, spouseName: 'Alex' }
      ]
    };
    
    const items = getTimelineItems(inputs);
    
    // Check points and status periods
    const pointEvent = items.find(item => item.id === 'event-domesticpartnership-point-dp-1');
    expect(pointEvent).toBeDefined();
    expect(pointEvent.age).toBe(38);
    
    const singleStatus = items.find(item => item.id === 'status-relationship-single');
    expect(singleStatus).toBeDefined();
    expect(singleStatus.endAge).toBe(38);
    
    const partneredStatus = items.find(item => item.id === 'status-relationship-married');
    expect(partneredStatus).toBeDefined();
    expect(partneredStatus.startAge).toBe(38);
    expect(partneredStatus.endAge).toBeNull();
  });

  test('generalizes marriage to relationship begins for timeline selectors', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      useLifeProfile: false,
      filingStatus: 'single',
      lifeEvents: [
        { id: 'rel-1', type: 'relationshipBegins', age: 40, enabled: true, spouseName: 'Sam' }
      ]
    };
    
    const items = getTimelineItems(inputs);
    
    const pointEvent = items.find(item => item.id === 'event-relationshipbegins-point-rel-1');
    expect(pointEvent).toBeDefined();
    expect(pointEvent.age).toBe(40);
    
    const singleStatus = items.find(item => item.id === 'status-relationship-single');
    expect(singleStatus).toBeDefined();
    expect(singleStatus.endAge).toBe(40);
    
    const partneredStatus = items.find(item => item.id === 'status-relationship-married');
    expect(partneredStatus).toBeDefined();
    expect(partneredStatus.startAge).toBe(40);
  });

  test('buildTimelineRows recognizes domestic partnership and relationship begins events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      useLifeProfile: false,
      lifeEvents: [
        { id: 'dp-1', type: 'domesticPartnership', age: 38, enabled: true, spouseName: 'Alex' }
      ]
    };
    
    const rows = buildTimelineRows(inputs);
    
    // Check if the spouse-partner row is created
    const spousePartnerRow = rows.find(r => r.id === 'spouse-partner');
    expect(spousePartnerRow).toBeDefined();
    expect(spousePartnerRow.label).toBe('Alex');
    
    // Verify relationship category row has positive count
    const relationshipRow = rows.find(r => r.id === 'relationship');
    expect(relationshipRow).toBeDefined();
    expect(relationshipRow.count).toBe(1);
  });
});
