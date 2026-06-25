import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';
import { runFireSimulation } from './src/calculators/fire/index.js';
import { getLifeSnapshotAtAge } from './src/models/lifeTimeline/lifeSnapshotSelectors.js';

const inputs = {
  ...DEFAULT_FIRE_INPUTS,
  currentAge: 35,
  inflationRate: 0,
  useLifeProfile: false,
  incomeList: [
    { id: 'inc-1', name: 'Salary', amount: 50000, startAge: 35, endAge: 45, growthRate: 0 }
  ],
  lifeEvents: [
    { id: 'inc-change', type: 'careerChange', name: 'New Job', startAge: 45, amount: 80000, endAge: 65, enabled: true, growthRate: 0 }
  ]
};

const snapshot = getLifeSnapshotAtAge(inputs, 40);
console.log('Snapshot income at 40:', snapshot.income);

const sim = runFireSimulation(inputs);
const point = sim?.data?.find(d => d.age === 40);
console.log('Simulation point at 40:', point);
