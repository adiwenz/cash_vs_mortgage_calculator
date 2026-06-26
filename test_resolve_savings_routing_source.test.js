import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { getLifeSnapshotAtAge } from './src/models/lifeTimeline/lifeSnapshotSelectors.js';
import { buildEffectiveSimulationInputs } from './src/calculators/fire/effectiveInputs.js';
import { normalizeInputsStage } from './src/calculators/fire/pipeline/normalizeInputs.js';
import {
  resolveSavingsRoutingSource,
  hasExplicitAllocationRules
} from './src/calculators/fire/simulation/resolveSavingsRoutingSource.js';
import { runFireSimulation } from './src/calculators/fire/index.js';

describe('Savings Routing Source Resolver & Input Pipeline', () => {
  test('1. getLifeSnapshotAtAge({}) returns annualIncome 0 and housingStatus null', () => {
    const snapshot = getLifeSnapshotAtAge({}, 40);
    expect(snapshot.income.annualIncome).toBe(0);
    expect(snapshot.housingStatus).toBeNull();
  });

  test('2. Minimal own-home profile preserves housingStatus own', () => {
    const inputs = {
      lifeProfile: {
        home: { status: 'own' }
      }
    };
    const snapshot = getLifeSnapshotAtAge(inputs, 40);
    expect(snapshot.housingStatus).toBe('own');
  });

  test('3. Future income change does not double-count base profile income plus event income', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      simpleIncome: 50000,
      inflationRate: 0,
      lifeEvents: [
        {
          id: 'career-change',
          type: 'incomeItem',
          name: 'Career Change',
          startAge: 40,
          endAge: 65,
          amount: 60000,
          growthRate: 0.0,
          enabled: true
        }
      ]
    };
    const results = runFireSimulation(inputs);
    const pointAt40 = results.nominalData.find(d => d.age === 40);
    expect(pointAt40.income).toBe(60000);
  });

  test('4. buildEffectiveSimulationInputs does not overwrite non-empty lifeProfile.incomeSources or lifeProfile.assets', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      useLifeProfile: true,
      lifeProfile: {
        ...DEFAULT_FIRE_INPUTS.lifeProfile,
        incomeSources: [{ id: 'custom-inc', name: 'Freelance', amount: 10000 }],
        assets: { cash: 5000, brokerage: 25000 }
      }
    };
    const effective = buildEffectiveSimulationInputs(inputs);
    expect(effective.lifeProfile.incomeSources[0]).toMatchObject({ id: 'custom-inc', name: 'Freelance', amount: 10000 });
    expect(effective.lifeProfile.assets.cash).toBe(5000);
    expect(effective.lifeProfile.assets.brokerage).toBe(25000);
  });

  test('5. Default alloc-surplus does not trigger advanced routing', () => {
    const inputs = {
      allocationRules: [
        {
          id: 'alloc-surplus',
          destination: 'brokerage',
          type: 'percentSurplus',
          value: 100
        }
      ]
    };
    expect(hasExplicitAllocationRules(inputs)).toBe(false);
    expect(resolveSavingsRoutingSource(inputs)).toBe('default_fallback');
  });

  test('6. budgetDetails.savings is honored when no explicit allocation rules exist', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      budgetDetails: {
        savings: {
          checking: 500
        }
      }
    };
    expect(resolveSavingsRoutingSource(inputs)).toBe('budget_savings');
  });

  test('7. Original allocationRules are not mutated by the routing resolver', () => {
    const inputs = {
      allocationRules: [
        {
          id: 'alloc-surplus',
          destination: 'brokerage',
          type: 'percentSurplus',
          value: 100
        }
      ],
      budgetDetails: {
        savings: {
          checking: 500
        }
      }
    };
    Object.freeze(inputs);
    Object.freeze(inputs.allocationRules);
    Object.freeze(inputs.allocationRules[0]);

    expect(() => resolveSavingsRoutingSource(inputs)).not.toThrow();
    expect(inputs.allocationRules[0].id).toBe('alloc-surplus');
  });

  test('8. Empty/minimal snapshot inputs return housingStatus === null', () => {
    const snapshot = getLifeSnapshotAtAge({}, 35);
    expect(snapshot.housingStatus).toBeNull();
  });

  test('9. New-user initialized inputs still default to renting', () => {
    expect(DEFAULT_FIRE_INPUTS.housingStatus).toBe('rent');
    const snapshot = getLifeSnapshotAtAge(DEFAULT_FIRE_INPUTS, 35);
    expect(snapshot.housingStatus).toBe('rent');
  });

  test('10. Account-type mapping occurs in the new canonical simulation-input pipeline', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      budgetDetails: {
        savings: {
          cash: 100,
          emergencyFund: 200,
          brokerage: 300
        }
      }
    };
    const normalized = normalizeInputsStage(inputs);
    expect(normalized.budgetDetails.savings.cash).toBeUndefined();
    expect(normalized.budgetDetails.savings.emergencyFund).toBeUndefined();
    expect(normalized.budgetDetails.savings.checking).toBe(100);
    expect(normalized.budgetDetails.savings.emergency).toBe(200);
    expect(normalized.budgetDetails.savings.brokerage).toBe(300);
  });
});
