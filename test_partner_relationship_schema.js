import { describe, it, expect } from 'vitest';
import { syncLifePlanWithInputs, initializeLifePlanIfMissing, deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';
import { getActiveObjectsAtAge, getRelationshipAtAge } from './src/models/lifePlan/lifePlanSelectors.js';
import { getTimelineItems } from './src/models/lifeTimeline/timelineSelectors.js';
import { buildTimelineRows } from './src/utils/timelineRowBuilder.js';

describe('Partner Person and Relationship Schema', () => {
  const getBaseInputs = () => ({
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    simpleIncome: 80000,
    simpleInvestments: 100000,
    includeTaxes: true,
    filingStatus: 'single',
    useLifeProfile: true,
    lifeProfile: {
      household: { status: 'single', partnerIncome: 0 },
      assets: { brokerage: 100000 },
      children: [],
      debts: [],
      incomeSources: []
    },
    lifeEvents: [
      {
        id: 'marriage-1',
        type: 'marriage',
        enabled: true,
        name: 'Marriage Event',
        age: 40,
        spouseCurrentAge: 35,
        spouseLifeExpectancy: 80,
        spouseIncome: 60000,
        filingStatus: 'jointly'
      }
    ]
  });

  describe('Initialization and Normalization', () => {
    it('creates and preserves partner person and relationship objects with startsAtAge and endsAtAge', () => {
      const inputs = getBaseInputs();
      
      // Initialize life plan
      const lifePlan = initializeLifePlanIfMissing(inputs);
      expect(lifePlan).not.toBeNull();

      // Because marriage event exists at age 40, it should synchronize the partner and relationship objects
      const partner = lifePlan.objects.find(o => o.type === 'person' && o.role === 'partner');
      expect(partner).toBeDefined();
      expect(partner.id).toBe('spouse-partner');
      expect(partner.startsAtAge).toBe(40);
      expect(partner.endsAtAge).toBe(80);
      expect(partner.status).toBe('married');
      expect(partner.metadata?.createdFromEventId).toBe('marriage-1');
      expect(partner.properties?.partnerIncome).toBe(60000);
      expect(partner.properties?.spouseCurrentAge).toBe(35);
      expect(partner.properties?.spouseLifeExpectancy).toBe(80);

      // Verify deterministic relationship object exists
      const expectedRelId = 'relationship_self-person_spouse-partner';
      const relationship = lifePlan.objects.find(o => o.type === 'relationship');
      expect(relationship).toBeDefined();
      expect(relationship.id).toBe(expectedRelId);
      expect(relationship.relationshipType).toBe('marriage');
      expect(relationship.participantIds).toEqual(['self-person', 'spouse-partner']);
      expect(relationship.startsAtAge).toBe(40);
      expect(relationship.endsAtAge).toBeNull();
      expect(relationship.taxFilingStatusDuringRelationship).toBe('marriedJointly');
      expect(relationship.sharedBudgetMode).toBe('combined');
      expect(relationship.metadata?.createdFromEventId).toBe('marriage-1');

      // Verify that running syncLifePlanWithInputs again preserves these objects without duplication
      const syncedPlan = syncLifePlanWithInputs(JSON.parse(JSON.stringify(lifePlan)), inputs);
      const partnersAfterSync = syncedPlan.objects.filter(o => o.type === 'person' && o.role === 'partner');
      const relsAfterSync = syncedPlan.objects.filter(o => o.type === 'relationship');
      
      expect(partnersAfterSync.length).toBe(1);
      expect(relsAfterSync.length).toBe(1);
      expect(relsAfterSync[0].id).toBe(expectedRelId);
    });

    it('creates deterministic relationship ID if partner has a non-spouse-partner ID', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);
      
      // Manually replace partner with a custom ID
      lifePlan.objects = lifePlan.objects.filter(o => o.id !== 'spouse-partner');
      lifePlan.objects.push({
        id: 'person_partner_1',
        type: 'person',
        role: 'partner',
        name: 'Spouse',
        startsAtAge: 40,
        endsAtAge: 85,
        status: 'married',
        properties: { role: 'partner' }
      });

      const syncedPlan = syncLifePlanWithInputs(lifePlan, inputs);
      const relationship = syncedPlan.objects.find(o => o.type === 'relationship');
      expect(relationship).toBeDefined();
      expect(relationship.id).toBe('relationship_self-person_person_partner_1');
      expect(relationship.participantIds).toEqual(['self-person', 'person_partner_1']);
    });
  });

  describe('Selectors', () => {
    it('getActiveObjectsAtAge respects startsAtAge and endsAtAge for partner', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);

      // Partner starts at age 40, ends at 85
      const activeAt35 = getActiveObjectsAtAge(lifePlan, 35);
      expect(activeAt35.some(o => o.type === 'person' && o.role === 'partner')).toBe(false);

      const activeAt40 = getActiveObjectsAtAge(lifePlan, 40);
      expect(activeAt40.some(o => o.type === 'person' && o.role === 'partner')).toBe(true);

      const activeAt85 = getActiveObjectsAtAge(lifePlan, 85);
      expect(activeAt85.some(o => o.type === 'person' && o.role === 'partner')).toBe(false);
    });

    it('getRelationshipAtAge respects startsAtAge and root status', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);

      // Single before 40, married at 40
      expect(getRelationshipAtAge(lifePlan, 39)).toBe('single');
      expect(getRelationshipAtAge(lifePlan, 40)).toBe('married');
    });
  });

  describe('Timeline skipped rendering', () => {
    it('excludes relationship objects and self-person from timeline items, but includes partner person', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);
      const effectiveInputs = { ...inputs, lifePlan };

      const timelineItems = getTimelineItems(effectiveInputs);
      
      // Relationship objects should not be mapped to timeline periods or points
      const relItems = timelineItems.filter(item => item.objectType === 'relationship' || item.sourceId?.startsWith('relationship'));
      expect(relItems.length).toBe(0);

      // Self person should be skipped
      const selfItems = timelineItems.filter(item => item.objectType === 'person' && (item.metadata?.role === 'self' || item.id === 'self-person'));
      expect(selfItems.length).toBe(0);

      // Partner person object should render under period categories
      const partnerItems = timelineItems.filter(item => item.objectType === 'person' && item.metadata?.role === 'partner');
      expect(partnerItems.length).toBe(1);
      expect(partnerItems[0].startAge).toBe(40);
    });

    it('excludes relationship objects and self-person from timeline rows, but includes partner person', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);
      const effectiveInputs = { ...inputs, lifePlan };

      const rows = buildTimelineRows(effectiveInputs);

      // Should not have a row with relationship object type
      const relRow = rows.find(r => r.objectType === 'relationship');
      expect(relRow).toBeUndefined();

      // Should not have self-person row
      const selfRow = rows.find(r => r.objectType === 'person' && r.id === 'self-person');
      expect(selfRow).toBeUndefined();

      // Should have partner person row
      const partnerRow = rows.find(r => r.objectType === 'person' && r.id === 'spouse-partner');
      expect(partnerRow).toBeDefined();
    });
  });

  describe('Legacy Parsing Compatibility', () => {
    it('correctly derives legacy inputs from new partner person shape', () => {
      const inputs = getBaseInputs();
      const lifePlan = initializeLifePlanIfMissing(inputs);

      const legacy = deriveLegacyInputsFromLifePlan(lifePlan, inputs);
      expect(legacy.lifeProfile?.household?.status).toBe('married');
      expect(legacy.lifeProfile?.household?.partnerAge).toBe(35);
      expect(legacy.lifeProfile?.household?.partnerLifeExpectancy).toBe(80);

      // Derived marriage event is created correctly
      const mEvent = legacy.lifeEvents.find(e => e.type === 'marriage');
      expect(mEvent).toBeDefined();
      expect(mEvent.age).toBe(40);
      expect(mEvent.spouseIncome).toBe(60000);
    });
  });
});
