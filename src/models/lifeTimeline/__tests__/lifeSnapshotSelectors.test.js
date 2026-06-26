import { describe, test, expect } from 'vitest';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';
import { getLifeSnapshotAtAge, getLifeSnapshotFromLifePlan } from '../lifeSnapshotSelectors.js';
import { runFireSimulation } from '../../../calculators/fire/index.js';
import { initializeLifePlanIfMissing } from '../../lifePlan/lifePlanNormalization.js';

describe('lifeSnapshotSelectors', () => {
  test('getLifeSnapshotAtAge safely handles empty or minimal inputs', () => {
    const snapshot = getLifeSnapshotAtAge({}, 40);
    
    expect(snapshot).toBeDefined();
    expect(snapshot.age).toBe(40);
    expect(snapshot.currentAge).toBe(35); // Safe default fallback
    expect(snapshot.relationshipStatus).toBe('single');
    expect(snapshot.housingStatus).toBe('rent');
    expect(snapshot.people.self).toBeDefined();
    expect(snapshot.people.self.currentAge).toBe(40);
    expect(snapshot.people.partner).toBeNull();
    expect(snapshot.children).toEqual([]);
    expect(snapshot.income.annualIncome).toBe(0);
    expect(snapshot.debts.activeDebts).toEqual([]);
    expect(snapshot.assets.investedAssets).toBe(0);
  });

  test('getLifeSnapshotAtAge returns current relationship status', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'single',
      useLifeProfile: false
    };
    const snapshot = getLifeSnapshotAtAge(inputs, 35);
    expect(snapshot.relationshipStatus).toBe('single');

    const inputsMarried = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'married',
      useLifeProfile: false
    };
    const snapshotMarried = getLifeSnapshotAtAge(inputsMarried, 35);
    expect(snapshotMarried.relationshipStatus).toBe('married');
    expect(snapshotMarried.people.partner).toBeDefined();
    expect(snapshotMarried.people.partner.currentAge).toBe(35);
  });

  test('getLifeSnapshotAtAge returns future married status after marriage event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      filingStatus: 'single',
      useLifeProfile: false,
      lifeEvents: [
        { id: 'marriage-1', type: 'marriage', age: 38, enabled: true, spouseIncome: 50000 }
      ]
    };
    
    // Age 37: Single
    const snapshot37 = getLifeSnapshotAtAge(inputs, 37);
    expect(snapshot37.relationshipStatus).toBe('single');
    expect(snapshot37.people.partner).toBeNull();

    // Age 38: Married
    const snapshot38 = getLifeSnapshotAtAge(inputs, 38);
    expect(snapshot38.relationshipStatus).toBe('married');
    expect(snapshot38.people.partner).toBeDefined();
    expect(snapshot38.people.partner.currentAge).toBe(38);
  });

  test('getLifeSnapshotAtAge returns future homeowner status after home purchase event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      lifeEvents: [
        { id: 'buy-house-1', type: 'buyHouse', age: 42, homePrice: 400000, downPayment: 80000, loanTerm: 30, enabled: true }
      ]
    };
    
    // Age 41: Renting
    const snapshot41 = getLifeSnapshotAtAge(inputs, 41);
    expect(snapshot41.housingStatus).toBe('rent');
    expect(snapshot41.debts.activeDebts.some(d => d.type === 'mortgage')).toBe(false);

    // Age 42: Homeowner and active Mortgage
    const snapshot42 = getLifeSnapshotAtAge(inputs, 42);
    expect(snapshot42.housingStatus).toBe('own');
    expect(snapshot42.debts.activeDebts.some(d => d.type === 'mortgage')).toBe(true);
  });

  test('getLifeSnapshotAtAge does not require simulation results and safely returns structural state only', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: false,
      assets: {
        brokerage: 10000,
        cash: 2000
      }
    };
    const lifePlan = initializeLifePlanIfMissing(inputs);
    const snapshot = getLifeSnapshotFromLifePlan(lifePlan, 50); // No third argument (originalInputs)
    
    // Invested assets should equal starting baseline assets
    expect(snapshot.assets.investedAssets).toBe(12000);
  });

  test('getLifeSnapshotAtAge does not mutate inputs', () => {
    const inputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
    Object.freeze(inputs);
    
    expect(() => getLifeSnapshotAtAge(inputs, 45)).not.toThrow();
  });

  test('getLifeSnapshotAtAge infers currentAge from legacy fields', () => {
    const inputs1 = { age: 40 };
    expect(getLifeSnapshotAtAge(inputs1, 45).currentAge).toBe(40);

    const inputs2 = {
      householdModel: {
        people: {
          self: {
            age: 42
          }
        }
      }
    };
    expect(getLifeSnapshotAtAge(inputs2, 45).currentAge).toBe(42);

    const inputs3 = {
      householdModel: {
        people: {
          self: {
            demographics: {
              currentAge: 44
            }
          }
        }
      }
    };
    expect(getLifeSnapshotAtAge(inputs3, 45).currentAge).toBe(44);
  });

  test('getLifeSnapshotAtAge extracts partner and calculates their age correctly', () => {
    const inputs = {
      currentAge: 35,
      filingStatus: 'married',
      householdModel: {
        people: {
          partner: {
            role: 'partner',
            displayName: 'My Spouse',
            currentAge: 38
          }
        }
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 45);
    expect(snapshot.relationshipStatus).toBe('married');
    expect(snapshot.people.partner).toBeDefined();
    expect(snapshot.people.partner.displayName).toBe('My Spouse');
    expect(snapshot.people.partner.currentAge).toBe(48); // 38 + (45 - 35)
  });

  test('getLifeSnapshotAtAge sums annualIncome and falls back correctly', () => {
    const inputsNoIncomeList = {
      currentAge: 35,
      simpleIncome: 100000,
      salaryGrowthRate: 0,
      inflationRate: 0
    };
    const snapshotNoList = getLifeSnapshotAtAge(inputsNoIncomeList, 40);
    expect(Math.round(snapshotNoList.income.annualIncome)).toBe(115927);

    const inputsWithIncomeList = {
      currentAge: 35,
      inflationRate: 0,
      isAdvancedMode: true,
      incomeList: [
        { id: 'inc-1', name: 'Salary', amount: 80000, startAge: 35, endAge: 65, growthRate: 0 }
      ],
      socialSecurity: { enabled: false }
    };
    const snapshotWithList = getLifeSnapshotAtAge(inputsWithIncomeList, 40);
    expect(snapshotWithList.income.annualIncome).toBe(80000);

    // Active at 40, but retired at 70 (activeIncomeItems is empty, so falls back to 0)
    const snapshotRetired = getLifeSnapshotAtAge(inputsWithIncomeList, 70);
    expect(snapshotRetired.income.annualIncome).toBe(0);
  });

  test('getLifeSnapshotAtAge derives activeDebts from active periods', () => {
    const inputs = {
      currentAge: 35,
      debtList: [
        { id: 'debt-1', name: 'Student Loan', balance: 20000, interestRate: 5.0, payment: 200, frequency: 'monthly', startAge: 35 }
      ]
    };

    // Active at 40
    const snapshot40 = getLifeSnapshotAtAge(inputs, 40);
    expect(snapshot40.debts.activeDebts.length).toBe(1);
    expect(snapshot40.debts.activeDebts[0].name).toBe('Student Loan');
    expect(snapshot40.debts.activeDebts[0].monthlyPayment).toBe(200);

    // Inactive at 70 (amortized loan payoff age is calculated to be before age 70)
    const snapshot70 = getLifeSnapshotAtAge(inputs, 70);
    expect(snapshot70.debts.activeDebts.length).toBe(0);
  });

  test('getLifeSnapshotAtAge returns current housing status', () => {
    const inputsOwn = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        home: { status: 'own', homeValue: 300000, mortgageBalance: 150000, monthlyPayment: 1000 }
      }
    };
    const snapshotOwn = getLifeSnapshotAtAge(inputsOwn, 35);
    expect(snapshotOwn.housingStatus).toBe('own');

    const inputsRent = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        home: { status: 'rent', monthlyRent: 2000 }
      }
    };
    const snapshotRent = getLifeSnapshotAtAge(inputsRent, 35);
    expect(snapshotRent.housingStatus).toBe('rent');
  });

  test('getLifeSnapshotAtAge returns future annual income after an income change event', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeProfile: {
        incomeSources: [
          { id: 'inc-1', name: 'Salary', amount: 50000, startAge: 35, endAge: 45 }
        ]
      },
      lifeEvents: [
        { id: 'inc-change', type: 'careerChange', name: 'New Job', startAge: 45, amount: 80000, endAge: 65, enabled: true, growthRate: 0.03 }
      ]
    };

    // Age 40: Should be original salary with 3% growth
    const snapshot40 = getLifeSnapshotAtAge(inputs, 40);
    expect(Math.round(snapshot40.income.annualIncome)).toBe(57964);

    // Age 46: Should be new job salary with 3% growth (1 year)
    const snapshot46 = getLifeSnapshotAtAge(inputs, 46);
    expect(Math.round(snapshot46.income.annualIncome)).toBe(82400);
  });

  test('getLifeSnapshotAtAge housing status regression: Buy (51) and Sell (85) events', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeExpectancy: 85,
      useLifeProfile: false,
      houseAssets: [
        { id: 'house-1', purchasePrice: 500000 }
      ],
      lifeEvents: [
        { id: 'buy-house-1', type: 'buyHouse', age: 51, houseId: 'house-1', enabled: true },
        { id: 'sell-house-1', type: 'sellHouse', age: 85, houseId: 'house-1', enabled: true }
      ]
    };

    expect(getLifeSnapshotAtAge(inputs, 35).housingStatus).toBe('rent');
    expect(getLifeSnapshotAtAge(inputs, 50).housingStatus).toBe('rent');
    expect(getLifeSnapshotAtAge(inputs, 51).housingStatus).toBe('own');
    expect(getLifeSnapshotAtAge(inputs, 84).housingStatus).toBe('own');
    expect(getLifeSnapshotAtAge(inputs, 85).housingStatus).toBe('rent');
  });

  test('Active job salary appears in Snapshot', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      inflationRate: 0,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-main',
            type: 'job',
            name: 'Main Salary',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [],
        assumptions: {
          inflationRate: 0
        }
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 52);
    expect(Math.round(snapshot.income.annualIncome)).toBe(82642);
    expect(Math.round(snapshot.income.activeIncomeItems[0].metadata.amount)).toBe(82642);
  });

  test('Salary aliases normalize correctly', () => {
    const aliases = ['annualIncome', 'salary', 'currentSalary', 'income', 'amount'];
    aliases.forEach((alias, idx) => {
      const inputs = {
        ...DEFAULT_FIRE_INPUTS,
        currentAge: 35,
        inflationRate: 0,
        useLifeProfile: true,
        lifePlan: {
          currentAge: 35,
          lifeExpectancy: 85,
          objects: [
            {
              id: `job-${idx}`,
              type: 'job',
              name: 'Main Salary',
              startAge: 35,
              endAge: 65,
              properties: {
                [alias]: 50000,
                growthRate: 3
              }
            }
          ],
          events: [],
          assumptions: {
            inflationRate: 0
          }
        }
      };

      const snapshot = getLifeSnapshotAtAge(inputs, 52);
      expect(Math.round(snapshot.income.annualIncome)).toBe(82642);
    });
  });

  test('Snapshot and Timeline use the same child object (Snapshot verification)', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'child-1',
            type: 'child',
            name: 'Child',
            startAge: 35,
            properties: {
              arrivalAge: 35,
              childcareCost: 15000,
              dependencyEndAge: 18,
              collegeCost: 25000,
              includeCollege: false
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 52);
    expect(snapshot.children.length).toBe(1);
    expect(snapshot.children[0].name).toBe('Child');
    expect(snapshot.children[0].age).toBe(17); // 52 - 35
  });

  test('Snapshot annualIncome: active jobs contribute, ended job does not contribute after endAge', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      inflationRate: 0,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-active-income',
            type: 'job',
            name: 'Active Job',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          },
          {
            id: 'job-active-salary',
            type: 'job',
            name: 'Active Salary Alias',
            startAge: 35,
            endAge: 65,
            properties: {
              salary: 30000,
              growthRate: 3
            }
          },
          {
            id: 'job-ended',
            type: 'job',
            name: 'Ended Job',
            startAge: 35,
            endAge: 50,
            properties: {
              annualIncome: 40000,
              growthRate: 3
            }
          }
        ],
        events: [
          {
            id: 'job-ended-event',
            objectId: 'job-ended',
            type: 'job.end',
            age: 50
          }
        ],
        assumptions: {
          inflationRate: 0
        }
      }
    };

    // Age 49: all three jobs are active. Total nominal projected income = ~181511
    const snapshot49 = getLifeSnapshotAtAge(inputs, 49);
    expect(Math.round(snapshot49.income.annualIncome)).toBe(181511);

    // Age 50: job-ended is no longer active. Total nominal projected income = ~124637
    const snapshot50 = getLifeSnapshotAtAge(inputs, 50);
    expect(Math.round(snapshot50.income.annualIncome)).toBe(124637);

    // Age 52: job-ended is still ended. Total nominal projected income = ~132228
    const snapshot52 = getLifeSnapshotAtAge(inputs, 52);
    expect(Math.round(snapshot52.income.annualIncome)).toBe(132228);
  });

  test('A $50,000 salary starting at age 35 with 3% annual growth produces approximately $54,636 at age 38', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-main',
            type: 'job',
            name: 'Job',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 38);
    expect(Math.round(snapshot.income.annualIncome)).toBe(54636);
  });

  test('Multiple active jobs sum correctly', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          },
          {
            id: 'job-2',
            type: 'job',
            name: 'Job 2',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 30000,
              growthRate: 2
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    // Age 38: Job 1 is ~54636, Job 2 is ~31836 (30000 * 1.02^3 = 31836.24). Total = ~86472
    const snapshot = getLifeSnapshotAtAge(inputs, 38);
    expect(Math.round(snapshot.income.annualIncome)).toBe(86473);
  });

  test('Jobs outside their active period are excluded', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 40,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [
          { id: 'job-ended', objectId: 'job-1', type: 'job.end', age: 40 }
        ],
        assumptions: {}
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 41);
    expect(snapshot.income.annualIncome).toBe(0);
  });

  test('Missing growth rate defaults to 0%', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: undefined
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    const snapshot = getLifeSnapshotAtAge(inputs, 38);
    expect(snapshot.income.annualIncome).toBe(50000);
  });

  test('Timeline, charts, and Life Snapshot all display identical projected income at the same age', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    const sim = runFireSimulation(inputs);
    const nominalPoint = sim.nominalData.find(d => d.age === 38);
    const snapshot = getLifeSnapshotAtAge(inputs, 38);
    expect(Math.round(snapshot.income.annualIncome)).toBe(Math.round(nominalPoint.projectedJobIncome));
  });

  test('getLifeSnapshotAtAge respects displayMode options', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      inflationRate: 3.0,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [],
        assumptions: {}
      }
    };

    // Age 38: 3 years of inflation and growth
    // Nominal salary: 50000 * 1.03^3 = 54636
    // Deflated salary: 54636 / 1.03^3 = 50000
    const snapshotFuture = getLifeSnapshotAtAge(inputs, 38, { displayMode: 'future' });
    const snapshotToday = getLifeSnapshotAtAge(inputs, 38, { displayMode: 'today' });

    expect(Math.round(snapshotFuture.income.annualIncome)).toBe(54636);
    expect(Math.round(snapshotToday.income.annualIncome)).toBe(50000);

    // Verify Net Worth matches displayMode
    const sim = runFireSimulation(inputs);
    const nominalPoint = sim.nominalData.find(d => d.age === 38);
    const deflatedPoint = sim.data.find(d => d.age === 38);

    expect(snapshotFuture.financialSummary.netWorth).toBe(nominalPoint.netWorth);
    expect(snapshotToday.financialSummary.netWorth).toBe(deflatedPoint.netWorth);
  });

  test('Life Snapshot Income Still Uses Static Input reproduction test', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      inflationRate: 3.0,
      socialSecurity: { enabled: false },
      lifeEvents: [
        { id: 'ss-1', type: 'socialSecurity', enabled: false, monthlyBenefit: 0, claimingAge: 67 }
      ],
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [],
        settings: {
          socialSecurityEnabled: false
        }
      }
    };

    // Age 78: job ended at 65, so active job income = 0 and job-1 is excluded
    const snapshot78 = getLifeSnapshotAtAge(inputs, 78);
    expect(snapshot78.income.annualIncome).toBe(0);
    expect(snapshot78.income.activeIncomeItems.find(j => j.id === 'job-1')).toBeUndefined();

    // Age 44: job is active, annual income should be projected above $50,000 (nominal)
    const snapshot44Nominal = getLifeSnapshotAtAge(inputs, 44, { displayMode: 'future' });
    expect(snapshot44Nominal.income.annualIncome).toBeGreaterThan(50000);
    expect(Math.round(snapshot44Nominal.income.annualIncome)).toBe(65239); // 50000 * 1.03^9 = 65238.68
    expect(snapshot44Nominal.income.activeIncomeItems.find(j => j.id === 'job-1')).toBeDefined();

    // Age 44 today/deflated: salary grown at 3% but deflated at 3% is exactly 50000
    const snapshot44Deflated = getLifeSnapshotAtAge(inputs, 44, { displayMode: 'today' });
    expect(Math.round(snapshot44Deflated.income.annualIncome)).toBe(50000);
  });

  test('Social Security is included in Snapshot annualIncome only after claiming age', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      useLifeProfile: true,
      lifeEvents: [
        { id: 'ss-event', type: 'socialSecurity', claimingAge: 67, monthlyBenefit: 2000, enabled: true }
      ],
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'job-1',
            type: 'job',
            name: 'Job 1',
            startAge: 35,
            endAge: 65,
            properties: {
              annualIncome: 50000,
              growthRate: 3
            }
          }
        ],
        events: [
          {
            id: 'event-ss',
            type: 'socialSecurity',
            age: 67,
            objectId: 'self-person',
            mutation: {
              claimingAge: 67,
              monthlyBenefit: 2000
            }
          }
        ],
        assumptions: {}
      }
    };

    // Age 66: job ended (0), SS not claimed yet (0)
    const snapshot66 = getLifeSnapshotAtAge(inputs, 66);
    expect(snapshot66.income.annualIncome).toBe(0);
    expect(snapshot66.income.activeIncomeItems.length).toBe(0);

    // Age 67: job ended (0), SS claimed (2000/mo * 12 = 24000/yr nominal or deflated)
    // SS benefit in nominal is 24000 * 1.03^32 = 61802.04
    const snapshot67Nominal = getLifeSnapshotAtAge(inputs, 67, { displayMode: 'future' });
    expect(Math.round(snapshot67Nominal.income.annualIncome)).toBe(61802);
    expect(snapshot67Nominal.income.activeIncomeItems.find(i => i.id === 'derived-social-security')).toBeDefined();

    // Today/deflated: SS benefit is exactly 24000
    const snapshot67Today = getLifeSnapshotAtAge(inputs, 67, { displayMode: 'today' });
    expect(Math.round(snapshot67Today.income.annualIncome)).toBe(24000);
    expect(snapshot67Today.income.activeIncomeItems.find(i => i.id === 'derived-social-security')).toBeDefined();
  });

  test('Snapshot account balances: account return override is respected', () => {
    const inputs = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      simpleIncome: 50000,
      simpleExpenses: 50000,
      inflationRate: 0,
      useLifeProfile: true,
      lifePlan: {
        currentAge: 35,
        lifeExpectancy: 85,
        objects: [
          {
            id: 'account-brokerage',
            type: 'account',
            name: 'Brokerage with override',
            startAge: 35,
            properties: {
              accountType: 'brokerage',
              currentBalance: 10000,
              expectedReturnOverride: 10 // 10% override
            }
          },
          {
            id: 'account-trad401k',
            type: 'account',
            name: '401k with default',
            startAge: 35,
            properties: {
              accountType: 'trad401k',
              currentBalance: 10000
              // no override, should use global expectedReturn default
            }
          }
        ],
        events: [],
        settings: {
          inflationRate: 0,
          expectedReturn: 5, // 5% default
          postRetirementReturn: 5
        }
      }
    };

    // Age 35: both have starting balance of 10000
    const snapshot35 = getLifeSnapshotAtAge(inputs, 35);
    const brokerage35 = snapshot35.accounts.find(a => a.id === 'account-brokerage');
    const trad401k35 = snapshot35.accounts.find(a => a.id === 'account-trad401k');
    expect(brokerage35.properties.currentBalance).toBe(10000);
    expect(trad401k35.properties.currentBalance).toBe(10000);

    // Age 36 (after 1 year growth):
    // Brokerage (10% override) -> 10000 * 1.10 = 11000
    // trad401k (5% default) -> 10000 * 1.05 = 10500
    const snapshot36 = getLifeSnapshotAtAge(inputs, 36);
    const brokerage36 = snapshot36.accounts.find(a => a.id === 'account-brokerage');
    const trad401k36 = snapshot36.accounts.find(a => a.id === 'account-trad401k');
    expect(brokerage36.properties.currentBalance).toBe(11000);
    expect(trad401k36.properties.currentBalance).toBe(10500);
  });
});
