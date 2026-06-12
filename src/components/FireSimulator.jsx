/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { runFireSimulation, validateFireInputs, getSocialSecurityFactor } from '../fireCalculations';
import './FireSimulator.css';

// Default base values for the simulator
const DEFAULT_FIRE_INPUTS = {
  currentAge: 35,
  targetRetirementAge: 65,
  lifeExpectancy: 85,
  expectedReturn: 7.0,
  postRetirementReturn: 5.0,
  inflationRate: 3.0,
  lifestyleUpgrades: 0.0,
  swr: 4.0,
  fireMode: 'traditional',
  includeTaxes: false,
  filingStatus: 'single',
  isAdvancedMode: false, // Simple Mode by default
  readinessCriteria: 'lastsComfortable',
  enableHealthcareModel: true,
  preMedicarePremium: 10000,
  medicarePremium: 4000,
  simpleIncome: 50000,
  simpleExpenses: 42500,
  simpleInvestments: 5000,
  assets: {
    cash: 0,
    emergencyFund: 0,
    brokerage: 5000,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    realEstate: 0,
    other: 0,
    debts: 0
  },
  incomeList: [
    {
      id: 'inc-1',
      name: 'Salary / Main Income',
      amount: 50000,
      frequency: 'yearly',
      startAge: 30,
      endAge: 65,
      growthRate: 0.03,
      isTaxable: true
    }
  ],
  spendingPhases: [
    {
      id: 'spend-1',
      name: 'Base Lifestyle Spending',
      startAge: 30,
      endAge: 85,
      amount: 42500,
      frequency: 'yearly',
      annualSpending: 42500,
      inflationOverride: null,
      notes: 'Initial standard living expenses'
    }
  ],
  allocationRules: [
    {
      id: 'alloc-1',
      destination: 'brokerage',
      type: 'percentSurplus',
      value: 100,
      frequency: 'yearly',
      priority: 1,
      smartRule: {
        enabled: false,
        targetValue: 0,
        redirectDestination: 'brokerage'
      }
    }
  ],
  lifeEvents: [
    {
      id: 'ss-1',
      type: 'socialSecurity',
      name: 'Social Security',
      enabled: true,
      claimingAge: 67,
      monthlyBenefit: 2000,
      inflationAdjusted: true
    },
    {
      id: 'retire-1',
      type: 'retire',
      name: 'Retirement',
      enabled: true,
      age: 65,
      spendingPercent: 70
    }
  ],
  debtList: []
};

// Help formatters
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const calculateLoanPayoff = (debt, currentAge) => {
  const balance = Number(debt.balance) || 0;
  const apr = Number(debt.interestRate) || 0;
  const monthlyMin = debt.frequency === 'yearly' ? (Number(debt.payment) || 0) / 12 : (Number(debt.payment) || 0);
  const monthlyExtra = debt.frequency === 'yearly' ? (Number(debt.extraPayment) || 0) / 12 : (Number(debt.extraPayment) || 0);
  const startAge = Number(debt.startAge) || Number(currentAge) || 30;
  const paydownEnabled = !!debt.paydownPlanEnabled;
  const initAge = Number(currentAge) || 30;

  if (balance <= 0) {
    return { success: true, months: 0, years: 0, endAge: initAge, msg: 'Fully paid off!' };
  }

  const monthlyRate = (apr / 100) / 12;
  let currentBalance = balance;
  let months = 0;
  const maxMonths = 1200; // 100 years limit

  while (currentBalance > 0 && months < maxMonths) {
    months++;
    const currentAgeForMonth = initAge + (months - 1) / 12;
    const interest = currentBalance * monthlyRate;

    let payment = monthlyMin;
    if (paydownEnabled && currentAgeForMonth >= startAge) {
      payment += monthlyExtra;
    }

    if (payment <= interest) {
      return {
        success: false,
        msg: 'Payment too low. Interest exceeds payment; debt will grow indefinitely.'
      };
    }

    if (currentBalance + interest <= payment) {
      currentBalance = 0;
    } else {
      currentBalance = currentBalance + interest - payment;
    }
  }

  if (months >= maxMonths) {
    return {
      success: false,
      msg: 'Takes more than 100 years to pay off.'
    };
  }

  const years = months / 12;
  const endAge = initAge + years;

  return {
    success: true,
    months,
    years: parseFloat(years.toFixed(1)),
    endAge: parseFloat(endAge.toFixed(1))
  };
};

const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

const propPIAmount = (ev) => {
  const p = Number(ev.homePrice) || 0;
  const dp = Number(ev.downPayment) || 0;
  const rate = (Number(ev.mortgageRate) || 6.5) / 100;
  const mortgageTerm = Number(ev.loanTerm) || 30;
  const loanAmount = Math.max(0, p - dp);
  if (loanAmount <= 0 || mortgageTerm <= 0) return 0;
  const r = rate / 12;
  const n = mortgageTerm * 12;
  const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthlyPayment * 12;
};

const getOutcomeDetails = (outcome, runOutAge, readinessCriteria, retirementReadyAge, lifeExpectancy) => {
  switch (outcome) {
    case 'comfortable':
      return {
        label: readinessCriteria === 'lastsIndefinitely' 
          ? 'Indefinite Retirement' 
          : readinessCriteria === 'lastsComfortable' 
          ? 'Comfortable Retirement' 
          : 'Sustainable Retirement',
        badge: readinessCriteria === 'lastsIndefinitely'
          ? '🟢 Indefinite'
          : readinessCriteria === 'lastsComfortable'
          ? '🟢 Comfortable'
          : '🟢 Sustainable',
        color: 'var(--accent-emerald)',
        bg: 'rgba(16, 185, 129, 0.1)',
        desc: readinessCriteria === 'lastsIndefinitely'
          ? `Your projected assets meet the safe perpetual withdrawal target, ensuring your portfolio lasts indefinitely (beyond Age ${lifeExpectancy || 85}).`
          : readinessCriteria === 'lastsComfortable'
          ? `Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age ${Number(lifeExpectancy || 85) + 10}).`
          : 'Your projected assets remain positive through life expectancy and you maintain a substantial portfolio cushion.'
      };
    case 'sustainable':
      return {
        label: 'Sustainable Retirement',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
        desc: readinessCriteria === 'lastsIndefinitely'
          ? `Your portfolio is projected to last through your life expectancy, but does not meet the safety margin to last indefinitely. Consider working until your Indefinite Retire Age (Age ${retirementReadyAge || 'N/A'}) to ensure your money lasts forever.`
          : readinessCriteria === 'lastsComfortable'
          ? `Your portfolio is projected to last through your life expectancy, but does not meet the 10-year safety buffer. Consider working until your Comfortable Retire Age (Age ${retirementReadyAge || 'N/A'}).`
          : 'Your projected assets remain positive through life expectancy. Your portfolio gradually declines but is projected to last.'
      };
    case 'retirementGap':
      return {
        label: 'Retirement Gap',
        badge: '⚪ Retirement Gap',
        color: 'var(--text-secondary)',
        bg: 'rgba(148, 163, 184, 0.15)',
        desc: `Your projected assets are projected to run out at Age ${runOutAge} (before life expectancy). Additional savings, later retirement, or reduced spending may be needed.`
      };
    default:
      return {
        label: 'Sustainable Retirement',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
        desc: 'Your projected assets remain positive through life expectancy.'
      };
  }
};

const applyScenarioToInputs = (currentInputs, type, value) => {
  const currentIncome = Number(currentInputs.simpleIncome) || 0;
  const currentExpenses = Number(currentInputs.simpleExpenses) || 0;

  if (type === 'savings' || type === 'spending') {
    const bestDeltaRate = value;
    const annualSavingsDelta = (bestDeltaRate * currentIncome) / 100;
    const newExpenses = Math.round(Math.max(0, currentExpenses - annualSavingsDelta));

    return {
      ...currentInputs,
      simpleExpenses: newExpenses,
      spendingPhases: currentInputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          return {
            ...phase,
            amount: newExpenses,
            annualSpending: newExpenses
          };
        }
        return phase;
      })
    };
  }

  if (type === 'workLonger') {
    const yearsDelay = value;
    const newRetirementAge = currentInputs.targetRetirementAge + yearsDelay;

    return {
      ...currentInputs,
      targetRetirementAge: newRetirementAge,
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: newRetirementAge };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: newRetirementAge };
        }
        return ev;
      })
    };
  }

  if (type === 'income') {
    const extraIncome = value;
    const newIncome = currentInputs.simpleIncome + extraIncome;

    return {
      ...currentInputs,
      simpleIncome: newIncome,
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, amount: (Number(inc.amount) || 0) + extraIncome };
        }
        return inc;
      })
    };
  }

  if (type === 'combined') {
    const savingsDelta = (0.03 * currentIncome) + 1200;
    const newExpenses = Math.round(Math.max(0, currentExpenses - savingsDelta));
    const newRetirementAge = currentInputs.targetRetirementAge + 2;

    return {
      ...currentInputs,
      targetRetirementAge: newRetirementAge,
      simpleExpenses: newExpenses,
      spendingPhases: currentInputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          return {
            ...phase,
            amount: newExpenses,
            annualSpending: newExpenses
          };
        }
        return phase;
      }),
      incomeList: currentInputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: newRetirementAge };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: newRetirementAge };
        }
        return ev;
      })
    };
  }

  return currentInputs;
};

export default function FireSimulator() {
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [currentScenarioId, setCurrentScenarioId] = useState('baseline');
  const [newEventSelectorType, setNewEventSelectorType] = useState('buyHouse');
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  // 2-Step Wizard Navigation states
  const [activeStep, setActiveStep] = useState(1);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedAdvancedDetail, setExpandedAdvancedDetail] = useState(false);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [hasAutoPopped, setHasAutoPopped] = useState(false);
  const dragOccurredRef = useRef(false);
  const lastNonZeroSavingsRateRef = useRef(15); // default to 15% pre-tax savings rate

  // Scenarios state
  const [scenarios, setScenarios] = useState([
    {
      id: 'baseline',
      name: 'Baseline Plan',
      inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
    },
    {
      id: 'compare1',
      name: 'Retire Early (Age 50)',
      inputs: (() => {
        const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
        cloned.targetRetirementAge = 50;
        cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
        return cloned;
      })()
    }
  ]);

  // Sidebar accordions expansion states
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    income: false,
    spending: false,
    allocation: false,
    events: false,
    assumptions: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleDuplicateScenario = () => {
    const newId = `compare-${Date.now()}`;
    const newScenario = {
      id: newId,
      name: `${activeScenario.name} (Copy)`,
      inputs: JSON.parse(JSON.stringify(activeScenario.inputs))
    };
    setScenarios(prev => [...prev, newScenario]);
    setCurrentScenarioId(newId);
  };

  const handleDeleteScenario = (idToDelete) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== idToDelete));
    if (currentScenarioId === idToDelete) {
      const remaining = scenarios.filter(s => s.id !== idToDelete);
      setCurrentScenarioId(remaining[0]?.id || 'baseline');
    }
  };

  // Get active inputs
  const activeScenario = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  const inputs = activeScenario.inputs;

  // Track last non-zero savings rate to preserve it during empty/zero income editing states
  useEffect(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income > 0) {
      const rate = Math.round(((income - expenses) / income) * 100);
      lastNonZeroSavingsRateRef.current = rate;
    }
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  // Sync state helpers
  const updateInput = (key, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            [key]: value
          }
        };
      }
      return scen;
    }));
  };

  const updateAsset = (assetKey, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            assets: {
              ...scen.inputs.assets,
              [assetKey]: value
            }
          }
        };
      }
      return scen;
    }));
  };

  // Synchronize Simple Mode inputs to Schedules in the background
  useEffect(() => {
    const inp = activeScenario.inputs;
    if (!inp.isAdvancedMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const simpleIncVal = Number(scen.inputs.simpleIncome) || 0;
          const simpleExpVal = Number(scen.inputs.simpleExpenses) || 0;
          const currentAgeVal = Number(scen.inputs.currentAge) || 30;
          const targetRetAgeVal = Number(scen.inputs.targetRetirementAge) || 65;
          const lifeExpVal = Number(scen.inputs.lifeExpectancy) || 85;
          const simpleInvestmentsVal = Number(scen.inputs.simpleInvestments) || 0;
          const simpleSavingsRateVal = simpleIncVal > 0 ? Math.round(((simpleIncVal - simpleExpVal) / simpleIncVal) * 100) : 15;

          const existingEvents = scen.inputs.lifeEvents || [];
          let hasRetire = false;
          const updatedEvents = existingEvents.map(ev => {
            if (ev.type === 'retire') {
              hasRetire = true;
              return {
                ...ev,
                age: targetRetAgeVal
              };
            }
            return ev;
          });
          if (!hasRetire) {
            updatedEvents.push({
              id: 'retire-1',
              type: 'retire',
              name: 'Retirement',
              enabled: true,
              age: targetRetAgeVal,
              spendingPercent: 70
            });
          }

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              assets: {
                ...scen.inputs.assets,
                cash: 0,
                brokerage: simpleInvestmentsVal,
                emergencyFund: 0,
                trad401k: 0,
                tradIra: 0,
                rothIra: 0,
                hsa: 0,
                realEstate: 0,
                other: 0,
                debts: 0
              },
              debtList: [],
              incomeList: [
                {
                  id: 'simple-inc',
                  name: 'Salary / Main Income',
                  amount: simpleIncVal,
                  frequency: 'yearly',
                  startAge: currentAgeVal,
                  endAge: targetRetAgeVal,
                  growthRate: 0.03,
                  isTaxable: true
                }
              ],
              spendingPhases: [
                {
                  id: 'simple-spend',
                  name: 'Base Lifestyle Spending',
                  startAge: currentAgeVal,
                  endAge: lifeExpVal,
                  amount: simpleExpVal,
                  frequency: 'yearly',
                  annualSpending: simpleExpVal,
                  inflationOverride: null,
                  notes: 'Simple Mode lifestyle cost'
                }
              ],
              allocationRules: [
                {
                  id: 'simple-alloc-pretax',
                  destination: 'trad401k',
                  type: 'percentIncome',
                  value: simpleSavingsRateVal,
                  frequency: 'yearly',
                  priority: 1,
                  smartRule: {
                    enabled: false,
                    targetValue: 0,
                    redirectDestination: 'brokerage'
                  }
                },
                {
                  id: 'simple-alloc-surplus',
                  destination: 'brokerage',
                  type: 'percentSurplus',
                  value: 100,
                  frequency: 'yearly',
                  priority: 2,
                  smartRule: {
                    enabled: false,
                    targetValue: 0,
                    redirectDestination: 'brokerage'
                  }
                }
              ],
              lifeEvents: updatedEvents
            }
          };
        }
        return scen;
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeScenario.inputs.isAdvancedMode,
    activeScenario.inputs.simpleIncome,
    activeScenario.inputs.simpleExpenses,
    activeScenario.inputs.simpleInvestments,
    activeScenario.inputs.currentAge,
    activeScenario.inputs.targetRetirementAge,
    activeScenario.inputs.lifeExpectancy,
    currentScenarioId
  ]);

  // Run financial calculations
  const baselineResults = useMemo(() => {
    return runFireSimulation(scenarios.find(s => s.id === 'baseline')?.inputs || DEFAULT_FIRE_INPUTS);
  }, [scenarios]);

  const activeResults = useMemo(() => {
    return runFireSimulation(inputs);
  }, [inputs]);

  // Validate inputs
  const validation = useMemo(() => {
    return validateFireInputs(inputs);
  }, [inputs]);

  // Suggestion engine for Retirement Improvement Plan
  const improvementPlan = useMemo(() => {
    const currentReadyAge = activeResults.retirementReadyAge;
    const isSustainable = inputs.readinessCriteria === 'lastsLifeExp';
    const isComfortable = inputs.readinessCriteria === 'lastsComfortable';
    
    const showImprovementPlan = 
      !currentReadyAge || 
      currentReadyAge > inputs.lifeExpectancy || 
      !activeResults.moneyLasts || 
      activeResults.runOutAge !== null || 
      inputs.targetRetirementAge < currentReadyAge;

    if (!showImprovementPlan) return null;

    const list = [];

    const currentIncome = Number(inputs.simpleIncome) || 0;
    const currentExpenses = Number(inputs.simpleExpenses) || 0;
    const currentSavingsRate = currentIncome > 0 ? Math.round((1 - currentExpenses / currentIncome) * 100) : 0;

    // Helper to simulate a test savings rate increase
    const getTestSavingsResult = (deltaRate) => {
      const annualSavingsDelta = (deltaRate * currentIncome) / 100;
      const testInputs = {
        ...inputs,
        simpleExpenses: Math.max(0, currentExpenses - annualSavingsDelta)
      };
      testInputs.spendingPhases = inputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          const currentAmt = Number(phase.amount) || Number(phase.annualSpending) || 42500;
          return {
            ...phase,
            amount: Math.max(0, currentAmt - annualSavingsDelta),
            annualSpending: Math.max(0, currentAmt - annualSavingsDelta)
          };
        }
        return phase;
      });
      return runFireSimulation(testInputs);
    };

    let bestDeltaRate = 5; // fallback
    let bestNewReadyAge = null;
    let foundSavingsImprovement = false;

    // Search from +1% to +15% savings rate
    for (let d = 1; d <= 15; d++) {
      if (currentSavingsRate + d > 70) break; // Avoid extreme suggestions
      const testRes = getTestSavingsResult(d);
      const testReadyAge = testRes.retirementReadyAge;
      
      if (testReadyAge) {
        if (!currentReadyAge || testReadyAge < currentReadyAge || (currentReadyAge > inputs.lifeExpectancy && testReadyAge <= inputs.lifeExpectancy)) {
          bestDeltaRate = d;
          bestNewReadyAge = testReadyAge;
          foundSavingsImprovement = true;
          if (testReadyAge <= inputs.lifeExpectancy) {
            break;
          }
        }
      }
    }

    if (foundSavingsImprovement && bestNewReadyAge) {
      const extraMonthly = Math.round((bestDeltaRate * currentIncome) / 1200);
      const yearsImprovement = currentReadyAge ? (currentReadyAge - bestNewReadyAge) : null;

      list.push({
        type: 'savings',
        icon: '📈',
        title: 'Increase Savings Rate',
        details: `Boost your savings rate by +${bestDeltaRate}% (from ${currentSavingsRate}% to ${currentSavingsRate + bestDeltaRate}%).`,
        bulletPoints: [
          `Save and invest an additional ${formatCurrency(extraMonthly)}/month.`,
          `This can be achieved by increasing pre-tax retirement contributions or trimming discretionary costs (which mathematically has the same positive impact on your cash flow surplus).`
        ],
        extraAction: `E.g., increase paycheck 401(k) contributions, automate transfer of ${formatCurrency(extraMonthly)}/mo to brokerage, or trim subscription/dining budgets.`,
        readyAge: bestNewReadyAge,
        yearsImprovement,
        value: bestDeltaRate,
        disruption: 2
      });
    }

    // Helper to simulate delaying retirement
    const getTestWorkLongerResult = (yearsDelay) => {
      const testInputs = {
        ...inputs,
        targetRetirementAge: inputs.targetRetirementAge + yearsDelay
      };
      testInputs.incomeList = inputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: inputs.targetRetirementAge + yearsDelay };
        }
        return inc;
      });
      testInputs.lifeEvents = inputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: inputs.targetRetirementAge + yearsDelay };
        }
        return ev;
      });
      return runFireSimulation(testInputs);
    };

    let bestDelay = 3;
    let workLongerNewReadyAge = null;
    let foundWorkImprovement = false;

    const delayOptions = [2, 3, 5];
    for (const delay of delayOptions) {
      if (inputs.targetRetirementAge + delay > inputs.lifeExpectancy) continue;
      const testRes = getTestWorkLongerResult(delay);
      const testReadyAge = testRes.retirementReadyAge;
      if (testReadyAge && testReadyAge <= inputs.lifeExpectancy) {
        bestDelay = delay;
        workLongerNewReadyAge = testReadyAge;
        foundWorkImprovement = true;
        break;
      }
    }

    if (!foundWorkImprovement) {
      for (const delay of delayOptions) {
        if (inputs.targetRetirementAge + delay > inputs.lifeExpectancy) continue;
        const testRes = getTestWorkLongerResult(delay);
        const testReadyAge = testRes.retirementReadyAge;
        if (testReadyAge && (!currentReadyAge || testReadyAge < currentReadyAge)) {
          bestDelay = delay;
          workLongerNewReadyAge = testReadyAge;
          foundWorkImprovement = true;
        }
      }
    }

    if (foundWorkImprovement && workLongerNewReadyAge) {
      const yearsImprovement = currentReadyAge ? (currentReadyAge - workLongerNewReadyAge) : null;
      list.push({
        type: 'workLonger',
        icon: '💼',
        title: 'Work Longer',
        details: `Work ${bestDelay} additional years, retiring at Age ${inputs.targetRetirementAge + bestDelay} instead of Age ${inputs.targetRetirementAge}.`,
        bulletPoints: [
          `Gives your investments ${bestDelay} more years of compound growth before drawing down.`,
          `Decreases the number of retirement years your portfolio needs to fund.`,
          `New retirement ready age: Age ${workLongerNewReadyAge}.`
        ],
        readyAge: workLongerNewReadyAge,
        yearsImprovement,
        value: bestDelay,
        disruption: 3
      });
    }

    // Helper to simulate increasing income
    const getTestIncomeResult = (extraIncome) => {
      const testInputs = {
        ...inputs,
        simpleIncome: inputs.simpleIncome + extraIncome
      };
      testInputs.incomeList = inputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, amount: (Number(inc.amount) || 0) + extraIncome };
        }
        return inc;
      });
      return runFireSimulation(testInputs);
    };

    let bestExtraIncome = 10000;
    let incomeNewReadyAge = null;
    let foundIncomeImprovement = false;

    const incomeIncrements = [5000, 10000, 20000];
    for (const incAmt of incomeIncrements) {
      const testRes = getTestIncomeResult(incAmt);
      const testReadyAge = testRes.retirementReadyAge;
      if (testReadyAge && (testReadyAge <= inputs.lifeExpectancy || !currentReadyAge || testReadyAge < currentReadyAge)) {
        bestExtraIncome = incAmt;
        incomeNewReadyAge = testReadyAge;
        foundIncomeImprovement = true;
        if (testReadyAge <= inputs.lifeExpectancy) {
          break;
        }
      }
    }

    if (foundIncomeImprovement && incomeNewReadyAge) {
      const yearsImprovement = currentReadyAge ? (currentReadyAge - incomeNewReadyAge) : null;
      list.push({
        type: 'income',
        icon: '📈',
        title: 'Increase Income',
        details: `Increase your gross annual earnings by ${formatCurrency(bestExtraIncome)}/year and save the difference.`,
        bulletPoints: [
          `Save an additional ${formatCurrency(Math.round(bestExtraIncome / 12))}/month.`,
          `Keeps your current lifestyle spending flat while boosting savings rate.`,
          `New retirement ready age: Age ${incomeNewReadyAge}.`
        ],
        readyAge: incomeNewReadyAge,
        yearsImprovement,
        value: bestExtraIncome,
        disruption: 1
      });
    }

    const getCombinedPlanResult = () => {
      const extraSavingsFrom3Percent = Math.round((0.03 * currentIncome) / 12);
      const savingsDelta = extraSavingsFrom3Percent * 12; // 3% of income saved by reducing spending
      const testInputs = {
        ...inputs,
        targetRetirementAge: inputs.targetRetirementAge + 2,
        simpleExpenses: Math.max(0, currentExpenses - savingsDelta)
      };
      testInputs.incomeList = inputs.incomeList.map(inc => {
        if (inc.id === 'simple-inc' || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: inputs.targetRetirementAge + 2 };
        }
        return inc;
      });
      testInputs.spendingPhases = inputs.spendingPhases.map((phase, idx) => {
        if (idx === 0 || phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
          const currentAmt = Number(phase.amount) || Number(phase.annualSpending) || 42500;
          return {
            ...phase,
            amount: Math.max(0, currentAmt - savingsDelta),
            annualSpending: Math.max(0, currentAmt - savingsDelta)
          };
        }
        return phase;
      });
      testInputs.lifeEvents = inputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: inputs.targetRetirementAge + 2 };
        }
        return ev;
      });
      return runFireSimulation(testInputs);
    };

    const combinedRes = getCombinedPlanResult();
    const combinedNewReadyAge = combinedRes.retirementReadyAge;

    if (combinedNewReadyAge) {
      const yearsImprovement = currentReadyAge ? (currentReadyAge - combinedNewReadyAge) : null;
      const extraSavingsFrom3Percent = Math.round((0.03 * currentIncome) / 12);
      
      list.push({
        type: 'combined',
        icon: '⚖️',
        title: 'Balanced Plan',
        badge: 'Recommended',
        details: 'A balanced combination of small, realistic adjustments that yields a massive improvement:',
        bulletPoints: [
          `Save 3% more (approx. ${formatCurrency(extraSavingsFrom3Percent)}/month) or reduce monthly spending by ${formatCurrency(extraSavingsFrom3Percent)}/month`,
          `Work 2 additional years (delaying retirement to Age ${inputs.targetRetirementAge + 2})`
        ],
        readyAge: combinedNewReadyAge,
        yearsImprovement,
        value: null,
        disruption: 1
      });
    }

    const balancedItem = list.find(item => item.type === 'combined');
    const otherItems = list.filter(item => item.type !== 'combined');

    otherItems.sort((a, b) => {
      const aImprove = a.yearsImprovement || 0;
      const bImprove = b.yearsImprovement || 0;
      if (aImprove !== bImprove) {
        return bImprove - aImprove;
      }
      return a.disruption - b.disruption;
    });

    const rankedPlan = [];
    if (balancedItem) rankedPlan.push(balancedItem);
    rankedPlan.push(...otherItems);

    return {
      showImprovementPlan: true,
      rankedPlan,
      currentReadyAge
    };
  }, [inputs, activeResults]);

  // Reset auto-pop when switching scenarios
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasAutoPopped(false);
  }, [currentScenarioId]);

  // Auto-pop the improvement plan modal when a plan becomes available
  useEffect(() => {
    if (improvementPlan) {
      if (!hasAutoPopped) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowImprovementModal(true);
        setHasAutoPopped(true);
      }
    } else {
      setHasAutoPopped(false);
    }
  }, [improvementPlan, hasAutoPopped]);

  const handleApplyImprovementScenario = (scenario) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: applyScenarioToInputs(scen.inputs, scenario.type, scenario.value)
        };
      }
      return scen;
    }));
    setShowImprovementModal(false);
  };

  // Income Phases handlers
  const addIncomeItem = () => {
    const newItem = {
      id: `inc-${Date.now()}`,
      name: 'Side Hustle',
      amount: 15000,
      frequency: 'yearly',
      startAge: inputs.currentAge,
      endAge: inputs.targetRetirementAge,
      growthRate: 0.03,
      isTaxable: true
    };
    updateInput('incomeList', [...inputs.incomeList, newItem]);
  };

  const removeIncomeItem = (id) => {
    updateInput('incomeList', inputs.incomeList.filter(item => item.id !== id));
  };

  const updateIncomeItemField = (id, field, value) => {
    updateInput('incomeList', inputs.incomeList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Spending Phases handlers
  const addSpendingPhase = () => {
    const newItem = {
      id: `spend-${Date.now()}`,
      name: 'Lifestyle Phase',
      startAge: inputs.targetRetirementAge,
      endAge: inputs.lifeExpectancy,
      amount: 45000,
      frequency: 'yearly',
      annualSpending: 45000,
      inflationOverride: null,
      notes: ''
    };
    updateInput('spendingPhases', [...inputs.spendingPhases, newItem]);
  };

  const removeSpendingPhase = (id) => {
    updateInput('spendingPhases', inputs.spendingPhases.filter(item => item.id !== id));
  };

  const updateSpendingPhaseField = (id, field, value) => {
    updateInput('spendingPhases', inputs.spendingPhases.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const amt = Number(updated.amount !== undefined ? updated.amount : updated.annualSpending) || 0;
        updated.annualSpending = (updated.frequency || 'yearly') === 'monthly' ? amt * 12 : amt;
        return updated;
      }
      return item;
    }));
  };

  // Allocation Rules handlers
  const addAllocationRule = () => {
    const newItem = {
      id: `alloc-${Date.now()}`,
      destination: 'brokerage',
      type: 'fixed',
      value: 500,
      frequency: 'monthly',
      priority: inputs.allocationRules.length + 1,
      smartRule: {
        enabled: false,
        targetValue: 20000,
        redirectDestination: 'brokerage'
      }
    };
    updateInput('allocationRules', [...inputs.allocationRules, newItem]);
  };

  const removeAllocationRule = (id) => {
    const remaining = inputs.allocationRules.filter(item => item.id !== id);
    updateInput('allocationRules', remaining.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  const moveAllocationRule = (index, direction) => {
    const rules = [...inputs.allocationRules];
    if (direction === 'up' && index > 0) {
      const temp = rules[index];
      rules[index] = rules[index - 1];
      rules[index - 1] = temp;
    } else if (direction === 'down' && index < rules.length - 1) {
      const temp = rules[index];
      rules[index] = rules[index + 1];
      rules[index + 1] = temp;
    }
    updateInput('allocationRules', rules.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  const updateAllocationRuleField = (id, field, value) => {
    updateInput('allocationRules', inputs.allocationRules.map(item => {
      if (item.id === id) {
        if (field.startsWith('smartRule.')) {
          const smartKey = field.split('.')[1];
          return {
            ...item,
            smartRule: {
              ...item.smartRule,
              [smartKey]: value
            }
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Debts and Loans handlers
  const addDebtItem = () => {
    const newItem = {
      id: `debt-${Date.now()}`,
      name: 'New Loan Account',
      balance: 15000,
      interestRate: 6.5,
      payment: 300,
      frequency: 'monthly',
      extraPayment: 0,
      paydownPlanEnabled: false,
      startAge: inputs.currentAge || 30
    };
    updateInput('debtList', [...inputs.debtList, newItem]);
  };

  const removeDebtItem = (id) => {
    updateInput('debtList', inputs.debtList.filter(item => item.id !== id));
  };

  const updateDebtItemField = (id, field, value) => {
    updateInput('debtList', inputs.debtList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Life Events & Asset Transfers handlers
  const addLifeEvent = () => {
    const type = newEventSelectorType;
    let newEvent = {
      id: `${type}-${Date.now()}`,
      type,
      enabled: true
    };

    if (type === 'buyHouse') {
      newEvent = {
        ...newEvent,
        name: 'Buy a House',
        purchaseType: 'mortgage',
        purchaseAge: 35,
        homePrice: 400000,
        downPayment: 80000,
        mortgageRate: 6.5,
        loanTerm: 30,
        propertyTax: 1.2,
        insurance: 0.5,
        maintenance: 1.0,
        appreciationRate: 3.0
      };
    } else if (type === 'haveChild') {
      newEvent = {
        ...newEvent,
        name: 'Have a Child',
        birthAge: 32,
        oneTimeBirthCost: 10000,
        annualChildcareCost: 12000,
        annualChildExpense: 6000,
        childcareEndAge: 5,
        supportEndAge: 18
      };
    } else if (type === 'college') {
      newEvent = {
        ...newEvent,
        name: 'Go to College',
        startAge: 18,
        tuitionCost: 25000,
        duration: 4
      };
    } else if (type === 'sabbatical') {
      newEvent = {
        ...newEvent,
        name: 'Sabbatical / Break',
        startAge: 40,
        endAge: 41,
        incomeReduction: 100,
        expenseChange: 5000
      };
    } else if (type === 'socialSecurity') {
      newEvent = {
        ...newEvent,
        name: 'Social Security',
        claimingAge: 67,
        monthlyBenefit: 2000,
        inflationAdjusted: true
      };
    } else if (type === 'windfall') {
      newEvent = {
        ...newEvent,
        name: 'Windfall / Inheritance',
        ageReceived: 50,
        amount: 100000,
        taxRate: 15
      };
    } else if (type === 'assetTransfer') {
      newEvent = {
        ...newEvent,
        name: 'Asset Transfer',
        transferAge: 35,
        amount: 25000,
        fromAsset: 'cash',
        toAsset: 'brokerage'
      };
    }

    updateInput('lifeEvents', [...inputs.lifeEvents, newEvent]);
  };

  const removeLifeEvent = (id) => {
    updateInput('lifeEvents', inputs.lifeEvents.filter(ev => ev.id !== id));
  };

  const updateLifeEventField = (id, field, value) => {
    updateInput('lifeEvents', inputs.lifeEvents.map(ev => {
      if (ev.id === id) {
        return { ...ev, [field]: value };
      }
      return ev;
    }));
  };

  const handleStep1Change = (field, val) => {
    updateInput(field, val);
    if (field === 'simpleInvestments') {
      updateInput('assets', {
        ...inputs.assets,
        brokerage: val,
        cash: 0,
        emergencyFund: 0,
        trad401k: 0,
        tradIra: 0,
        rothIra: 0,
        hsa: 0,
        realEstate: 0,
        other: 0,
        debts: 0
      });
    } else if (field === 'simpleIncome') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const updatedIncomeList = scen.inputs.incomeList.map(inc => {
            if (inc.id === 'simple-inc' || inc.name === 'Salary / Main Income') {
              return { ...inc, amount: val };
            }
            return inc;
          });

          // Preserve the pre-tax savings rate percentage from the ref
          const rate = lastNonZeroSavingsRateRef.current / 100;
          const newExpenses = Math.round(val * (1 - rate));

          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
              return { ...phase, amount: newExpenses, annualSpending: newExpenses };
            }
            return phase;
          });

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              incomeList: updatedIncomeList,
              spendingPhases: updatedSpendingPhases,
              simpleIncome: val,
              simpleExpenses: newExpenses
            }
          };
        }
        return scen;
      }));
    } else if (field === 'simpleExpenses') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.name === 'Base Lifestyle Spending') {
              return { ...phase, amount: val, annualSpending: (phase.frequency === 'monthly' ? val * 12 : val) };
            }
            return phase;
          });
          return {
            ...scen,
            inputs: { ...scen.inputs, spendingPhases: updatedSpendingPhases }
          };
        }
        return scen;
      }));
    } else if (field === 'currentAge') {
      setScenarios(prev => prev.map(scen => {
        if (scen.id === currentScenarioId) {
          const oldAge = scen.inputs.currentAge;
          const updatedIncomeList = scen.inputs.incomeList.map(inc => {
            if (inc.id === 'simple-inc' || inc.startAge === oldAge) {
              return { ...inc, startAge: val };
            }
            return inc;
          });
          const updatedSpendingPhases = scen.inputs.spendingPhases.map(phase => {
            if (phase.id === 'simple-spend' || phase.startAge === oldAge) {
              return { ...phase, startAge: val };
            }
            return phase;
          });
          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              currentAge: val,
              incomeList: updatedIncomeList,
              spendingPhases: updatedSpendingPhases
            }
          };
        }
        return scen;
      }));
    }
  };

  const handleStartOver = () => {
    setScenarios([
      {
        id: 'baseline',
        name: 'Baseline Plan',
        inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
      },
      {
        id: 'compare1',
        name: 'Retire Early (Age 50)',
        inputs: (() => {
          const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
          cloned.targetRetirementAge = 50;
          cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
          return cloned;
        })()
      }
    ]);
    setCurrentScenarioId('baseline');
    setActiveStep(1);
  };

  const handleCreateEvent = (type) => {
    let defaults = { type };
    const curAge = inputs.currentAge || 35;
    
    if (type === 'buyHouse') {
      defaults = { ...defaults, purchaseAge: 40, homePrice: 500000, downPayment: 100000 };
    } else if (type === 'haveChild') {
      defaults = { ...defaults, birthAge: 38, childcareCost: 12000, supportEndAge: 18 };
    } else if (type === 'careerChange') {
      defaults = { ...defaults, name: 'Senior Manager', startAge: 40, amount: 150000, growthRate: 3.5 };
    } else if (type === 'move') {
      defaults = { ...defaults, location: 'Dominican Republic', moveAge: 55, newSpending: 40000 };
    } else if (type === 'retire') {
      defaults = { ...defaults, age: 55, spendingPercent: 70 };
    } else if (type === 'windfall') {
      defaults = { ...defaults, ageReceived: 50, amount: 100000, taxRate: 15 };
    } else if (type === 'college') {
      defaults = { ...defaults, startAge: 48, tuitionCost: 30000, duration: 4 };
    } else if (type === 'debtPayoff') {
      defaults = { ...defaults, payoffAge: 38, amount: 5000 };
    } else if (type === 'custom') {
      defaults = { ...defaults, name: 'Custom Event', age: 45, amount: -15000 };
    } else if (type === 'socialSecurity') {
      defaults = { ...defaults, claimingAge: 67, monthlyBenefit: 2000, inflationAdjusted: true, name: 'Social Security' };
    } else if (type === 'pension') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 1000, inflationAdjusted: true, name: 'Pension' };
    } else if (type === 'rentalIncome') {
      defaults = { ...defaults, claimingAge: 60, monthlyBenefit: 1500, inflationAdjusted: true, name: 'Rental Income' };
    } else if (type === 'annuity') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 500, inflationAdjusted: false, name: 'Annuity' };
    } else if (type === 'otherRetirementIncome') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 800, inflationAdjusted: true, name: 'Other Income' };
    }
    
    setEditingEvent(defaults);
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;
    const type = editingEvent.type;
    
    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      
      let newInputs = { ...scen.inputs };
      
      // 1. If editing an existing event, remove it first from the appropriate list
      if (editingEvent.id) {
        if (newInputs.lifeEvents.some(e => e.id === editingEvent.id)) {
          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== editingEvent.id);
        } else {
          const matchSpend = newInputs.spendingPhases.find(p => p.id === editingEvent.id);
          if (matchSpend) {
            const remaining = newInputs.spendingPhases.filter(p => p.id !== editingEvent.id);
            newInputs.spendingPhases = remaining.map(p => {
              if (p.endAge === matchSpend.startAge) {
                return { ...p, endAge: matchSpend.endAge };
              }
              return p;
            });
          } else {
            const matchInc = newInputs.incomeList.find(i => i.id === editingEvent.id);
            if (matchInc) {
              const remaining = newInputs.incomeList.filter(i => i.id !== editingEvent.id);
              newInputs.incomeList = remaining.map(i => {
                if (i.endAge === matchInc.startAge) {
                  return { ...i, endAge: matchInc.endAge };
                }
                return i;
              });
            }
          }
        }
      }
      
      // 2. Perform save/insert logic
      if (type === 'retire') {
        newInputs.targetRetirementAge = editingEvent.age;
        // Filter out any existing retirement event to avoid duplicates
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.type !== 'retire');
        let newEventObj = {
          id: editingEvent.id && editingEvent.id !== 'retire' ? editingEvent.id : `retire-${Date.now()}`,
          type: 'retire',
          enabled: true,
          name: 'Retirement',
          age: editingEvent.age,
          spendingPercent: editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70
        };
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      } else if (type === 'move') {
        const newPhase = {
          id: editingEvent.id && editingEvent.id !== 'move' ? editingEvent.id : `spend-${Date.now()}`,
          name: `Moved to ${editingEvent.location}`,
          startAge: editingEvent.moveAge,
          endAge: newInputs.lifeExpectancy,
          amount: editingEvent.newSpending,
          frequency: 'yearly',
          annualSpending: editingEvent.newSpending,
          inflationOverride: null,
          notes: `Lifestyle after moving to ${editingEvent.location}`
        };
        const updatedPhases = newInputs.spendingPhases.map(p => {
          if (p.startAge < editingEvent.moveAge && p.endAge > editingEvent.moveAge) {
            return { ...p, endAge: editingEvent.moveAge };
          }
          return p;
        });
        newInputs.spendingPhases = [...updatedPhases, newPhase];
      } else if (type === 'careerChange') {
        const newInc = {
          id: editingEvent.id && editingEvent.id !== 'careerChange' ? editingEvent.id : `inc-${Date.now()}`,
          name: editingEvent.name,
          amount: editingEvent.amount,
          frequency: 'yearly',
          startAge: editingEvent.startAge,
          endAge: newInputs.targetRetirementAge,
          growthRate: (editingEvent.growthRate || 3.0) / 100,
          isTaxable: true
        };
        const updatedIncome = newInputs.incomeList.map(inc => {
          if (inc.startAge < editingEvent.startAge && inc.endAge > editingEvent.startAge) {
            return { ...inc, endAge: editingEvent.startAge };
          }
          return inc;
        });
        newInputs.incomeList = [...updatedIncome, newInc];
      } else {
        const isRetIncomeType = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type);
        let defaultName = 'Other Income';
        if (type === 'socialSecurity') defaultName = 'Social Security';
        else if (type === 'pension') defaultName = 'Pension';
        else if (type === 'rentalIncome') defaultName = 'Rental Income';
        else if (type === 'annuity') defaultName = 'Annuity';

        let newEventObj = {
          id: editingEvent.id && !['buyHouse', 'haveChild', 'college', 'windfall', 'debtPayoff', 'custom', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(editingEvent.id)
            ? editingEvent.id
            : `${type}-${Date.now()}`,
          type,
          enabled: true,
          name: type === 'buyHouse' ? 'Buy a House' : type === 'haveChild' ? 'Have a Child' : type === 'college' ? 'College' : type === 'windfall' ? 'Windfall' : isRetIncomeType ? (editingEvent.name || defaultName) : editingEvent.name
        };
        
        if (type === 'buyHouse') {
          newEventObj = {
            ...newEventObj,
            purchaseAge: editingEvent.purchaseAge,
            homePrice: editingEvent.homePrice,
            downPayment: editingEvent.downPayment,
            purchaseType: 'mortgage',
            mortgageRate: 6.5,
            loanTerm: 30,
            propertyTax: 1.2,
            insurance: 0.5,
            maintenance: 1.0,
            appreciationRate: 3.0
          };
        } else if (type === 'haveChild') {
          newEventObj = {
            ...newEventObj,
            birthAge: editingEvent.birthAge,
            oneTimeBirthCost: 10000,
            annualChildcareCost: editingEvent.childcareCost,
            annualChildExpense: 6000,
            childcareEndAge: 5,
            supportEndAge: editingEvent.supportEndAge
          };
        } else if (type === 'college') {
          newEventObj = {
            ...newEventObj,
            startAge: editingEvent.startAge,
            tuitionCost: editingEvent.tuitionCost,
            duration: editingEvent.duration
          };
        } else if (type === 'windfall') {
          newEventObj = {
            ...newEventObj,
            ageReceived: editingEvent.ageReceived,
            amount: editingEvent.amount,
            taxRate: editingEvent.taxRate
          };
        } else if (type === 'debtPayoff') {
          newEventObj = {
            ...newEventObj,
            payoffAge: editingEvent.payoffAge,
            amount: editingEvent.amount
          };
        } else if (isRetIncomeType) {
          let claimingAge = editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65);
          if (type === 'socialSecurity') {
            claimingAge = Math.max(62, Math.min(70, claimingAge));
          }
          newEventObj = {
            ...newEventObj,
            claimingAge,
            startAge: claimingAge,
            age: claimingAge,
            monthlyBenefit: editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000,
            inflationAdjusted: editingEvent.inflationAdjusted !== false
          };
        } else if (type === 'custom') {
          newEventObj = {
            ...newEventObj,
            age: editingEvent.age,
            amount: editingEvent.amount
          };
        }
        
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      }
      
      return {
        ...scen,
        inputs: newInputs
      };
    }));
    
    setEditingEvent(null);
  };

  const handleDeleteRoadmapEvent = (evt) => {
    if (!evt || evt.isMilestone) return;
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      setScenarios(prev => prev.map(scen => {
        if (scen.id !== currentScenarioId) return scen;
        let newInputs = {
          ...scen.inputs,
          lifeEvents: scen.inputs.lifeEvents.filter(e => e.id !== matchEvent.id)
        };
        if (evt.type === 'retire') {
          newInputs.targetRetirementAge = scen.inputs.lifeExpectancy;
        }
        return {
          ...scen,
          inputs: newInputs
        };
      }));
      return;
    }
    const matchSpend = inputs.spendingPhases.find(p => p.id === evt.originalId || p.startAge === evt.age);
    if (matchSpend && inputs.spendingPhases.length > 1) {
      const remaining = inputs.spendingPhases.filter(p => p.id !== matchSpend.id);
      const updated = remaining.map(p => {
        if (p.endAge === matchSpend.startAge) {
          return { ...p, endAge: matchSpend.endAge };
        }
        return p;
      });
      updateInput('spendingPhases', updated);
      return;
    }
    const matchInc = inputs.incomeList.find(i => i.id === evt.originalId || i.startAge === evt.age);
    if (matchInc && inputs.incomeList.length > 1) {
      const remaining = inputs.incomeList.filter(i => i.id !== matchInc.id);
      const updated = remaining.map(i => {
        if (i.endAge === matchInc.startAge) {
          return { ...i, endAge: matchInc.endAge };
        }
        return i;
      });
      updateInput('incomeList', updated);
      return;
    }
  };

  const commitEventAgeChange = (evt, newAge) => {
    const oldAge = evt.age;
    if (newAge === oldAge) return;

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };

      // 1. Retirement
      if (evt.type === 'retire') {
        newInputs.targetRetirementAge = newAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.type === 'retire') {
            return { ...e, age: newAge };
          }
          return e;
        });
      }
      // 3. Relocation spending phase (move / lifestyle)
      else if (evt.type === 'move' || evt.type === 'lifestyle') {
        newInputs.spendingPhases = newInputs.spendingPhases.map(p => {
          if (p.id === evt.originalId) {
            return { ...p, startAge: newAge };
          }
          if (p.endAge === oldAge) {
            return { ...p, endAge: newAge };
          }
          return p;
        });
      }
      // 4. Career income phase
      else if (evt.type === 'careerChange' || evt.type === 'career') {
        newInputs.incomeList = newInputs.incomeList.map(i => {
          if (i.id === evt.originalId) {
            return { ...i, startAge: newAge };
          }
          if (i.endAge === oldAge) {
            return { ...i, endAge: newAge };
          }
          return i;
        });
      }
      // 5. General Life Events
      else {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId) {
            let updated = { ...e };
            if (e.type === 'buyHouse') {
              updated.purchaseAge = newAge;
            } else if (e.type === 'haveChild') {
              updated.birthAge = newAge;
            } else if (e.type === 'college') {
              updated.startAge = newAge;
            } else if (e.type === 'sabbatical') {
              const duration = (Number(e.endAge) || 0) - (Number(e.startAge) || 0);
              updated.startAge = newAge;
              updated.endAge = newAge + duration;
            } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(e.type)) {
              let finalAge = newAge;
              if (e.type === 'socialSecurity') {
                finalAge = Math.max(62, Math.min(70, newAge));
              }
              updated.claimingAge = finalAge;
              updated.startAge = finalAge;
              updated.age = finalAge;
            } else if (e.type === 'windfall') {
              updated.ageReceived = newAge;
              updated.age = newAge;
            } else if (e.type === 'assetTransfer') {
              updated.transferAge = newAge;
            } else if (e.type === 'debtPayoff') {
              updated.payoffAge = newAge;
            } else {
              updated.age = newAge;
            }
            return updated;
          }
          return e;
        });
      }

      return {
        ...scen,
        inputs: newInputs
      };
    }));
  };

  const handleNodeDragStart = (e, evt) => {
    // Exclude FI age, mortgageOff, or any other uneditable timeline element
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    // Prevent default touch/click dragging behavior
    e.preventDefault();

    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    // Find the timeline track container
    const track = e.currentTarget.closest('.timeline-track-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width - 140; // Subtract padding of 70px on left and 70px on right
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = evt.age;

    dragOccurredRef.current = false;

    // Initialize draggingInfo in state
    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      // Calculate shift in years
      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      let newAge = Math.round(initialAge + deltaYears);
      newAge = Math.max(minAge, Math.min(maxAge, newAge));

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      // Prevent scrolling on mobile during drag
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      setDraggingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentAge: newAge
        };
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);

      // Read current dragged age to commit
      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          commitEventAgeChange(evt, currentDrag.currentAge);
        }
        return null;
      });

      // Clear the drag flag after click event propagation passes
      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  const isEditableEvent = (evt) => {
    if (!evt) return false;
    return !!evt.originalId || evt.type === 'retire';
  };

  const handleEditRoadmapEvent = (evt) => {
    if (!evt) return;

    // 1. Retirement
    if (evt.type === 'retire') {
      const existingRetire = inputs.lifeEvents.find(e => e.type === 'retire') || {};
      setEditingEvent({
        id: existingRetire.id || 'retire-1',
        type: 'retire',
        age: evt.age,
        spendingPercent: existingRetire.spendingPercent !== undefined ? existingRetire.spendingPercent : 70
      });
      return;
    }

    // 2. Life Events (using originalId or matching attributes)
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      let defaults = {
        id: matchEvent.id,
        type: matchEvent.type,
      };
      if (matchEvent.type === 'buyHouse') {
        defaults = {
          ...defaults,
          purchaseAge: matchEvent.purchaseAge,
          homePrice: matchEvent.homePrice,
          downPayment: matchEvent.downPayment
        };
      } else if (matchEvent.type === 'haveChild') {
        defaults = {
          ...defaults,
          birthAge: matchEvent.birthAge,
          childcareCost: matchEvent.annualChildcareCost,
          supportEndAge: matchEvent.supportEndAge
        };
      } else if (matchEvent.type === 'college') {
        defaults = {
          ...defaults,
          startAge: matchEvent.startAge,
          tuitionCost: matchEvent.tuitionCost,
          duration: matchEvent.duration
        };
      } else if (matchEvent.type === 'windfall') {
        defaults = {
          ...defaults,
          ageReceived: matchEvent.ageReceived,
          amount: matchEvent.amount,
          taxRate: matchEvent.taxRate
        };
      } else if (matchEvent.type === 'debtPayoff') {
        defaults = {
          ...defaults,
          payoffAge: matchEvent.payoffAge,
          amount: matchEvent.amount
        };
      } else if (matchEvent.type === 'socialSecurity') {
        defaults = {
          ...defaults,
          claimingAge: matchEvent.claimingAge,
          monthlyBenefit: matchEvent.monthlyBenefit,
          inflationAdjusted: matchEvent.inflationAdjusted
        };
      } else if (matchEvent.type === 'custom') {
        defaults = {
          ...defaults,
          name: matchEvent.name,
          age: matchEvent.age,
          amount: matchEvent.amount
        };
      }
      setEditingEvent(defaults);
      return;
    }

    // 3. Spending Phases (lifestyle relocations, i.e. move)
    const matchSpend = inputs.spendingPhases.find(p => p.id === evt.originalId || p.startAge === evt.age);
    if (matchSpend) {
      const location = matchSpend.name.replace(/^Moved to /, '');
      setEditingEvent({
        id: matchSpend.id,
        type: 'move',
        location: location,
        moveAge: matchSpend.startAge,
        newSpending: matchSpend.annualSpending
      });
      return;
    }

    // 4. Income Phases (career changes)
    const matchInc = inputs.incomeList.find(i => i.id === evt.originalId || i.startAge === evt.age);
    if (matchInc) {
      setEditingEvent({
        id: matchInc.id,
        type: 'careerChange',
        name: matchInc.name,
        startAge: matchInc.startAge,
        amount: matchInc.amount,
        growthRate: matchInc.growthRate * 100
      });
      return;
    }
  };

  const generateLifeStory = (inp, results) => {
    const list = [];
    const curAge = inp.currentAge || 35;
    
    inp.incomeList.forEach(inc => {
      if (inc.startAge > curAge) {
        list.push({
          age: inc.startAge,
          text: `Start new career: "${inc.name}" earning ${formatCurrency(inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount)}/yr`
        });
      }
    });

    inp.spendingPhases.forEach(phase => {
      if (phase.startAge > curAge) {
        list.push({
          age: phase.startAge,
          text: `Change lifestyle: "${phase.name}" costing ${formatCurrency(phase.frequency === 'monthly' ? phase.amount * 12 : phase.amount)}/yr`
        });
      }
    });

    inp.lifeEvents.forEach(ev => {
      if (ev.enabled) {
        if (ev.type === 'buyHouse') {
          list.push({
            age: Number(ev.purchaseAge),
            text: `Buy a home for ${formatCurrency(ev.homePrice)} (${ev.purchaseType === 'cash' ? 'in cash' : 'with mortgage'})`
          });
        } else if (ev.type === 'haveChild') {
          list.push({
            age: Number(ev.birthAge),
            text: `Have a child (childcare/support starts)`
          });
        } else if (ev.type === 'college') {
          list.push({
            age: Number(ev.startAge),
            text: `Start paying college tuition of ${formatCurrency(ev.tuitionCost)}/yr`
          });
        } else if (ev.type === 'windfall') {
          list.push({
            age: Number(ev.ageReceived),
            text: `Receive a windfall of ${formatCurrency(ev.amount)}`
          });
        } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
          const label = ev.type === 'socialSecurity' ? 'Social Security' : ev.name || 'Retirement Income';
          let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
          const claimingAge = Number(ev.claimingAge !== undefined ? ev.claimingAge : (ev.startAge !== undefined ? ev.startAge : ev.age)) || 65;
          if (ev.type === 'socialSecurity') {
            if (claimingAge < 62) {
              monthlyBenefit = 0;
            } else {
              monthlyBenefit = monthlyBenefit * getSocialSecurityFactor(claimingAge);
            }
          }
          list.push({
            age: claimingAge,
            text: `Receive ${label} benefits (${formatCurrency(monthlyBenefit)}/mo${ev.type === 'socialSecurity' && claimingAge !== 67 ? ' - claiming age adjusted' : ''})`
          });
        } else {
          list.push({
            age: Number(ev.age || ev.startAge),
            text: `Event: ${ev.name || 'Custom'}`
          });
        }
      }
    });

    list.sort((a, b) => a.age - b.age);



    const criteria = inputs.readinessCriteria;
    const roadmapLabel = criteria === 'lastsLifeExp' ? 'Sustainable' : criteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite';
    const retirementReadyAge = results.retirementReadyAge;
    if (retirementReadyAge) {
      list.push({
        age: retirementReadyAge,
        text: `<strong style="color: var(--accent-emerald)">Reach ${roadmapLabel} Retirement (Target: ${formatCurrency(results.retirementReadyTarget)})</strong>`
      });
    }

    if (results.runOutAge) {
      list.push({
        age: results.runOutAge,
        text: `<strong style="color: var(--accent-rose)">Assets Depleted: investable assets reach zero</strong>`
      });
    }

    if (list.length === 0) {
      return (
        <div className="plan-summary-story-card">
          <p className="plan-summary-story-text" style={{ margin: 0 }}>
            No future events yet. Add some life decisions using the dropdown above to build your roadmap!
          </p>
        </div>
      );
    }

    return (
      <div className="plan-summary-story-card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.50rem', color: 'var(--primary)', letterSpacing: '0.05em' }}>
          Your Life Story Roadmap
        </h3>
        <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {list.map((item, idx) => (
            <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Age <strong>{item.age}</strong>: <span dangerouslySetInnerHTML={{ __html: item.text }} />
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Compile timeline events
  const timelineEvents = useMemo(() => {
    const events = [];
    const inp = activeScenario.inputs;
    const calc = activeResults;

    // 1. Income Phases
    inp.incomeList.forEach(inc => {
      if (inc.startAge > inp.currentAge && inc.startAge <= inp.lifeExpectancy) {
        events.push({
          originalId: inc.id,
          age: Number(inc.startAge),
          title: `Career Phase: ${inc.name}`,
          label: inc.name,
          icon: '💼',
          type: 'career',
          description: `Started career phase "${inc.name}" earning ${formatCurrency(inc.frequency === 'monthly' ? inc.amount * 12 : inc.amount)}/year (raises: ${(inc.growthRate * 100).toFixed(1)}%).`
        });
      }
    });

    // 2. Spending Phases
    inp.spendingPhases.forEach(phase => {
      if (phase.startAge > inp.currentAge && phase.startAge <= inp.lifeExpectancy) {
        let emoji = '🏡';
        if (phase.name.toLowerCase().includes('dominican') || phase.name.toLowerCase().includes('dr')) {
          emoji = '🇩🇴';
        } else if (phase.name.toLowerCase().includes('retir')) {
          emoji = '🏖️';
        } else if (phase.name.toLowerCase().includes('child')) {
          emoji = '👶';
        }
        events.push({
          originalId: phase.id,
          age: Number(phase.startAge),
          title: `Lifestyle: ${phase.name}`,
          label: phase.name,
          icon: emoji,
          type: 'lifestyle',
          description: `Began lifestyle phase "${phase.name}" costing ${formatCurrency(phase.annualSpending)}/year (inflation override: ${phase.inflationOverride !== null ? phase.inflationOverride + '%' : 'default'}).`
        });
      }
    });

    // 3. Life Events & Asset Transfers
    inp.lifeEvents.forEach(ev => {
      if (ev.enabled) {
        const age = Number(ev.purchaseAge || ev.birthAge || ev.startAge || ev.claimingAge || ev.ageReceived || ev.transferAge || ev.age);
        if (age >= inp.currentAge && age <= inp.lifeExpectancy) {
          if (ev.type === 'buyHouse') {
            events.push({
              originalId: ev.id,
              age,
              title: `Buy House`,
              label: `Buy House`,
              icon: '🏠',
              type: 'buyHouse',
              description: `Purchased a home for ${formatCurrency(ev.homePrice)} (${ev.purchaseType === 'cash' ? 'Cash Purchase' : 'Mortgage with ' + formatCurrency(ev.downPayment) + ' down'}).`
            });
            if (ev.purchaseType !== 'cash') {
              const payoffAge = age + Number(ev.loanTerm);
              if (payoffAge <= inp.lifeExpectancy) {
                events.push({
                  age: payoffAge,
                  title: `Mortgage Paid Off`,
                  label: `Mortgage Off`,
                  icon: '🏠',
                  type: 'mortgageOff',
                  isMilestone: true,
                  description: `Mortgage on home is fully amortized, removing P&I payment of ${formatCurrency(propPIAmount(ev))} /yr from annual expenses.`
                });
              }
            }
          } else if (ev.type === 'haveChild') {
            events.push({
              originalId: ev.id,
              age,
              title: `Have Child`,
              label: `Have Child`,
              icon: '👶',
              type: 'haveChild',
              description: `Welcomed a child! Childcare/support runs until support ends at age ${ev.supportEndAge || 18}.`
            });
            const supportEndAge = Number(ev.supportEndAge) || 18;
            const parentAgeAtEnd = age + supportEndAge;
            if (parentAgeAtEnd <= inp.lifeExpectancy) {
              events.push({
                age: parentAgeAtEnd,
                title: `Child Expenses End`,
                label: `Child Support Ends`,
                icon: '👶',
                type: 'childSupportEnds',
                isMilestone: true,
                description: `General support and childcare expenses for child born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
              });
            }
          } else if (ev.type === 'college') {
            events.push({
              originalId: ev.id,
              age,
              title: `College Tuition Starts`,
              label: `College`,
              icon: '🎓',
              type: 'college',
              description: `Paying college tuition of ${formatCurrency(ev.tuitionCost)}/year for ${ev.duration || 4} years.`
            });
          } else if (ev.type === 'sabbatical') {
            events.push({
              originalId: ev.id,
              age,
              title: `Sabbatical Starts`,
              label: `Sabbatical`,
              icon: '🌴',
              type: 'sabbatical',
              description: `Taking a sabbatical until age ${ev.endAge} (income reduced by ${ev.incomeReduction}%).`
            });
          } else if (['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(ev.type)) {
            let icon = '💰';
            let label = 'Social Security';
            if (ev.type === 'pension') { icon = '📜'; label = ev.name || 'Pension'; }
            else if (ev.type === 'rentalIncome') { icon = '🏢'; label = ev.name || 'Rental Income'; }
            else if (ev.type === 'annuity') { icon = '📈'; label = ev.name || 'Annuity'; }
            else if (ev.type === 'otherRetirementIncome') { icon = '💵'; label = ev.name || 'Other Income'; }

            let desc = `Receiving ${label} of ${formatCurrency(ev.monthlyBenefit)}/month (${formatCurrency(ev.monthlyBenefit * 12)}/year).`;
            if (ev.type === 'socialSecurity') {
              let monthlyBenefit = Number(ev.monthlyBenefit) || 0;
              if (age < 62) {
                desc = `Social Security cannot be claimed before age 62 (Benefit: $0/mo).`;
              } else {
                const factor = getSocialSecurityFactor(age);
                monthlyBenefit = monthlyBenefit * factor;
                const penaltyPct = Math.round((1 - factor) * 100);
                const bonusPct = Math.round((factor - 1) * 100);
                
                desc = `Receiving Social Security of ${formatCurrency(monthlyBenefit)}/month (${formatCurrency(monthlyBenefit * 12)}/year) claimed at age ${age}. `;
                if (age === 67) {
                  desc += `Full retirement benefit (100%).`;
                } else if (age < 67) {
                  desc += `Benefit is permanently reduced by ${penaltyPct}% from full benefit (at age 67: ${formatCurrency(ev.monthlyBenefit)}/mo) due to early claim.`;
                } else {
                  desc += `Benefit is permanently increased by ${bonusPct}% from full benefit (at age 67: ${formatCurrency(ev.monthlyBenefit)}/mo) due to delayed claim.`;
                }
              }
            }

            events.push({
              originalId: ev.id,
              age,
              title: label,
              label: label,
              icon: icon,
              type: ev.type,
              description: desc
            });
          } else if (ev.type === 'retire') {
            events.push({
              originalId: ev.id,
              age,
              title: `Target Retirement`,
              label: `Retirement`,
              icon: '🏖️',
              type: 'retire',
              description: `Target retirement age reached. Contributions stop, and you begin drawing down from your retirement portfolios at ${ev.spendingPercent !== undefined ? ev.spendingPercent : 70}% of your pre-retirement spending.`
            });
          } else if (ev.type === 'windfall') {
            events.push({
              originalId: ev.id,
              age,
              title: `Windfall / Inheritance`,
              label: `Windfall`,
              icon: '💰',
              type: 'windfall',
              description: `Received a one-time windfall inflow of ${formatCurrency(ev.amount)} (post-tax).`
            });
          } else if (ev.type === 'assetTransfer') {
            events.push({
              originalId: ev.id,
              age,
              title: `Asset Transfer`,
              label: `Transfer`,
              icon: '🔄',
              type: 'assetTransfer',
              description: `Moved ${formatCurrency(ev.amount)} from ${getAssetLabel(ev.fromAsset)} to ${getAssetLabel(ev.toAsset)}.`
            });
          }
        }
      }
    });

    // 4. Mathematical Milestones (e.g. debt payoffs)
    const calculationMilestones = calc.dynamicMilestones || [];
    calculationMilestones.forEach(m => {
      events.push({
        age: m.age,
        title: m.label,
        label: m.label,
        icon: m.type === 'debtPayoff' ? '🛑' : '🔔',
        type: m.type,
        isMilestone: m.isMilestone,
        description: `Mathematical milestone: "${m.label}" was achieved.`
      });
    });

    // 5. FIRE Milestones
    if (inp.readinessCriteria === 'lastsLifeExp') {
      if (calc.retirementReadyAgeSurvival) {
        events.push({
          age: calc.retirementReadyAgeSurvival,
          title: `Sustainable Retirement (lasts to Life Expectancy)`,
          label: `Sustainable Retire`,
          icon: '🎉',
          type: 'retirementReadySurvival',
          isMilestone: true,
          description: `Age at which you can retire and have your portfolio survive through your life expectancy (Age ${inp.lifeExpectancy}) under current assumptions.`
        });
      }
    } else if (inp.readinessCriteria === 'lastsComfortable') {
      if (calc.retirementReadyAgeComfortable) {
        events.push({
          age: calc.retirementReadyAgeComfortable,
          title: `Comfortable Retirement (lasts to Life Expectancy + 10)`,
          label: `Comfortable Retire`,
          icon: '🎉',
          type: 'retirementReadyComfortable',
          isMilestone: true,
          description: `Age at which you can retire and have your portfolio survive through your life expectancy plus 10 years (Age ${inp.lifeExpectancy + 10}) under current assumptions.`
        });
      }
    } else {
      if (calc.retirementReadyAgeSWR) {
        events.push({
          age: calc.retirementReadyAgeSWR,
          title: `Indefinite Retirement (lasts indefinitely)`,
          label: `Indefinite Retire`,
          icon: '🎉',
          type: 'retirementReadySWR',
          isMilestone: true,
          description: `Age at which your portfolio meets the safe perpetual Safe Withdrawal Rate (SWR) target (${formatCurrency(calc.retirementReadyTarget)}), ensuring it lasts indefinitely.`
        });
      }
    }

    if (calc.runOutAge) {
      events.push({
        age: calc.runOutAge,
        title: `Assets Depleted`,
        label: `Assets Depleted`,
        icon: '⚠️',
        type: 'assetsDepleted',
        isMilestone: true,
        description: `Your investable assets are projected to reach zero at Age ${calc.runOutAge} under current assumptions.`
      });
    }

    if (calc.coastAge) {
      events.push({
        age: calc.coastAge,
        title: `Coast FIRE Reached`,
        label: `Coast FIRE`,
        icon: '⛵',
        type: 'coastFire',
        isMilestone: true,
        description: `You reached Coast FIRE! Your current savings will grow to cover your target retirement expenses without any additional contributions.`
      });
    }

    // Medicare Milestone
    if (inp.enableHealthcareModel !== false) {
      events.push({
        age: 65,
        title: `Medicare Eligibility`,
        label: `Medicare`,
        icon: '🏥',
        type: 'medicareEligibility',
        isMilestone: true,
        description: `You become eligible for Medicare. Healthcare costs drop from your pre-Medicare private premium (${formatCurrency(inp.preMedicarePremium || 10000)}/yr) to Medicare rates (${formatCurrency(inp.medicarePremium || 4000)}/yr).`
      });
    }

    const sorted = events.sort((a, b) => {
      if (a.age !== b.age) {
        return a.age - b.age;
      }
      const aIsMilestone = !!a.isMilestone;
      const bIsMilestone = !!b.isMilestone;
      if (aIsMilestone && !bIsMilestone) return -1;
      if (!aIsMilestone && bIsMilestone) return 1;
      return 0;
    });

    const ageCounts = {};
    return sorted.map(evt => {
      const ageKey = Math.floor(evt.age);
      const stackIndex = ageCounts[ageKey] || 0;
      ageCounts[ageKey] = stackIndex + 1;
      return { ...evt, stackIndex };
    });
  }, [activeScenario.inputs, activeResults]);

  function getAssetLabel(key) {
    const labels = {
      cash: 'Cash / Reserves',
      emergencyFund: 'Emergency Fund',
      brokerage: 'Taxable Brokerage',
      trad401k: 'Traditional 401k',
      tradIra: 'Traditional IRA',
      rothIra: 'Roth IRA',
      hsa: 'HSA (Health Savings)',
      other: 'Other Investments'
    };
    return labels[key] || key;
  }



  // Summary statistics
  const totalNetWorth = activeResults.currentNetWorth;
  const targetGoal = activeResults.fiNumber || 0;
  const rawPercent = targetGoal > 0 ? Math.round((totalNetWorth / targetGoal) * 100) : 0;
  const gaugePercent = rawPercent;
  const clampedPercentForGauge = Math.max(0, Math.min(100, rawPercent));

  const sqSize = 120;
  const radius = 50;
  const viewBox = `0 0 ${sqSize} ${sqSize}`;
  const dashArray = radius * Math.PI * 2;
  const dashOffset = dashArray - (dashArray * clampedPercentForGauge) / 100;

  const renderEventForm = (event) => {
    const type = event.type;
    return (
      <div className="modal-backdrop" onClick={() => setEditingEvent(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
          {type === 'buyHouse' && '🏠 Buy a House'}
          {type === 'haveChild' && '👶 Have a Child'}
          {type === 'careerChange' && '💼 Career Change'}
          {type === 'move' && '📍 Move / Relocate'}
          {type === 'retire' && '🏖 Schedule Retirement'}
          {type === 'socialSecurity' && '💰 Claim Social Security'}
          {type === 'pension' && '📜 Add Pension'}
          {type === 'rentalIncome' && '🏢 Add Rental Income'}
          {type === 'annuity' && '📈 Add Annuity'}
          {type === 'otherRetirementIncome' && '💵 Add Other Retirement Income'}
          {type === 'windfall' && '💰 Windfall / Inheritance'}
          {type === 'college' && '🎓 College Tuition'}
          {type === 'debtPayoff' && '💸 Debt Payoff Plan'}
          {type === 'custom' && '➕ Custom Life Event'}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* BUY HOUSE FIELDS */}
          {type === 'buyHouse' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Purchase Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.purchaseAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, purchaseAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Home Price ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.homePrice}
                  onChange={(e) => setEditingEvent({ ...editingEvent, homePrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Down Payment ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.downPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, downPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* HAVE CHILD FIELDS */}
          {type === 'haveChild' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Birth Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.birthAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, birthAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Annual Childcare Cost ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.childcareCost}
                  onChange={(e) => setEditingEvent({ ...editingEvent, childcareCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Support Ends at Child Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.supportEndAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, supportEndAge: parseInt(e.target.value) || 18 })}
                />
              </div>
            </>
          )}

          {/* CAREER CHANGE FIELDS */}
          {type === 'careerChange' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Job Title / Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Change Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">New Annual Income ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Raise / Growth Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.growthRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, growthRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* MOVE FIELDS */}
          {type === 'move' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Where? (Location Name)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.location}
                  placeholder="e.g. Dominican Republic"
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Moving Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.moveAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, moveAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">New Annual Spending ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.newSpending}
                  onChange={(e) => setEditingEvent({ ...editingEvent, newSpending: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* RETIRE FIELDS */}
          {type === 'retire' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Retirement Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Spending Replacement Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70}
                  onChange={(e) => setEditingEvent({ ...editingEvent, spendingPercent: parseInt(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* SOCIAL SECURITY FIELDS */}
          {/* RETIREMENT INCOME FIELDS (Social Security, Pension, Rental, Annuity, Other Income) */}
          {['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type) && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Income Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">
                  {type === 'socialSecurity' ? 'Claiming Age' : 'Start Age'}
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65)}
                  onChange={(e) => setEditingEvent({ ...editingEvent, claimingAge: parseInt(e.target.value) || 62, startAge: parseInt(e.target.value) || 62, age: parseInt(e.target.value) || 62 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Monthly Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000}
                  onChange={(e) => setEditingEvent({ ...editingEvent, monthlyBenefit: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="ret-inflation-adj"
                  checked={editingEvent.inflationAdjusted !== false}
                  onChange={(e) => setEditingEvent({ ...editingEvent, inflationAdjusted: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="ret-inflation-adj" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                  Inflation Adjusted (increases with cost of living)
                </label>
              </div>
            </>
          )}

          {/* WINDFALL FIELDS */}
          {type === 'windfall' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Age Received</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.ageReceived}
                  onChange={(e) => setEditingEvent({ ...editingEvent, ageReceived: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Tax Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.taxRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* COLLEGE FIELDS */}
          {type === 'college' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Start Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Annual Tuition Cost ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.tuitionCost}
                  onChange={(e) => setEditingEvent({ ...editingEvent, tuitionCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Duration (years)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.duration}
                  onChange={(e) => setEditingEvent({ ...editingEvent, duration: parseInt(e.target.value) || 4 })}
                />
              </div>
            </>
          )}

          {/* DEBT PAYOFF FIELDS */}
          {type === 'debtPayoff' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Payoff Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.payoffAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, payoffAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Payoff Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* CUSTOM FIELDS */}
          {type === 'custom' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Event Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Cash Flow ($: negative for cost)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setEditingEvent(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveEvent}
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
  };
  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  return (
    <div className="fire-simulator-container" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      
      {/* Wizard Steps Navigation Header */}
      <div className="wizard-steps-container">
        <div 
          className={`wizard-step-node ${activeStep === 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}
          onClick={() => setActiveStep(1)}
        >
          <div className="wizard-step-icon">1</div>
          <span className="wizard-step-label">Today</span>
        </div>
        <div className={`wizard-step-divider ${activeStep >= 2 ? 'active' : ''}`} />
        <div 
          className={`wizard-step-node ${activeStep === 2 ? 'active' : ''}`}
          onClick={() => {
            setActiveStep(2);
          }}
        >
          <div className="wizard-step-icon">2</div>
          <span className="wizard-step-label">Life Plan</span>
        </div>
      </div>

      {/* Screen 1: Your Life Today */}
      {activeStep === 1 && (
        <div className="today-screen-layout">
          {/* Inputs Grid */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Your Life Today</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Let's estimate your path to financial independence. Fill in your current numbers to see your baseline projection instantly.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-wrapper">
                <span className="input-name">Current Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', fontSize: '1.1rem', padding: '0.6rem 0.8rem' }}
                  value={inputs.currentAge}
                  onChange={(e) => handleStep1Change('currentAge', parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Your current age today (e.g. 35)
                </span>
              </div>

              <div className="input-wrapper">
                <span className="input-name">Life Expectancy</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', fontSize: '1.1rem', padding: '0.6rem 0.8rem' }}
                  value={inputs.lifeExpectancy}
                  onChange={(e) => handleStep1Change('lifeExpectancy', parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Age you expect to live to (e.g. 85)
                </span>
              </div>

              <div className="input-wrapper">
                <span className="input-name">Annual Income ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', fontSize: '1.1rem', padding: '0.6rem 0.8rem' }}
                  value={inputs.simpleIncome}
                  onChange={(e) => handleStep1Change('simpleIncome', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Your total yearly gross income (e.g. $120,000)
                </span>
              </div>

              <div className="input-wrapper">
                <span className="input-name">Pre-Tax Savings Rate (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', fontSize: '1.1rem', padding: '0.6rem 0.8rem' }}
                  value={simpleSavingsRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    const clampedRate = Math.min(100, Math.max(0, rate));
                    lastNonZeroSavingsRateRef.current = clampedRate;
                    const income = Number(inputs.simpleIncome) || 0;
                    const newExpenses = Math.round(income * (1 - clampedRate / 100));
                    handleStep1Change('simpleExpenses', newExpenses);
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Percent of income saved pre-tax (e.g. 20%)
                </span>
              </div>

              <div className="input-wrapper">
                <span className="input-name">Current Savings ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', fontSize: '1.1rem', padding: '0.6rem 0.8rem' }}
                  value={inputs.simpleInvestments}
                  onChange={(e) => handleStep1Change('simpleInvestments', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  Your total savings, retirement, and investment accounts combined (e.g. $250,000)
                </span>
              </div>

            </div>

          </div>

          {/* Immediate Value Display Progress Board */}
          <div className="progress-board-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Your Financial Snapshot</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Your current starting point parameters:
              </p>
            </div>

            {/* Positive Metrics Deck */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%' }}>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.15rem' }}>
                  Annual Income
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {formatCurrency(inputs.simpleIncome)}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.15rem' }}>
                  Pre-Tax Savings Rate
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {simpleSavingsRate}%
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.15rem' }}>
                  Annual Surplus
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                  {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.15rem' }}>
                  Current Net Worth
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {formatCurrency(totalNetWorth)}
                </span>
              </div>
            </div>

            {/* Encouraging Insights */}
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Starting Point Insights
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span>💡</span>
                  <span>
                    {simpleSavingsRate >= 15 
                      ? `Strong Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                      : simpleSavingsRate > 0
                        ? `Good Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax. Every bit helps build momentum!`
                        : `Action Plan: Try adjusting your spending to create a surplus and start saving.`}
                  </span>
                </div>
                {inputs.simpleIncome - inputs.simpleExpenses > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                    <span>🌱</span>
                    <span>
                      {`Annual Investing: You have approximately ${formatCurrency(inputs.simpleIncome - inputs.simpleExpenses)} per year available to build wealth.`}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span>✨</span>
                  <span>
                    {`Current Status: This is your starting point. Future career growth and life decisions can dramatically change your timeline.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Next Step CTA */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Next Step
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Now let’s see how future life choices affect your path.
                </span>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', fontWeight: '700', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
                onClick={() => {
                  setActiveStep(2);
                }}
              >
                Build My Life Plan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Your Life Plan */}
      {activeStep === 2 && (
        <div className="roadmap-step-container">
          
          {/* visual Retirement Plan Summary Card (Full-Width at Top) */}
          {(() => {
            const details = getOutcomeDetails(
              activeResults.retirementOutcome,
              activeResults.runOutAge,
              inputs.readinessCriteria,
              activeResults.retirementReadyAge,
              inputs.lifeExpectancy
            );
            return (
              <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    🏆 Retirement Plan Summary
                  </h3>
                  <div className="segmented-control-container" style={{ margin: 0, minWidth: '400px', width: '100%', maxWidth: '500px' }}>
                    <div className="segmented-control" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', display: 'flex', width: '100%' }}>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsLifeExp' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsLifeExp' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsLifeExp' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsLifeExp')}
                      >
                        Sustainable
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: 'var(--primary)' }}>Sustainable Retirement:</strong> Money is projected to last through planned Life Expectancy (Age {inputs.lifeExpectancy || 85}), drawing the portfolio down to $0.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsComfortable' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsComfortable' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsComfortable' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsComfortable')}
                      >
                        Comfortable
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: '#fbbf24' }}>Comfortable Retirement:</strong> Money is projected to last 10 years beyond planned Life Expectancy (Age {Number(inputs.lifeExpectancy || 85) + 10}), providing a solid longevity safety buffer.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`segmented-control-btn ${inputs.readinessCriteria === 'lastsIndefinitely' ? 'active' : ''}`}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.7rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: inputs.readinessCriteria === 'lastsIndefinitely' ? 'var(--primary)' : 'transparent',
                          color: inputs.readinessCriteria === 'lastsIndefinitely' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => updateInput('readinessCriteria', 'lastsIndefinitely')}
                      >
                        Indefinite
                        <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                          <span className="toggle-tooltip-icon">i</span>
                          <span className="toggle-tooltip-text">
                            <strong style={{ color: '#10b981' }}>Indefinite Retirement:</strong> Portfolio meets the Safe Withdrawal Rate (SWR) target, ensuring it remains intact or grows, lasting indefinitely.
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Outcome Banner (Compact) */}
                <div style={{ 
                  background: details.bg, 
                  border: `1px solid ${details.color}44`, 
                  borderRadius: '6px', 
                  padding: '0.5rem 0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: '800', color: details.color }}>
                    {details.badge}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', flex: 1, minWidth: '250px' }}>
                    {details.desc}
                  </p>
                </div>
                
                {/* Planning Concepts & Key Values Grid (6-Column Compact) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                  gap: '1rem', 
                  paddingTop: '0.25rem' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Planned Retirement</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '800' }}>Age {inputs.targetRetirementAge}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'Sustainable Age' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                        ? 'Comfortable Age' 
                        : 'Indefinite Age'}
                    </span>
                    <strong style={{ fontSize: '1.15rem', color: activeResults.retirementReadyAge ? 'var(--accent-emerald)' : 'var(--text-secondary)', fontWeight: '800' }}>
                      {activeResults.retirementReadyAge ? `Age ${activeResults.retirementReadyAge}` : 'Not Reached'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'Sustainable Target' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                          ? 'Comfortable Target' 
                          : 'Indefinite Target'}
                    </span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {formatCurrency(activeResults.retirementReadyTarget)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Projected Portfolio</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {activeResults.targetRetirementAge === inputs.lifeExpectancy ? 'N/A' : formatCurrency(activeResults.portfolioAtRetirement)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Retirement Income</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '800' }}>{formatCurrency(activeResults.retirementIncomeSources)} / yr</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Annual Spending</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {formatCurrency(activeResults.annualRetirementSpending)} / yr
                    </strong>
                  </div>
                </div>

                {/* Retirement Improvement Plan Banner (Compact) */}
                {improvementPlan && improvementPlan.rankedPlan.length > 0 && (
                  <div className="improvement-banner-container" style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-light)' }}>💡 Action Plan Available:</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Adjustments are available to improve your projection.</span>
                    </div>
                    <button
                      type="button"
                      className="improvement-banner-btn"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', margin: 0 }}
                      onClick={() => setShowImprovementModal(true)}
                    >
                      View Action Plan
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* Centerpiece Timeline */}
          <div className="glass-card timeline-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Interactive Roadmap</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Click milestones to view details</span>
              </div>
              <div style={{ width: '100%', maxWidth: '280px' }}>
                <select
                  className="add-event-dropdown"
                  style={{ width: '100%' }}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateEvent(e.target.value);
                      e.target.value = ''; // reset selection
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>➕ Add Life Decision or Milestone...</option>
                  <option value="buyHouse">🏠 Buy a House</option>
                  <option value="haveChild">👶 Have a Child</option>
                  <option value="careerChange">💼 Career Change</option>
                  <option value="move">📍 Move / Relocate</option>
                  <option value="retire">🏖 Retire</option>
                  <option value="socialSecurity">💰 Social Security</option>
                  <option value="pension">📜 Pension</option>
                  <option value="rentalIncome">🏢 Rental Income</option>
                  <option value="annuity">📈 Annuity</option>
                  <option value="otherRetirementIncome">💵 Other Income</option>
                  <option value="windfall">💰 Windfall</option>
                  <option value="college">🎓 College Costs</option>
                  <option value="debtPayoff">💸 Debt Payoff</option>
                  <option value="custom">➕ Custom Event</option>
                </select>
              </div>
            </div>

            {/* Horizontal Timeline (Desktop) */}
            <div className="timeline-wrapper">
              <div className="timeline-track-container" style={{ height: '140px' }}>
                <div className="timeline-line-axis" style={{ top: '105px' }} />
                <div
                  className="timeline-progress-line"
                  style={{
                    top: '105px',
                    width: activeResults.targetRetirementAge 
                      ? `calc((100% - 140px) * ${Math.max(0, Math.min(100, (((activeResults.targetRetirementAge) - inputs.currentAge) / (inputs.lifeExpectancy - inputs.currentAge)) * 100))} / 100)`
                      : '0px'
                  }}
                />

                {/* Chronological Axis Number Line Ticks */}
                <div className="timeline-ticks-container" style={{ position: 'absolute', top: '105px', left: 0, right: 0, height: '30px', zIndex: 1, pointerEvents: 'none' }}>
                  {(() => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    const ticks = [];
                    const tickInterval = 5;
                    const startTick = Math.ceil(inputs.currentAge / tickInterval) * tickInterval;
                    const endTick = Math.floor(inputs.lifeExpectancy / tickInterval) * tickInterval;
                    for (let age = startTick; age <= endTick; age += tickInterval) {
                      ticks.push(age);
                    }
                    return ticks.map((age, idx) => {
                      const percent = totalYears > 0 ? ((age - inputs.currentAge) / totalYears) * 100 : 0;
                      const leftOffset = `calc(70px + (100% - 140px) * ${percent} / 100)`;
                      return (
                        <div key={idx} className="timeline-tick" style={{ position: 'absolute', left: leftOffset, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className="timeline-tick-mark" style={{ width: '2px', height: '6px', background: 'var(--border-color)', opacity: 0.8 }} />
                          <span className="timeline-tick-label" style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-tertiary)', marginTop: '4px' }}>{age}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <div className="timeline-events-container">
                  {timelineEvents.map((evt, idx) => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    const isDraggingThis = !!(draggingInfo && (
                      (evt.originalId && draggingInfo.originalId === evt.originalId) ||
                      (!evt.originalId && draggingInfo.type === evt.type)
                    ));

                    const displayAge = isDraggingThis ? draggingInfo.currentAge : evt.age;
                    const percent = totalYears > 0 ? ((displayAge - inputs.currentAge) / totalYears) * 100 : 0;
                    const leftOffset = `calc(70px + (100% - 140px) * ${percent} / 100)`;

                    return (
                      <div
                        key={idx}
                        className={`timeline-node ${evt.isMilestone ? 'milestone' : ''} ${evt.age <= activeResults.targetRetirementAge ? 'active' : ''} ${isDraggingThis ? 'dragging' : ''}`}
                        style={{ 
                          left: leftOffset, 
                          top: `${93 - (evt.stackIndex * 24)}px`, 
                          transform: 'translateX(-50%)',
                          cursor: isDraggingThis ? 'grabbing' : isEditableEvent(evt) ? 'grab' : 'pointer'
                        }}
                        onMouseDown={(e) => handleNodeDragStart(e, evt)}
                        onTouchStart={(e) => handleNodeDragStart(e, evt)}
                        onClick={(e) => {
                          if (dragOccurredRef.current) {
                            e.stopPropagation();
                            return;
                          }
                          setSelectedTimelineEvent(evt);
                          setSelectedYear(Math.floor(evt.age));
                        }}
                      >
                        <div className="timeline-node-dot">
                          {evt.icon}
                          {/* Premium hover tooltip */}
                          <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                            <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                              {evt.title}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '150px', lineHeight: '1.3' }}>
                              Age {displayAge} • {evt.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Clickable Event Details Card Panel */}
            {selectedTimelineEvent && (
              <div className="timeline-event-details-card" style={{ marginTop: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTimelineEvent(null)}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ✖
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{selectedTimelineEvent.icon}</span>
                  <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Age {selectedTimelineEvent.age} - {selectedTimelineEvent.title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {selectedTimelineEvent.description}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {isEditableEvent(selectedTimelineEvent) && (
                    <button
                      type="button"
                      className="list-builder-edit-btn"
                      onClick={() => {
                        handleEditRoadmapEvent(selectedTimelineEvent);
                        setSelectedTimelineEvent(null);
                      }}
                    >
                      ✏️ Edit Event
                    </button>
                  )}
                  {!selectedTimelineEvent.isMilestone && (
                    <button
                      type="button"
                      className="list-builder-remove-btn"
                      style={{ padding: '0.2rem 0.5rem', alignSelf: 'flex-start' }}
                      onClick={() => {
                        handleDeleteRoadmapEvent(selectedTimelineEvent);
                        setSelectedTimelineEvent(null);
                      }}
                    >
                      🗑️ Remove Event
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Vertical Timeline (Mobile Stacked) */}
            <div className="vertical-timeline-container">
              <div className="vertical-timeline-line" />
              {timelineEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className={`vertical-timeline-node ${evt.isMilestone ? 'milestone' : ''} ${evt.age <= activeResults.targetRetirementAge ? 'active' : ''}`}
                  onClick={() => setSelectedTimelineEvent(evt)}
                >
                  <div className="vertical-timeline-dot">
                    {evt.icon}
                  </div>
                  <div className="vertical-timeline-content">
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="vertical-timeline-age">Age {evt.age} - {evt.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isEditableEvent(evt) && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRoadmapEvent(evt);
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        {!evt.isMilestone && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoadmapEvent(evt);
                              setSelectedTimelineEvent(null);
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="vertical-timeline-label">{evt.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Net Worth Trajectory Graph (Full Width, directly below timeline) */}
          {validation.errors.length === 0 && (
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Net Worth Trajectory</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Updates live • Click chart to view detailed benchmarks below</span>
              </div>
              <div className="chart-container-inner" style={{ height: '240px', cursor: 'crosshair' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activeResults.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedYear(Number(data.activeLabel));
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="age"
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={10}
                    />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontFamily="var(--font-body)"
                      fontSize={10}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="custom-chart-tooltip">
                              <p style={{ fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                                Age {label}
                              </p>
                              {payload.map((item) => (
                                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '0.2rem 0' }}>
                                  <span style={{ color: item.stroke || item.color, fontWeight: '500' }}>{item.name}:</span>
                                  <span style={{ fontWeight: '700' }}>{formatCurrency(item.value)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke={colorBlindMode ? '#ea580c' : '#6366f1'}
                      strokeWidth={2}
                      dot={false}
                    />

                    {/* 1. Planned Retirement Age */}
                    {activeResults.targetRetirementAge && (
                      <ReferenceLine
                        x={activeResults.targetRetirementAge}
                        stroke="#a855f7"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Retirement: Age ${activeResults.targetRetirementAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 10
                        }}
                      />
                    )}

                    {/* 2. Retirement Ready Age */}
                    {activeResults.retirementReadyAge && (
                      <ReferenceLine
                        x={activeResults.retirementReadyAge}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `${inputs.readinessCriteria === 'lastsLifeExp' ? 'Sustainable' : inputs.readinessCriteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite'} Ready: Age ${activeResults.retirementReadyAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 25
                        }}
                      />
                    )}

                    {/* 3. Assets Depleted Age */}
                    {activeResults.runOutAge && (
                      <ReferenceLine
                        x={activeResults.runOutAge}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Assets Run Out: Age ${activeResults.runOutAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 40
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="roadmap-grid-layout">
            
            {/* Left Column: Plan Story */}
            <div className="roadmap-grid-col-left">
              {/* Life Story Summary */}
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                <h2 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Life Plan</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                  Select a life decision or milestone from the dropdown above the timeline to add it. Drag events on the timeline above or edit them below to map out your roadmap.
                </p>
                {generateLifeStory(inputs, activeResults)}
              </div>
            </div>

            {/* Right Column: Graphs, Snapshot, and Settings */}
            <div className="roadmap-grid-col-right">

              {/* Benchmarks Snapshot */}
              {validation.errors.length === 0 && (() => {
                const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
                const yearData = activeResults.data.find(d => d.age === activeYear);
                if (!yearData) return null;

                const isWorking = activeYear < activeResults.targetRetirementAge;
                
                return (
                  <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        🔍 Age {activeYear} Financial Snapshot
                      </h3>
                      <span className="badge" style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.2rem 0.6rem', 
                        background: isWorking ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                        color: isWorking ? 'var(--primary)' : 'var(--accent-emerald)',
                        border: `1px solid ${isWorking ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        {isWorking ? 'Working' : 'Retired'}
                      </span>
                    </div>

                    {/* KPI Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Net Worth</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.netWorth)}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Portfolio Value</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.portfolio)}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Income</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>{formatCurrency(yearData.income)}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Annual Spending</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                          {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                        </strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Taxes Paid</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                          {formatCurrency(yearData.taxes || 0)}
                        </strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {yearData.withdrawals > 0 ? 'Withdrawals' : 'Net Savings'}
                        </span>
                        <strong style={{ 
                          fontSize: '1.05rem', 
                          color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', 
                          display: 'block', 
                          marginTop: '0.25rem' 
                        }}>
                          {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                        </strong>
                      </div>
                    </div>

                    {/* Account Balances Breakdown */}
                    <div style={{ marginTop: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                        💼 Account Balances Breakdown
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Cash / Reserves:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency((yearData.cashBalance || 0) + (yearData.emergencyFundBalance || 0))}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Taxable Brokerage:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.brokerageBalance || 0)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Pre-Tax (401k/IRA):</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency((yearData.trad401kBalance || 0) + (yearData.tradIraBalance || 0))}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Roth IRA:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.rothIraBalance || 0)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>HSA Balance:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.hsaBalance || 0)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Other Investments:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.otherBalance || 0)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Property / Debt info if active */}
                    {(yearData.homeValue > 0 || yearData.mortgageBalance > 0 || yearData.debtBalance > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                        {yearData.homeValue > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            🏠 <span>Property Value: </span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(yearData.homeValue)}</strong>
                          </div>
                        )}
                        {yearData.mortgageBalance > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            📝 <span>Mortgage Balance: </span>
                            <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(yearData.mortgageBalance)}</strong>
                          </div>
                        )}
                        {yearData.debtBalance > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            🛑 <span>Outstanding Debt: </span>
                            <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(yearData.debtBalance)}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Advanced Detail Collapsible Accordion (Simulation Assumptions) */}
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                <button
                  type="button"
                  className="collapsible-trigger-btn"
                  onClick={() => setExpandedAdvancedDetail(!expandedAdvancedDetail)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    ⚙️ Advanced Detail
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{expandedAdvancedDetail ? 'Hide ▲' : 'Show Details ▼'}</span>
                </button>
                
                {expandedAdvancedDetail && (
                  <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Pre-Retire Return (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={inputs.expectedReturn}
                          step="0.1"
                          onChange={(e) => updateInput('expectedReturn', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Post-Retire Return (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={inputs.postRetirementReturn !== undefined ? inputs.postRetirementReturn : inputs.expectedReturn}
                          step="0.1"
                          onChange={(e) => updateInput('postRetirementReturn', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Inflation Rate (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={inputs.inflationRate}
                          step="0.1"
                          onChange={(e) => updateInput('inflationRate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="input-wrapper" style={{ position: 'relative' }}>
                        <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="input-name">Lifestyle Upgrades (%)</span>
                          <span className="tooltip-icon">?</span>
                          <span className="tooltip-text">
                            At 0%, your spending only increases with inflation. Increase this if you plan to upgrade your lifestyle over time (spending grows faster than inflation).
                          </span>
                        </div>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', marginTop: '0.15rem' }}
                          value={inputs.lifestyleUpgrades !== undefined ? inputs.lifestyleUpgrades : 0}
                          step="0.1"
                          min="0"
                          max="100"
                          onChange={(e) => updateInput('lifestyleUpgrades', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">SWR (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={inputs.swr}
                          step="0.1"
                          onChange={(e) => updateInput('swr', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={inputs.includeTaxes}
                          onChange={(e) => updateInput('includeTaxes', e.target.checked)}
                        />
                        Include Taxes (U.S. Federal Progressive)
                      </label>
                      {inputs.includeTaxes && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <div className="input-wrapper" style={{ maxWidth: '300px' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Filing Status</span>
                            <select
                              className="input-number-box"
                              style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem', textAlign: 'left' }}
                              value={inputs.filingStatus || 'single'}
                              onChange={(e) => updateInput('filingStatus', e.target.value)}
                            >
                              <option value="single">Single Filer</option>
                              <option value="married">Married Filing Jointly</option>
                            </select>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                            ℹ️ Taxes are calculated using progressive brackets (10% to 37%) and standard deductions ($16,100 Single / $32,200 Married for 2026), inflated annually.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Healthcare & Medicare Bridge */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={inputs.enableHealthcareModel !== false}
                          onChange={(e) => updateInput('enableHealthcareModel', e.target.checked)}
                        />
                        🏥 Enable Healthcare & Medicare Bridge
                      </label>
                      {inputs.enableHealthcareModel !== false && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            <div className="input-wrapper">
                              <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span className="input-name">Pre-Medicare Cost ($/yr)</span>
                                <span className="tooltip-icon">?</span>
                                <span className="tooltip-text">
                                  Estimated annual cost of private health insurance (ACA/COBRA) if you retire before age 65.
                                </span>
                              </div>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', marginTop: '0.15rem' }}
                                value={inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000}
                                step="500"
                                onChange={(e) => updateInput('preMedicarePremium', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="input-wrapper">
                              <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span className="input-name">Medicare Cost ($/yr)</span>
                                <span className="tooltip-icon">?</span>
                                <span className="tooltip-text">
                                  Estimated annual cost of Medicare premiums and out-of-pocket costs after age 65.
                                </span>
                              </div>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', marginTop: '0.15rem' }}
                                value={inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000}
                                step="200"
                                onChange={(e) => updateInput('medicarePremium', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                            ℹ️ Pre-Medicare costs apply from retirement age until age 65. Medicare eligibility starts at age 65. Both are adjusted for inflation.
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>FIRE Strategy Mode</span>
                      <div className="segmented-control">
                        {[
                          { val: 'traditional', label: 'Traditional' },
                          { val: 'coast', label: 'Coast' },
                          { val: 'barista', label: 'Barista' },
                          { val: 'lean', label: 'Lean' },
                          { val: 'fat', label: 'Fat' }
                        ].map(modeItem => (
                          <button
                            key={modeItem.val}
                            type="button"
                            className={`segmented-control-btn ${inputs.fireMode === modeItem.val ? 'active' : ''}`}
                            onClick={() => updateInput('fireMode', modeItem.val)}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {modeItem.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Render the modal at the step root, outside any glass-card */}
          {editingEvent && renderEventForm(editingEvent)}

          {showImprovementModal && improvementPlan && improvementPlan.rankedPlan.length > 0 && (
            <div className="modal-backdrop" onClick={() => setShowImprovementModal(false)}>
              <div className="improvement-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="improvement-modal-header">
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    💡 Retirement Improvement Plan
                  </h3>
                  <button 
                    type="button" 
                    className="improvement-modal-close-btn"
                    onClick={() => setShowImprovementModal(false)}
                  >
                    &times;
                  </button>
                </div>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: '1.45' }}>
                  Your current path may not fully support retirement. We've generated a personalized action plan with adjustments that could improve your projection. Earning more, saving more, or retiring slightly later can make a massive difference:
                </p>

                <div className="improvement-plan-grid">
                  {improvementPlan.rankedPlan.map((scenario) => {
                    const isBalanced = scenario.type === 'combined';
                    return (
                      <div 
                        key={scenario.type} 
                        className={`improvement-plan-card ${isBalanced ? 'improvement-plan-card-balanced' : ''} ${isBalanced ? 'improvement-plan-grid-balanced' : ''}`}
                      >
                        <div className="improvement-plan-card-main-content">
                          <div className="improvement-plan-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 className="improvement-plan-card-title">
                              <span style={{ marginRight: '0.3rem' }}>{scenario.icon}</span>
                              <span>{scenario.title}</span>
                            </h4>
                            {isBalanced && (
                              <span className="improvement-plan-card-badge improvement-plan-card-badge-recommended" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)', letterSpacing: '0.05em' }}>
                                {scenario.badge}
                              </span>
                            )}
                          </div>
                          <div className="improvement-plan-card-details">
                            <p className="improvement-plan-card-description">
                              {scenario.details}
                            </p>
                            {scenario.bulletPoints && scenario.bulletPoints.length > 0 && (
                              <ul className="improvement-plan-card-bullets">
                                {scenario.bulletPoints.map((pt, i) => (
                                  <li key={i}>{pt}</li>
                                ))}
                              </ul>
                            )}
                            {scenario.extraAction && (
                              <p className="improvement-plan-card-extra">
                                {scenario.extraAction}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="improvement-plan-card-kpi-block">
                          <div className="improvement-plan-kpi-item">
                            <span className="kpi-item-label">Estimated Ready Age</span>
                            <strong className="kpi-item-value">Age {scenario.readyAge}</strong>
                          </div>
                          <div className="improvement-plan-kpi-item">
                            <span className="kpi-item-label">Retirement Gain</span>
                            <strong className="kpi-item-value gain-value" style={{ fontSize: '0.8rem' }}>
                              {scenario.yearsImprovement !== null && scenario.yearsImprovement > 0 ? (
                                `⚡ ${scenario.yearsImprovement} ${scenario.yearsImprovement === 1 ? 'Year' : 'Years'} Sooner (vs. Age ${activeResults.retirementReadyAge} on current path)`
                              ) : (
                                '✨ Sustainable!'
                              )}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="improvement-plan-card-apply-btn"
                          onClick={() => handleApplyImprovementScenario(scenario)}
                        >
                          Apply Scenario
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', borderRadius: '6px' }}
                    onClick={() => setShowImprovementModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Calculation Assumptions & Methodology Footer Section */}
      <div className="glass-card" style={{ padding: '1.5rem', marginTop: '2rem', textAlign: 'left' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📝 Calculation Assumptions & Methodology
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          To maintain financial realism, the FIRE Retirement Simulator operates under several standard U.S. financial planning and tax rules. Key calculations and background assumptions include:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🏖 Retirement Spending Model
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Target retirement spending defaults to <strong>{inputs.isAdvancedMode ? 'your customized spending phases' : '70% of pre-retirement lifestyle spending'}</strong> (not final salary), ensuring SWR targets scale with actual lifestyle costs rather than gross income.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              💰 Social Security Claiming Scale
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Benefits scale dynamically based on the claiming age relative to Full Retirement Age (FRA, age 67):
              <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
                • Age 62 (Early Claiming): <strong>70%</strong> of full benefit.<br />
                • Age 67 (Full Retirement): <strong>100%</strong> of benefit.<br />
                • Age 70 (Delayed Credits): <strong>124%</strong> of benefit.<br />
                • Prior to claiming age, benefit is <strong>$0</strong>.
              </span>
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🏥 Healthcare & Medicare Bridge
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              If enabled, retirees pay an unsubsidized pre-Medicare premium bridge (default <strong>$10,000/yr</strong>) until age <strong>65</strong>. At age 65, costs automatically transition to Medicare premiums (default <strong>$4,000/yr</strong>).
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              📈 Annual Inflation Adjustments
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              All variables—including standard salary growth, spending phases, Social Security benefits, pension income, tax brackets, and health insurance premiums—are adjusted annually using the inflation rate to report final values in constant, today's dollars.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🔄 Portfolio Drawdown Order
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Deficits are covered from liquid accounts in a strict tax-efficient hierarchy: Cash → Emergency Fund → Taxable Brokerage → Pre-tax (Traditional 401k/IRA, grossed up to cover taxes) → Roth accounts → HSA → Other.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              ⚖️ Taxation & Standard Deductions
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Pre-tax withdrawals (Traditional 401k/IRA) are taxed as ordinary income. The engine simulates standard deductions and federal income tax brackets (Single or Married Filing Jointly) adjusted annually for inflation.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
