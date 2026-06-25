import { describe, test, expect } from 'vitest';
import { deriveLegacyInputsFromLifePlan } from './src/models/lifePlan/lifePlanNormalization.js';
import { getTimelineItems } from './src/models/lifeTimeline/timelineSelectors.js';
import { getActiveDebtsForAge } from './src/calculators/fire/debts.js';

describe('Phase 2 Object-Native Timeline and Event Mutations', () => {
  test('Job salary segmentation with raises and end events', () => {
    const lifePlan = {
      currentAge: 35,
      lifeExpectancy: 85,
      objects: [
        {
          id: 'job-1',
          type: 'job',
          name: 'Software Engineer',
          startAge: 35,
          endAge: 65,
          properties: {
            annualIncome: 100000,
            growthRate: 3
          }
        }
      ],
      events: [
        {
          id: 'raise-1',
          objectId: 'job-1',
          type: 'job.raise',
          age: 40,
          mutation: { annualIncome: 120000 }
        },
        {
          id: 'raise-2',
          objectId: 'job-1',
          type: 'job.raise',
          age: 50,
          mutation: { raiseAmount: 30000 } // raises salary to 150000
        },
        {
          id: 'end-1',
          objectId: 'job-1',
          type: 'job.end',
          age: 60
        }
      ]
    };

    const derived = deriveLegacyInputsFromLifePlan(lifePlan);
    expect(derived.incomeList.length).toBe(3);

    // Segment 1: age 35 to 40, salary = 100000
    const s1 = derived.incomeList.find(i => i.startAge === 35 && i.endAge === 40);
    expect(s1).toBeDefined();
    expect(s1.amount).toBe(100000);

    // Segment 2: age 40 to 50, salary = 120000
    const s2 = derived.incomeList.find(i => i.startAge === 40 && i.endAge === 50);
    expect(s2).toBeDefined();
    expect(s2.amount).toBe(120000);

    // Segment 3: age 50 to 60, salary = 150000
    const s3 = derived.incomeList.find(i => i.startAge === 50 && i.endAge === 60);
    expect(s3).toBeDefined();
    expect(s3.amount).toBe(150000);
  });

  test('Debt custom payoffAge and getActiveDebtsForAge override', () => {
    const lifePlan = {
      currentAge: 35,
      lifeExpectancy: 85,
      objects: [
        {
          id: 'debt-1',
          type: 'debt',
          name: 'Student Loan',
          startAge: 35,
          properties: {
            debtType: 'student',
            balance: 50000,
            interestRate: 5,
            monthlyPayment: 500
          }
        }
      ],
      events: [
        {
          id: 'payoff-1',
          objectId: 'debt-1',
          type: 'debt.payoff',
          age: 40
        }
      ]
    };

    const derived = deriveLegacyInputsFromLifePlan(lifePlan);
    const debt = derived.debtList.find(d => d.id === 'debt-1');
    expect(debt).toBeDefined();
    expect(debt.payoffAge).toBe(40);

    // Verify simulation logic respects custom payoffAge
    const activeAt39 = getActiveDebtsForAge(derived, derived.lifeEvents, 39);
    expect(activeAt39.some(d => d.id === 'debt-1')).toBe(true);

    const activeAt40 = getActiveDebtsForAge(derived, derived.lifeEvents, 40);
    expect(activeAt40.some(d => d.id === 'debt-1')).toBe(false);
  });

  test('Account contribution change boundaries and budget phase overrides', () => {
    const lifePlan = {
      currentAge: 35,
      lifeExpectancy: 85,
      objects: [
        {
          id: 'account-brokerage',
          type: 'account',
          name: 'Brokerage',
          startAge: 35,
          properties: {
            accountType: 'brokerage',
            currentBalance: 5000,
            contributionAmount: 500
          }
        }
      ],
      events: [
        {
          id: 'contrib-change-1',
          objectId: 'account-brokerage',
          type: 'account.contributionChange',
          age: 45,
          mutation: { contributionAmount: 1000 }
        }
      ]
    };

    const derived = deriveLegacyInputsFromLifePlan(lifePlan);
    expect(derived.budgetDetails.phases.length).toBeGreaterThan(0);

    const phase1 = derived.budgetDetails.phases.find(p => p.startAge === 35 && p.endAge === 45);
    expect(phase1).toBeDefined();
    expect(phase1.savings.brokerage).toBe(500);

    const phase2 = derived.budgetDetails.phases.find(p => p.startAge === 45 && p.endAge === 65);
    expect(phase2).toBeDefined();
    expect(phase2.savings.brokerage).toBe(1000);
  });

  test('getTimelineItems produces object-native items when inputs.lifePlan is present', () => {
    const inputs = {
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Software Engineer',
            startAge: 35,
            endAge: 65,
            properties: { annualIncome: 100000 }
          }
        ],
        events: [
          {
            id: 'raise-1',
            objectId: 'job-1',
            type: 'job.raise',
            age: 40
          }
        ]
      }
    };

    const items = getTimelineItems(inputs);
    expect(items.length).toBe(2);

    const jobPeriod = items.find(i => i.kind === 'period' && i.id === 'job-1');
    expect(jobPeriod).toBeDefined();
    expect(jobPeriod.startAge).toBe(35);
    expect(jobPeriod.endAge).toBe(65);
    expect(jobPeriod.category).toBe('income');

    const raisePoint = items.find(i => i.kind === 'point' && i.id === 'raise-1');
    expect(raisePoint).toBeDefined();
    expect(raisePoint.age).toBe(40);
    expect(raisePoint.category).toBe('income');
  });
});
