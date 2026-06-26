import { describe, it, expect } from 'vitest';
import { runFireSimulation } from './src/fireCalculations.js';
import { initializeLifePlanIfMissing, syncLifePlanWithInputs } from './src/models/lifePlan/lifePlanNormalization.js';
import { createMarriageEventObject, createSpouseRecord } from './src/domain/events/marriage/marriageEventFactory.js';

describe('Relationship Wizard Integration & Calculations', () => {
  const getBaseInputs = () => ({
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    simpleIncome: 80000,
    simpleInvestments: 100000,
    includeTaxes: true,
    filingStatus: 'single',
    useLifeProfile: true,
    preTaxSavingsRate: 15,
    lifeProfile: {
      household: { status: 'single', partnerIncome: 0 },
      assets: { brokerage: 100000 },
      children: [],
      debts: [],
      incomeSources: []
    },
    lifeEvents: []
  });

  describe('Filing Status & Tax Calculations', () => {
    it('applies married joint filing status ONLY for legal marriages', () => {
      // 1. Marriage Event
      const marriageEvent = {
        id: 'rel-marriage',
        type: 'marriage',
        relationshipType: 'married',
        enabled: true,
        age: 40,
        spouseCurrentAge: 35,
        spouseLifeExpectancy: 85,
        spouseIncome: 60000,
        cash: 10000,
        investments: 0,
        retirement: 0,
        debtStudent: 0,
        debtCredit: 0,
        debtOther: 0,
        savingsRate: 15,
        includeWeddingCost: false,
        weddingCost: 0,
        filingStatus: 'jointly',
        livingTogether: true,
        combineFinances: true
      };

      const marriedInputs = getBaseInputs();
      marriedInputs.lifeEvents = [marriageEvent];
      marriedInputs.householdMembers = [createSpouseRecord(marriageEvent, marriedInputs)];
      
      const marriedResults = runFireSimulation(marriedInputs);
      const marriedAge41 = marriedResults.nominalData.find(d => d.age === 41);

      // 2. Domestic Partnership Event
      const dpEvent = {
        ...marriageEvent,
        id: 'rel-dp',
        type: 'domesticPartnership',
        relationshipType: 'domestic_partnership',
        filingStatus: 'single' // domestic partners file single for federal income tax
      };

      const dpInputs = getBaseInputs();
      dpInputs.lifeEvents = [dpEvent];
      dpInputs.householdMembers = [createSpouseRecord(dpEvent, dpInputs)];

      const dpResults = runFireSimulation(dpInputs);
      const dpAge41 = dpResults.nominalData.find(d => d.age === 41);

      // Verify both have added the partner's income
      // Married total income = 80000 (user) + 60000 (spouse) + growth...
      // Both should have combined income
      expect(marriedAge41.income).toBeGreaterThan(130000);
      expect(dpAge41.income).toBeGreaterThan(130000);

      // Tax comparison: Joint filing status generally has lower/different tax brackets than Single filing status.
      // Domestic partnership tax status should remain single for each individual's portion or modeled taxes.
      // Let's assert that domestic partnership tax calculations are distinct from married joint tax calculations.
      expect(dpAge41.taxes).not.toEqual(marriedAge41.taxes);
    });
  });

  describe('Combine Finances vs Separate Finances', () => {
    it('zeros out spouse financials in simulation context if combineFinances is false', () => {
      const separateEvent = {
        id: 'rel-separate',
        type: 'relationshipBegins',
        relationshipType: 'partner',
        enabled: true,
        age: 40,
        spouseCurrentAge: 35,
        spouseLifeExpectancy: 85,
        spouseIncome: 60000,
        cash: 10000,
        investments: 20000,
        retirement: 30000,
        debtStudent: 10000,
        debtCredit: 0,
        debtOther: 0,
        savingsRate: 15,
        includeWeddingCost: false,
        weddingCost: 0,
        filingStatus: 'single',
        livingTogether: true,
        combineFinances: false // Model separate finances!
      };

      const separateInputs = getBaseInputs();
      separateInputs.lifeEvents = [separateEvent];
      separateInputs.householdMembers = [createSpouseRecord(separateEvent, separateInputs)];

      const results = runFireSimulation(separateInputs);

      // Since combineFinances is false:
      // 1. Partner assets (10k cash + 20k investments + 30k retirement = 60k) should NOT be injected.
      // 2. Partner income (60k) should NOT be added.
      // Let's check results at Age 41.
      const age41 = results.nominalData.find(d => d.age === 41);
      
      // Without partner income, total income at Age 41 should just be user's income (around 80k * growth)
      expect(age41.income).toBeLessThan(100000); // 80k plus growth is way less than 100k, whereas combined is ~140k
      
      // Let's verify that the base results (without relationship) match the separate results
      const baseResults = runFireSimulation(getBaseInputs());
      const baseAge41 = baseResults.nominalData.find(d => d.age === 41);
      
      expect(Math.round(age41.income)).toEqual(Math.round(baseAge41.income));
      expect(Math.round(age41.portfolio)).toEqual(Math.round(baseAge41.portfolio));
    });
  });

  describe('Normalization & Alignment', () => {
    it('normalizes domestic partnerships and partners/engaged events correctly into life plan objects', () => {
      const inputs = getBaseInputs();
      const dpEvent = {
        id: 'marriage-1',
        type: 'domesticPartnership',
        relationshipType: 'domestic_partnership',
        enabled: true,
        name: 'Domestic Partnership',
        age: 40,
        spouseCurrentAge: 35,
        spouseLifeExpectancy: 80,
        spouseIncome: 60000,
        filingStatus: 'single',
        livingTogether: true,
        combineFinances: true
      };
      inputs.lifeEvents = [dpEvent];

      const lifePlan = initializeLifePlanIfMissing(inputs);
      expect(lifePlan).not.toBeNull();

      const partner = lifePlan.objects.find(o => o.type === 'person' && o.role === 'partner');
      expect(partner).toBeDefined();
      expect(partner.status).toBe('domestic_partnership');

      const relationship = lifePlan.objects.find(o => o.type === 'relationship');
      expect(relationship).toBeDefined();
      expect(relationship.relationshipType).toBe('domesticPartnership');
      expect(relationship.taxFilingStatusDuringRelationship).toBe('single');
    });
  });
});
