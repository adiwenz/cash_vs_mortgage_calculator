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
import { runFireSimulation, validateFireInputs, getSocialSecurityFactor, validateSocialSecurityClaimAge, calculateSocialSecurityBenefit, getIncomeHistory, calculateTop35AverageIncome, calculateClaimingAgeMultiplier, getNormalizedPhases } from '../fireCalculations';
import { 
  calculateRetireAt65Recommendation, 
  calculateSaveMoreRecommendation, 
  calculateEarnMoreRecommendation,
  getChildCostOffsetRecommendations
} from '../recommendations';
import './FireSimulator.css';

import { DEFAULT_FIRE_INPUTS } from '../defaultInputs';
import {
  estimateAdditionalMonthlySavings,
  getReasonableSavingsAllocation,
  calculateUSTaxForModal,
  calculateLoanPayoff,
  propPIAmount,
  calculatePeakChildCosts,
  getActiveChildrenCountAtAge,
  getBaseCareerIncomeAtAge,
  getChildCountIntervals,
  getChildCostsForInterval
} from '../simulatorMathUtils';

// Help formatters
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const formatYAxis = (val) => {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  if (val <= -1e6) return `-$${(Math.abs(val) / 1e6).toFixed(1)}M`;
  if (val <= -1e3) return `-$${(Math.abs(val) / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

const getOutcomeDetails = (outcome, runOutAge, readinessCriteria, retirementReadyAge, lifeExpectancy) => {
  switch (outcome) {
    case 'comfortable':
      return {
        label: 'Comfortable Retirement',
        badge: '🟢 Comfortable',
        color: 'var(--accent-emerald)',
        bg: 'rgba(16, 185, 129, 0.1)',
        desc: `Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age ${Number(lifeExpectancy || 85) + 10}).`
      };
    case 'sustainable':
      return {
        label: 'Sustainable Retirement',
        badge: '🟡 Sustainable',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.1)',
        desc: `Your projected assets remain positive through life expectancy (Age ${lifeExpectancy || 85}), but do not meet the 10-year safety buffer.`
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
        desc: 'Your projected assets remain positive through life expectancy. Your portfolio gradually declines but is projected to last.'
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
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, amount: (Number(inc.amount) || 0) + extraIncome };
        }
        return inc;
      })
    };
  }

  if (type === 'combined') {
    const savingsPercent = value && typeof value === 'object' ? value.savings : 3;
    const yearsDelay = value && typeof value === 'object' ? value.delay : 2;

    const savingsDelta = (savingsPercent / 100 * currentIncome);
    const newExpenses = Math.round(Math.max(0, currentExpenses - savingsDelta));
    const newRetirementAge = currentInputs.targetRetirementAge + yearsDelay;

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
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
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

  if (type === 'retire65') {
    const target65Age = currentInputs.currentAge < 65 ? 65 : currentInputs.currentAge;
    const deltaRate = value;
    const annualSavingsDelta = (deltaRate * currentIncome) / 100;
    const newExpenses = Math.round(Math.max(0, currentExpenses - annualSavingsDelta));

    return {
      ...currentInputs,
      targetRetirementAge: target65Age,
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
        if (inc.id && (inc.id.startsWith('simple-inc-childcare') || inc.id.startsWith('simple-inc-prechild') || inc.id.startsWith('child-income-boost'))) return inc;
        if (inc.id === 'simple-inc' || (inc.id && inc.id.startsWith('simple-inc-worksave')) || inc.name.toLowerCase().includes('job') || inc.name.toLowerCase().includes('salary')) {
          return { ...inc, endAge: target65Age };
        }
        return inc;
      }),
      lifeEvents: currentInputs.lifeEvents.map(ev => {
        if (ev.type === 'retire') {
          return { ...ev, age: target65Age };
        }
        return ev;
      })
    };
  }

  return currentInputs;
};

const getPaceBadgeStyles = (savingsFocus) => {
  if (!savingsFocus) return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)'
  };
  const focusLower = savingsFocus.toLowerCase();
  if (focusLower.includes('tip')) {
    return {
      color: 'var(--primary)',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.3)'
    };
  }
  if (focusLower.includes('steady')) {
    return {
      color: '#10b981',
      background: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.3)'
    };
  }
  if (focusLower.includes('gentle') || focusLower.includes('work')) {
    return {
      color: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.12)',
      border: '1px solid rgba(59, 130, 246, 0.3)'
    };
  }
  if (focusLower.includes('balanced')) {
    return {
      color: '#6366f1',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.3)'
    };
  }
  if (focusLower.includes('moderate') || focusLower.includes('save')) {
    return {
      color: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    };
  }
  if (focusLower.includes('earnings') || focusLower.includes('active') || focusLower.includes('earn')) {
    return {
      color: '#8b5cf6',
      background: 'rgba(139, 92, 246, 0.12)',
      border: '1px solid rgba(139, 92, 246, 0.3)'
    };
  }
  if (focusLower.includes('accelerated') || focusLower.includes('proactive') || focusLower.includes('dynamic')) {
    return {
      color: '#ec4899',
      background: 'rgba(236, 72, 153, 0.12)',
      border: '1px solid rgba(236, 72, 153, 0.3)'
    };
  }
  return {
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)'
  };
};
const syncChildcarePhasesAndRules = (newInputs) => {
  // Budget calculations and rules are now built dynamically from getNormalizedPhases
};

export default function FireSimulator() {
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [currentScenarioId, setCurrentScenarioId] = useState('baseline');
  const [newEventSelectorType, setNewEventSelectorType] = useState('buyHouse');
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showAssets, setShowAssets] = useState(true);
  const [showDebt, setShowDebt] = useState(true);
  const [showNetWorth, setShowNetWorth] = useState(true);
  const [showFinancialMilestones, setShowFinancialMilestones] = useState(false);
  const [isFullPartnerProfileOpen, setIsFullPartnerProfileOpen] = useState(false);
  const [isZeroSpendingConfirmed, setIsZeroSpendingConfirmed] = useState(false);
  const [isPartnerZeroSpendingConfirmed, setIsPartnerZeroSpendingConfirmed] = useState(false);

  // 2-Step Wizard Navigation states
  const [activeStep, setActiveStep] = useState(1);
  const [isSavingsDetailsOpen, setIsSavingsDetailsOpen] = useState(false);
  const [savingsDetails, setSavingsDetails] = useState({
    cash: 0,
    emergencyFund: 0,
    brokerage: 0,
    trad401k: 0,
    tradIra: 0,
    rothIra: 0,
    hsa: 0,
    other: 0
  });

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [showHouseAdvanced, setShowHouseAdvanced] = useState(false);
  const [isBudgetOpenFromMarriageWizard, setIsBudgetOpenFromMarriageWizard] = useState(false);
  const [activeBudgetPhase, setActiveBudgetPhase] = useState('workSave'); // 'workSave' | 'childcare'
  const [editedPhases, setEditedPhases] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({
    needs: false,
    wants: false,
    savings: false
  });
  
  // Redesigned Budget Modal States
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isEditingNeeds, setIsEditingNeeds] = useState(false);
  const [isEditingWants, setIsEditingWants] = useState(false);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('needs');


  
  // Storage for standard work phase budget details
  const [workSaveIncome, setWorkSaveIncome] = useState(4167);
  const [workSaveSavings, setWorkSaveSavings] = useState({});
  const [workSavePartnerSavings, setWorkSavePartnerSavings] = useState({});
  const [workSaveExpenses, setWorkSaveExpenses] = useState({});
  const [workSaveAllocMode, setWorkSaveAllocMode] = useState('fixed');

  // Storage for childcare phase budget details
  const [childcareIncome, setChildcareIncome] = useState(4167);
  const [childcareSavings, setChildcareSavings] = useState({});
  const [childcareExpenses, setChildcareExpenses] = useState({});
  const [childcareAllocMode, setChildcareAllocMode] = useState('fixed');
  const [childcareBudgets, setChildcareBudgets] = useState({});
  const [applyToFutureBudgets, setApplyToFutureBudgets] = useState(true);

  const [budgetGrossIncome, setBudgetGrossIncome] = useState(50000);
  const [budgetFilingStatus, setBudgetFilingStatus] = useState('single');
  const [budgetHsaCoverage, setBudgetHsaCoverage] = useState('single');
  const [savingsAllocMode, setSavingsAllocMode] = useState('fixed'); // 'fixed' | 'percentSurplus'
  const [budgetSavings, setBudgetSavings] = useState({
    trad401k: 100,
    rothIra: 50,
    tradIra: 0,
    hsa: 50,
    brokerage: 0,
    checking: 50,
    hysa: 50,
    emergency: 26,
    debt: 0,
    other: 0
  });
  const [budgetPartnerSavings, setBudgetPartnerSavings] = useState({
    trad401k: 0,
    rothIra: 0,
    tradIra: 0,
    hsa: 0,
    brokerage: 0,
    cash: 0,
    debt: 0
  });
  const [budgetExpenses, setBudgetExpenses] = useState({
    housing: 1500,
    utilities: 300,
    food: 400,
    diningOut: 200,
    transportation: 400,
    healthcare: 300,
    leisure: 300,
    misc: 141
  });
  const [activeBudgetTab, setActiveBudgetTab] = useState('userSavings'); // 'userSavings' | 'partnerSavings' | 'householdExpenses'
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [editingEvent, setEditingEvent] = useState(null);
  useEffect(() => {
    setShowHouseAdvanced(false);
  }, [editingEvent?.id]);
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [budgetMonthlyIncome, setBudgetMonthlyIncome] = useState(4167);
  const [budgetMonthlySpending, setBudgetMonthlySpending] = useState(3542);
  const [budgetMonthlySavings, setBudgetMonthlySavings] = useState(625);
  const [expandedAdvancedDetail, setExpandedAdvancedDetail] = useState(false);
  const [expandedMethodology, setExpandedMethodology] = useState(false);
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [notification, setNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);
  const showNotification = (message) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(message);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 2000);
  };
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [wasShortfall, setWasShortfall] = useState(false);
  const [pendingImprovement, setPendingImprovement] = useState(null);
  const [budgetDiffs, setBudgetDiffs] = useState(null);
  const [displayMode, setDisplayMode] = useState('future'); // 'future' | 'today'

  const handleCloseBudgetModal = () => {
    setIsBudgetModalOpen(false);
    setPendingImprovement(null);
    setBudgetDiffs(null);
    setIsBudgetOpenFromMarriageWizard(false);
  };
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

  // Compute temporary Social Security details for real-time modal preview
  const tempSocialSecurityDetails = useMemo(() => {
    if (!editingEvent || editingEvent.type !== 'socialSecurity') return null;
    
    const claimAge = Number(editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : 67);
    const useEarnings = editingEvent.useEarnings === true;
    
    const incomeHistory = getIncomeHistory(inputs, editingEvent);
    const { workingYears, isEligible } = calculateTop35AverageIncome(incomeHistory);
    
    if (useEarnings) {
      return calculateSocialSecurityBenefit({
        incomeHistory,
        claimAge,
        fullRetirementAge: 67,
        firstBendPoint: 1286,
        secondBendPoint: 7749,
        indexingMode: "simple"
      });
    } else {
      const fixedAnnual = (Number(editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 2000) || 0) * 12;
      const claimingMultiplierDetails = calculateClaimingAgeMultiplier({ claimAge, fullRetirementAge: 67 });
      let annualBenefit = fixedAnnual * claimingMultiplierDetails.multiplier;
      let adjustmentType = claimingMultiplierDetails.adjustmentType;
      let adjustmentMultiplier = claimingMultiplierDetails.multiplier;
      
      if (!isEligible) {
        adjustmentType = 'Not eligible';
        adjustmentMultiplier = 0;
        annualBenefit = 0;
      }
      
      return {
        claimAge,
        workingYears,
        isEligible,
        indexedEarningsHistory: [],
        top35AnnualEarnings: 0,
        averageTop35AnnualIncome: 0,
        aimeMonthly: 0,
        piaMonthly: fixedAnnual / 12,
        claimingAgeMultiplier: adjustmentMultiplier,
        monthlyBenefit: annualBenefit / 12,
        annualBenefit,
        adjustmentType
      };
    }
  }, [editingEvent, inputs]);

  // Track last non-zero savings rate to preserve it during empty/zero income editing states
  useEffect(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income > 0) {
      const rate = Math.round(((income - expenses) / income) * 100);
      lastNonZeroSavingsRateRef.current = rate;
    }
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  // Prevent body scroll when modal overlays are active
  useEffect(() => {
    if (isBudgetModalOpen || showImprovementModal || editingEvent || editingCondition) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBudgetModalOpen, showImprovementModal, editingEvent, editingCondition]);

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
          if (!hasRetire && targetRetAgeVal < lifeExpVal) {
            updatedEvents.push({
              id: 'retire-1',
              type: 'retire',
              name: 'Retirement',
              enabled: true,
              age: targetRetAgeVal,
              spendingPercent: 70
            });
          }

          const baseInputsUpdate = {
            ...scen.inputs,
            lifeEvents: updatedEvents
          };

          if (scen.inputs.budgetDetails) {
            baseInputsUpdate.incomeList = (scen.inputs.incomeList || []).map(inc => {
              if (
                (inc.id === 'simple-inc' ||
                inc.id === 'inc-1' ||
                inc.name.toLowerCase().includes('salary') ||
                inc.name.toLowerCase().includes('main income')) &&
                !inc.id.startsWith('simple-inc-childcare') &&
                !inc.id.startsWith('simple-inc-worksave') &&
                !inc.id.startsWith('simple-inc-prechild')
              ) {
                return {
                  ...inc,
                  startAge: currentAgeVal,
                  endAge: targetRetAgeVal
                };
              }
              return inc;
            });
            baseInputsUpdate.spendingPhases = (scen.inputs.spendingPhases || []).map(phase => {
              if (
                (phase.id === 'simple-spend' ||
                phase.id === 'spend-1' ||
                phase.name.toLowerCase().includes('lifestyle') ||
                phase.name.toLowerCase().includes('spending')) &&
                !phase.id.startsWith('simple-spend-childcare') &&
                !phase.id.startsWith('simple-spend-worksave') &&
                !phase.id.startsWith('simple-spend-prechild')
              ) {
                return {
                  ...phase,
                  startAge: currentAgeVal,
                  endAge: lifeExpVal
                };
              }
              return phase;
            });
          } else {
            baseInputsUpdate.assets = {
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
            };
            baseInputsUpdate.debtList = [];
            baseInputsUpdate.incomeList = [
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
            ];
            baseInputsUpdate.spendingPhases = [
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
            ];
            baseInputsUpdate.allocationRules = [
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
            ];
          }

          return {
            ...scen,
            inputs: baseInputsUpdate
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
    const res = runFireSimulation(inputs);
    console.log('[FIRE Debug] RAW INPUTS:', inputs);
    const inf = (Number(inputs.inflationRate) || 3) / 100;
    const curAge = Number(inputs.currentAge) || 35;
    const logLines = [];
    res.data.forEach(d => {
      const factor = Math.pow(1 + inf, d.age - curAge);
      logLines.push(
        `Age ${d.age}: ` +
        `Income=${Math.round(d.income * factor)}, ` +
        `ChildCosts=${Math.round(d.childCosts * factor)}, ` +
        `Expenses=${Math.round(d.expenses * factor)}, ` +
        `Savings=${Math.round(d.savings * factor)}, ` +
        `Taxes=${Math.round(d.taxes * factor)}, ` +
        `Portfolio=${Math.round(d.portfolio * factor)}, ` +
        `NetWorth=${Math.round(d.netWorth * factor)}`
      );
    });
    console.log('[FIRE Debug] YEAR-BY-YEAR LOGS:\n' + logLines.join('\n'));
    return res;
  }, [inputs]);

  const displayedResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...activeResults,
      data: isNominal ? activeResults.nominalData : activeResults.deflatedData,
      retirementReadyTarget: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? activeResults.nominalRetirementReadyTargetNoSS : activeResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? activeResults.retirementReadyTargetComfortable : activeResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? activeResults.retirementReadyTargetSurvival : activeResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? activeResults.nominalPortfolioAtRetirement : activeResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? activeResults.nominalNetWorthAtRetirement : activeResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? activeResults.nominalAnnualRetirementSpending : activeResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? activeResults.nominalEndingSurplusShortfall : activeResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? activeResults.nominalRetirementIncomeSources : activeResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retireTodayTarget: activeResults.retireTodayTarget
    };
  }, [activeResults, displayMode]);

  const displayedBaselineResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...baselineResults,
      data: isNominal ? baselineResults.nominalData : baselineResults.deflatedData,
      retirementReadyTarget: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? baselineResults.nominalRetirementReadyTargetNoSS : baselineResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? baselineResults.retirementReadyTargetComfortable : baselineResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? baselineResults.retirementReadyTargetSurvival : baselineResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? baselineResults.nominalPortfolioAtRetirement : baselineResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? baselineResults.nominalNetWorthAtRetirement : baselineResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? baselineResults.nominalAnnualRetirementSpending : baselineResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? baselineResults.nominalEndingSurplusShortfall : baselineResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? baselineResults.nominalRetirementIncomeSources : baselineResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retireTodayTarget: baselineResults.retireTodayTarget
    };
  }, [baselineResults, displayMode]);

  const chartData = useMemo(() => {
    if (!displayedResults.data || displayedResults.data.length === 0) return [];
    
    const cash = Number(inputs.assets?.cash) || 0;
    const emergencyFund = Number(inputs.assets?.emergencyFund) || 0;
    const brokerage = Number(inputs.assets?.brokerage) || 0;
    const trad401k = Number(inputs.assets?.trad401k) || 0;
    const tradIra = Number(inputs.assets?.tradIra) || 0;
    const rothIra = Number(inputs.assets?.rothIra) || 0;
    const hsa = Number(inputs.assets?.hsa) || 0;
    const other = Number(inputs.assets?.other) || 0;
    
    const currentConditions = inputs.currentConditions || [];
    const customAssetsStartingValue = currentConditions
      .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const customHousesStartingValue = currentConditions
      .filter(c => c.type === 'house')
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const homeValueBaseline = (Number(inputs.assets?.realEstate) || 0) + customHousesStartingValue;
    
    const startingPortfolio = cash + emergencyFund + brokerage + trad401k + tradIra + rothIra + hsa + other + customAssetsStartingValue;
    const startingAssets = startingPortfolio + homeValueBaseline;
    
    const customDebtsSum = currentConditions
      .filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0)
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const baseActiveLoansSum = (inputs.debtList || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
    
    const houseAssets = inputs.houseAssets || [];
    const houseMortgagesSum = houseAssets.reduce((sum, h) => {
      if (h.hasMortgage && h.mortgage) {
        return sum + (Number(h.mortgage.balance) || 0);
      }
      return sum;
    }, 0);
    
    const startingDebt = baseActiveLoansSum + customDebtsSum + houseMortgagesSum;
    const startingNetWorth = startingAssets - startingDebt;

    return displayedResults.data.map((log, idx) => {
      if (idx === 0) {
        return {
          ...log,
          assets: startingAssets,
          debt: startingDebt,
          portfolio: startingPortfolio,
          netWorth: startingNetWorth
        };
      } else {
        const prevLog = displayedResults.data[idx - 1];
        return {
          ...log,
          assets: prevLog.assets,
          debt: prevLog.debt,
          portfolio: prevLog.portfolio,
          netWorth: prevLog.netWorth
        };
      }
    });
  }, [displayedResults.data, inputs]);

  const baselineChartData = useMemo(() => {
    if (!displayedBaselineResults.data || displayedBaselineResults.data.length === 0) return [];
    
    const cash = Number(inputs.assets?.cash) || 0;
    const emergencyFund = Number(inputs.assets?.emergencyFund) || 0;
    const brokerage = Number(inputs.assets?.brokerage) || 0;
    const trad401k = Number(inputs.assets?.trad401k) || 0;
    const tradIra = Number(inputs.assets?.tradIra) || 0;
    const rothIra = Number(inputs.assets?.rothIra) || 0;
    const hsa = Number(inputs.assets?.hsa) || 0;
    const other = Number(inputs.assets?.other) || 0;
    
    const currentConditions = inputs.currentConditions || [];
    const customAssetsStartingValue = currentConditions
      .filter(c => ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type))
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const customHousesStartingValue = currentConditions
      .filter(c => c.type === 'house')
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const homeValueBaseline = (Number(inputs.assets?.realEstate) || 0) + customHousesStartingValue;
    
    const startingPortfolio = cash + emergencyFund + brokerage + trad401k + tradIra + rothIra + hsa + other + customAssetsStartingValue;
    const startingAssets = startingPortfolio + homeValueBaseline;
    
    const customDebtsSum = currentConditions
      .filter(c => c.type === 'debt' && c.creditCardHandling !== 'payoff' && (Number(c.value) || 0) > 0)
      .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const baseActiveLoansSum = (inputs.debtList || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
    
    const houseAssets = inputs.houseAssets || [];
    const houseMortgagesSum = houseAssets.reduce((sum, h) => {
      if (h.hasMortgage && h.mortgage) {
        return sum + (Number(h.mortgage.balance) || 0);
      }
      return sum;
    }, 0);
    
    const startingDebt = baseActiveLoansSum + customDebtsSum + houseMortgagesSum;
    const startingNetWorth = startingAssets - startingDebt;

    return displayedBaselineResults.data.map((log, idx) => {
      if (idx === 0) {
        return {
          ...log,
          assets: startingAssets,
          debt: startingDebt,
          portfolio: startingPortfolio,
          netWorth: startingNetWorth
        };
      } else {
        const prevLog = displayedBaselineResults.data[idx - 1];
        return {
          ...log,
          assets: prevLog.assets,
          debt: prevLog.debt,
          portfolio: prevLog.portfolio,
          netWorth: prevLog.netWorth
        };
      }
    });
  }, [displayedBaselineResults.data, inputs]);

  // Validate inputs
  const validation = useMemo(() => {
    return validateFireInputs(inputs);
  }, [inputs]);

  // Suggestion engine for Retirement Improvement Plan
  // Suggestion engine for Retirement Improvement Plan
  const improvementPlan = useMemo(() => {
    const currentAge = Number(inputs.currentAge) || 30;
    const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
    const yearsUntilRetirement = Math.max(0, targetRetirementAge - currentAge);
    const rateOfReturn = (Number(inputs.expectedReturn) || 7) / 100;
    const swr = (Number(inputs.swr) || 4) / 100;
    const marginalTaxRate = inputs.includeTaxes ? 0.25 : 0.0;

    // Run a temporary simulation with the default childcare boost enabled
    // so recommendations are calculated against the post-boost baseline.
    const recInputs = JSON.parse(JSON.stringify(inputs));
    const normPhases = getNormalizedPhases(recInputs);
    if (!recInputs.budgetDetails) recInputs.budgetDetails = {};
    recInputs.budgetDetails.phases = normPhases.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      startAge: p.startAge,
      endAge: p.endAge,
      income: p.income,
      savingsAllocMode: p.smartRule || p.savingsAllocMode || 'fixed',
      savings: p.savings,
      partnerSavings: p.partnerSavings,
      expenses: p.expenses
    }));
    const recResults = runFireSimulation(recInputs);

    const retirementExpenses = recResults.annualRetirementSpending || 40000;
    const shortfall = recResults.endingSurplusShortfall < 0 ? -recResults.endingSurplusShortfall : 0;

    // Determine childcare phase and peak monthly child cost
    const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    let hasChildcarePhase = false;
    let maxChildCostsAnnual = 0;
    if (childEvents.length > 0) {
      let minChildParentAge = Infinity;
      let maxChildParentAge = -Infinity;
      childEvents.forEach(ev => {
        const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (birthAge < minChildParentAge) minChildParentAge = birthAge;
        if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
      });
      hasChildcarePhase = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAge;

      if (hasChildcarePhase) {
        // Find the maximum child cost in today's dollars for any year from currentAge to targetRetirementAge
        for (let age = currentAge; age < targetRetirementAge; age++) {
          let yearCost = 0;
          childEvents.forEach(ev => {
            const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
            const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
            const childAge = age - birthAge;
            if (childAge >= childStartAge) {
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (childAge < maxAge) {
                const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
                const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
                const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
                const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

                let annualCost = 0;
                if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
                else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
                else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
                else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
                
                yearCost += annualCost;
              }
            }
          });
          if (yearCost > maxChildCostsAnnual) {
            maxChildCostsAnnual = yearCost;
          }
        }
      }
    }
    const maxChildCostsMonthly = Math.round(maxChildCostsAnnual / 12);

    let peakCount = 0;
    const currentAgeVal = Number(inputs.currentAge) || 30;
    const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;
    for (let age = currentAgeVal; age < targetRetAgeVal; age++) {
      const count = getActiveChildrenCountAtAge(age, inputs.lifeEvents);
      if (count > peakCount) {
        peakCount = count;
      }
    }
    const savingIntervals = getChildCountIntervals(currentAgeVal, targetRetAgeVal, inputs.lifeEvents, inputs.incomeList);
    const peakIntervalIdx = savingIntervals.findIndex(inv => inv.childCount === peakCount);
    let ccIncomeVal = (Number(inputs.simpleIncome) || 50000) / 12;
    if (inputs.budgetDetails) {
      if (inputs.budgetDetails.childcareBudgets && peakIntervalIdx !== -1 && inputs.budgetDetails.childcareBudgets[peakIntervalIdx]) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareBudgets[peakIntervalIdx].income);
      } else if (inputs.budgetDetails.childcareIncome !== undefined) {
        ccIncomeVal = Number(inputs.budgetDetails.childcareIncome);
      }
    }
    const wsIncomeVal = inputs.budgetDetails && inputs.budgetDetails.income !== undefined
      ? Number(inputs.budgetDetails.income)
      : (Number(inputs.simpleIncome) || 50000) / 12;
    const currentChildcareIncomeBoostMonthly = Math.max(0, ccIncomeVal - wsIncomeVal);

    const unfundedMaxChildCostsMonthly = Math.max(0, maxChildCostsMonthly - currentChildcareIncomeBoostMonthly);

    const currentReadyAge = recResults.retirementReadyAge;
    const hasShortfall = recResults.endingSurplusShortfall < 0 || 
                         !recResults.moneyLasts ||
                         (recResults.retirementReadyAge && inputs.targetRetirementAge < recResults.retirementReadyAge) ||
                         (hasChildcarePhase && unfundedMaxChildCostsMonthly > 0);

    const hasBuyHouse = (inputs.lifeEvents || []).some(e => e.type === 'buyHouse' && e.enabled);
    if (!hasShortfall && !hasBuyHouse) return null;

    // Calculate sum of current liquid assets
    const currentAssets = (Number(inputs.assets?.cash) || 0) +
                          (Number(inputs.assets?.emergencyFund) || 0) +
                          (Number(inputs.assets?.brokerage) || 0) +
                          (Number(inputs.assets?.trad401k) || 0) +
                          (Number(inputs.assets?.tradIra) || 0) +
                          (Number(inputs.assets?.rothIra) || 0) +
                          (Number(inputs.assets?.hsa) || 0) +
                          (Number(inputs.assets?.other) || 0);

    const annualSavings = (Number(inputs.simpleIncome) || 0) - (Number(inputs.simpleExpenses) || 0);
    const standardMonthlySavings = Math.round(annualSavings / 12);
    const childcarePeakGrossBoost = Math.round(unfundedMaxChildCostsMonthly / (1 - marginalTaxRate));
    const childcarePeakGrossBoostZeroSavings = Math.round(Math.max(0, unfundedMaxChildCostsMonthly - standardMonthlySavings) / (1 - marginalTaxRate));

    const list = [];

    // 1. Retire at Age 65 (and changes needed to do that)
    if (currentAge >= 65) {
      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: 'You are already age 65 or older.',
        bulletPoints: [
          'This option is not applicable because your current age is 65 or older.'
        ],
        readyAge: currentAge,
        yearsImprovement: null,
        value: 0,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    } else {
      const yearsTo65 = 65 - currentAge;
      let projectedAssetsAt65 = currentAssets * Math.pow(1 + rateOfReturn, yearsTo65);
      if (rateOfReturn > 0) {
        const fvFactor = (Math.pow(1 + rateOfReturn, yearsTo65) - 1) / rateOfReturn;
        projectedAssetsAt65 += annualSavings * fvFactor;
      } else {
        projectedAssetsAt65 += annualSavings * yearsTo65;
      }

      const targetAssetsAt65 = swr > 0 ? retirementExpenses / swr : 0;
      const newShortfall = Math.max(0, targetAssetsAt65 - projectedAssetsAt65);
      const saveMoreAmtAt65 = calculateSaveMoreRecommendation(
        newShortfall,
        rateOfReturn,
        yearsTo65,
        1.0
      );
      const hasShortfallAt65 = newShortfall > 0;

      list.push({
        type: 'retire65',
        icon: '📅',
        title: 'Retire at Age 65',
        details: hasShortfallAt65
          ? 'Delay your retirement to Age 65 and adjust your budget to save more to bridge the remaining shortfall.'
          : 'Delay your retirement to Age 65. Under your current plan, your assets are projected to fully support you at age 65 with no additional savings needed.',
        bulletPoints: [
          `Working until 65 adds ${65 - targetRetirementAge} more working/saving years to your plan.`,
          ...(hasShortfallAt65
            ? [
                `Save and invest an additional ${formatCurrency(saveMoreAmtAt65)}/year (approx. ${formatCurrency(Math.round(saveMoreAmtAt65 / 12))}/month) starting now.`,
                `This will compound over your remaining ${65 - currentAge} working years to bridge the remaining ${formatCurrency(newShortfall)} shortfall at age 65.`
              ]
            : [
                'This completely resolves your projected retirement shortfall with no other changes needed!'
              ])
        ],
        readyAge: 65,
        yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - 65) : null,
        value: saveMoreAmtAt65,
        savingsFocus: 'Retire at 65',
        savingsEffortScore: 1
      });
    }

    // 2. Retire at the retirement ready age
    if (currentReadyAge) {
      list.push({
        type: 'retireReadyAge',
        icon: '⏳',
        title: 'Retire at Retirement Ready Age',
        details: `Delay your retirement to Age ${currentReadyAge} (your Retirement Ready Age) so that your current saving and spending rates are sufficient to support you without any additional changes.`,
        bulletPoints: [
          `Working until Age ${currentReadyAge} allows your assets to compound for ${currentReadyAge - targetRetirementAge} more years.`,
          'No additional savings or income changes are required under your current budget.',
          'This completely resolves your projected retirement gap.'
        ],
        readyAge: currentReadyAge,
        yearsImprovement: null,
        value: currentReadyAge,
        savingsFocus: 'Retire Ready',
        savingsEffortScore: 2
      });
    }

    // 3. Retire at the requested retirement date
    const saveMoreAmt100 = calculateSaveMoreRecommendation(
      shortfall,
      rateOfReturn,
      yearsUntilRetirement,
      1.0
    );

    list.push({
      type: 'retireRequestedDate',
      icon: '🎯',
      title: 'Retire at Requested Retirement Date',
      details: `Maintain your target retirement age of Age ${targetRetirementAge} and adjust your budget to save more to bridge the shortfall.`,
      bulletPoints: [
        `Save and invest an additional ${formatCurrency(saveMoreAmt100)}/year (approx. ${formatCurrency(Math.round(saveMoreAmt100 / 12))}/month) before retirement.`,
        `This will compound over your remaining ${yearsUntilRetirement} working years at an assumed ${(rateOfReturn * 100).toFixed(0)}% annual rate of return.`,
        `This completely bridges your projected retirement gap at Age ${targetRetirementAge}.`
      ],
      readyAge: targetRetirementAge,
      yearsImprovement: currentReadyAge ? Math.max(0, currentReadyAge - targetRetirementAge) : null,
      value: saveMoreAmt100,
      savingsFocus: 'Save More',
      savingsEffortScore: 3
    });

    // 4. Temporary Childcare Offset Recommendation
    const childRecommendations = getChildCostOffsetRecommendations(inputs);
    childRecommendations.forEach(rec => {
      const clonedInputs = JSON.parse(JSON.stringify(inputs));
      clonedInputs.incomeList = [...(clonedInputs.incomeList || []), ...rec.incomeBoosts];
      
      const boostResults = runFireSimulation(clonedInputs);
      const readyAge = boostResults.retirementReadyAge;
      
      const currentReadyAge = recResults.retirementReadyAge;
      const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;
      
      list.push({
        type: `childOffset-${rec.childEventId}`,
        icon: '👶',
        title: 'Offset child costs with temporary income',
        details: `Your plan includes about ${formatCurrency(rec.peakCost)}/year in child-related costs for ${rec.duration} years. One way to keep your retirement plan on track is to earn an extra ${formatCurrency(rec.peakCost)}/year during those years.`,
        bulletPoints: [
          `Earn an extra ${formatCurrency(rec.peakCost)}/year from parent age ${rec.parentStartAge} to ${rec.parentEndAge}.`,
          `This temporary income boost is designed to align precisely with your child-rearing years.`,
          `This recommendation improves or preserves your retirement readiness without requiring a permanent budget cut.`
        ],
        readyAge: readyAge || targetRetirementAge,
        yearsImprovement: yearsImprovement,
        value: rec.peakCost,
        incomeBoosts: rec.incomeBoosts,
        savingsFocus: 'Earn More',
        savingsEffortScore: 2
      });
    });

    // 5. Homeownership tip
    const buyHouseEvs = (inputs.lifeEvents || []).filter(e => e.type === 'buyHouse' && e.enabled);
    buyHouseEvs.forEach(ev => {
      const sellEv = (inputs.lifeEvents || []).find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
      const sellAge = sellEv ? Number(sellEv.age) : Number(inputs.lifeExpectancy || 85);
      list.push({
        type: `houseSaleTip-${ev.id}`,
        icon: '🏠',
        title: 'Home ownership added',
        details: `This assumes you'll sell the home at age ${sellAge}.`,
        bulletPoints: [
          'You can drag the sale event later directly on the timeline.'
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: 0,
        savingsFocus: 'Tip',
        savingsEffortScore: 0,
        isInfoOnly: true
      });
    });

    return {
      showImprovementPlan: true,
      rankedPlan: list,
      currentReadyAge
    };
  }, [inputs, activeResults, activeStep]);

  // Reset wasShortfall when switching scenarios or active step
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWasShortfall(false);
  }, [currentScenarioId, activeStep]);

  // Auto-pop the improvement plan modal when a plan becomes available or transitions to shortfall
  useEffect(() => {
    const hasShortfall = activeStep === 2 && (
      !activeResults.moneyLasts || 
      activeResults.runOutAge !== null || 
      (activeResults.retirementReadyAge && inputs.targetRetirementAge < activeResults.retirementReadyAge)
    );
    const hasImprovementPlan = !!(improvementPlan && improvementPlan.rankedPlan && improvementPlan.rankedPlan.length > 0);
    if (hasShortfall && hasImprovementPlan && !wasShortfall && !childImpactSummary && !draggingInfo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowImprovementModal(true);
    }
    setWasShortfall(hasShortfall);
  }, [activeResults.moneyLasts, activeResults.runOutAge, activeResults.retirementReadyAge, inputs.targetRetirementAge, activeStep, wasShortfall, childImpactSummary, draggingInfo, improvementPlan]);

  const handleApplyImprovementScenario = (scenario) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    let inp = scen.inputs;
    if (scenario.type.startsWith('childOffset')) {
      inp = JSON.parse(JSON.stringify(scen.inputs));
      inp.incomeList = [...(inp.incomeList || []), ...(scenario.incomeBoosts || [])];
    }
    const currentAgeVal = Number(inp.currentAge) || 30;
    const targetRetAgeVal = Number(inp.targetRetirementAge) || 65;

    let targetIncome = Number(inp.simpleIncome) || 50000;
    const targetFilingStatus = inp.filingStatus || 'single';
    const targetHsaCoverage = inp.budgetDetails?.hsaCoverage || 'single';

    let targetExpensesMap = {};
    let targetSavingsMap = {};

    const currentIncome = Number(inp.simpleIncome) || 0;
    const currentExpenses = Number(inp.simpleExpenses) || 0;
    const simMonthlyExpenses = currentExpenses / 12;
    const simMonthlySavings = Math.max(0, currentIncome - currentExpenses) / 12;

    const monthlyGross = Math.round(currentIncome / 12);

    if (inp.budgetDetails) {
      targetSavingsMap = { ...inp.budgetDetails.savings };
      targetExpensesMap = { ...inp.budgetDetails.expenses };

      const totalSavingsInModal = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);

      // Scale savings map to align with simulation totals first
      if (totalSavingsInModal > 0 && Math.abs(totalSavingsInModal - simMonthlySavings) > 1) {
        const savingsScale = simMonthlySavings / totalSavingsInModal;
        Object.keys(targetSavingsMap).forEach(key => {
          targetSavingsMap[key] = Math.round(targetSavingsMap[key] * savingsScale);
        });
      } else if (totalSavingsInModal === 0 && simMonthlySavings > 0) {
        targetSavingsMap.brokerage = Math.round(simMonthlySavings);
      }

      // Adjust savings rounding error
      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      // Calculate taxes to find available net income for expenses
      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);
      const totalExpensesInModal = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);

      // Scale expenses map to align with simulation net income first
      if (totalExpensesInModal > 0 && Math.abs(totalExpensesInModal - availableMonthlyExpenses) > 1) {
        const expensesScale = availableMonthlyExpenses / totalExpensesInModal;
        Object.keys(targetExpensesMap).forEach(key => {
          targetExpensesMap[key] = Math.round(targetExpensesMap[key] * expensesScale);
        });
      } else if (totalExpensesInModal === 0 && availableMonthlyExpenses > 0) {
        targetExpensesMap = {
          housing: Math.round(availableMonthlyExpenses * 0.40),
          utilities: Math.round(availableMonthlyExpenses * 0.10),
          food: Math.round(availableMonthlyExpenses * 0.10),
          diningOut: Math.round(availableMonthlyExpenses * 0.05),
          transportation: Math.round(availableMonthlyExpenses * 0.10),
          healthcare: Math.round(availableMonthlyExpenses * 0.10),
          leisure: Math.round(availableMonthlyExpenses * 0.10),
          misc: Math.round(availableMonthlyExpenses * 0.05)
        };
      }

      // Adjust expenses rounding error
      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0 && Object.keys(targetExpensesMap).length > 0) {
        let maxKey = Object.keys(targetExpensesMap)[0];
        Object.keys(targetExpensesMap).forEach(key => {
          if (targetExpensesMap[key] > targetExpensesMap[maxKey]) {
            maxKey = key;
          }
        });
        targetExpensesMap[maxKey] = Math.max(0, targetExpensesMap[maxKey] + expenseDiff);
      }
    } else {
      const defaultSavings = {
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      };
      if (inp.allocationRules && inp.allocationRules.length > 0) {
        inp.allocationRules.forEach(r => {
          const key = r.destination === 'cash' ? 'checking' :
                      r.destination === 'other' ? 'hysa' :
                      r.destination === 'emergencyFund' ? 'emergency' :
                      r.destination === 'debtPaydown' ? 'debt' : r.destination;
          if (defaultSavings[key] !== undefined) {
            if (r.type === 'fixed') {
              defaultSavings[key] = r.frequency === 'monthly' ? r.value : Math.round(r.value / 12);
            } else {
              const pool = Math.max(0, (Number(inp.simpleIncome) - Number(inp.simpleExpenses)) / 12);
              defaultSavings[key] = Math.round(pool * (r.value / 100));
            }
          }
        });
      } else {
        defaultSavings.brokerage = Math.round(simMonthlySavings);
      }
      targetSavingsMap = defaultSavings;

      // Adjust savings rounding error
      const scaledSavingsSum = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const targetSavingsTotal = Math.round(simMonthlySavings);
      const savingsDiff = targetSavingsTotal - scaledSavingsSum;
      if (savingsDiff !== 0) {
        let maxKey = 'brokerage';
        if (targetSavingsMap[maxKey] === undefined) {
          maxKey = Object.keys(targetSavingsMap)[0];
        }
        Object.keys(targetSavingsMap).forEach(key => {
          if ((targetSavingsMap[key] || 0) > (targetSavingsMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        targetSavingsMap[maxKey] = Math.max(0, (targetSavingsMap[maxKey] || 0) + savingsDiff);
      }

      const capped401k = Math.min(23500, (targetSavingsMap.trad401k || 0) * 12);
      const cappedTradIra = Math.min(7000, (targetSavingsMap.tradIra || 0) * 12);
      const cappedHsa = Math.min(targetHsaCoverage === 'family' ? 8300 : 4150, (targetSavingsMap.hsa || 0) * 12);
      const preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;
      const annualTax = inp.includeTaxes
        ? calculateUSTaxForModal(currentIncome, preTaxDeductionsAnnual, targetFilingStatus)
        : 0;
      const monthlyTax = Math.round(annualTax / 12);

      const actualSavingsMonthly = Object.values(targetSavingsMap).reduce((sum, val) => sum + val, 0);
      const availableMonthlyExpenses = Math.max(0, monthlyGross - actualSavingsMonthly - monthlyTax);

      targetExpensesMap = {
        housing: Math.round(availableMonthlyExpenses * 0.40),
        utilities: Math.round(availableMonthlyExpenses * 0.10),
        food: Math.round(availableMonthlyExpenses * 0.10),
        diningOut: Math.round(availableMonthlyExpenses * 0.05),
        transportation: Math.round(availableMonthlyExpenses * 0.10),
        healthcare: Math.round(availableMonthlyExpenses * 0.10),
        leisure: Math.round(availableMonthlyExpenses * 0.10),
        misc: Math.round(availableMonthlyExpenses * 0.05)
      };

      // Adjust targetExpensesMap rounding error
      const scaledExpensesSum = Object.values(targetExpensesMap).reduce((sum, val) => sum + val, 0);
      const expenseDiff = availableMonthlyExpenses - scaledExpensesSum;
      if (expenseDiff !== 0) {
        targetExpensesMap.housing = Math.max(0, targetExpensesMap.housing + expenseDiff);
      }
    }
    // Calculate baseline savings rate
    const currentSavingsRate = currentIncome > 0 ? Math.round((1 - currentExpenses / currentIncome) * 100) : 0;

    // Save baseline scaled maps to compute clean visual differences
    const baselineSavingsMap = { ...targetSavingsMap };
    const baselineExpensesMap = { ...targetExpensesMap };

    // Adjust target values based on our new recommendation types
    if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
      // Save More: increase monthly savings by scenario.value / 12
      const additionalSavingsAnnual = scenario.value;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      // Reduce monthly expenses by the same amount to keep it balanced
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }
    } else if (scenario.type === 'income') {
      // Earn More: increase gross income by gross salary increase
      const grossIncreaseAnnual = scenario.value;
      const netSavingsAnnual = scenario.netSavingsValue || 0;
      
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'combined') {
      // Balanced Plan (50/50): Apply BOTH 50% savings reduction and 50% earnings increase
      const additionalSavingsAnnual = scenario.value.savings;
      const additionalSavingsMonthly = Math.round(additionalSavingsAnnual / 12);
      
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + additionalSavingsMonthly;
      
      // Reduce monthly expenses by the savings portion
      if (targetExpensesMap && Object.keys(targetExpensesMap).length > 0) {
        let remainingReduction = additionalSavingsMonthly;
        const keysToReduce = ['leisure', 'misc', 'diningOut', 'housing', 'food', 'utilities', 'transportation'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }

      // Apply the income increase portion
      const grossIncreaseAnnual = scenario.value.income;
      const netSavingsAnnual = scenario.value.netSavings || 0;
      
      targetIncome = targetIncome + grossIncreaseAnnual;
      const monthlyNetSavings = Math.round(netSavingsAnnual / 12);
      targetSavingsMap.brokerage = (targetSavingsMap.brokerage || 0) + monthlyNetSavings;
    } else if (scenario.type === 'retire65') {
      // Retire at 65 with no changes needed (scenario.value === 0) doesn't change current income/expenses
    } else if (scenario.type === 'retireReadyAge') {
      // Retire at ready age doesn't change current income/expenses
    } else if (scenario.type.startsWith('childOffset')) {
      // Offset child costs with temporary income doesn't change current base income/expenses/savings
    }

    // Calculate differences for glow effect
    const diffs = { savings: {}, expenses: {} };

    Object.keys(targetSavingsMap).forEach(key => {
      const oldVal = baselineSavingsMap[key] || 0;
      const newVal = targetSavingsMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.savings[key] = newVal - oldVal;
      }
    });

    Object.keys(targetExpensesMap).forEach(key => {
      const oldVal = baselineExpensesMap[key] || 0;
      const newVal = targetExpensesMap[key] || 0;
      if (newVal !== oldVal) {
        diffs.expenses[key] = newVal - oldVal;
      }
    });

    setBudgetDiffs(diffs);

    setBudgetGrossIncome(targetIncome);
    setBudgetFilingStatus(targetFilingStatus);
    setBudgetHsaCoverage(targetHsaCoverage);
    setBudgetSavings(targetSavingsMap);
    setBudgetExpenses(targetExpensesMap);

    // Initialize phase states to prevent unallocated toggles
    const appliedWsIncome = Math.round(targetIncome / 12);
    setWorkSaveIncome(appliedWsIncome);
    setWorkSaveSavings(targetSavingsMap);
    setWorkSaveExpenses(targetExpensesMap);
    setWorkSaveAllocMode(inp.budgetDetails?.savingsAllocMode || 'fixed');

    // Calculate childcare costs
    let currentChildCostsAnnual = 0;
    const currentAgeForApplied = Number(inp.currentAge) || 30;
    const childEventsForApplied = (inp.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
    childEventsForApplied.forEach(ev => {
      const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
      const startAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
      const childAge = currentAgeForApplied - birthAge;
      if (childAge >= startAge) {
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (childAge < maxAge) {
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inp.childCosts?.ages0to4 !== undefined ? Number(inp.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inp.childCosts?.ages5to12 !== undefined ? Number(inp.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inp.childCosts?.ages13to18 !== undefined ? Number(inp.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inp.childCosts?.ages19to22 !== undefined ? Number(inp.childCosts.ages19to22) : 15000);

          let annualCost = 0;
          if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
          else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
          else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
          else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
          
          currentChildCostsAnnual += annualCost;
        }
      }
    });
    const currentChildCostsMonthlyForApplied = Math.round(currentChildCostsAnnual / 12);

    // Calculate peak childcare costs to determine recommended income boost
    let maxChildCostsAnnualForApplied = 0;
    if (childEventsForApplied.length > 0) {
      let minChildParentAge = Infinity;
      let maxChildParentAge = -Infinity;
      childEventsForApplied.forEach(ev => {
        const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;
        if (birthAge < minChildParentAge) minChildParentAge = birthAge;
        if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
      });
      const hasChildcarePhaseForApplied = minChildParentAge < maxChildParentAge && maxChildParentAge > currentAgeForApplied;

      if (hasChildcarePhaseForApplied) {
        for (let age = currentAgeForApplied; age < (Number(inp.targetRetirementAge) || 65); age++) {
          let yearCost = 0;
          childEventsForApplied.forEach(ev => {
            const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
            const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
            const childAge = age - birthAge;
            if (childAge >= childStartAge) {
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (childAge < maxAge) {
                const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inp.childCosts?.ages0to4 !== undefined ? Number(inp.childCosts.ages0to4) : 15000);
                const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inp.childCosts?.ages5to12 !== undefined ? Number(inp.childCosts.ages5to12) : 15000);
                const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inp.childCosts?.ages13to18 !== undefined ? Number(inp.childCosts.ages13to18) : 15000);
                const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inp.childCosts?.ages19to22 !== undefined ? Number(inp.childCosts.ages19to22) : 15000);

                let annualCost = 0;
                if (childAge >= 0 && childAge <= 4) annualCost = ages0to4;
                else if (childAge >= 5 && childAge <= 12) annualCost = ages5to12;
                else if (childAge >= 13 && childAge <= 18) annualCost = ages13to18;
                else if (childAge >= 19 && childAge <= 22) annualCost = ages19to22;
                yearCost += annualCost;
              }
            }
          });
          if (yearCost > maxChildCostsAnnualForApplied) {
            maxChildCostsAnnualForApplied = yearCost;
          }
        }
      }
    }
    const maxChildCostsMonthlyForApplied = Math.round(maxChildCostsAnnualForApplied / 12);
    const marginalTaxRateForApplied = inp.includeTaxes ? 0.25 : 0.0;
    const childcarePeakGrossBoostForApplied = Math.round(maxChildCostsMonthlyForApplied / (1 - marginalTaxRateForApplied));

    const normalizedPhases = getNormalizedPhases(inp);
    const initialEdited = {};
    normalizedPhases.forEach(p => {
      initialEdited[p.id] = { ...p };
    });

    const currentPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
    if (currentPhase) {
      let childBoostForCurrent = 0;
      (inp.incomeList || []).forEach(inc => {
        if (inc.id && typeof inc.id === 'string' && inc.id.startsWith('child-income-boost')) {
          if (currentPhase.startAge >= inc.startAge && currentPhase.startAge < inc.endAge) {
            const boostYearly = inc.frequency === 'monthly' ? Number(inc.amount) * 12 : Number(inc.amount);
            childBoostForCurrent += boostYearly / 12;
          }
        }
      });
      const baseSalaryMonthly = (currentPhase.startAge >= targetRetAgeVal) ? 0 : Math.round(targetIncome / 12);
      initialEdited[currentPhase.id] = {
        ...currentPhase,
        income: baseSalaryMonthly + childBoostForCurrent,
        savings: targetSavingsMap,
        expenses: targetExpensesMap,
        savingsAllocMode: inp.budgetDetails?.savingsAllocMode || 'fixed'
      };
    }
    setEditedPhases(initialEdited);

    let startPhaseId = currentPhase ? currentPhase.id : (normalizedPhases[0]?.id || null);
    setActiveBudgetPhase(startPhaseId);

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
      setBudgetMonthlyIncome(startPhase.income);
      setBudgetSavings(startPhase.savings);
      setBudgetPartnerSavings(startPhase.partnerSavings || {});
      setBudgetExpenses(startPhase.expenses);
      setSavingsAllocMode(startPhase.savingsAllocMode);
      setBudgetMonthlySpending(Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0));
      
      const totalSavings = startPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, startPhase.income - Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setPendingImprovement({
      scenario,
      originalInputs: inp
    });

    setShowImprovementModal(false);
    setIsBudgetModalOpen(true);
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
        points: 0,
        pmi: 0.5,
        closingCosts: 3,
        propertyTax: 1.1,
        insurance: 0.35,
        hoa: 0,
        maintenance: 1.0,
        renovationCost: 0,
        utilitiesIncrease: 0,
        appreciationRate: 3.0,
        sellingCost: 6,
        yearsUntilSale: '',
        currentRent: 0,
        rentGrowth: 3,
        renterInsurance: 0,
        investmentReturn: 7,
        inflation: 3
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
    const scaleBudgetMap = (map, scale, targetTotal, defaultKeyForSurplus = 'brokerage') => {
      if (!map || Object.keys(map).length === 0) return {};
      const newMap = {};
      Object.keys(map).forEach(key => {
        newMap[key] = Math.round((map[key] || 0) * scale);
      });
      const sum = Object.values(newMap).reduce((acc, v) => acc + v, 0);
      const diff = targetTotal - sum;
      if (diff !== 0) {
        let maxKey = defaultKeyForSurplus;
        if (newMap[maxKey] === undefined) {
          maxKey = Object.keys(newMap)[0];
        }
        Object.keys(newMap).forEach(key => {
          if ((newMap[key] || 0) > (newMap[maxKey] || 0)) {
            maxKey = key;
          }
        });
        newMap[maxKey] = Math.max(0, (newMap[maxKey] || 0) + diff);
      }
      return newMap;
    };

    updateInput(field, val);
    if (field === 'simpleInvestments') {
      const allocated = getReasonableSavingsAllocation(val);
      updateInput('assets', {
        ...inputs.assets,
        ...allocated,
        realEstate: inputs.assets?.realEstate || 0,
        debts: inputs.assets?.debts || 0
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

          // Scale budget details and allocation rules
          let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
          let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

          if (updatedBudgetDetails) {
            const oldIncome = Number(scen.inputs.simpleIncome) || 50000;
            const incomeScale = oldIncome > 0 ? (val / oldIncome) : 1;

            if (incomeScale > 0 && isFinite(incomeScale)) {
              // 1. Scale standard work phase expenses
              const newMonthlyExpenses = newExpenses / 12;
              updatedBudgetDetails.expenses = scaleBudgetMap(
                scen.inputs.budgetDetails.expenses,
                incomeScale,
                Math.round(newMonthlyExpenses),
                'housing'
              );

              // 2. Scale standard work phase savings
              const newMonthlySavings = (val - newExpenses) / 12;
              updatedBudgetDetails.savings = scaleBudgetMap(
                scen.inputs.budgetDetails.savings,
                incomeScale,
                Math.round(newMonthlySavings),
                'brokerage'
              );

              // 3. Scale childcare phase expenses if they exist
              if (scen.inputs.budgetDetails.childcareExpenses) {
                const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
                const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * incomeScale);
                updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareExpenses,
                  incomeScale,
                  targetCCExpensesTotal,
                  'housing'
                );
              }

              // 4. Scale childcare phase savings if they exist
              if (scen.inputs.budgetDetails.childcareSavings) {
                const oldCCSavingsTotal = Object.values(scen.inputs.budgetDetails.childcareSavings).reduce((sum, v) => sum + v, 0);
                const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * incomeScale);
                updatedBudgetDetails.childcareSavings = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareSavings,
                  incomeScale,
                  targetCCSavingsTotal,
                  'brokerage'
                );
              }

              // 5. Update income fields
              updatedBudgetDetails.income = Math.round(val / 12);
              if (updatedBudgetDetails.childcareIncome !== undefined) {
                updatedBudgetDetails.childcareIncome = Math.round(updatedBudgetDetails.childcareIncome * incomeScale);
              }
              if (updatedBudgetDetails.childcareBudgets) {
                const nextChildcareBudgets = { ...updatedBudgetDetails.childcareBudgets };
                Object.keys(nextChildcareBudgets).forEach(cKey => {
                  const c = Number(cKey);
                  const budget = { ...nextChildcareBudgets[c] };
                  budget.income = Math.round(budget.income * incomeScale);
                  const oldCCExpensesTotal = Object.values(budget.expenses || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * incomeScale);
                  budget.expenses = scaleBudgetMap(
                    budget.expenses || {},
                    incomeScale,
                    targetCCExpensesTotal,
                    'housing'
                  );
                  const oldCCSavingsTotal = Object.values(budget.savings || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * incomeScale);
                  budget.savings = scaleBudgetMap(
                    budget.savings || {},
                    incomeScale,
                    targetCCSavingsTotal,
                    'brokerage'
                  );
                  nextChildcareBudgets[c] = budget;
                });
                updatedBudgetDetails.childcareBudgets = nextChildcareBudgets;
              }
            }
          }

          // Sync allocation rules values
          if (updatedBudgetDetails && updatedRules.length > 0) {
            const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
            let maxChildParentAge = -Infinity;
            childEvents.forEach(ev => {
              const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
            });
            const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

            updatedRules = updatedRules.map(rule => {
              if (rule.type === 'fixed') {
                let savingsMap = updatedBudgetDetails.savings;
                if (rule.id.includes('budget-alloc-cc-')) {
                  const parts = rule.id.split('-');
                  const ccIdx = parts.indexOf('cc');
                  if (ccIdx !== -1 && parts[ccIdx + 1]) {
                    const c = Number(parts[ccIdx + 1]);
                    if (updatedBudgetDetails.childcareBudgets?.[c]) {
                      savingsMap = updatedBudgetDetails.childcareBudgets[c].savings;
                    } else {
                      savingsMap = updatedBudgetDetails.childcareSavings;
                    }
                  } else {
                    savingsMap = updatedBudgetDetails.childcareSavings;
                  }
                } else if (rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge)) {
                  savingsMap = updatedBudgetDetails.childcareSavings;
                }

                const key = rule.destination === 'cash' ? 'checking' :
                            rule.destination === 'other' ? 'hysa' :
                            rule.destination === 'emergencyFund' ? 'emergency' :
                            rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

                if (savingsMap && savingsMap[key] !== undefined) {
                  return { ...rule, value: savingsMap[key] };
                }
              }
              return rule;
            });
          }

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              incomeList: updatedIncomeList,
              spendingPhases: updatedSpendingPhases,
              simpleIncome: val,
              simpleExpenses: newExpenses,
              budgetDetails: updatedBudgetDetails,
              allocationRules: updatedRules
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

          // Scale budget details and allocation rules
          let updatedBudgetDetails = scen.inputs.budgetDetails ? { ...scen.inputs.budgetDetails } : null;
          let updatedRules = scen.inputs.allocationRules ? [...scen.inputs.allocationRules] : [];

          if (updatedBudgetDetails) {
            const oldExpenses = Number(scen.inputs.simpleExpenses) || 42500;
            const currentIncome = Number(scen.inputs.simpleIncome) || 50000;
            const expenseScale = oldExpenses > 0 ? (val / oldExpenses) : 1;

            // 1. Scale expenses (standard and childcare)
            if (expenseScale > 0 && isFinite(expenseScale)) {
              const newMonthlyExpenses = val / 12;
              updatedBudgetDetails.expenses = scaleBudgetMap(
                scen.inputs.budgetDetails.expenses,
                expenseScale,
                Math.round(newMonthlyExpenses),
                'housing'
              );

              if (scen.inputs.budgetDetails.childcareExpenses) {
                const oldCCExpensesTotal = Object.values(scen.inputs.budgetDetails.childcareExpenses).reduce((sum, v) => sum + v, 0);
                const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * expenseScale);
                updatedBudgetDetails.childcareExpenses = scaleBudgetMap(
                  scen.inputs.budgetDetails.childcareExpenses,
                  expenseScale,
                  targetCCExpensesTotal,
                  'housing'
                );
              }
            }

            // 2. Scale savings (standard and childcare)
            const oldSavings = Math.max(0, currentIncome - oldExpenses);
            const newSavings = Math.max(0, currentIncome - val);

            const oldMonthlySavings = oldSavings / 12;
            const newMonthlySavings = newSavings / 12;

            if (oldMonthlySavings <= 0 && newMonthlySavings > 0) {
              // Transition from 0 to positive savings: allocate entirely to brokerage
              const defaultSavings = {
                trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
              };
              defaultSavings.brokerage = Math.round(newMonthlySavings);
              updatedBudgetDetails.savings = defaultSavings;

              if (updatedBudgetDetails.childcareSavings) {
                const defaultCC = { ...defaultSavings };
                const ccIncome = updatedBudgetDetails.childcareIncome || Math.round(currentIncome / 12);
                const ccExpenses = Object.values(updatedBudgetDetails.childcareExpenses || {}).reduce((sum, v) => sum + v, 0);
                defaultCC.brokerage = Math.round(Math.max(0, ccIncome - ccExpenses));
                updatedBudgetDetails.childcareSavings = defaultCC;
              }
            } else if (newMonthlySavings <= 0) {
              const zeroSavings = {
                trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
              };
              updatedBudgetDetails.savings = zeroSavings;
              if (updatedBudgetDetails.childcareSavings) {
                updatedBudgetDetails.childcareSavings = { ...zeroSavings };
              }
            } else {
              const savingsScale = newMonthlySavings / oldMonthlySavings;
              if (isFinite(savingsScale)) {
                updatedBudgetDetails.savings = scaleBudgetMap(
                  scen.inputs.budgetDetails.savings,
                  savingsScale,
                  Math.round(newMonthlySavings),
                  'brokerage'
                );

                if (updatedBudgetDetails.childcareSavings) {
                  const oldCCSavingsTotal = Object.values(scen.inputs.childcareSavings).reduce((sum, v) => sum + v, 0);
                  const targetCCSavingsTotal = Math.round(oldCCSavingsTotal * savingsScale);
                  updatedBudgetDetails.childcareSavings = scaleBudgetMap(
                    scen.inputs.childcareSavings,
                    savingsScale,
                    targetCCSavingsTotal,
                    'brokerage'
                  );
                }
              }
              if (updatedBudgetDetails.childcareBudgets) {
                const nextChildcareBudgets = { ...updatedBudgetDetails.childcareBudgets };
                Object.keys(nextChildcareBudgets).forEach(cKey => {
                  const c = Number(cKey);
                  const budget = { ...nextChildcareBudgets[c] };
                  const oldCCExpensesTotal = Object.values(budget.expenses || {}).reduce((sum, v) => sum + v, 0);
                  const targetCCExpensesTotal = Math.round(oldCCExpensesTotal * expenseScale);
                  budget.expenses = scaleBudgetMap(
                    budget.expenses || {},
                    expenseScale,
                    targetCCExpensesTotal,
                    'housing'
                  );
                  const oldCCSavings = Math.max(0, budget.income - oldCCExpensesTotal);
                  const newCCSavings = Math.max(0, budget.income - targetCCExpensesTotal);
                  if (oldCCSavings <= 0 && newCCSavings > 0) {
                    const defaultSavings = {
                      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                      checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
                    };
                    defaultSavings.brokerage = newCCSavings;
                    budget.savings = defaultSavings;
                  } else if (newCCSavings <= 0) {
                    const zeroSavings = {
                      trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
                      checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
                    };
                    budget.savings = zeroSavings;
                  } else {
                    const cSavingsScale = newCCSavings / oldCCSavings;
                    if (isFinite(cSavingsScale)) {
                      budget.savings = scaleBudgetMap(
                        budget.savings || {},
                        cSavingsScale,
                        newCCSavings,
                        'brokerage'
                      );
                    }
                  }
                  nextChildcareBudgets[c] = budget;
                });
                updatedBudgetDetails.childcareBudgets = nextChildcareBudgets;
              }
            }
          }

          // Sync allocation rules values
          if (updatedBudgetDetails && updatedRules.length > 0) {
            const childEvents = (scen.inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
            let maxChildParentAge = -Infinity;
            childEvents.forEach(ev => {
              const birthAge = Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30;
              const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
              const maxAge = includeCollege ? 22 : 18;
              if (birthAge + maxAge > maxChildParentAge) maxChildParentAge = birthAge + maxAge;
            });
            const childEndAge = Math.min(scen.inputs.lifeExpectancy || 85, Math.max(scen.inputs.currentAge, maxChildParentAge));

            updatedRules = updatedRules.map(rule => {
              if (rule.type === 'fixed') {
                let savingsMap = updatedBudgetDetails.savings;
                if (rule.id.includes('budget-alloc-cc-')) {
                  const parts = rule.id.split('-');
                  const ccIdx = parts.indexOf('cc');
                  if (ccIdx !== -1 && parts[ccIdx + 1]) {
                    const c = Number(parts[ccIdx + 1]);
                    if (updatedBudgetDetails.childcareBudgets?.[c]) {
                      savingsMap = updatedBudgetDetails.childcareBudgets[c].savings;
                    } else {
                      savingsMap = updatedBudgetDetails.childcareSavings;
                    }
                  } else {
                    savingsMap = updatedBudgetDetails.childcareSavings;
                  }
                } else if (rule.id.includes('-cc-') || (rule.endAge && rule.endAge === childEndAge)) {
                  savingsMap = updatedBudgetDetails.childcareSavings;
                }

                const key = rule.destination === 'cash' ? 'checking' :
                            rule.destination === 'other' ? 'hysa' :
                            rule.destination === 'emergencyFund' ? 'emergency' :
                            rule.destination === 'debtPaydown' ? 'debt' : rule.destination;

                if (savingsMap && savingsMap[key] !== undefined) {
                  return { ...rule, value: savingsMap[key] };
                }
              }
              return rule;
            });
          }

          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              spendingPhases: updatedSpendingPhases,
              budgetDetails: updatedBudgetDetails,
              allocationRules: updatedRules,
              simpleExpenses: val
            }
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

  const getSavingsBreakdown = (editingEvent, inputs) => {
    const curHousing = inputs.budgetDetails?.expenses?.housing !== undefined ? Number(inputs.budgetDetails.expenses.housing) : 1500;
    const curUtilities = inputs.budgetDetails?.expenses?.utilities !== undefined ? Number(inputs.budgetDetails.expenses.utilities) : 400;
    const curInternet = inputs.budgetDetails?.expenses?.internet !== undefined ? Number(inputs.budgetDetails.expenses.internet) : 100;
    const curStreaming = inputs.budgetDetails?.expenses?.streaming !== undefined ? Number(inputs.budgetDetails.expenses.streaming) : 60;
    const curHouseholdGoods = inputs.budgetDetails?.expenses?.householdGoods !== undefined ? Number(inputs.budgetDetails.expenses.householdGoods) : 500;

    const housing = curHousing > 0 ? Math.round(curHousing * 0.5) : 750;
    const utilities = curUtilities > 0 ? Math.round(curUtilities * 0.25) : 100;
    const internet = curInternet > 0 ? Math.round(curInternet * 0.5) : 50;
    const streaming = curStreaming > 0 ? Math.round(curStreaming * 0.5) : 30;
    const otherShared = curHouseholdGoods > 0 ? Math.round(curHouseholdGoods * 0.1) : 50;
    
    const total = housing + utilities + internet + streaming + otherShared;
    
    return {
      housing,
      utilities,
      internet,
      streaming,
      otherShared,
      total
    };
  };

  const calculateMarriageEstimates = (editingEvent, inputs) => {
    if (!editingEvent) return null;

    const spouseIncome = Number(editingEvent.spouseIncome) || 0;
    const savingsRate = Number(editingEvent.savingsRate) || 0;
    const partnerSavings = spouseIncome * (savingsRate / 100);
    const partnerTax = inputs?.includeTaxes ? calculateUSTaxForModal(spouseIncome, partnerSavings, 'single') : 0;
    const partnerTakeHome = spouseIncome - partnerTax;
    const partnerTakeHomeRemaining = Math.max(0, partnerTakeHome - partnerSavings);

    // Calculate user spending baseline pre-retirement
    let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
    const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
    if (initialPhase) {
      if (initialPhase.frequency === 'monthly') {
        userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
      } else if (initialPhase.frequency === 'yearly') {
        userSpendingPreRetirement = Number(initialPhase.amount) || 0;
      } else {
        userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
      }
    }

    const curSavings = getSavingsBreakdown(editingEvent, inputs);
    const totalSavingsAmount = curSavings.total * 12;

    const combinedSpendingVal = Math.round(
      Math.max(0, userSpendingPreRetirement + 
      partnerTakeHomeRemaining - 
      totalSavingsAmount)
    );

    const spousePreRetirementSpending = Math.max(0, combinedSpendingVal - userSpendingPreRetirement);
    const userRetirePercent = Number((inputs?.lifeEvents || []).find(e => e.type === 'retire')?.spendingPercent || 70) / 100;
    const spouseRetSpendingVal = editingEvent.retirementSpendingNeed !== undefined && editingEvent.retirementSpendingNeed !== '' && editingEvent.retirementSpendingNeed !== null 
      ? Number(editingEvent.retirementSpendingNeed) 
      : Math.round(spousePreRetirementSpending * userRetirePercent);

    return {
      userSpendingPreRetirement,
      partnerTakeHomeRemaining,
      currentHousingCost: inputs.budgetDetails?.expenses?.housing !== undefined ? Number(inputs.budgetDetails.expenses.housing) : 1500,
      housingOption: 'move',
      housingCostAmount: - curSavings.housing * 12,
      sharedCostSavingsAmount: - (curSavings.utilities + curSavings.internet + curSavings.streaming + curSavings.otherShared) * 12,
      lifestyleOption: 'same',
      lifestyleAdjustmentAmount: 0,
      combinedSpendingVal,
      spousePreRetirementSpending,
      spouseRetSpendingVal,
      partnerSavings,
      partnerTax,
      savingsBreakdown: curSavings
    };
  };

  const handleSetBudgetClick = (initialPhaseId = null, fromMarriageWizard = false) => {
    const scen = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
    const inp = scen.inputs;

    const normalizedPhases = getNormalizedPhases(inp);
    
    // Compute estimates if budget opened from marriage wizard
    let estimatedExpenses = null;
    let estimatedPartnerSavings = null;

    if ((isBudgetOpenFromMarriageWizard || fromMarriageWizard) && editingEvent) {
      const estimates = calculateMarriageEstimates(editingEvent, inp);
      if (estimates) {
        const userExpenses = inp.budgetDetails?.expenses || {
          housing: 1500,
          utilities: 300,
          food: 400,
          diningOut: 200,
          transportation: 400,
          healthcare: 300,
          leisure: 300,
          misc: 142
        };
        
        // 1. Housing stays the same price
        const housingVal = userExpenses.housing !== undefined ? Number(userExpenses.housing) : 1500;
        
        // 2. Spouse spending and total savings to apply
        const partnerMonthlySpend = Math.round(estimates.partnerTakeHomeRemaining / 12);
        const nonHousingCats = ['utilities', 'food', 'diningOut', 'transportation', 'healthcare', 'leisure', 'misc'];
        const userNonHousingTotal = nonHousingCats.reduce((sum, cat) => sum + (Number(userExpenses[cat]) || 0), 0);
        
        // Total non-housing spending to distribute
        const remainingToDistribute = Math.max(0, userNonHousingTotal + partnerMonthlySpend - estimates.savingsBreakdown.total);
        
        const tempExpenses = { ...userExpenses, housing: housingVal };
        nonHousingCats.forEach(cat => {
          let spouseCatSpend = 0;
          if (userNonHousingTotal > 0) {
            spouseCatSpend = remainingToDistribute * ((Number(userExpenses[cat]) || 0) / userNonHousingTotal);
          } else {
            spouseCatSpend = remainingToDistribute / nonHousingCats.length;
          }
          tempExpenses[cat] = Math.round(spouseCatSpend);
        });
        
        estimatedExpenses = tempExpenses;
        
        // Compute estimated spouse savings (monthly)
        const spouseMonthlySavings = Math.round(estimates.partnerSavings / 12);
        const userSavings = inp.budgetDetails?.savings || {};
        console.log('[DIAGNOSTIC] handleSetBudgetClick savings:', { userSavings, inpBudgetDetails: inp.budgetDetails });
        const userTotalSavings = Object.values(userSavings).reduce((sum, v) => sum + (Number(v) || 0), 0);
        
        estimatedPartnerSavings = {
          trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
          checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
        };
        
        if (userTotalSavings > 0) {
          Object.keys(userSavings).forEach(key => {
            estimatedPartnerSavings[key] = Math.round(spouseMonthlySavings * ((Number(userSavings[key]) || 0) / userTotalSavings));
          });
          
          const partnerTotalSavings = Object.values(estimatedPartnerSavings).reduce((sum, v) => sum + v, 0);
          const diff = spouseMonthlySavings - partnerTotalSavings;
          if (diff !== 0) {
            let maxKey = 'brokerage';
            Object.keys(estimatedPartnerSavings).forEach(key => {
              if (estimatedPartnerSavings[key] > (estimatedPartnerSavings[maxKey] || 0)) {
                maxKey = key;
              }
            });
            estimatedPartnerSavings[maxKey] = Math.max(0, estimatedPartnerSavings[maxKey] + diff);
          }
        } else {
          const trad401kAlloc = Math.min(1958, spouseMonthlySavings);
          estimatedPartnerSavings.trad401k = trad401kAlloc;
          estimatedPartnerSavings.checking = Math.max(0, spouseMonthlySavings - trad401kAlloc);
        }
      }
    }

    // Initialize editedPhases mapping
    const initialEdited = {};
    normalizedPhases.forEach(p => {
      if (p.type !== 'retire' && (isBudgetOpenFromMarriageWizard || fromMarriageWizard) && estimatedExpenses && estimatedPartnerSavings) {
        initialEdited[p.id] = { 
          ...p, 
          expenses: { ...estimatedExpenses },
          partnerSavings: { ...estimatedPartnerSavings }
        };
      } else {
        initialEdited[p.id] = { ...p };
      }
    });
    setEditedPhases(initialEdited);

    // Determine starting activeBudgetPhase ID
    let startPhaseId = null;
    if (initialPhaseId && initialEdited[initialPhaseId]) {
      startPhaseId = initialPhaseId;
    } else {
      // Find phase matching current age
      const currentAgeVal = Number(inp.currentAge) || 30;
      const match = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge);
      if (match) {
        startPhaseId = match.id;
      } else if (normalizedPhases.length > 0) {
        startPhaseId = normalizedPhases[0].id;
      }
    }

    if (startPhaseId) {
      const startPhase = initialEdited[startPhaseId];
      setActiveBudgetPhase(startPhaseId);
      setBudgetMonthlyIncome(startPhase.income);
      setBudgetSavings(startPhase.savings);
      setBudgetPartnerSavings(startPhase.partnerSavings || {});
      setBudgetExpenses(startPhase.expenses);
      setSavingsAllocMode(startPhase.savingsAllocMode);
      
      setBudgetMonthlySpending(Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0));
      const totalSavings = startPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, startPhase.income - Object.values(startPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(startPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setBudgetGrossIncome(Number(inp.simpleIncome) || 50000);
    setBudgetFilingStatus(inp.filingStatus || 'single');
    setBudgetHsaCoverage(inp.budgetDetails?.hsaCoverage || 'single');
    
    // Reset redesign states
    setIsAdvancedOpen(false);
    setShowBreakdown(false);
    setIsEditingNeeds(false);
    setIsEditingWants(false);
    setIsEditingSavings(false);
    setActiveBreakdownTab('needs');
    
    setIsBudgetModalOpen(true);
  };

  const handleSwitchBudgetPhase = (newPhaseId) => {
    if (newPhaseId === activeBudgetPhase) return;

    // Save current modal inputs to the old phase's state
    setEditedPhases(prev => ({
      ...prev,
      [activeBudgetPhase]: {
        ...prev[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    }));

    // Load new phase inputs
    const nextPhase = editedPhases[newPhaseId];
    if (nextPhase) {
      setBudgetMonthlyIncome(nextPhase.income);
      setBudgetSavings(nextPhase.savings);
      setBudgetPartnerSavings(nextPhase.partnerSavings || {});
      setBudgetExpenses(nextPhase.expenses);
      setSavingsAllocMode(nextPhase.savingsAllocMode);
      setBudgetMonthlySpending(Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0));
      
      const totalSavings = nextPhase.savingsAllocMode === 'percentSurplus'
        ? Math.round(Math.max(0, nextPhase.income - Object.values(nextPhase.expenses).reduce((sum, val) => sum + val, 0)) * (Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0) / 100))
        : Object.values(nextPhase.savings).reduce((sum, val) => sum + val, 0);
      setBudgetMonthlySavings(totalSavings);
    }

    setActiveBudgetPhase(newPhaseId);
  };

  const handleToggleSavingsAllocMode = (newMode) => {
    if (newMode === savingsAllocMode) return;
    
    if (newMode === 'percentSurplus') {
      const totalSavings = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = totalSavings > 0 ? Math.round((val / totalSavings) * 100) : 0;
      });
      
      if (totalSavings > 0) {
        const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
        const diff = 100 - newSum;
        if (diff !== 0) {
          const keys = Object.keys(newSavings);
          let maxKey = 'brokerage';
          keys.forEach(k => {
            if (newSavings[k] > (newSavings[maxKey] || 0)) {
              maxKey = k;
            }
          });
          newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
        }
      } else {
        newSavings.brokerage = 100;
      }
      setBudgetSavings(newSavings);
    } else {
      const totalExpenses = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
      const estimatedSurplus = Math.max(0, budgetMonthlyIncome - totalExpenses);
      
      const newSavings = {};
      Object.keys(budgetSavings).forEach(key => {
        const val = budgetSavings[key] || 0;
        newSavings[key] = Math.round(estimatedSurplus * (val / 100));
      });
      
      const newSum = Object.values(newSavings).reduce((sum, val) => sum + val, 0);
      const diff = estimatedSurplus - newSum;
      if (diff !== 0) {
        const keys = Object.keys(newSavings);
        let maxKey = 'brokerage';
        keys.forEach(k => {
          if (newSavings[k] > (newSavings[maxKey] || 0)) {
            maxKey = k;
          }
        });
        newSavings[maxKey] = Math.max(0, newSavings[maxKey] + diff);
      }
      setBudgetSavings(newSavings);
    }
    
    setSavingsAllocMode(newMode);
  };

  const handleSaveBudget = () => {
    // Capture the current edits for the active phase
    const finalEdited = {
      ...editedPhases,
      [activeBudgetPhase]: {
        ...editedPhases[activeBudgetPhase],
        income: budgetMonthlyIncome,
        savings: budgetSavings,
        partnerSavings: budgetPartnerSavings,
        expenses: budgetExpenses,
        savingsAllocMode: savingsAllocMode
      }
    };

    setScenarios(prev => prev.map(scen => {
      if (scen.id !== currentScenarioId) return scen;

      let newInputs = { ...scen.inputs };
      
      newInputs.filingStatus = budgetFilingStatus;
      if (!newInputs.budgetDetails) newInputs.budgetDetails = {};
      newInputs.budgetDetails.hsaCoverage = budgetHsaCoverage;
      
      // Save all phases back to inputs.budgetDetails.phases
      newInputs.budgetDetails.phases = Object.values(finalEdited).map(p => ({
        id: p.id,
        type: p.type,
        name: p.name,
        startAge: p.startAge,
        endAge: p.endAge,
        income: p.income,
        savingsAllocMode: p.savingsAllocMode,
        savings: p.savings,
        partnerSavings: p.partnerSavings,
        expenses: p.expenses
      }));

      // Synchronize back to simpleIncome, simpleExpenses, incomeList, and spendingPhases
      const currentAgeVal = Number(newInputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      
      if (currentPhase) {
        const wsPhase = Object.values(finalEdited).find(p => p.type === 'workSave');
        const standardIncomeMonthly = wsPhase ? wsPhase.income : currentPhase.income;
        const childBoost = Math.max(0, currentPhase.income - standardIncomeMonthly);
        newInputs.simpleIncome = (currentPhase.income - childBoost) * 12;
        newInputs.simpleExpenses = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
      }

      // Sync career incomes in incomeList
      newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === inc.startAge && (p.type === 'careerChange' || p.type === 'current'));
        if (matchingPhase) {
          inc.amount = inc.frequency === 'monthly' ? matchingPhase.income : matchingPhase.income * 12;
        }
        return inc;
      });

      // Sync spendingPhases
      newInputs.spendingPhases = (newInputs.spendingPhases || []).map(sp => {
        const matchingPhase = Object.values(finalEdited).find(p => p.startAge === sp.startAge && p.type === 'move');
        if (matchingPhase) {
          const totalMonthlyExpenses = Object.values(matchingPhase.expenses).reduce((sum, v) => sum + v, 0);
          sp.amount = sp.frequency === 'monthly' ? totalMonthlyExpenses : totalMonthlyExpenses * 12;
          sp.annualSpending = totalMonthlyExpenses * 12;
        }
        return sp;
      });

      if (pendingImprovement) {
        const { scenario } = pendingImprovement;
        if (scenario.type === 'workLonger') {
          const yearsDelay = scenario.value;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type === 'retire65') {
          const target65Age = newInputs.currentAge < 65 ? 65 : newInputs.currentAge;
          newInputs.targetRetirementAge = target65Age;
        } else if (scenario.type === 'retireReadyAge') {
          newInputs.targetRetirementAge = scenario.value;
        } else if (scenario.type === 'combined') {
          const yearsDelay = scenario.value && typeof scenario.value === 'object' ? (scenario.value.delay || 0) : 0;
          newInputs.targetRetirementAge = newInputs.targetRetirementAge + yearsDelay;
        } else if (scenario.type.startsWith('childOffset')) {
          const boosts = scenario.incomeBoosts || [];
          newInputs.incomeList = [...(newInputs.incomeList || []), ...boosts];
        }

        const targetRetAge = newInputs.targetRetirementAge;
        newInputs.lifeEvents = newInputs.lifeEvents.map(ev => {
          if (ev.type === 'retire') {
            return { ...ev, age: targetRetAge };
          }
          return ev;
        });
      }

      // Update active marriage event and spouse household member in inputs
      const marriageEventIdx = (newInputs.lifeEvents || []).findIndex(e => e.type === 'marriage' && e.enabled);
      if (marriageEventIdx !== -1 && currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        newInputs.lifeEvents[marriageEventIdx] = {
          ...newInputs.lifeEvents[marriageEventIdx],
          combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
        };
        const spouseIdx = (newInputs.householdMembers || []).findIndex(m => m.id === 'spouse');
        if (spouseIdx !== -1) {
          newInputs.householdMembers[spouseIdx] = {
            ...newInputs.householdMembers[spouseIdx],
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual
          };
        }
      }

      // Let the single source of truth properly build suffix-indexed childcare phases, spending phases and rules
      syncChildcarePhasesAndRules(newInputs);

      console.log('>>> SAVE BUDGET:', {
        id: scen.id,
        simpleIncome: newInputs.simpleIncome,
        simpleExpenses: newInputs.simpleExpenses,
        phases: newInputs.budgetDetails?.phases
      });

      return {
        ...scen,
        inputs: newInputs
      };
    }));

    if (isBudgetOpenFromMarriageWizard) {
      const currentAgeVal = Number(inputs.currentAge) || 30;
      const currentPhase = Object.values(finalEdited).find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || Object.values(finalEdited)[0];
      if (currentPhase) {
        const currentPhaseExpensesAnnual = Object.values(currentPhase.expenses).reduce((sum, v) => sum + v, 0) * 12;
        setEditingEvent(prev => {
          if (!prev) return prev;
          let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
          const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
          if (initialPhase) {
            if (initialPhase.frequency === 'monthly') {
              userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
            } else if (initialPhase.frequency === 'yearly') {
              userSpendingPreRetirement = Number(initialPhase.amount) || 0;
            } else {
              userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
            }
          }
          const spousePersonalSpending = Math.round(Math.max(0, currentPhaseExpensesAnnual - userSpendingPreRetirement - (prev.housingCost !== undefined ? Number(prev.housingCost) : -6000)) / 12);
          return {
            ...prev,
            combinedSpendingAfterMarriage: currentPhaseExpensesAnnual,
            spousePersonalSpending: spousePersonalSpending
          };
        });
      }
    }

    handleCloseBudgetModal();
  };

  const handleOpenSavingsDetails = () => {
    setSavingsDetails({
      cash: inputs.assets?.cash || 0,
      emergencyFund: inputs.assets?.emergencyFund || 0,
      brokerage: inputs.assets?.brokerage || 0,
      trad401k: inputs.assets?.trad401k || 0,
      tradIra: inputs.assets?.tradIra || 0,
      rothIra: inputs.assets?.rothIra || 0,
      hsa: inputs.assets?.hsa || 0,
      other: inputs.assets?.other || 0
    });
    setIsSavingsDetailsOpen(true);
  };

  const handleSaveSavingsDetails = () => {
    const total = Object.values(savingsDetails).reduce((sum, val) => sum + val, 0);
    
    // Save to inputs.assets
    updateInput('assets', {
      ...inputs.assets,
      ...savingsDetails
    });
    // Update simpleInvestments
    updateInput('simpleInvestments', total);
    
    setIsSavingsDetailsOpen(false);
  };

  const getDefaultValuesForType = (type, currentAge) => {
    switch (type) {
      case 'checkingSavings':
        return {
          name: 'Cash / Savings',
          value: 10000,
          monthlyAmount: 200,
          rate: 4,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'brokerage':
        return {
          name: 'Investment Account',
          value: 50000,
          monthlyAmount: 500,
          rate: 7,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'house':
        return {
          name: 'Primary Home',
          value: 350000,
          monthlyAmount: 2000,
          rate: 3,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'child':
        return {
          name: 'Child 1',
          value: 0,
          monthlyAmount: 800,
          rate: 3,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'studentLoan':
        return {
          name: 'Student Loan',
          value: 20000,
          monthlyAmount: 250,
          rate: 4.5,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'creditCard':
        return {
          name: 'Credit Card',
          value: 5000,
          monthlyAmount: 150,
          rate: 18,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      case 'carLoan':
        return {
          name: 'Car Loan',
          value: 15000,
          monthlyAmount: 350,
          rate: 5.5,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
      default:
        return {
          name: '',
          value: 0,
          monthlyAmount: 0,
          rate: 0,
          notes: '',
          startAge: currentAge,
          endAge: ''
        };
    }
  };

  const handleCreateCurrentCondition = () => {
    const currentAge = inputs.currentAge || 35;
    setEditingCondition({
      type: 'debt',
      subtype: 'studentLoan',
      ...getDefaultValuesForType('studentLoan', currentAge)
    });
  };

  const handleSaveCurrentCondition = () => {
    if (!editingCondition) return;
    
    let nextList = [...(inputs.currentConditions || [])];
    
    if (editingCondition.id) {
      // Update existing
      nextList = nextList.map(c => c.id === editingCondition.id ? editingCondition : c);
    } else {
      // Create new
      const newItem = {
        ...editingCondition,
        id: `cond-${Date.now()}`
      };
      nextList.push(newItem);
    }
    
    updateInput('currentConditions', nextList);
    setEditingCondition(null);
  };

  const handleRemoveCurrentCondition = (id) => {
    const nextList = (inputs.currentConditions || []).filter(c => c.id !== id);
    updateInput('currentConditions', nextList);
  };

  const handleCreateEvent = (type) => {
    if (type === 'retire' && (inputs.lifeEvents || []).some(e => e.type === 'retire')) {
      return;
    }
    let defaults = { type };
    const curAge = inputs.currentAge || 35;
    
    if (type === 'buyHouse') {
      defaults = {
        ...defaults,
        purchaseAge: 40,
        homePrice: 500000,
        downPayment: 100000,
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        points: 0,
        pmi: 0.5,
        closingCosts: 3,
        propertyTax: 1.1,
        insurance: 0.35,
        hoa: 0,
        maintenance: 1,
        renovationCost: 0,
        utilitiesIncrease: 0,
        appreciationRate: 3,
        sellingCost: 6,
        yearsUntilSale: '',
        currentRent: 0,
        rentGrowth: 3,
        renterInsurance: 0,
        investmentReturn: 7,
        inflation: 3
      };
    } else if (type === 'haveChild') {
      defaults = {
        ...defaults,
        childName: '',
        childStartAge: 0,
        birthAge: inputs.currentAge || 35,
        costMethod: 'default',
        customAges0to4: 15000,
        customAges5to12: 9000,
        customAges13to18: 12000,
        customAges19to22: 20000,
        includeCollege: false
      };
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
      defaults = { ...defaults, claimingAge: 67, monthlyBenefit: 2000, inflationAdjusted: true, name: 'Social Security', ageStartedWorking: 22 };
    } else if (type === 'pension') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 1000, inflationAdjusted: true, name: 'Pension' };
    } else if (type === 'rentalIncome') {
      defaults = { ...defaults, claimingAge: 60, monthlyBenefit: 1500, inflationAdjusted: true, name: 'Rental Income' };
    } else if (type === 'annuity') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 500, inflationAdjusted: false, name: 'Annuity' };
    } else if (type === 'otherRetirementIncome') {
      defaults = { ...defaults, claimingAge: 65, monthlyBenefit: 800, inflationAdjusted: true, name: 'Other Income' };
    } else if (type === 'marriage') {
      const userIncome = Number(inputs.simpleIncome) || 50000;
      const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
      const userAssets = (Number(inputs.assets?.cash) || 0) +
                         (Number(inputs.assets?.brokerage) || 0) +
                         (Number(inputs.assets?.trad401k) || 0) +
                         (Number(inputs.assets?.tradIra) || 0) +
                         (Number(inputs.assets?.rothIra) || 0) +
                         (Number(inputs.assets?.hsa) || 0) +
                         (Number(inputs.assets?.other) || 0);
      const userDebt = (Number(inputs.assets?.debts) || 0) +
                       (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);

      defaults = {
        ...defaults,
        age: inputs.currentAge || 35,
        spouseIncome: userIncome,
        incomeGrowthRate: 3,
        cash: 0,
        investments: userAssets,
        retirement: 0,
        debtStudent: 0,
        debtCredit: 0,
        debtOther: userDebt,
        savingsRate: userSavingsRate,
        housingOption: 'move',
        housingSavings: 0,
        housingCost: 0,
        lifestyleOption: 'same',
        lifestyleAdjustment: 0,
        includeWeddingCost: true,
        weddingCost: 20000,
        weddingFundingMethod: 'savings',
        weddingAge: inputs.currentAge || 35,
        filingStatus: 'jointly',
        wizardStep: 1,
        spouseCurrentAge: inputs.currentAge || 35,
        spouseLifeExpectancy: inputs.lifeExpectancy || 85,
        spouseSocialSecurityAge: 67,
        spouseEstimatedSocialSecurityBenefit: 0,
        spouseDesiredRetirementAge: '',
        retirementSpendingNeed: '',
        partnerRetiresWithUser: true
      };
    }
    
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setEditingEvent(defaults);
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;
    const type = editingEvent.type;
    
    let beforeReadyAge = null;
    let afterReadyAge = null;
    let avgAnnualChildCost = 0;

    if (type === 'haveChild') {
      const currentScenObj = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
      const beforeRes = runFireSimulation(currentScenObj.inputs);
      beforeReadyAge = beforeRes.retirementReadyAge;

      const startAge = editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0;
      const includeCollege = !!editingEvent.includeCollege;
      const maxAge = includeCollege ? 22 : 18;
      let totalCost = 0;
      let activeYears = 0;
      for (let childAge = startAge; childAge < maxAge; childAge++) {
        const ages0to4 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges0to4 !== undefined ? Number(editingEvent.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
        const ages5to12 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges5to12 !== undefined ? Number(editingEvent.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
        const ages13to18 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges13to18 !== undefined ? Number(editingEvent.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
        const ages19to22 = editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

        if (childAge >= 0 && childAge <= 4) {
          totalCost += ages0to4;
        } else if (childAge >= 5 && childAge <= 12) {
          totalCost += ages5to12;
        } else if (childAge >= 13 && childAge <= 18) {
          totalCost += ages13to18;
        } else if (childAge >= 19 && childAge <= 22) {
          totalCost += ages19to22;
        }
        activeYears++;
      }
      avgAnnualChildCost = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;
    }

    let savedEvent = null;
    const nextScenarios = scenarios.map(scen => {
      if (scen.id !== currentScenarioId) return scen;
      
      let newInputs = { ...scen.inputs };
      
      // 1. If editing an existing event, remove it first from the appropriate list
      if (editingEvent.id) {
        const oldEvent = newInputs.lifeEvents.find(e => e.id === editingEvent.id);
        if (oldEvent && oldEvent.type === 'haveChild') {
          const oldBirthAge = Number(oldEvent.birthAge !== undefined ? oldEvent.birthAge : oldEvent.parentAgeAtBirth) || 30;
          const newBirthAge = Number(editingEvent.birthAge !== undefined ? editingEvent.birthAge : editingEvent.parentAgeAtBirth) || 30;
          const ageDiff = newBirthAge - oldBirthAge;
          if (ageDiff !== 0) {
            newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
              if (inc.id && typeof inc.id === 'string' && inc.id.startsWith(`child-income-boost-${editingEvent.id}-`)) {
                return {
                  ...inc,
                  startAge: inc.startAge + ageDiff,
                  endAge: inc.endAge + ageDiff
                };
              }
              return inc;
            });
          }
        }
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
      } else if (type === 'buyHouse') {
        const houseId = editingEvent.houseId || `house-${Date.now()}`;
        
        // Construct the updated HouseAsset
        const houseAssetObj = {
          id: houseId,
          name: editingEvent.name || 'Primary Home',
          purchasePrice: Number(editingEvent.homePrice),
          downPayment: Number(editingEvent.downPayment),
          purchaseType: editingEvent.purchaseType || 'mortgage',
          mortgageRate: editingEvent.mortgageRate !== undefined ? Number(editingEvent.mortgageRate) : 6.5,
          loanTermYears: editingEvent.loanTerm !== undefined ? Number(editingEvent.loanTerm) : 30,
          points: editingEvent.points !== undefined ? Number(editingEvent.points) : 0,
          pmi: editingEvent.pmi !== undefined ? Number(editingEvent.pmi) : 0.5,
          closingCosts: editingEvent.closingCosts !== undefined ? Number(editingEvent.closingCosts) : 3,
          propertyTaxRate: editingEvent.propertyTax !== undefined ? Number(editingEvent.propertyTax) : 1.1,
          insuranceCost: editingEvent.insurance !== undefined ? Number(editingEvent.insurance) : 0.35,
          hoaCost: editingEvent.hoa !== undefined ? Number(editingEvent.hoa) : 0,
          maintenanceRate: editingEvent.maintenance !== undefined ? Number(editingEvent.maintenance) : 1.0,
          renovationCost: editingEvent.renovationCost !== undefined ? Number(editingEvent.renovationCost) : 0,
          utilitiesIncrease: editingEvent.utilitiesIncrease !== undefined ? Number(editingEvent.utilitiesIncrease) : 0,
          appreciationRate: editingEvent.appreciationRate !== undefined ? Number(editingEvent.appreciationRate) : 3.0,
          sellingCostRate: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          investmentReturn: editingEvent.investmentReturn !== undefined ? Number(editingEvent.investmentReturn) : 7,
          inflation: editingEvent.inflation !== undefined ? Number(editingEvent.inflation) : 3,
          currentRent: editingEvent.currentRent !== undefined ? Number(editingEvent.currentRent) : 0,
          rentGrowth: editingEvent.rentGrowth !== undefined ? Number(editingEvent.rentGrowth) : 3,
          renterInsurance: editingEvent.renterInsurance !== undefined ? Number(editingEvent.renterInsurance) : 0
        };

        if (!newInputs.houseAssets) {
          newInputs.houseAssets = [];
        }
        if (newInputs.houseAssets.some(h => h.id === houseId)) {
          newInputs.houseAssets = newInputs.houseAssets.map(h => h.id === houseId ? houseAssetObj : h);
        } else {
          newInputs.houseAssets = [...newInputs.houseAssets, houseAssetObj];
        }

        // Construct BuyHouseEvent
        const buyEvId = editingEvent.id && editingEvent.id.startsWith('buy-') ? editingEvent.id : `buy-${Date.now()}`;
        const buyEvObj = {
          id: buyEvId,
          type: 'buyHouse',
          enabled: true,
          name: 'Buy House',
          purchaseAge: Number(editingEvent.purchaseAge),
          age: Number(editingEvent.purchaseAge),
          houseId: houseId
        };

        // Find or create linked SellHouseEvent
        const existingSell = newInputs.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === houseId);
        const purchaseAgeNum = Number(editingEvent.purchaseAge);
        let defaultSellAge = Number(newInputs.lifeExpectancy || 85);
        if (defaultSellAge <= purchaseAgeNum) {
          defaultSellAge = purchaseAgeNum + 10;
        }

        const sellEvObj = existingSell ? {
          ...existingSell,
          age: Number(existingSell.age) <= purchaseAgeNum ? purchaseAgeNum + 10 : Number(existingSell.age),
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : existingSell.sellingCost
        } : {
          id: `sell-${Date.now()}`,
          type: 'sellHouse',
          enabled: true,
          name: 'Sell House',
          age: defaultSellAge,
          houseId: houseId,
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          proceedsDestination: 'investments'
        };

        // Filter out existing buy/sell events and re-add updated ones
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== buyEvId && e.id !== sellEvObj.id && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, buyEvObj, sellEvObj];
        
        savedEvent = buyEvObj;

      } else if (type === 'sellHouse') {
        const sellEvId = editingEvent.id && editingEvent.id.startsWith('sell-') ? editingEvent.id : `sell-${Date.now()}`;
        const sellEvObj = {
          id: sellEvId,
          type: 'sellHouse',
          enabled: true,
          name: 'Sell House',
          age: Number(editingEvent.age),
          houseId: editingEvent.houseId,
          sellingCost: editingEvent.sellingCost !== undefined ? Number(editingEvent.sellingCost) : 6,
          proceedsDestination: editingEvent.proceedsDestination || 'investments'
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== sellEvId && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, sellEvObj];

        // Update sellingCostRate in HouseAsset
        if (newInputs.houseAssets) {
          newInputs.houseAssets = newInputs.houseAssets.map(h => {
            if (h.id === editingEvent.houseId) {
              return { ...h, sellingCostRate: Number(editingEvent.sellingCost) };
            }
            return h;
          });
        }

        savedEvent = sellEvObj;

      } else {
        const isRetIncomeType = ['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type);
        let defaultName = 'Other Income';
        if (type === 'socialSecurity') defaultName = 'Social Security';
        else if (type === 'pension') defaultName = 'Pension';
        else if (type === 'rentalIncome') defaultName = 'Rental Income';
        else if (type === 'annuity') defaultName = 'Annuity';

        let newEventObj = {
          id: editingEvent.id && !['haveChild', 'college', 'windfall', 'debtPayoff', 'custom', 'socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(editingEvent.id)
            ? editingEvent.id
            : `${type}-${Date.now()}`,
          type,
          enabled: true,
          name: type === 'haveChild' ? 'Have a Child' : type === 'college' ? 'College' : type === 'windfall' ? 'Windfall' : isRetIncomeType ? (editingEvent.name || defaultName) : editingEvent.name
        };
        
        if (type === 'haveChild') {
          newEventObj = {
            ...newEventObj,
            childName: editingEvent.childName || '',
            childStartAge: editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0,
            birthAge: editingEvent.birthAge !== undefined ? editingEvent.birthAge : newInputs.currentAge,
            costMethod: editingEvent.costMethod || 'default',
            customAges0to4: editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000,
            customAges5to12: editingEvent.customAges5to12 !== undefined ? editingEvent.customAges5to12 : 9000,
            customAges13to18: editingEvent.customAges13to18 !== undefined ? editingEvent.customAges13to18 : 12000,
            customAges19to22: editingEvent.customAges19to22 !== undefined ? editingEvent.customAges19to22 : 20000,
            includeCollege: !!editingEvent.includeCollege
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
            inflationAdjusted: editingEvent.inflationAdjusted !== false,
            useEarnings: editingEvent.useEarnings === true,
            ageStartedWorking: editingEvent.ageStartedWorking !== undefined 
              ? Number(editingEvent.ageStartedWorking) 
              : 22
          };
        } else if (type === 'custom') {
          newEventObj = {
            ...newEventObj,
            age: editingEvent.age,
            amount: editingEvent.amount
          };
        } else if (type === 'marriage') {
          const estimates = calculateMarriageEstimates(editingEvent, newInputs);
          const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
          const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;
          const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
          const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;

          newEventObj = {
            ...newEventObj,
            age: Number(editingEvent.age),
            spouseIncome: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3),
            cash: Number(editingEvent.cash || 0),
            investments: Number(editingEvent.investments || 0),
            retirement: Number(editingEvent.retirement || 0),
            debtStudent: Number(editingEvent.debtStudent || 0),
            debtCredit: Number(editingEvent.debtCredit || 0),
            debtOther: Number(editingEvent.debtOther || 0),
            savingsRate: Number(editingEvent.savingsRate),
            housingOption: estimates ? estimates.housingOption : 'move',
            housingSavings: 0,
            housingCost: housingCostAmount,
            lifestyleOption: estimates ? estimates.lifestyleOption : 'same',
            lifestyleAdjustment: lifestyleAdjustmentAmount,
            includeWeddingCost: !!editingEvent.includeWeddingCost,
            weddingCost: Number(editingEvent.weddingCost),
            weddingFundingMethod: editingEvent.weddingFundingMethod || 'savings',
            weddingAge: Number(editingEvent.weddingAge),
            filingStatus: editingEvent.filingStatus || 'jointly',
            spouseCurrentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            spouseLifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,

            spouseDesiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            partnerRetiresWithUser: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            combinedSpendingAfterMarriage: combinedSpendingVal
          };
          
          let nextHouseholdMembers = [...(newInputs.householdMembers || [])];
          const spouseIdx = nextHouseholdMembers.findIndex(m => m.id === 'spouse');
          const spouseRecord = {
            id: 'spouse',
            name: 'Spouse',
            activeFromDate: Number(editingEvent.age),
            activeUntilDate: null,
            income: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate || 3) / 100,
            assets: {
              cash: Number(editingEvent.cash || 0),
              investments: Number(editingEvent.investments || 0),
              retirement: Number(editingEvent.retirement || 0)
            },
            debts: {
              student: Number(editingEvent.debtStudent || 0),
              credit: Number(editingEvent.debtCredit || 0),
              other: Number(editingEvent.debtOther || 0)
            },
            savingsRate: Number(editingEvent.savingsRate),
            currentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            spouseDesiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            desiredRetirementAge: editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== '' && editingEvent.spouseDesiredRetirementAge !== null ? Number(editingEvent.spouseDesiredRetirementAge) : null,
            partnerRetiresWithUser: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            growthRate: Number(editingEvent.incomeGrowthRate || 3),
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount,
            lifestyleAdjustment: lifestyleAdjustmentAmount
          };
          if (spouseIdx !== -1) {
            nextHouseholdMembers[spouseIdx] = spouseRecord;
          } else {
            nextHouseholdMembers.push(spouseRecord);
          }
          newInputs.householdMembers = nextHouseholdMembers;
        }
        
        savedEvent = newEventObj;
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
      }

      if (type === 'haveChild') {
        syncChildcarePhasesAndRules(newInputs);
        const afterRes = runFireSimulation(newInputs);
        afterReadyAge = afterRes.retirementReadyAge;
      }
      
      return {
        ...scen,
        inputs: newInputs
      };
    });

    setScenarios(nextScenarios);

    if (type === 'haveChild' && savedEvent) {
      const diff = (afterReadyAge && beforeReadyAge) ? (afterReadyAge - beforeReadyAge) : 0;
      const currentScenObj = scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
      const targetRetAge = Number(currentScenObj?.inputs?.targetRetirementAge) || 65;
      const isStillReady = afterReadyAge !== null && (diff <= 0 || afterReadyAge <= targetRetAge);

      setChildImpactSummary({
        beforeAge: beforeReadyAge,
        afterAge: afterReadyAge,
        diffYears: diff,
        annualSpending: avgAnnualChildCost,
        event: savedEvent
      });
    }
    
    setEditingEvent(null);
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
  };

  const handleDeleteRoadmapEvent = (evt) => {
    if (!evt || evt.isMilestone) return;
    const matchEvent = inputs.lifeEvents.find(e => e.id === evt.originalId || (e.type === evt.type && (e.purchaseAge === evt.age || e.birthAge === evt.age || e.startAge === evt.age || e.claimingAge === evt.age || e.ageReceived === evt.age || e.age === evt.age)));
    if (matchEvent) {
      setScenarios(prev => prev.map(scen => {
        if (scen.id !== currentScenarioId) return scen;
        
        let newEvents = scen.inputs.lifeEvents.filter(e => e.id !== matchEvent.id);
        let newAssets = scen.inputs.houseAssets || [];

        if (matchEvent.type === 'buyHouse' || matchEvent.type === 'sellHouse') {
          const houseId = matchEvent.houseId;
          if (houseId) {
            newEvents = scen.inputs.lifeEvents.filter(e => e.houseId !== houseId);
            newAssets = (scen.inputs.houseAssets || []).filter(h => h.id !== houseId);
          }
        }

        let newInputs = {
          ...scen.inputs,
          lifeEvents: newEvents,
          houseAssets: newAssets
        };

        if (evt.type === 'retire') {
          newInputs.targetRetirementAge = scen.inputs.lifeExpectancy;
        }
        if (matchEvent.type === 'haveChild') {
          syncChildcarePhasesAndRules(newInputs);
        }
        if (matchEvent.type === 'marriage') {
          newInputs.householdMembers = (scen.inputs.householdMembers || []).filter(m => m.id !== 'spouse');
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

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    
    // Create a proxy event object that handleDeleteRoadmapEvent expects
    const proxyEvent = {
      originalId: editingEvent.id,
      id: editingEvent.id,
      type: editingEvent.type,
      age: editingEvent.age || editingEvent.purchaseAge || editingEvent.birthAge || editingEvent.claimingAge || editingEvent.moveAge
    };
    
    handleDeleteRoadmapEvent(proxyEvent);
    setEditingEvent(null);
    setIsFullPartnerProfileOpen(false);
    setIsZeroSpendingConfirmed(false);
    setIsPartnerZeroSpendingConfirmed(false);
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
              updated.age = newAge;
            } else if (e.type === 'sellHouse') {
              updated.age = newAge;
            } else if (e.type === 'haveChild') {
              updated.birthAge = newAge;
              const oldBirthAge = Number(e.birthAge !== undefined ? e.birthAge : e.parentAgeAtBirth) || 30;
              const ageDiff = newAge - oldBirthAge;
              if (ageDiff !== 0) {
                newInputs.incomeList = (newInputs.incomeList || []).map(inc => {
                  if (inc.id && typeof inc.id === 'string' && inc.id.startsWith(`child-income-boost-${e.id}-`)) {
                    return {
                      ...inc,
                      startAge: inc.startAge + ageDiff,
                      endAge: inc.endAge + ageDiff
                    };
                  }
                  return inc;
                });
              }
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

      if (evt.type === 'haveChild') {
        syncChildcarePhasesAndRules(newInputs);
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
    const track = e.currentTarget.closest('.timeline-track-inner');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
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
      const rawAge = Math.round(initialAge + deltaYears);
      let newAge = rawAge;
      if (evt.type === 'socialSecurity') {
        newAge = Math.max(62, Math.min(70, newAge));
      } else if (evt.type === 'buyHouse' && evt.houseId) {
        const sellEv = inputs.lifeEvents?.find(e => e.type === 'sellHouse' && e.houseId === evt.houseId);
        const maxLimit = sellEv ? Number(sellEv.age) - 1 : maxAge;
        newAge = Math.max(minAge, Math.min(maxLimit, newAge));
      } else if (evt.type === 'sellHouse' && evt.houseId) {
        const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === evt.houseId);
        const minLimit = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) + 1 : minAge;
        newAge = Math.max(minLimit, Math.min(maxAge, newAge));
      } else {
        newAge = Math.max(minAge, Math.min(maxAge, newAge));
      }

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
          currentAge: newAge,
          rawAge: rawAge
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
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const validation = validateSocialSecurityClaimAge(rawAge);
            targetAge = validation.validAge;
            if (validation.wasClamped) {
              showNotification(validation.message);
            }
          }
          commitEventAgeChange(evt, targetAge);
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

  const isFinancialEvent = (evt) => {
    if (!evt) return false;
    if (isEditableEvent(evt)) return false;
    const financialTypes = [
      'mortgageOff',
      'childSupportEnds',
      'medicareEligibility',
      'socialSecurity',
      'retirementReadySurvival',
      'retirementReadyComfortable',
      'retirementReadySWR',
      'coastFire',
      'debtPayoff',
      'pension',
      'rentalIncome',
      'annuity',
      'otherRetirementIncome'
    ];
    if (financialTypes.includes(evt.type)) {
      return true;
    }
    if (evt.isMilestone && !evt.originalId && evt.type !== 'retire' && evt.type !== 'buyHouse' && evt.type !== 'sellHouse' && evt.type !== 'haveChild' && evt.type !== 'marriage') {
      return true;
    }
    return false;
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
        const asset = inputs.houseAssets?.find(h => h.id === matchEvent.houseId) || {};
        defaults = {
          ...defaults,
          id: matchEvent.id,
          houseId: matchEvent.houseId,
          purchaseAge: matchEvent.purchaseAge !== undefined ? matchEvent.purchaseAge : matchEvent.age,
          homePrice: asset.purchasePrice !== undefined ? asset.purchasePrice : (asset.homePrice !== undefined ? asset.homePrice : (matchEvent.homePrice || 500000)),
          downPayment: asset.downPayment !== undefined ? asset.downPayment : (matchEvent.downPayment || 100000),
          purchaseType: asset.purchaseType || matchEvent.purchaseType || 'mortgage',
          mortgageRate: asset.mortgageRate !== undefined ? asset.mortgageRate : (matchEvent.mortgageRate !== undefined ? matchEvent.mortgageRate : 6.5),
          loanTerm: asset.loanTermYears !== undefined ? asset.loanTermYears : (asset.loanTerm !== undefined ? asset.loanTerm : (matchEvent.loanTerm !== undefined ? matchEvent.loanTerm : 30)),
          points: asset.points !== undefined ? asset.points : (matchEvent.points || 0),
          pmi: asset.pmi !== undefined ? asset.pmi : (matchEvent.pmi !== undefined ? matchEvent.pmi : 0.5),
          closingCosts: asset.closingCosts !== undefined ? asset.closingCosts : (matchEvent.closingCosts !== undefined ? matchEvent.closingCosts : 3),
          propertyTax: asset.propertyTaxRate !== undefined ? asset.propertyTaxRate : (asset.propertyTax !== undefined ? asset.propertyTax : (matchEvent.propertyTax !== undefined ? matchEvent.propertyTax : 1.1)),
          insurance: asset.insuranceCost !== undefined ? asset.insuranceCost : (asset.insurance !== undefined ? asset.insurance : (matchEvent.insurance !== undefined ? matchEvent.insurance : 0.35)),
          hoa: asset.hoaCost !== undefined ? asset.hoaCost : (asset.hoa !== undefined ? asset.hoa : (matchEvent.hoa !== undefined ? matchEvent.hoa : 0)),
          maintenance: asset.maintenanceRate !== undefined ? asset.maintenanceRate : (asset.maintenance !== undefined ? asset.maintenance : (matchEvent.maintenance !== undefined ? matchEvent.maintenance : 1.0)),
          renovationCost: asset.renovationCost !== undefined ? asset.renovationCost : (matchEvent.renovationCost || 0),
          utilitiesIncrease: asset.utilitiesIncrease !== undefined ? asset.utilitiesIncrease : (matchEvent.utilitiesIncrease || 0),
          appreciationRate: asset.appreciationRate !== undefined ? asset.appreciationRate : (matchEvent.appreciationRate !== undefined ? matchEvent.appreciationRate : 3.0),
          sellingCost: asset.sellingCostRate !== undefined ? asset.sellingCostRate : (asset.sellingCost !== undefined ? asset.sellingCost : 6),
          currentRent: asset.currentRent !== undefined ? asset.currentRent : (matchEvent.currentRent || 0),
          rentGrowth: asset.rentGrowth !== undefined ? asset.rentGrowth : (matchEvent.rentGrowth || 3),
          renterInsurance: asset.renterInsurance !== undefined ? asset.renterInsurance : (matchEvent.renterInsurance || 0),
          investmentReturn: asset.investmentReturn !== undefined ? asset.investmentReturn : (matchEvent.investmentReturn !== undefined ? matchEvent.investmentReturn : 7),
          inflation: asset.inflation !== undefined ? asset.inflation : (matchEvent.inflation !== undefined ? matchEvent.inflation : 3)
        };
      } else if (matchEvent.type === 'sellHouse') {
        defaults = {
          ...defaults,
          id: matchEvent.id,
          houseId: matchEvent.houseId,
          age: matchEvent.age,
          sellingCost: matchEvent.sellingCost !== undefined ? matchEvent.sellingCost : 6,
          proceedsDestination: matchEvent.proceedsDestination || 'investments'
        };
      } else if (matchEvent.type === 'haveChild') {
        defaults = {
          ...defaults,
          childName: matchEvent.childName || '',
          childStartAge: matchEvent.childStartAge !== undefined ? matchEvent.childStartAge : 0,
          birthAge: matchEvent.birthAge,
          costMethod: matchEvent.costMethod || 'default',
          customAges0to4: matchEvent.customAges0to4 !== undefined ? matchEvent.customAges0to4 : 15000,
          customAges5to12: matchEvent.customAges5to12 !== undefined ? matchEvent.customAges5to12 : 9000,
          customAges13to18: matchEvent.customAges13to18 !== undefined ? matchEvent.customAges13to18 : 12000,
          customAges19to22: matchEvent.customAges19to22 !== undefined ? matchEvent.customAges19to22 : 20000,
          includeCollege: !!matchEvent.includeCollege
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
          inflationAdjusted: matchEvent.inflationAdjusted,
          useEarnings: matchEvent.useEarnings,
          ageStartedWorking: matchEvent.ageStartedWorking !== undefined ? matchEvent.ageStartedWorking : 22,
          yearStartedWorking: matchEvent.yearStartedWorking
        };
      } else if (matchEvent.type === 'custom') {
        defaults = {
          ...defaults,
          name: matchEvent.name,
          age: matchEvent.age,
          amount: matchEvent.amount
        };
      } else if (matchEvent.type === 'marriage') {
        defaults = {
          ...defaults,
          age: matchEvent.age,
          spouseIncome: matchEvent.spouseIncome,
          incomeGrowthRate: matchEvent.incomeGrowthRate,
          cash: matchEvent.cash,
          investments: matchEvent.investments,
          retirement: matchEvent.retirement,
          debtStudent: matchEvent.debtStudent,
          debtCredit: matchEvent.debtCredit,
          debtOther: matchEvent.debtOther,
          savingsRate: matchEvent.savingsRate,
          housingOption: matchEvent.housingOption || 'none',
          housingSavings: matchEvent.housingSavings,
          housingCost: matchEvent.housingCost,
          lifestyleAdjustment: matchEvent.lifestyleAdjustment,
          includeWeddingCost: !!matchEvent.includeWeddingCost,
          weddingCost: matchEvent.weddingCost,
          weddingAge: matchEvent.weddingAge,
          filingStatus: matchEvent.filingStatus || 'jointly',
          spouseCurrentAge: matchEvent.spouseCurrentAge !== undefined ? matchEvent.spouseCurrentAge : matchEvent.age,
          spouseLifeExpectancy: matchEvent.spouseLifeExpectancy !== undefined ? matchEvent.spouseLifeExpectancy : (inputs.lifeExpectancy || 85),
          spouseSocialSecurityAge: matchEvent.spouseSocialSecurityAge !== undefined ? matchEvent.spouseSocialSecurityAge : 67,
          spouseEstimatedSocialSecurityBenefit: matchEvent.spouseEstimatedSocialSecurityBenefit !== undefined ? matchEvent.spouseEstimatedSocialSecurityBenefit : 0,
          spouseDesiredRetirementAge: matchEvent.spouseDesiredRetirementAge !== undefined ? matchEvent.spouseDesiredRetirementAge : '',
          retirementSpendingNeed: matchEvent.retirementSpendingNeed !== undefined ? matchEvent.retirementSpendingNeed : '',
          combinedSpendingAfterMarriage: matchEvent.combinedSpendingAfterMarriage,
          spousePersonalSpending: matchEvent.spousePersonalSpending,
          wizardStep: 1
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
          const supportEndParentAge = Number(ev.birthAge) + (ev.includeCollege ? 22 : 18);
          const childCurrentAge = Math.max(0, curAge - Number(ev.birthAge));
          const bornText = Number(ev.birthAge) < curAge 
            ? `(already born, current age ${childCurrentAge}, support ends at parent age ${supportEndParentAge})` 
            : `(support ends at parent age ${supportEndParentAge})`;
          list.push({
            age: Number(ev.birthAge),
            text: `Have a child${ev.childName ? ` "${ev.childName}"` : ''} ${bornText}`
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
          const age = Number(ev.age || ev.startAge || ev.payoffAge || ev.purchaseAge || ev.birthAge || ev.ageReceived || ev.claimingAge || ev.transferAge || 0);
          let desc = `Event: ${ev.name || 'Custom'}`;
          if (ev.type === 'debtPayoff') {
            desc = `Pay off debt: "${ev.name || 'Debt Payoff'}" costing ${formatCurrency(ev.amount)}`;
          } else if (ev.type === 'sabbatical') {
            desc = `Take sabbatical "${ev.name || 'Sabbatical'}" until age ${ev.endAge}`;
          } else if (ev.type === 'baristaFire') {
            desc = `Transition to Barista FIRE (expenses: ${formatCurrency(ev.annualExpenses)}/yr)`;
          } else if (ev.type === 'coastFire') {
            desc = `Transition to Coast FIRE`;
          } else if (ev.type === 'assetTransfer') {
            desc = `Transfer ${formatCurrency(ev.amount)} from ${ev.fromAsset || 'portfolio'} to ${ev.toAsset || 'portfolio'}`;
          }
          list.push({
            age,
            text: desc
          });
        }
      }
    });

    list.sort((a, b) => a.age - b.age);



    const criteria = inputs.readinessCriteria;
    const roadmapLabel = criteria === 'lastsLifeExp' ? 'Sustainable' : criteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite';
    const retirementReadyAge = results.retirementReadyAge;
    if (retirementReadyAge) {
      const targetValForStory = criteria === 'lastsLifeExp'
        ? results.retirementReadyTargetSurvival
        : criteria === 'lastsComfortable'
          ? results.retirementReadyTargetComfortable
          : results.retirementReadyTarget;
      list.push({
        age: retirementReadyAge,
        text: `<strong style="color: var(--accent-emerald)">Reach ${roadmapLabel} Retirement (Target: ${formatCurrency(targetValForStory)})</strong>`
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
    const calc = displayedResults;

    // 1. Income Phases
    inp.incomeList.forEach(inc => {
      if (inc.id && typeof inc.id === 'string' && (inc.id.startsWith('simple-inc') || inc.id.startsWith('child-income-boost'))) {
        return;
      }
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
      if (phase.id && typeof phase.id === 'string' && phase.id.startsWith('simple-spend')) {
        return;
      }
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
            const asset = inp.houseAssets?.find(h => h.id === ev.houseId) || ev;
            const houseName = asset.name || 'Primary Home';
            const price = Number(asset.purchasePrice !== undefined ? asset.purchasePrice : (asset.homePrice || 500000));
            const dp = Number(asset.downPayment || 0);
            const loanTermVal = Number(asset.loanTermYears !== undefined ? asset.loanTermYears : (asset.loanTerm || 30));
            const purchaseTypeVal = asset.purchaseType || 'mortgage';

            events.push({
              originalId: ev.id,
              age,
              title: `Buy House: ${houseName}`,
              label: `Buy ${houseName}`,
              icon: '🏠',
              type: 'buyHouse',
              houseId: ev.houseId,
              description: `Purchased "${houseName}" for ${formatCurrency(price)} (${purchaseTypeVal === 'cash' ? 'Cash Purchase' : 'Mortgage with ' + formatCurrency(dp) + ' down'}).`
            });

            if (purchaseTypeVal !== 'cash') {
              // Find linked sellHouse event age
              const sellEv = inp.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
              const sellAge = sellEv ? Number(sellEv.age) : (age + loanTermVal);
              const payoffAge = age + loanTermVal;
              if (payoffAge <= inp.lifeExpectancy && payoffAge < sellAge) {
                events.push({
                  age: payoffAge,
                  title: `Mortgage Paid Off: ${houseName}`,
                  label: `${houseName} Paid Off`,
                  icon: '🏠',
                  type: 'mortgageOff',
                  houseId: ev.houseId,
                  isMilestone: true,
                  description: `Mortgage on "${houseName}" is fully amortized, removing P&I payment of ${formatCurrency(propPIAmount(asset))} /yr from annual expenses.`
                });
              }
            }
          } else if (ev.type === 'sellHouse') {
            const asset = inp.houseAssets?.find(h => h.id === ev.houseId);
            const houseName = asset?.name || 'Home';
            
            let purchasePrice = 0;
            let purchaseAge = 40;
            let currentValue = 0;
            let remainingMortgageBalance = 0;
            let sellingCosts = 0;
            let netProceeds = 0;
            let yearsOwned = 0;
            
            if (asset) {
              purchasePrice = Number(asset.purchasePrice || asset.homePrice || 0);
              purchaseAge = Number(asset.purchaseAge || 40);
              const saleAge = Number(ev.age || 50);
              yearsOwned = Math.max(0, saleAge - purchaseAge);
              const appreciationRate = (Number(asset.appreciationRate !== undefined ? asset.appreciationRate : 3.0)) / 100;
              currentValue = purchasePrice * Math.pow(1 + appreciationRate, yearsOwned);
              
              if (asset.purchaseType !== 'cash') {
                const loanAmount = Math.max(0, purchasePrice - Number(asset.downPayment || 0));
                const rate = (Number(asset.mortgageRate !== undefined ? asset.mortgageRate : 6.5)) / 100;
                const loanTerm = Number(asset.loanTermYears || asset.loanTerm || 30);
                
                if (yearsOwned >= loanTerm) {
                  remainingMortgageBalance = 0;
                } else if (loanAmount > 0 && loanTerm > 0) {
                  const r = rate / 12;
                  const n = loanTerm * 12;
                  const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  const elapsedMonths = yearsOwned * 12;
                  const remainingMonths = n - elapsedMonths;
                  remainingMortgageBalance = r === 0 ? monthlyPayment * remainingMonths : monthlyPayment * (1 - Math.pow(1 + r, -remainingMonths)) / r;
                }
              }
              
              const sellingCostRate = Number(ev.sellingCost !== undefined ? ev.sellingCost : 6);
              sellingCosts = currentValue * (sellingCostRate / 100);
              netProceeds = currentValue - remainingMortgageBalance - sellingCosts;
            }

            events.push({
              originalId: ev.id,
              age,
              title: `Sell House: ${houseName}`,
              label: `Sell ${houseName}`,
              icon: '🏠',
              type: 'sellHouse',
              houseId: ev.houseId,
              description: `Sold home "${houseName}" after ${yearsOwned} years for ${formatCurrency(currentValue)} (net proceeds: ${formatCurrency(netProceeds)} after mortgage payoff of ${formatCurrency(remainingMortgageBalance)} and ${ev.sellingCost || 6}% selling costs).`
            });
          } else if (ev.type === 'haveChild') {
            events.push({
              originalId: ev.id,
              age,
              title: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              label: ev.childName ? `Have Child: ${ev.childName}` : `Have Child`,
              icon: '👶',
              type: 'haveChild',
              description: ev.childName 
                ? `Welcomed ${ev.childName}! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
                : `Welcomed a child! Childcare/support runs until support ends at age ${ev.includeCollege ? 22 : 18}.`
            });
            const supportEndAge = ev.includeCollege ? 22 : 18;
            const parentAgeAtEnd = age + supportEndAge;
            if (parentAgeAtEnd <= inp.lifeExpectancy) {
              events.push({
                age: parentAgeAtEnd,
                title: ev.childName ? `Support for ${ev.childName} Ends` : `Child Expenses End`,
                label: ev.childName ? `Support for ${ev.childName} Ends` : `Child Support Ends`,
                icon: '👶',
                type: 'childSupportEnds',
                isMilestone: true,
                description: ev.childName 
                  ? `General support and childcare expenses for ${ev.childName} born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
                  : `General support and childcare expenses for child born when you were Age ${age} have ended (support term: ${supportEndAge} years).`
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
            let ssTitle = label;
            if (ev.type === 'socialSecurity') {
              const ss = calc.socialSecurityDetails;
              const isEligible = ss ? ss.isEligible : true;
              let annualBenefit = ss ? ss.annualBenefit : (Number(ev.monthlyBenefit) || 0) * 12 * getSocialSecurityFactor(age);
              let monthlyBenefitVal = annualBenefit / 12;
              
              if (!isEligible) {
                ssTitle = `Social Security starts at ${age}: Not Eligible`;
                desc = `Not eligible for Social Security benefits. At least 10 working years are required. (Working Years: ${ss ? ss.workingYears : 0} / 10)`;
              } else {
                ssTitle = `Social Security starts at ${age}: ~$${Math.round(annualBenefit).toLocaleString()}/yr`;
                
                if (age < 62) {
                  desc = `Social Security cannot be claimed before age 62 (Benefit: $0/mo).`;
                } else {
                  const factor = getSocialSecurityFactor(age);
                  const penaltyPct = 30; // 30% early reduction
                  const bonusPct = Math.round((factor - 1) * 100);
                  
                  desc = `Receiving Social Security of ${formatCurrency(monthlyBenefitVal)}/month (${formatCurrency(annualBenefit)}/year) claimed at age ${age}. `;
                  if (age === 67) {
                    desc += `Full retirement benefit (100%).`;
                  } else if (age < 67) {
                    desc += `Benefit is permanently reduced by ${penaltyPct}% from full benefit due to early claim.`;
                  } else {
                    desc += `Benefit is permanently increased by ${bonusPct}% from full benefit due to delayed claim (8% delayed credit per year after 67).`;
                  }
                }
              }
            }

            events.push({
              originalId: ev.id,
              age,
              title: ssTitle,
              label: ssTitle,
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
          } else if (ev.type === 'marriage') {
            const spouseAssets = (Number(ev.cash) || 0) + (Number(ev.investments) || 0) + (Number(ev.retirement) || 0);
            const spouseDebts = (Number(ev.debtStudent) || 0) + (Number(ev.debtCredit) || 0) + (Number(ev.debtOther) || 0);
            events.push({
              originalId: ev.id,
              age,
              title: `💍 Get Married`,
              label: `Get Married`,
              icon: '💍',
              type: 'marriage',
              description: `Married a spouse with ${formatCurrency(ev.spouseIncome)}/yr income, ${formatCurrency(spouseAssets)} starting assets, and ${formatCurrency(spouseDebts)} starting debts. ${ev.includeWeddingCost ? 'Wedding cost: ' + formatCurrency(ev.weddingCost) + ' at Age ' + ev.weddingAge + '.' : ''}`,
              spouseIncome: ev.spouseIncome,
              incomeGrowthRate: ev.incomeGrowthRate,
              cash: ev.cash,
              investments: ev.investments,
              retirement: ev.retirement,
              debtStudent: ev.debtStudent,
              debtCredit: ev.debtCredit,
              debtOther: ev.debtOther,
              savingsRate: ev.savingsRate,
              housingOption: ev.housingOption,
              housingSavings: ev.housingSavings,
              housingCost: ev.housingCost,
              lifestyleAdjustment: ev.lifestyleAdjustment,
              includeWeddingCost: ev.includeWeddingCost,
              weddingCost: ev.weddingCost,
              weddingAge: ev.weddingAge,
              filingStatus: ev.filingStatus
            });
          }
        }
      }
    });

    // 4. Mathematical Milestones (e.g. debt payoffs)
    const calculationMilestones = calc.dynamicMilestones || [];
    calculationMilestones.forEach(m => {
      if (m.type === 'sellHouse') {
        return; // Skip duplicate sellHouse dynamic milestones (already represented by Sell House event)
      }
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

    // Allocate stackIndex slots consistently for house-related events
    const houseRanges = {};
    inp.lifeEvents.forEach(ev => {
      if (ev.enabled && ev.type === 'buyHouse' && ev.houseId) {
        const buyAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
        const sellEv = inp.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId);
        const sellAge = sellEv ? Number(sellEv.age) : Number(inp.lifeExpectancy || 85);
        houseRanges[ev.houseId] = {
          start: Math.floor(buyAge),
          end: Math.floor(sellAge)
        };
      }
    });

    const houseSlots = {};
    const occupiedSlots = [];

    const houseIds = Object.keys(houseRanges).sort((a, b) => houseRanges[a].start - houseRanges[b].start);
    houseIds.forEach(houseId => {
      const range = houseRanges[houseId];
      let slot = 0;
      while (true) {
        if (!occupiedSlots[slot]) {
          occupiedSlots[slot] = new Set();
        }
        let isFree = true;
        for (let age = range.start; age <= range.end; age++) {
          if (occupiedSlots[slot].has(age)) {
            isFree = false;
            break;
          }
        }
        if (isFree) {
          for (let age = range.start; age <= range.end; age++) {
            occupiedSlots[slot].add(age);
          }
          houseSlots[houseId] = slot;
          break;
        }
        slot++;
      }
    });

    return sorted.map(evt => {
      let stackIndex = 0;
      if (evt.houseId && houseSlots[evt.houseId] !== undefined) {
        stackIndex = houseSlots[evt.houseId];
      } else {
        const ageKey = Math.floor(evt.age);
        let slot = 0;
        while (true) {
          if (!occupiedSlots[slot]) {
            occupiedSlots[slot] = new Set();
          }
          if (!occupiedSlots[slot].has(ageKey)) {
            occupiedSlots[slot].add(ageKey);
            stackIndex = slot;
            break;
          }
          slot++;
        }
      }
      return { ...evt, stackIndex };
    });
  }, [activeScenario.inputs, displayedResults]);

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
  const totalNetWorth = displayedResults.currentNetWorth;
  const targetGoal = displayedResults.fiNumber || 0;
  const rawPercent = targetGoal > 0 ? Math.round((totalNetWorth / targetGoal) * 100) : 0;
  const gaugePercent = rawPercent;
  const clampedPercentForGauge = Math.max(0, Math.min(100, rawPercent));

  const sqSize = 120;
  const radius = 50;
  const viewBox = `0 0 ${sqSize} ${sqSize}`;
  const dashArray = radius * Math.PI * 2;
  const dashOffset = dashArray - (dashArray * clampedPercentForGauge) / 100;

  const getLifestyleGaps = (logs) => {
    if (!logs) return [];
    const gaps = [];
    let currentGap = null;
    
    logs.forEach(log => {
      if (log.lifestyleGap && log.lifestyleGap > 0) {
        if (currentGap && currentGap.endAge === log.age - 1) {
          currentGap.endAge = log.age;
          currentGap.maxGap = Math.max(currentGap.maxGap, log.lifestyleGap);
          currentGap.totalGap += log.lifestyleGap;
          currentGap.yearsCount++;
        } else {
          if (currentGap) {
            gaps.push(currentGap);
          }
          currentGap = {
            startAge: log.age,
            endAge: log.age,
            maxGap: log.lifestyleGap,
            totalGap: log.lifestyleGap,
            yearsCount: 1
          };
        }
      } else {
        if (currentGap) {
          gaps.push(currentGap);
          currentGap = null;
        }
      }
    });
    if (currentGap) {
      gaps.push(currentGap);
    }
    return gaps;
  };

  const renderChildImpactModal = () => {
    if (!childImpactSummary) return null;
    const { beforeAge, afterAge, diffYears, annualSpending, event } = childImpactSummary;

    const targetRet = Number(inputs.targetRetirementAge) || 65;
    const isBeforeReady = beforeAge !== null && beforeAge <= targetRet;
    const isAfterReady = afterAge !== null && afterAge <= targetRet;
    const isStillReady = afterAge !== null && (diffYears <= 0 || afterAge <= targetRet);

    const startAge = event.childStartAge !== undefined ? Number(event.childStartAge) : 0;
    const includeCollege = !!event.includeCollege;
    const maxAge = includeCollege ? 22 : 18;
    const years = Math.max(0, maxAge - startAge);

    return (
      <div className="modal-backdrop" onClick={() => setChildImpactSummary(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👶 {event.childName ? `Welcome, ${event.childName}!` : 'Child Event Added'}
          </h3>
          
          <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {isStillReady 
              ? "Congratulations! Your retirement plan remains fully on track and sustainable with this child event. No further adjustments are needed."
              : "Adding child-related costs changes the timeline and may require adjustments to savings, spending, or retirement assumptions. Raising a child is a beautiful journey, and these figures help you plan with confidence. You can refine child spending details in your budget at any time."
            }
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Before Child:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isBeforeReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
                {beforeAge 
                  ? (beforeAge <= targetRet ? `✓ Retirement Ready at Age ${beforeAge}` : `⚠ Retires Late at Age ${beforeAge}`)
                  : '⚠ Current Plan Needs Adjustment'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>After Child:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isAfterReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
                {afterAge 
                  ? (afterAge <= targetRet ? `✓ Retirement Ready at Age ${afterAge}` : `⚠ Retires Late at Age ${afterAge}`)
                  : '⚠ Current Plan Needs Adjustment'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estimated Child Costs:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {formatCurrency(annualSpending)}/year for {years} years
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => {
                setChildImpactSummary(null);
                setEditingEvent(event);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Refine Child Costs
            </button>
            <button 
              type="button"
              className={isStillReady ? "btn-primary" : "btn-secondary"} 
              onClick={() => {
                setChildImpactSummary(null);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Done
            </button>
            <button 
              type="button"
              className={isStillReady ? "btn-secondary" : "btn-primary"} 
              onClick={() => {
                setChildImpactSummary(null);
                setShowImprovementModal(true);
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Adjust Plan
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderChildCostsBuckets = () => {
    const childEvents = inputs.lifeEvents.filter(e => e.type === 'haveChild');
    if (childEvents.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
        {childEvents.map((ev, idx) => {
          const startAge = ev.childStartAge !== undefined ? ev.childStartAge : 0;
          const birthAge = ev.birthAge !== undefined ? ev.birthAge : inputs.currentAge;
          const childName = ev.childName || `Child #${idx + 1}`;
          
          const maxAge = ev.includeCollege ? 22 : 18;
          const parentStartAge = birthAge + startAge;
          const parentEndAge = birthAge + maxAge;
          
          const currentChildAge = Math.max(0, inputs.currentAge - birthAge);
          
          let currentAnnualCost = 0;
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

          if (currentChildAge >= 0 && currentChildAge <= 4) currentAnnualCost = ages0to4;
          else if (currentChildAge >= 5 && currentChildAge <= 12) currentAnnualCost = ages5to12;
          else if (currentChildAge >= 13 && currentChildAge <= 18) currentAnnualCost = ages13to18;
          else if (currentChildAge >= 19 && currentChildAge <= 22) currentAnnualCost = ages19to22;

          const monthlyCost = Math.round(currentAnnualCost / 12);

          return (
            <div className="glass-card" key={ev.id || idx} style={{ padding: '1.25rem 1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  👶 {childName} Spending Bucket
                </h4>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', margin: 0 }}
                  onClick={() => handleEditRoadmapEvent({
                    ...ev,
                    age: birthAge
                  })}
                >
                  Adjust
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Monthly Cost</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(monthlyCost)}/mo</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Annual Cost</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(currentAnnualCost)}/yr</strong>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div>
                  Active Years: <strong>Parent Age {parentStartAge} to {parentEndAge}</strong> (Child Age {startAge} to {maxAge})
                </div>
                <div>
                  College Support: <strong>{ev.includeCollege ? 'Enabled (Ages 19-22)' : 'Disabled'}</strong>
                </div>
                <div>
                  Cost Method: <strong>{ev.costMethod === 'custom' ? 'Custom Brackets' : ev.costMethod === 'budget' ? 'Budget Builder' : 'Default Assumptions'}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMarriageWizard = () => {
    const stepId = editingEvent.wizardStep || 1;
    const showTaxesStep = !!inputs.includeTaxes;

    const handleNext = () => {
      if (stepId < 4) {
        setEditingEvent({ ...editingEvent, wizardStep: stepId + 1 });
      }
    };

    const handleBack = () => {
      if (stepId > 1) {
        setEditingEvent({ ...editingEvent, wizardStep: stepId - 1 });
      }
    };

    // Calculate Combined Live Summary
    const userIncome = Number(inputs.simpleIncome) || 50000;
    const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
    const spouseIncome = Number(editingEvent.spouseIncome) || 0;
    const combinedIncome = userIncome + spouseIncome;

    const userAssets = Number(inputs.assets?.cash || 0) +
                       Number(inputs.assets?.brokerage || 0) +
                       Number(inputs.assets?.trad401k || 0) +
                       Number(inputs.assets?.tradIra || 0) +
                       Number(inputs.assets?.rothIra || 0) +
                       Number(inputs.assets?.hsa || 0) +
                       Number(inputs.assets?.other || 0);
    const spouseAssets = Number(editingEvent.cash || 0) +
                         Number(editingEvent.investments || 0) +
                         Number(editingEvent.retirement || 0);
    const combinedAssets = userAssets + spouseAssets;

    const userDebt = Number(inputs.assets?.debts || 0) +
                     (inputs.debtList || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);
    const spouseDebt = Number(editingEvent.debtStudent || 0) +
                       Number(editingEvent.debtCredit || 0) +
                       Number(editingEvent.debtOther || 0);
    const combinedDebt = userDebt + spouseDebt;

    // Calculate user spending baseline pre-retirement
    let userSpendingPreRetirement = Number(inputs.simpleExpenses) || 42500;
    const initialPhase = (inputs.spendingPhases || []).find(p => (inputs.currentAge || 30) >= p.startAge && (inputs.currentAge || 30) < p.endAge) || (inputs.spendingPhases || [])[0];
    if (initialPhase) {
      if (initialPhase.frequency === 'monthly') {
        userSpendingPreRetirement = (Number(initialPhase.amount) || 0) * 12;
      } else if (initialPhase.frequency === 'yearly') {
        userSpendingPreRetirement = Number(initialPhase.amount) || 0;
      } else {
        userSpendingPreRetirement = Number(initialPhase.annualSpending) || Number(initialPhase.amount) || 0;
      }
    }

    const estimates = calculateMarriageEstimates(editingEvent, inputs);
    const partnerSavings = estimates ? estimates.partnerSavings : 0;
    const partnerTax = estimates ? estimates.partnerTax : 0;
    const partnerTakeHomeRemaining = estimates ? estimates.partnerTakeHomeRemaining : 0;
    const currentHousingCost = estimates ? estimates.currentHousingCost : 1500;
    const housingOption = estimates ? estimates.housingOption : 'move';
    const housingCostAmount = estimates ? estimates.housingCostAmount : 0;
    const sharedCostSavingsAmount = estimates ? estimates.sharedCostSavingsAmount : -3000;
    const lifestyleOption = estimates ? estimates.lifestyleOption : 'same';
    const lifestyleAdjustmentAmount = estimates ? estimates.lifestyleAdjustmentAmount : 0;
    const combinedSpendingVal = estimates ? estimates.combinedSpendingVal : 0;
    const spousePreRetirementSpending = estimates ? estimates.spousePreRetirementSpending : 0;
    const spouseRetSpendingVal = estimates ? estimates.spouseRetSpendingVal : 0;

    const partnerPersonalSpending = Math.round(partnerTakeHomeRemaining / 12);
    const weddingCostAmount = editingEvent.includeWeddingCost ? Number(editingEvent.weddingCost || 20000) : 0;

    // Net Cash Flow Impact = Spouse Income - (Combined Spend - User Spend) - Housing Cost - Lifestyle Cost
    const netCashFlowImpact = spouseIncome - spousePreRetirementSpending - housingCostAmount - lifestyleAdjustmentAmount;

    const beforeSpendingNeed = userSpendingPreRetirement * (Number((inputs.lifeEvents || []).find(e => e.type === 'retire')?.spendingPercent || 70) / 100);
    const afterSpendingNeed = beforeSpendingNeed + spouseRetSpendingVal;

    // Monthly budget preview calculations
    const userSavingsMonthly = Object.values(inputs.budgetDetails?.savings || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const userFlatSavings = (Number(inputs.simpleIncome) || 50000) * ((Number(inputs.preTaxSavingsRate) || 15) / 100) / 12;
    const userSavings = userSavingsMonthly > 0 ? userSavingsMonthly : Math.round(userFlatSavings);
    const partnerSavingsMonthly = partnerSavings / 12;
    const combinedSavings = userSavings + partnerSavingsMonthly;
    const surplusMonthly = combinedIncome / 12 - combinedSpendingVal / 12;
    const leftoverGap = surplusMonthly - combinedSavings;

    const isStep4Invalid = (combinedSpendingVal <= userSpendingPreRetirement && !isZeroSpendingConfirmed) || (partnerPersonalSpending === 0 && !isPartnerZeroSpendingConfirmed);
    const isStep3Invalid = isStep4Invalid;

    const isPreviewStep = stepId === 4;
    let beforeReadyAge = null;
    let afterReadyAge = null;
    if (isPreviewStep) {
      const beforeInputs = {
        ...inputs,
        lifeEvents: (inputs.lifeEvents || []).filter(e => e.type !== 'marriage')
      };
      const beforeRes = runFireSimulation(beforeInputs);
      beforeReadyAge = beforeRes.retirementReadyAge;

      const afterInputs = {
        ...inputs,
        lifeEvents: [
          ...(inputs.lifeEvents || []).filter(e => e.type !== 'marriage'),
          {
            ...editingEvent,
            enabled: true,
            retirementSpendingNeed: spouseRetSpendingVal,
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount,
            partnerRetiresWithUser: true
          }
        ],
        householdMembers: [
          ...(inputs.householdMembers || []).filter(m => m.id !== 'spouse'),
          {
            id: 'spouse',
            name: 'Spouse',
            activeFromDate: Number(editingEvent.age),
            activeUntilDate: null,
            income: Number(editingEvent.spouseIncome),
            incomeGrowthRate: Number(editingEvent.incomeGrowthRate) / 100,
            assets: {
              cash: Number(editingEvent.cash),
              investments: Number(editingEvent.investments),
              retirement: Number(editingEvent.retirement)
            },
            debts: {
              student: Number(editingEvent.debtStudent),
              credit: Number(editingEvent.debtCredit),
              other: Number(editingEvent.debtOther)
            },
            savingsRate: Number(editingEvent.savingsRate),
            currentAge: editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? Number(editingEvent.spouseCurrentAge) : Number(editingEvent.age),
            lifeExpectancy: editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? Number(editingEvent.spouseLifeExpectancy) : (inputs.lifeExpectancy || 85),
            spouseSocialSecurityAge: editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? Number(editingEvent.spouseSocialSecurityAge) : 67,
            spouseEstimatedSocialSecurityBenefit: editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? Number(editingEvent.spouseEstimatedSocialSecurityBenefit) : 0,
            desiredRetirementAge: null, // Forces spouse to retire at same age as user
            retirementSpendingNeed: spouseRetSpendingVal,
            growthRate: Number(editingEvent.incomeGrowthRate),
            combinedSpendingAfterMarriage: combinedSpendingVal,
            housingCost: housingCostAmount,
            lifestyleAdjustment: lifestyleAdjustmentAmount,
            partnerRetiresWithUser: true
          }
        ]
      };
      const afterRes = runFireSimulation(afterInputs);
      afterReadyAge = afterRes.retirementReadyAge;
    }

    const showImprovementWarning = beforeReadyAge && afterReadyAge && (beforeReadyAge - afterReadyAge > 10);

    return (
      <div className="modal-backdrop" onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💍 Get Married
          </h3>

          {/* Stepper Headers */}
          <div className="wizard-steps-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            {/* Step 1: Congratulations */}
            <div className={`wizard-step-node ${stepId === 1 ? 'active' : ''} ${stepId > 1 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 1 })}>
              <div className="wizard-step-icon">1</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Congratulations</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 2 ? 'active' : ''}`} />

            {/* Step 2: Wedding */}
            <div className={`wizard-step-node ${stepId === 2 ? 'active' : ''} ${stepId > 2 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 2 })}>
              <div className="wizard-step-icon">2</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Wedding</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 3 ? 'active' : ''}`} />

            {/* Step 3: Life Together */}
            <div className={`wizard-step-node ${stepId === 3 ? 'active' : ''} ${stepId > 3 ? 'completed' : ''}`} onClick={() => setEditingEvent({ ...editingEvent, wizardStep: 3 })}>
              <div className="wizard-step-icon">3</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Life Together</span>
            </div>

            <div className={`wizard-step-divider ${stepId >= 4 ? 'active' : ''}`} />

            {/* Step 4: Marriage Impact */}
            <div className={`wizard-step-node ${stepId === 4 ? 'active' : ''}`} onClick={() => {
              setEditingEvent({ ...editingEvent, wizardStep: 4 });
            }}>
              <div className="wizard-step-icon">4</div>
              <span className="wizard-step-label" style={{ fontSize: '0.75rem' }}>Marriage Impact</span>
            </div>
          </div>

          {/* STEP 1: CONGRATULATIONS */}
          {stepId === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                <h4 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)', margin: '0 0 0.5rem 0' }}>Congratulations! 🎉</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  We've assumed your partner's finances are similar to yours and that you'll combine households after marriage.
                </p>
              </div>

              {/* Simple Benefits List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  Key Benefits of Combining Finances:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.04)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>💼 Shared Income</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Pool your monthly earnings to boost purchasing power.</p>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>💰 Shared Savings</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Grow your investments faster with combined capital.</p>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.04)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>🏠 Split Housing Costs</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Share rent/mortgage and utilities to lower monthly expenses.</p>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.04)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>📊 Joint FIRE Planning</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>Coordinate retirement targets and withdrawal strategies.</p>
                  </div>
                </div>
              </div>

              {/* Edit Partner Profile Toggle Button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                <button
                  key="toggle-partner-profile"
                  type="button"
                  onClick={() => setIsFullPartnerProfileOpen(!isFullPartnerProfileOpen)}
                  className="list-builder-edit-btn"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                >
                  👤 {isFullPartnerProfileOpen ? 'Hide Partner Profile' : 'Edit Partner Profile'}
                </button>
              </div>

              {/* Advanced Partner Profile Controls (Progressive Disclosure) */}
              {isFullPartnerProfileOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Advanced Partner Profile</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-wrapper">
                      <span className="input-name">Marriage Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.age}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { age: parseInt(e.target.value) || inputs.currentAge }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Partner Current Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseCurrentAge !== undefined && editingEvent.spouseCurrentAge !== '' ? editingEvent.spouseCurrentAge : editingEvent.age}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseCurrentAge: parseInt(e.target.value) || editingEvent.age }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Spouse Income ($/year)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseIncome}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseIncome: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Savings Rate (%)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.savingsRate}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { savingsRate: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Partner Assets ($)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={Number(editingEvent.cash || 0) + Number(editingEvent.investments || 0) + Number(editingEvent.retirement || 0)}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { investments: parseFloat(e.target.value) || 0, cash: 0, retirement: 0 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Partner Debt ($)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={Number(editingEvent.debtStudent || 0) + Number(editingEvent.debtCredit || 0) + Number(editingEvent.debtOther || 0)}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { debtOther: parseFloat(e.target.value) || 0, debtStudent: 0, debtCredit: 0 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Spouse Retirement Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseDesiredRetirementAge !== undefined && editingEvent.spouseDesiredRetirementAge !== null ? editingEvent.spouseDesiredRetirementAge : ''}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseDesiredRetirementAge: e.target.value !== '' ? parseInt(e.target.value) : null }))}
                        placeholder="e.g. 65 (optional)"
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Spouse Life Expectancy</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseLifeExpectancy !== undefined && editingEvent.spouseLifeExpectancy !== '' ? editingEvent.spouseLifeExpectancy : 85}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseLifeExpectancy: parseInt(e.target.value) || 85 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Spouse Social Security Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseSocialSecurityAge !== undefined && editingEvent.spouseSocialSecurityAge !== '' ? editingEvent.spouseSocialSecurityAge : 67}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseSocialSecurityAge: parseInt(e.target.value) || 67 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Spouse Est. SS Benefit ($/yr)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.spouseEstimatedSocialSecurityBenefit !== undefined && editingEvent.spouseEstimatedSocialSecurityBenefit !== '' ? editingEvent.spouseEstimatedSocialSecurityBenefit : 0}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { spouseEstimatedSocialSecurityBenefit: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: WEDDING */}
          {stepId === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Plan Your Wedding</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Determine your wedding budget, evaluate funding sources, and identify any savings gaps.
                </p>
              </div>

              {/* Savings Details */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Available Savings Summary</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Your Savings</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatCurrency(userAssets)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Partner Savings</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatCurrency(spouseAssets)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Total Savings</div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--accent-emerald)' }}>{formatCurrency(userAssets + spouseAssets)}</strong>
                  </div>
                </div>
              </div>

              {/* Wedding Cost Checkbox & Inputs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="include-wedding-cost"
                  checked={editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : true}
                  onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { includeWeddingCost: e.target.checked }))}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="include-wedding-cost" className="input-name" style={{ margin: 0, cursor: 'pointer' }}>
                  Plan to have a wedding ceremony / celebration
                </label>
              </div>

              {(editingEvent.includeWeddingCost !== undefined ? !!editingEvent.includeWeddingCost : true) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  
                  {/* Presets */}
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Cost Presets</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {[
                        { label: 'Court $500', value: 500 },
                        { label: 'Simple $5k', value: 5000 },
                        { label: 'Traditional $20k', value: 20000 },
                        { label: 'Dream $50k', value: 50000 }
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className="list-builder-edit-btn"
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.3rem 0.6rem',
                            border: (editingEvent.weddingCost === preset.value) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            background: (editingEvent.weddingCost === preset.value) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            color: (editingEvent.weddingCost === preset.value) ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer'
                          }}
                          onClick={() => setEditingEvent(Object.assign({}, editingEvent, { weddingCost: preset.value }))}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="list-builder-edit-btn"
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.3rem 0.6rem',
                          border: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          color: ![500, 5000, 20000, 50000].includes(editingEvent.weddingCost) ? 'var(--primary)' : 'var(--text-primary)'
                        }}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  {/* Manual cost and age input */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-wrapper">
                      <span className="input-name">Wedding Cost ($)</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ 
                          width: '100%',
                          color: (editingEvent.weddingCost || 0) > 0 ? '#f43f5e' : 'inherit',
                          fontWeight: (editingEvent.weddingCost || 0) > 0 ? 'bold' : 'normal'
                        }}
                        value={editingEvent.weddingCost !== undefined ? editingEvent.weddingCost : 20000}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingCost: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="input-wrapper">
                      <span className="input-name">Wedding Age</span>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%' }}
                        value={editingEvent.weddingAge !== undefined ? editingEvent.weddingAge : editingEvent.age}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingAge: parseInt(e.target.value) || editingEvent.age }))}
                      />
                    </div>
                  </div>

                  {/* Funding Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>How will you fund the wedding?</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {[
                        { label: '🏦 Use Available Savings (Deduct from liquid assets)', value: 'savings' },
                        { label: '📈 Save Until Wedding (Extra savings targeted before wedding)', value: 'save_targeted' },
                        { label: '💳 Finance Difference (Create credit card or other debt)', value: 'debt' }
                      ].map((opt) => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="weddingFundingMethod"
                            value={opt.value}
                            checked={(editingEvent.weddingFundingMethod || 'savings') === opt.value}
                            onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { weddingFundingMethod: e.target.value }))}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Funding Gap Calculation Display */}
                  {Number(editingEvent.weddingCost || 0) > (userAssets + spouseAssets) && (
                    <div style={{ border: '1px solid var(--accent-orange)', backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                      <strong style={{ color: 'var(--accent-orange)' }}>⚠️ Funding Gap Identified</strong>
                      <span>
                        Wedding cost exceeds combined available savings by <strong>{formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))}</strong>.
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {(editingEvent.weddingFundingMethod || 'savings') === 'savings' && 'Note: This gap will result in negative liquid assets at the wedding age.'}
                        {(editingEvent.weddingFundingMethod || 'savings') === 'save_targeted' && 'Note: You will need to save this difference before the wedding.'}
                        {(editingEvent.weddingFundingMethod || 'savings') === 'debt' && `Note: This will add ${formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))} of debt.`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: LIFE TOGETHER */}
          {stepId === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Life Together</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Review automatic savings estimated from sharing housing, utilities, and services.
                </p>
              </div>

              {/* Shared Household Benefits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  🏠 Shared Household Benefits
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Housing Shared</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                      Estimated Savings: +50% of current housing cost
                    </div>
                  </div>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Utilities Shared</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                      Estimated Savings: +25% of utilities budget
                    </div>
                  </div>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Internet Shared</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                      Estimated Savings: +50% of internet budget
                    </div>
                  </div>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Streaming Shared</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                      Estimated Savings: +50% of streaming budget
                    </div>
                  </div>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>Household Goods Shared</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                      Estimated Savings: +10% of household goods budget
                    </div>
                  </div>
                </div>
              </div>

              {/* Estimated Monthly Household Savings Breakdown Table */}
              {estimates && estimates.savingsBreakdown && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                    Estimated Monthly Household Savings
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Housing</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(estimates.savingsBreakdown.housing)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Utilities</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(estimates.savingsBreakdown.utilities)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Internet</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(estimates.savingsBreakdown.internet)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Streaming</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(estimates.savingsBreakdown.streaming)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Other Shared</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(estimates.savingsBreakdown.otherShared)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Total Savings</span>
                      <strong style={{ color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                        +{formatCurrency(estimates.savingsBreakdown.total)}/mo
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Large CTA - Update Household Budget */}
              <button
                key="open-budget-wizard"
                type="button"
                onClick={() => {
                  setIsBudgetOpenFromMarriageWizard(true);
                  handleSetBudgetClick('workSave', true);
                }}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                📊 Adjust Budget Details
              </button>
            </div>
          )}

          {/* STEP 4: MARRIAGE IMPACT */}
          {stepId === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Marriage Impact</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Compare your household financials and retirement readiness before and after marriage.
                </p>
              </div>

              {/* Tax Filing Status (if Taxes are included) */}
              {showTaxesStep && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', padding: '0.75rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Tax Filing Status</span>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="filingStatus"
                        value="jointly"
                        checked={editingEvent.filingStatus === 'jointly'}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { filingStatus: e.target.value }))}
                      />
                      Married Filing Jointly
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="filingStatus"
                        value="separately"
                        checked={editingEvent.filingStatus === 'separately'}
                        onChange={(e) => setEditingEvent(Object.assign({}, editingEvent, { filingStatus: e.target.value }))}
                      />
                      Married Filing Separately
                    </label>
                  </div>
                </div>
              )}

              {/* Comparison Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Before Marriage Card */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--bg-tertiary)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                    Before Marriage
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Income:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userIncome / 12)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Savings:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userSavings)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Spending:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userSpendingPreRetirement / 12)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Savings Rate:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{Math.round(userSavingsRate)}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net Worth:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(userAssets - userDebt)}</strong>
                    </div>
                  </div>
                </div>

                {/* After Marriage Card */}
                <div style={{ border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(139, 92, 246, 0.04) 100%)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', display: 'block', borderBottom: '1px solid var(--primary)', paddingBottom: '0.35rem', marginBottom: '0.5rem' }}>
                    After Marriage
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Combined Income:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(combinedIncome / 12)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Combined Savings:</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(combinedSavings)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Combined Spending:</span>
                      <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(combinedSpendingVal / 12)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Savings Rate:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{Math.round(((combinedSavings + Math.max(0, leftoverGap)) / (combinedIncome / 12)) * 100)}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--primary)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net Worth:</span>
                      <strong style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(combinedAssets - combinedDebt)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wedding details summary */}
              {editingEvent.includeWeddingCost && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Wedding Cost:</span>
                    <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(editingEvent.weddingCost || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Funding Method:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {(editingEvent.weddingFundingMethod === 'savings') && 'Available Savings'}
                      {(editingEvent.weddingFundingMethod === 'save_targeted') && 'Save Until Wedding'}
                      {(editingEvent.weddingFundingMethod === 'debt') && 'Finance Difference'}
                    </strong>
                  </div>
                  {editingEvent.weddingFundingMethod === 'debt' && Number(editingEvent.weddingCost || 0) > (userAssets + spouseAssets) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                      <span>Debt Created:</span>
                      <span>+{formatCurrency(Number(editingEvent.weddingCost || 0) - (userAssets + spouseAssets))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Retirement Readiness Impact Card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.2rem' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Before Retirement Age</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {beforeReadyAge ? `Age ${beforeReadyAge}` : 'Never Ready'}
                  </div>
                </div>
                <div style={{
                  border: '1px solid',
                  borderColor: afterReadyAge && beforeReadyAge && afterReadyAge < beforeReadyAge ? 'var(--accent-emerald)' : afterReadyAge && beforeReadyAge && afterReadyAge > beforeReadyAge ? 'var(--accent-rose)' : 'var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>After Retirement Age</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.2rem' }}>
                    {afterReadyAge ? `Age ${afterReadyAge}` : 'Never Ready'}
                  </div>
                  {afterReadyAge && beforeReadyAge && afterReadyAge !== beforeReadyAge && (
                    <div style={{ fontSize: '0.65rem', color: afterReadyAge < beforeReadyAge ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 'bold', marginTop: '0.1rem' }}>
                      {afterReadyAge < beforeReadyAge ? `Ready ${beforeReadyAge - afterReadyAge} years earlier! 🎉` : `Ready ${afterReadyAge - beforeReadyAge} years later`}
                    </div>
                  )}
                </div>
              </div>

              {/* SWR display */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-0.5rem' }}>
                Retirement target calculated at <strong>{inputs.swr || 4.0}% SWR</strong> supporting both spouses.
              </div>

              {/* Warnings & Confirmations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* 1. Low Combined Spending Warning */}
                {combinedSpendingVal <= userSpendingPreRetirement && (
                  <div style={{ border: '1px solid var(--accent-rose)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      id="confirm-zero-spending-preview"
                      checked={isZeroSpendingConfirmed}
                      onChange={(e) => setIsZeroSpendingConfirmed(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                    />
                    <label htmlFor="confirm-zero-spending-preview" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                      <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Low Combined Spending</strong>
                      I confirm that combined household spending after marriage is less than or equal to my single spending (meaning my spouse has no additional spending needs).
                    </label>
                  </div>
                )}

                {/* 2. Zero Partner Personal Spending Warning */}
                {partnerPersonalSpending === 0 && (
                  <div style={{ border: '1px solid var(--accent-rose)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      id="confirm-partner-zero-spending"
                      checked={isPartnerZeroSpendingConfirmed}
                      onChange={(e) => setIsPartnerZeroSpendingConfirmed(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.1rem' }}
                    />
                    <label htmlFor="confirm-partner-zero-spending" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                      <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '0.2rem' }}>⚠️ Warning: Zero Partner Personal Spending</strong>
                      I confirm that partner personal spending is set to $0/month.
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="list-builder-remove-btn"
                onClick={() => { setEditingEvent(null); setIsFullPartnerProfileOpen(false); setIsZeroSpendingConfirmed(false); setIsPartnerZeroSpendingConfirmed(false); }}
                style={{ alignSelf: 'center', margin: 0 }}
              >
                Cancel
              </button>
              {editingEvent.id && (
                <button
                  type="button"
                  className="list-builder-remove-btn"
                  onClick={handleDeleteEvent}
                  style={{ alignSelf: 'center', margin: 0, background: 'var(--accent-rose, #f43f5e)', color: '#fff', borderColor: 'var(--accent-rose, #f43f5e)', cursor: 'pointer' }}
                >
                  Delete Event
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {stepId > 1 && (
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  onClick={handleBack}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1rem', cursor: 'pointer' }}
                >
                  Back
                </button>
              )}
              {stepId < 4 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNext}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveEvent}
                  style={{ alignSelf: 'center', margin: 0, padding: '0.4rem 1.2rem', fontWeight: 'bold', background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                  disabled={isStep4Invalid}
                >
                  Save Marriage Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEventForm = (event) => {
    const type = event.type;
    if (type === 'marriage') {
      return renderMarriageWizard();
    }
    const calculateHouseSummary = () => {
      const p = parseFloat(editingEvent.homePrice) || 0;
      const dp = parseFloat(editingEvent.downPayment) || 0;
      const rate = (parseFloat(editingEvent.mortgageRate) || 6.5) / 100;
      const mortgageTerm = parseInt(editingEvent.loanTerm) || 30;
      
      const loanAmount = Math.max(0, p - dp);
      let monthlyPI = 0;
      if (loanAmount > 0 && mortgageTerm > 0) {
        const r = rate / 12;
        const n = mortgageTerm * 12;
        monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      }
      
      const monthlyPropertyTax = (p * ((parseFloat(editingEvent.propertyTax) || 1.1) / 100)) / 12;
      const monthlyInsurance = (p * ((parseFloat(editingEvent.insurance) || 0.35) / 100)) / 12;
      const monthlyMaintenance = (p * ((parseFloat(editingEvent.maintenance) || 1.0) / 100)) / 12;
      const monthlyHOA = parseFloat(editingEvent.hoa) || 0;
      const monthlyUtilities = parseFloat(editingEvent.utilitiesIncrease) || 0;
      
      const hasPMI = dp < p * 0.2;
      const monthlyPMI = hasPMI ? (loanAmount * ((parseFloat(editingEvent.pmi) || 0.5) / 100)) / 12 : 0;
      
      const monthlyOwnershipCost = monthlyPI + monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyHOA + monthlyUtilities + monthlyPMI;
      
      const closingCostRate = parseFloat(editingEvent.closingCosts) || 3;
      const closingCosts = p * (closingCostRate / 100);
      const points = parseFloat(editingEvent.points) || 0;
      const renovation = parseFloat(editingEvent.renovationCost) || 0;
      
      const cashNeeded = dp + closingCosts + points + renovation;
      
      const currentRent = parseFloat(editingEvent.currentRent) || 0;
      const renterInsurance = parseFloat(editingEvent.renterInsurance) || 0;
      const totalCurrentRentCost = currentRent + renterInsurance;
      const rentDifference = monthlyOwnershipCost - totalCurrentRentCost;
      
      return {
        monthlyPI,
        monthlyOwnershipCost,
        cashNeeded,
        rentDifference,
        currentRentConfigured: currentRent > 0
      };
    };

    return (
      <div className="modal-backdrop" onClick={() => setEditingEvent(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={type === 'buyHouse' || type === 'sellHouse' ? { maxWidth: '650px', width: '90%' } : {}}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
          {type === 'buyHouse' && '🏠 Buy a House'}
          {type === 'sellHouse' && '🏠 Sell a House'}
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
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Down Payment ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.downPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, downPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* COLLAPSIBLE ADVANCED SETTINGS TRIGGER */}
              <div style={{ gridColumn: 'span 2', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowHouseAdvanced(!showHouseAdvanced)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: 0,
                    fontSize: '0.85rem'
                  }}
                >
                  {showHouseAdvanced ? '▼ Hide Advanced Settings' : '▶ Advanced Settings'}
                </button>
              </div>

              {showHouseAdvanced && (
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  {/* GROUP 1: Mortgage */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>💳</span> Mortgage Settings
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Mortgage Rate (%)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.mortgageRate}
                          onChange={(e) => setEditingEvent({ ...editingEvent, mortgageRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Loan Term (years)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.loanTerm}
                          onChange={(e) => setEditingEvent({ ...editingEvent, loanTerm: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Points / Fees ($)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.points}
                          onChange={(e) => setEditingEvent({ ...editingEvent, points: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Closing Costs (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.closingCosts}
                          onChange={(e) => setEditingEvent({ ...editingEvent, closingCosts: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      {editingEvent.downPayment < editingEvent.homePrice * 0.2 && (
                        <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                          <span className="input-name">PMI Rate (% / year)</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-number-box"
                            style={{ width: '100%' }}
                            value={editingEvent.pmi}
                            onChange={(e) => setEditingEvent({ ...editingEvent, pmi: parseFloat(e.target.value) || 0 })}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                            Required because down payment is less than 20%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GROUP 2: Ownership Costs */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>🏡</span> Ownership Costs
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Property Tax (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.propertyTax}
                          onChange={(e) => setEditingEvent({ ...editingEvent, propertyTax: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Homeowners Insurance (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.insurance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, insurance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">HOA Dues ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.hoa}
                          onChange={(e) => setEditingEvent({ ...editingEvent, hoa: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Maintenance (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.maintenance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, maintenance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Renovation / Furnishing ($)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.renovationCost}
                          onChange={(e) => setEditingEvent({ ...editingEvent, renovationCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Utilities Increase ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.utilitiesIncrease}
                          onChange={(e) => setEditingEvent({ ...editingEvent, utilitiesIncrease: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GROUP 3: Home Value Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📈</span> Home Value Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Home Appreciation (% / year)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.appreciationRate}
                          onChange={(e) => setEditingEvent({ ...editingEvent, appreciationRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Selling Cost (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.sellingCost}
                          onChange={(e) => setEditingEvent({ ...editingEvent, sellingCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GROUP 4: Rent Comparison Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📊</span> Rent Comparison Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Current Rent ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.currentRent}
                          onChange={(e) => setEditingEvent({ ...editingEvent, currentRent: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Rent Growth (% / year)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.rentGrowth}
                          onChange={(e) => setEditingEvent({ ...editingEvent, rentGrowth: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                        <span className="input-name">Renter's Insurance ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.renterInsurance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, renterInsurance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GROUP 5: Investment Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📈</span> Investment Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Investment Return (%)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.investmentReturn}
                          onChange={(e) => setEditingEvent({ ...editingEvent, investmentReturn: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Inflation Rate (%)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.inflation}
                          onChange={(e) => setEditingEvent({ ...editingEvent, inflation: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Box */}
              {(() => {
                const summary = calculateHouseSummary();
                return (
                  <div style={{
                    gridColumn: 'span 2',
                    background: 'rgba(99, 102, 241, 0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>
                      🏠 Purchase & Cost Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment (P&I):</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(summary.monthlyPI)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Cash Needed:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(summary.cashNeeded)}</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Monthly Ownership Cost:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(summary.monthlyOwnershipCost)}/mo</strong>
                        </div>
                        {summary.currentRentConfigured && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Difference vs Current Rent:</span>
                            <strong style={{ color: summary.rentDifference > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                              {summary.rentDifference > 0 ? '+' : ''}{formatCurrency(summary.rentDifference)}/mo
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {type === 'sellHouse' && (() => {
            const asset = inputs.houseAssets?.find(h => h.id === editingEvent.houseId);
            const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === editingEvent.houseId);
            const purchaseAge = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) : 30;
            const saleAge = Number(editingEvent.age) || 50;
            const yearsOwned = Math.max(0, saleAge - purchaseAge);

            const purchasePrice = Number(asset?.purchasePrice) || 0;
            const downPayment = Number(asset?.downPayment) || 0;
            const appreciationRate = (Number(asset?.appreciationRate) || 3.0) / 100;
            const sellingCostRate = Number(editingEvent.sellingCost !== undefined ? editingEvent.sellingCost : 6.0);
            const mortgageRate = (Number(asset?.mortgageRate) || 6.5) / 100;
            const loanTermYears = Number(asset?.loanTermYears) || 30;
            const isCash = asset?.purchaseType === 'cash' || downPayment >= purchasePrice;

            const currentValue = purchasePrice * Math.pow(1 + appreciationRate, yearsOwned);

            let remainingMortgageBalance = 0;
            if (!isCash) {
              const loanAmount = Math.max(0, purchasePrice - downPayment);
              const elapsedYears = Math.max(0, yearsOwned - 1);
              if (elapsedYears >= loanTermYears) {
                remainingMortgageBalance = 0;
              } else if (loanAmount > 0 && loanTermYears > 0) {
                const r = mortgageRate / 12;
                const n = loanTermYears * 12;
                const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                const elapsedMonths = elapsedYears * 12;
                const remainingMonths = n - elapsedMonths;
                remainingMortgageBalance = r === 0 ? monthlyPayment * remainingMonths : monthlyPayment * (1 - Math.pow(1 + r, -remainingMonths)) / r;
              }
            }

            const sellingCosts = currentValue * (sellingCostRate / 100);
            const equity = currentValue - remainingMortgageBalance - sellingCosts;

            return (
              <>
                <div className="input-wrapper">
                  <span className="input-name">Sale Age</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.age}
                    onChange={(e) => {
                      const newAge = parseInt(e.target.value) || 50;
                      setEditingEvent({ ...editingEvent, age: Math.max(purchaseAge, newAge) });
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                    Must be at or after purchase age ({purchaseAge})
                  </span>
                </div>
                <div className="input-wrapper">
                  <span className="input-name">Selling Cost Rate (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.sellingCost}
                    onChange={(e) => setEditingEvent({ ...editingEvent, sellingCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Proceeds Destination</span>
                  <select
                    className="input-number-box"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={editingEvent.proceedsDestination || 'investments'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, proceedsDestination: e.target.value })}
                  >
                    <option value="investments">📈 Liquid Investments (Brokerage)</option>
                    <option value="cash">💰 Cash Reserves</option>
                  </select>
                </div>

                <div style={{
                  gridColumn: 'span 2',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginTop: '0.5rem'
                }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>💰</span> Sale Proceeds Preview (Age {saleAge})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Appreciated Home Value ({yearsOwned} yrs owned):</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(currentValue)}</span>
                    </div>
                    {!isCash && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Remaining Mortgage Balance:</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-rose, #f43f5e)' }}>-{formatCurrency(remainingMortgageBalance)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Selling Costs ({sellingCostRate}%):</span>
                      <span style={{ fontWeight: '600', color: 'var(--accent-rose, #f43f5e)' }}>-{formatCurrency(sellingCosts)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Estimated Net Proceeds:</span>
                      <span style={{ color: 'var(--accent-emerald, #10b981)' }}>{formatCurrency(equity)}</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {type === 'haveChild' && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Child's Name (Optional)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.childName || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, childName: e.target.value })}
                  placeholder="e.g. Liam"
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Child's Current Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0}
                  onChange={(e) => {
                    const startAge = Math.max(0, Math.min(22, parseInt(e.target.value) || 0));
                    const birthAge = Math.max(0, (inputs.currentAge || 35) - startAge);
                    setEditingEvent({
                      ...editingEvent,
                      childStartAge: startAge,
                      birthAge: birthAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Parent's Age when Born</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.birthAge !== undefined ? editingEvent.birthAge : inputs.currentAge}
                  onChange={(e) => {
                    const birthAge = Math.max(0, parseInt(e.target.value) || 0);
                    const startAge = Math.max(0, (inputs.currentAge || 35) - birthAge);
                    setEditingEvent({
                      ...editingEvent,
                      birthAge: birthAge,
                      childStartAge: startAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Cost Estimate Method</span>
                <select
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
                  value={editingEvent.costMethod || 'default'}
                  onChange={(e) => setEditingEvent({ ...editingEvent, costMethod: e.target.value })}
                >
                  <option value="default">Use default estimate</option>
                  <option value="custom">Enter my own estimate</option>
                  <option value="budget">Refine in Budget Builder</option>
                </select>
              </div>

              {(editingEvent.costMethod === 'default' || !editingEvent.costMethod) && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Default Estimate:</div>
                  <ul style={{ paddingLeft: '1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Child-Rearing Years (Ages 0–18): {formatCurrency(15000)}/yr</li>
                    {editingEvent.includeCollege && (
                      <li>College / Young Adult Support (Ages 19–22): {formatCurrency(15000)}/yr</li>
                    )}
                  </ul>
                </div>
              )}

              {editingEvent.costMethod === 'custom' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Custom Annual Child Cost ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingEvent({
                        ...editingEvent,
                        customAges0to4: val,
                        customAges5to12: val,
                        customAges13to18: val,
                        customAges19to22: val
                      });
                    }}
                  />
                </div>
              )}

              {editingEvent.costMethod === 'budget' && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(124, 58, 237, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124, 58, 237, 0.15)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  ℹ️ This will save the child event with default estimates. You can then click <strong>Refine Child Costs</strong> or use the <strong>Set Budget</strong> button on your Life Plan dashboard to distribute child costs across specific categories (housing, food, childcare, etc.).
                </div>
              )}

              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="include-college"
                    checked={!!editingEvent.includeCollege}
                    onChange={(e) => setEditingEvent({ ...editingEvent, includeCollege: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="include-college" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Include College / Young Adult Support (Ages 19–22)
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
                  Adds an additional <strong>{formatCurrency(editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : 15000)}/yr</strong> per child from age 19 to 22.
                </span>
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
              {type === 'socialSecurity' && editingEvent.useEarnings === true && (
                <div className="input-wrapper">
                  <span className="input-name">Age Started Working</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.ageStartedWorking !== undefined ? editingEvent.ageStartedWorking : 22}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ageStartedWorking: parseInt(e.target.value) || 22 })}
                  />
                </div>
              )}
              {(!editingEvent.useEarnings || type !== 'socialSecurity') ? (
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
              ) : (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Estimated Monthly Amount ($)</span>
                  <div style={{ 
                    height: '2.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0 0.75rem', 
                    background: 'var(--bg-primary, #111827)', 
                    borderRadius: 'var(--radius-sm, 6px)', 
                    border: '1px solid var(--border-color, #374151)', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold', 
                    color: tempSocialSecurityDetails?.isEligible ? 'var(--text-primary)' : 'var(--accent-rose, #f43f5e)'
                  }}>
                    <span>
                      {tempSocialSecurityDetails?.isEligible 
                        ? formatCurrency(tempSocialSecurityDetails.annualBenefit / 12) 
                        : '$0 (Not Eligible)'}
                    </span>
                    {tempSocialSecurityDetails?.isEligible && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                        ({formatCurrency((tempSocialSecurityDetails.annualBenefit / 12) * Math.pow(1 + (Number(inputs.inflationRate || 3) / 100), tempSocialSecurityDetails.claimAge - (Number(inputs.currentAge) || 35)))}/mo in future nominal dollars at age {tempSocialSecurityDetails.claimAge})
                      </span>
                    )}
                  </div>
                </div>
              )}
              {type === 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-use-earnings" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Calculate from earning years
                  </label>
                  <input
                    type="checkbox"
                    id="ret-use-earnings"
                    checked={editingEvent.useEarnings === true}
                    onChange={(e) => setEditingEvent({ ...editingEvent, useEarnings: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type !== 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-inflation-adj" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Inflation Adjusted (increases with cost of living)
                  </label>
                  <input
                    type="checkbox"
                    id="ret-inflation-adj"
                    checked={editingEvent.inflationAdjusted !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, inflationAdjusted: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type === 'socialSecurity' && (
                <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  💡 Calculated in Today's Dollars (purchasing power). In future dollars (nominal mode), the benefit is adjusted for inflation (currently {Number(inputs.inflationRate || 3)}% yearly) starting from your current age.
                </div>
              )}
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
  
  const renderCurrentConditionsList = () => {
    const list = inputs.currentConditions || [];
    if (list.length === 0) {
      return (
        <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          No current conditions added yet. Start by adding items that are already true today.
        </div>
      );
    }

    const getTypeIcon = (c) => {
      if (c.type === 'debt') {
        if (c.subtype === 'studentLoan') return '🎓';
        if (c.subtype === 'creditCard') return '💳';
        if (c.subtype === 'carLoan') return '🚗';
        return '💳';
      }
      switch (c.type) {
        case 'checkingSavings': return '💰';
        case 'brokerage': return '📈';
        case 'retirement': return '🛡️';
        case 'asset': return '💎';
        case 'house': return '🏠';
        case 'child': return '👶';
        case 'obligation': return '📄';
        default: return '❓';
      }
    };

    const getTypeLabel = (c) => {
      if (c.type === 'debt') {
        if (c.subtype === 'studentLoan') return 'Student Loan';
        if (c.subtype === 'creditCard') return 'Credit Card';
        if (c.subtype === 'carLoan') return 'Car Loan';
        return 'Debt';
      }
      if (c.type === 'checkingSavings') return 'Cash';
      if (c.type === 'brokerage') return 'Investment Account';
      const labels = {
        house: 'House',
        child: 'Child',
        obligation: 'Obligation',
        retirement: 'Retirement Account',
        asset: 'Asset'
      };
      return labels[c.type] || c.type;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {list.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{getTypeIcon(c)}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.name || getTypeLabel(c)}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{getTypeLabel(c)}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
                {c.type !== 'child' && c.type !== 'obligation' && (
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(c.value)}
                  </strong>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {c.monthlyAmount > 0 ? (
                    ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type) ? (
                      <span style={{ color: 'var(--primary-light)' }}>+{formatCurrency(c.monthlyAmount)}/mo</span>
                    ) : (
                      <span style={{ color: 'var(--accent-rose)' }}>-{formatCurrency(c.monthlyAmount)}/mo</span>
                    )
                  ) : null}
                  {c.rate > 0 && ` (${c.rate}% ${c.type === 'debt' ? 'interest' : c.type === 'house' ? 'appr.' : 'growth'})`}
                </span>
                {c.endAge && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                    Ends at age {c.endAge}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={() => setEditingCondition(c)}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--accent-rose)' }}
                  onClick={() => handleRemoveCurrentCondition(c.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCurrentConditionModal = () => {
    if (!editingCondition) return null;
    const type = editingCondition.type;
    const isAssetType = ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(type);
    
    // Choose labels and descriptions based on type
    let valueLabel = "Current Balance / Value ($)";
    let amountLabel = "Monthly Contribution ($/mo)";
    let amountDesc = "How much you save/invest into this account each month.";
    let rateLabel = "Annual Growth Rate (%)";
    let rateDesc = "Expected annual growth rate (before inflation).";

    if (type === 'checkingSavings') {
      amountLabel = "Monthly Savings ($/mo)";
      amountDesc = "Additional monthly savings added to this account.";
      rateLabel = "Interest Rate (%)";
      rateDesc = "Annual interest rate earned.";
    } else if (type === 'retirement') {
      amountLabel = "Monthly Contribution ($/mo)";
      amountDesc = "Pre-tax or post-tax contribution to this account.";
    } else if (type === 'debt') {
      valueLabel = "Current Outstanding Balance ($)";
      amountLabel = "Monthly Payment ($/mo)";
      amountDesc = "Minimum or standard monthly payment.";
      rateLabel = "Interest Rate (%)";
      rateDesc = "Annual interest rate on the debt.";
    } else if (type === 'house') {
      valueLabel = "Current Home Value ($)";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Mortgage, taxes, maintenance, and insurance monthly total.";
      rateLabel = "Annual Appreciation Rate (%)";
      rateDesc = "Expected annual appreciation rate.";
    } else if (type === 'child') {
      valueLabel = "Not Applicable";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Childcare, schooling, and general monthly expenses.";
      rateLabel = "Annual Cost Inflation (%)";
      rateDesc = "Optional: custom inflation rate for child costs.";
    } else if (type === 'obligation') {
      valueLabel = "Not Applicable";
      amountLabel = "Monthly Cost ($/mo)";
      amountDesc = "Monthly cost for this obligation.";
      rateLabel = "Annual Cost Inflation (%)";
      rateDesc = "Optional: custom inflation rate for this obligation.";
    }

    return (
      <div className="modal-backdrop" onClick={() => setEditingCondition(null)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              {editingCondition.id ? '✏️ Edit Current Condition' : '📋 Add Current Condition'}
            </h3>
            <button 
              type="button" 
              onClick={() => setEditingCondition(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
            >
              ✖
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Type Selector */}
            <div className="input-wrapper">
              <span className="input-name">Category Type</span>
              <select
                className="input-number-box"
                style={{ width: '100%', padding: '0.35rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                value={(() => {
                  if (editingCondition.type === 'debt') {
                    if (editingCondition.subtype) return editingCondition.subtype;
                    const nameLower = (editingCondition.name || '').toLowerCase();
                    if (nameLower.includes('student')) return 'studentLoan';
                    if (nameLower.includes('credit')) return 'creditCard';
                    if (nameLower.includes('car')) return 'carLoan';
                    return 'studentLoan';
                  }
                  return editingCondition.type;
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  let type = val;
                  let subtype = '';
                  if (['studentLoan', 'creditCard', 'carLoan'].includes(val)) {
                    type = 'debt';
                    subtype = val;
                  }
                  const currentAge = inputs.currentAge || 35;
                  const defaults = getDefaultValuesForType(val, currentAge);
                  setEditingCondition({
                    ...editingCondition,
                    type,
                    subtype,
                    name: defaults.name,
                    value: defaults.value,
                    monthlyAmount: defaults.monthlyAmount,
                    rate: defaults.rate,
                    notes: defaults.notes,
                    startAge: defaults.startAge,
                    endAge: defaults.endAge
                  });
                }}
              >
                <option value="house">🏠 House</option>
                <option value="child">👶 Child</option>
                <option value="studentLoan">🎓 Student Loan</option>
                <option value="creditCard">💳 Credit Card</option>
                <option value="carLoan">🚗 Car Loan</option>
              </select>
            </div>

            {/* Name */}
            <div className="input-wrapper">
              <span className="input-name">Name</span>
              <input
                type="text"
                className="input-number-box"
                style={{ width: '100%', textAlign: 'left' }}
                placeholder="e.g. Chase HYSA, Car Payment, Leo, etc."
                value={editingCondition.name}
                onChange={(e) => setEditingCondition({ ...editingCondition, name: e.target.value })}
              />
            </div>

            {/* Value/Balance (if applicable) */}
            {type !== 'child' && type !== 'obligation' && (
              <div className="input-wrapper">
                <span className="input-name">{valueLabel}</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingCondition.value || 0}
                  onChange={(e) => setEditingCondition({ ...editingCondition, value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* Monthly Cost/Contribution */}
            <div className="input-wrapper">
              <span className="input-name">{amountLabel}</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingCondition.monthlyAmount || 0}
                onChange={(e) => setEditingCondition({ ...editingCondition, monthlyAmount: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{amountDesc}</span>
            </div>

            {/* Growth Rate / Interest Rate */}
            <div className="input-wrapper">
              <span className="input-name">{rateLabel}</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingCondition.rate || 0}
                onChange={(e) => setEditingCondition({ ...editingCondition, rate: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{rateDesc}</span>
            </div>

            {/* Start Age (Readonly) */}
            <div className="input-wrapper">
              <span className="input-name">Starts at Age (Current Age)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-tertiary)' }}
                value={inputs.currentAge || 35}
                disabled
              />
            </div>

            {/* End Age (Optional) */}
            <div className="input-wrapper">
              <span className="input-name">End Age (Optional)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                placeholder="e.g. 50 (lasts until age 50, empty if lifetime)"
                value={editingCondition.endAge || ''}
                onChange={(e) => setEditingCondition({ ...editingCondition, endAge: e.target.value ? parseInt(e.target.value) || null : '' })}
              />
            </div>

            {/* Notes/Assumptions */}
            <div className="input-wrapper">
              <span className="input-name">Notes / Assumptions</span>
              <textarea
                className="input-number-box"
                style={{ width: '100%', minHeight: '60px', textAlign: 'left', padding: '0.45rem' }}
                placeholder="Any special notes or assumptions for this condition."
                value={editingCondition.notes || ''}
                onChange={(e) => setEditingCondition({ ...editingCondition, notes: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="list-builder-edit-btn"
              style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              onClick={() => setEditingCondition(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveCurrentCondition}
            >
              Save Condition
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSavingsDetailsModal = () => {
    const totalDetails = Object.values(savingsDetails).reduce((sum, val) => sum + val, 0);

    return (
      <div className="modal-backdrop" onClick={() => setIsSavingsDetailsOpen(false)}>
        <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              🎯 Current Savings Breakdown
            </h3>
            <button 
              type="button" 
              onClick={() => setIsSavingsDetailsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
            >
              ✖
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.45', textAlign: 'left' }}>
            Specify the starting balances for each of your savings and investment accounts below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { key: 'cash', label: 'Cash / Checking Balance' },
              { key: 'emergencyFund', label: 'HYSA / Emergency Fund' },
              { key: 'brokerage', label: 'Taxable Brokerage' },
              { key: 'trad401k', label: 'Pre-Tax 401(k) / 403(b)' },
              { key: 'tradIra', label: 'Traditional IRA' },
              { key: 'rothIra', label: 'Roth IRA / Roth 401(k)' },
              { key: 'hsa', label: 'Health Savings Account (HSA)' },
              { key: 'other', label: 'Other Assets / Accounts' }
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span className="input-name" style={{ fontSize: '0.85rem' }}>{item.label}</span>
                <div className="input-prefix-wrapper" style={{ width: '130px' }}>
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%', textAlign: 'right', padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                    value={savingsDetails[item.key] || 0}
                    onChange={(e) => setSavingsDetails({
                      ...savingsDetails,
                      [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                    })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Savings:</span>
              <strong style={{ fontSize: '1rem', color: 'var(--primary)', marginLeft: '0.35rem' }}>
                {formatCurrency(totalDetails)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                onClick={() => setIsSavingsDetailsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                onClick={handleSaveSavingsDetails}
              >
                Save Details
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderBudgetModal = () => {
    const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled) || (isBudgetOpenFromMarriageWizard ? editingEvent : null);
    const isMarriedMode = !!marriageEvent;
    const partnerMonthlyIncome = isMarriedMode ? Math.round(Number(marriageEvent.spouseIncome || 0) / 12) : 0;
    const combinedIncome = isMarriedMode ? (budgetMonthlyIncome + partnerMonthlyIncome) : budgetMonthlyIncome;

    const totalExpensesMonthly = Object.values(budgetExpenses).reduce((sum, val) => sum + val, 0);
    const needsTotal = (Number(budgetExpenses.housing) || 0) +
                       (Number(budgetExpenses.utilities) || 0) +
                       (Number(budgetExpenses.food) || 0) +
                       (Number(budgetExpenses.transportation) || 0) +
                       (Number(budgetExpenses.healthcare) || 0) +
                       (isMarriedMode ? (Number(budgetExpenses.debt) || 0) : 0);
    const wantsTotal = (Number(budgetExpenses.leisure) || 0) +
                       (Number(budgetExpenses.diningOut) || 0) +
                       (Number(budgetExpenses.misc) || 0);
    const surplusMonthly = Math.max(0, combinedIncome - totalExpensesMonthly);

    const totalUserAllocationPct = Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);
    const totalPartnerAllocationPct = isMarriedMode ? Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0) : 0;
    const totalAllocationPct = totalUserAllocationPct + totalPartnerAllocationPct;

    const currentAgeVal = Number(inputs.currentAge) || 30;
    const targetRetAgeVal = Number(inputs.targetRetirementAge) || 65;

    // Get normalized phases
    const normalizedPhases = getNormalizedPhases(inputs);
    const activePhaseObj = normalizedPhases.find(p => p.id === activeBudgetPhase) || normalizedPhases[0];
    const isRetirementPhase = activePhaseObj?.type === 'retire';

    let activeC = activePhaseObj?.childCount || 0;
    let activeChildBoost = 0;
    if (activeC > 0 && activePhaseObj) {
      const rawIncomeItem = (inputs.incomeList || []).find(inc => 
        activePhaseObj.startAge >= inc.startAge && 
        activePhaseObj.startAge < inc.endAge && 
        !inc.id.startsWith('simple-inc-childcare') && 
        !inc.id.startsWith('simple-inc-worksave') && 
        !inc.id.startsWith('simple-inc-prechild') && 
        !inc.id.startsWith('child-income-boost')
      );
      let baseSalaryMonthly = 0;
      if (isRetirementPhase) {
        baseSalaryMonthly = activePhaseObj.ssMonthlyIncome || 0;
      } else if (rawIncomeItem) {
        baseSalaryMonthly = Math.round(rawIncomeItem.frequency === 'monthly' ? Number(rawIncomeItem.amount) : Number(rawIncomeItem.amount) / 12);
      } else {
        baseSalaryMonthly = Math.round((Number(inputs.simpleIncome) || 50000) / 12);
      }
      activeChildBoost = Math.max(0, budgetMonthlyIncome - baseSalaryMonthly);
    }

    let currentChildCostsMonthly = 0;
    if (activeC > 0 && activePhaseObj) {
      currentChildCostsMonthly = activeC * 1250;
    }
    const surplusWithChild = Math.max(0, combinedIncome - totalExpensesMonthly - currentChildCostsMonthly);

    const est401kMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) 
      : (budgetSavings.trad401k || 0);
    const estTradIraMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) 
      : (budgetSavings.tradIra || 0);
    const estRothIraMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.rothIra || 0) / 100)) 
      : (budgetSavings.rothIra || 0);
    const estHsaMonthly = savingsAllocMode === 'percentSurplus' 
      ? Math.round(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) 
      : (budgetSavings.hsa || 0);

    const capped401k = Math.min(23500, est401kMonthly * 12);
    const cappedTradIra = Math.min(7000, estTradIraMonthly * 12);
    const cappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estHsaMonthly * 12);
    let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

    let partnerCapped401k = 0;
    let partnerCappedTradIra = 0;
    let partnerCappedHsa = 0;
    if (isMarriedMode) {
      const estPartner401k = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
      const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
      const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

      partnerCapped401k = Math.min(23500, estPartner401k * 12);
      partnerCappedTradIra = Math.min(7000, estPartnerTradIra * 12);
      partnerCappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estPartnerHsa * 12);
      preTaxDeductionsAnnual += partnerCapped401k + partnerCappedTradIra + partnerCappedHsa;
    }

    const filingStatusForModal = isMarriedMode ? (marriageEvent.filingStatus || 'jointly') : budgetFilingStatus;
    const annualTax = inputs.includeTaxes
      ? calculateUSTaxForModal(combinedIncome * 12, preTaxDeductionsAnnual, filingStatusForModal)
      : 0;
    const monthlyTax = Math.round(annualTax / 12);
    
    const userSavingsMonthly = savingsAllocMode === 'percentSurplus'
      ? Math.round(surplusMonthly * (totalUserAllocationPct / 100))
      : Object.values(budgetSavings).reduce((sum, val) => sum + val, 0);

    const partnerSavingsMonthly = isMarriedMode 
      ? (savingsAllocMode === 'percentSurplus'
         ? Math.round(surplusMonthly * (totalPartnerAllocationPct / 100))
         : Object.values(budgetPartnerSavings).reduce((sum, val) => sum + val, 0))
      : 0;

    const combinedSavingsMonthly = userSavingsMonthly + partnerSavingsMonthly;
    const totalSavingsMonthly = combinedSavingsMonthly;
    const activeSavings = combinedSavingsMonthly;
    const activeSpending = totalExpensesMonthly > 0 ? totalExpensesMonthly : budgetMonthlySpending;
    
    const remainingMonthly = savingsAllocMode === 'percentSurplus'
      ? 100 - totalAllocationPct
      : combinedIncome - activeSavings - activeSpending - monthlyTax;
    
    const childAdjustedSavings = combinedSavingsMonthly;
    const netRemaining = combinedIncome - childAdjustedSavings - activeSpending - currentChildCostsMonthly - monthlyTax;
    
    const handleAllocateRemaining = (categoryKey) => {
      setBudgetSavings(prev => ({
        ...prev,
        [categoryKey]: Math.max(0, (prev[categoryKey] || 0) + remainingMonthly)
      }));
    };
    
    const handleAdjustGrossIncome = () => {
      setBudgetMonthlyIncome(Math.max(0, activeSavings + activeSpending + currentChildCostsMonthly + monthlyTax - partnerMonthlyIncome));
    };

    const handleAutoReduceSavingsToBalance = () => {
      const priority = ['brokerage', 'other', 'checking', 'hysa', 'emergency', 'rothIra', 'tradIra', 'hsa', 'trad401k', 'debt', 'cash'];
      const newSavings = { ...budgetSavings };
      const newPartnerSavings = { ...budgetPartnerSavings };

      if (savingsAllocMode === 'percentSurplus') {
        let pctDeficit = totalAllocationPct - 100;
        if (pctDeficit <= 0) return;
        
        if (isMarriedMode) {
          for (const key of priority) {
            const val = newPartnerSavings[key] || 0;
            if (val > 0) {
              const reduceAmount = Math.min(val, pctDeficit);
              newPartnerSavings[key] = Math.max(0, parseFloat((val - reduceAmount).toFixed(4)));
              pctDeficit -= reduceAmount;
              if (pctDeficit <= 0) break;
            }
          }
        }
        if (pctDeficit > 0) {
          for (const key of priority) {
            const currentVal = newSavings[key] || 0;
            if (currentVal > 0) {
              const reduceAmount = Math.min(currentVal, pctDeficit);
              newSavings[key] = Math.max(0, parseFloat((currentVal - reduceAmount).toFixed(4)));
              pctDeficit -= reduceAmount;
              if (pctDeficit <= 0) break;
            }
          }
        }
        setBudgetSavings(newSavings);
        if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
      } else {
        let deficitAmount = Math.abs(netRemaining);
        if (deficitAmount <= 0) return;

        if (isMarriedMode) {
          for (const key of priority) {
            const val = newPartnerSavings[key] || 0;
            if (val > 0) {
              const reduceAmount = Math.min(val, deficitAmount);
              newPartnerSavings[key] = Math.max(0, Math.round(val - reduceAmount));
              deficitAmount -= reduceAmount;
              if (deficitAmount <= 0) break;
            }
          }
        }
        if (deficitAmount > 0) {
          for (const key of priority) {
            const currentVal = newSavings[key] || 0;
            if (currentVal > 0) {
              const reduceAmount = Math.min(currentVal, deficitAmount);
              newSavings[key] = Math.max(0, Math.round(currentVal - reduceAmount));
              deficitAmount -= reduceAmount;
              if (deficitAmount <= 0) break;
            }
          }
        }
        setBudgetSavings(newSavings);
        if (isMarriedMode) setBudgetPartnerSavings(newPartnerSavings);
      }
    };

    const handleClearDetailedSavings = () => {
      setBudgetSavings({
        trad401k: 0, rothIra: 0, tradIra: 0, hsa: 0, brokerage: 0,
        checking: 0, hysa: 0, emergency: 0, debt: 0, other: 0
      });
      setBudgetMonthlySavings(0);
    };

    const handleClearDetailedExpenses = () => {
      setBudgetExpenses({
        housing: 0, utilities: 0, food: 0, diningOut: 0, transportation: 0, healthcare: 0, leisure: 0, misc: 0
      });
    };

    const handleMonthlyIncomeChange = (val) => {
      const newIncome = Math.max(0, val);
      setBudgetMonthlyIncome(newIncome);

      if (totalSavingsMonthly === 0) {
        setBudgetMonthlySavings(Math.max(0, newIncome - activeSpending));
      } else if (totalExpensesMonthly === 0) {
        setBudgetMonthlySpending(Math.max(0, newIncome - totalSavingsMonthly));
      }
    };

    const handleMonthlySpendingChange = (val) => {
      const newSpending = Math.max(0, val);
      setBudgetMonthlySpending(newSpending);
      if (totalSavingsMonthly === 0) {
        setBudgetMonthlySavings(Math.max(0, budgetMonthlyIncome - newSpending));
      }
    };

    const handleMonthlySavingsChange = (val) => {
      const newSavings = Math.max(0, val);
      setBudgetMonthlySavings(newSavings);
      if (totalExpensesMonthly === 0) {
        setBudgetMonthlySpending(Math.max(0, budgetMonthlyIncome - newSavings));
      }
    };

    let targetSavingsRate = null;
    if (pendingImprovement) {
      const { scenario, originalInputs } = pendingImprovement;
      const currentIncome = Number(originalInputs.simpleIncome) || 0;
      const currentExpenses = Number(originalInputs.simpleExpenses) || 0;
      const currentSavingsRate = currentIncome > 0 ? Math.round((1 - currentExpenses / currentIncome) * 100) : 0;
      
      if (scenario.type === 'savings' || scenario.type === 'retireRequestedDate' || (scenario.type === 'retire65' && scenario.value > 0)) {
        const savingsPercent = currentIncome > 0 ? (scenario.value / currentIncome) * 100 : 0;
        targetSavingsRate = currentSavingsRate + savingsPercent;
      } else if (scenario.type === 'retireReadyAge' || scenario.type === 'retire65') {
        targetSavingsRate = currentSavingsRate;
      } else if (scenario.type === 'combined') {
        const savingsPercent = scenario.value && typeof scenario.value === 'object' 
          ? (currentIncome > 0 ? (scenario.value.savings / currentIncome) * 100 : 0) 
          : 0;
        targetSavingsRate = currentSavingsRate + savingsPercent;
      } else if (scenario.type === 'income') {
        const grossIncrease = scenario.value;
        const netSavingsIncrease = scenario.netSavingsValue || 0;
        const newIncome = currentIncome + grossIncrease;
        const newSavings = Math.max(0, currentIncome - currentExpenses) + netSavingsIncrease;
        targetSavingsRate = newIncome > 0 ? Math.round((newSavings / newIncome) * 100) : 0;
      }
    }

    const activeSavingsRate = combinedIncome > 0 
      ? Math.round((activeSavings / combinedIncome) * 100) 
      : 0;

    let modalTitle = 'Work Phase Budget';
    if (activePhaseObj) {
      if (activePhaseObj.type === 'careerChange') {
        modalTitle = 'Career Change Budget';
      } else if (activePhaseObj.type === 'marriage') {
        modalTitle = 'Marriage Phase Budget';
      } else if (activePhaseObj.type === 'divorce') {
        modalTitle = 'Divorce Phase Budget';
      } else if (activePhaseObj.type === 'childcare') {
        modalTitle = `Childcare Phase Budget (${activePhaseObj.childCount} Child${activePhaseObj.childCount === 1 ? '' : 'ren'})`;
      } else if (activePhaseObj.type === 'move') {
        modalTitle = `Move Phase Budget (${activePhaseObj.name})`;
      } else if (activePhaseObj.type === 'buyHouse') {
        modalTitle = `Home Purchase Phase Budget (${activePhaseObj.name})`;
      } else if (activePhaseObj.type === 'retire') {
        modalTitle = activePhaseObj.childCount > 0 ? 'Retirement Childcare Phase Budget' : 'Retirement Phase Budget';
      } else {
        modalTitle = 'Work Phase Budget';
      }
    }

    const takeHomeIncome = inputs.includeTaxes ? (combinedIncome - monthlyTax) : combinedIncome;
    const totalAllocated = needsTotal + wantsTotal + activeSavings;
    const remainingBalance = takeHomeIncome - totalAllocated;

    return (
      <div className="modal-backdrop" onClick={handleCloseBudgetModal}>
        <div 
          className={`budget-modal-card redesigned modal-content ${showBreakdown ? 'with-breakdown' : ''}`} 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="budget-modal-layout">
            
            {/* Left/Main Column */}
            <div className="budget-main-col">
              
              {/* Header */}
              <div className="budget-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
                    🎯 {modalTitle} {activePhaseObj && `(Age ${activePhaseObj.startAge}–${activePhaseObj.endAge})`}
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Set your monthly plan for this phase.
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={handleCloseBudgetModal}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem' }}
                >
                  ✖
                </button>
              </div>

              <div className="budget-main-scroll-body">
                {pendingImprovement && (
                <div style={{
                  background: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    💡 Applying Recommendation: {pendingImprovement.scenario.title}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    This scenario changes your monthly budget targets (recommended adjustment: <strong>{pendingImprovement.scenario.savingsFocus}</strong>). 
                    We have updated the gross salary and target savings, but your detailed allocations need to be aligned. Please review and adjust the categories below, then click <strong>Save Budget</strong> to apply the scenario.
                  </p>
                </div>
              )}

              {/* Segmented Phase Tabs */}
              {normalizedPhases.length > 1 && (
                <div className="segmented-control-container" style={{ margin: '0 0 1.25rem 0', width: '100%', overflowX: 'auto' }}>
                  <div className="segmented-control" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', display: 'flex', width: 'max-content', gap: '4px' }}>
                    {normalizedPhases.map((phase) => {
                      const isActive = activeBudgetPhase === phase.id;
                      return (
                        <button
                          key={phase.id}
                          type="button"
                          className={`segmented-control-btn ${isActive ? 'active' : ''}`}
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            background: isActive ? 'var(--primary)' : 'transparent',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => handleSwitchBudgetPhase(phase.id)}
                        >
                          <span>{phase.icon}</span>
                          <span>{phase.name.split(':')[0]} ({phase.startAge}-{phase.endAge})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Primary Section: Three Budget Cards */}
              <div className="budget-cards-grid">
                
                {/* Needs Card */}
                <div 
                  className={`budget-card needs ${showBreakdown && activeBreakdownTab === 'needs' ? 'active' : ''}`}
                  onClick={() => {
                    if (showBreakdown && activeBreakdownTab === 'needs') {
                      setShowBreakdown(false);
                    } else {
                      setShowBreakdown(true);
                      setActiveBreakdownTab('needs');
                    }
                  }}
                >
                  <div className="budget-card-icon-circle">🏠</div>
                  <div className="budget-card-title">Needs</div>
                  <div className="budget-card-amount">{formatCurrency(needsTotal)}/mo</div>
                  <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0}%</div>
                  <div className="budget-card-progress">
                    <div 
                      className="budget-card-progress-fill" 
                      style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((needsTotal / takeHomeIncome) * 100) : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Wants Card */}
                <div 
                  className={`budget-card wants ${showBreakdown && activeBreakdownTab === 'wants' ? 'active' : ''}`}
                  onClick={() => {
                    if (showBreakdown && activeBreakdownTab === 'wants') {
                      setShowBreakdown(false);
                    } else {
                      setShowBreakdown(true);
                      setActiveBreakdownTab('wants');
                    }
                  }}
                >
                  <div className="budget-card-icon-circle">🎉</div>
                  <div className="budget-card-title">Wants</div>
                  <div className="budget-card-amount">{formatCurrency(wantsTotal)}/mo</div>
                  <div className="budget-card-pct">{takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0}%</div>
                  <div className="budget-card-progress">
                    <div 
                      className="budget-card-progress-fill" 
                      style={{ width: `${Math.min(100, takeHomeIncome > 0 ? Math.round((wantsTotal / takeHomeIncome) * 100) : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Save & Invest Card */}
                <div 
                  className={`budget-card save ${showBreakdown && activeBreakdownTab === 'savings' ? 'active' : ''}`}
                  onClick={() => {
                    if (showBreakdown && activeBreakdownTab === 'savings') {
                      setShowBreakdown(false);
                    } else {
                      setShowBreakdown(true);
                      setActiveBreakdownTab('savings');
                    }
                  }}
                >
                  <div className="budget-card-icon-circle">💰</div>
                  <div className="budget-card-title">Save & Invest</div>
                  <div className="budget-card-amount">
                    {isRetirementPhase ? '$0/mo' : `${formatCurrency(activeSavings)}/mo`}
                  </div>
                  <div className="budget-card-pct">
                    {isRetirementPhase ? '0%' : `${takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0}%`}
                  </div>
                  <div className="budget-card-progress">
                    <div 
                      className="budget-card-progress-fill" 
                      style={{ width: `${Math.min(100, isRetirementPhase ? 0 : (takeHomeIncome > 0 ? Math.round((activeSavings / takeHomeIncome) * 100) : 0))}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* Childcare Adjustment Card (if applicable) */}
              {activeC > 0 && currentChildCostsMonthly > 0 && (
                <div className="childcare-adjustment-card">
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', display: 'block', marginBottom: '0.2rem' }}>
                      👶 Childcare Adjustment
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Child expenses increase spending by <strong>{formatCurrency(currentChildCostsMonthly)}/mo</strong>.
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '0.15rem' }}>
                      Recommendation: Increase income by {formatCurrency(currentChildCostsMonthly)}/mo during this phase.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="list-builder-edit-btn"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => {
                      setBudgetMonthlyIncome(prev => prev + currentChildCostsMonthly);
                    }}
                  >
                    Apply Recommendation
                  </button>
                </div>
              )}

              {/* Simplified Summary Section */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    Monthly Take-Home Income
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {formatCurrency(takeHomeIncome)}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    Allocated
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {formatCurrency(totalAllocated)}/mo{' '}
                    <span style={{ fontSize: '0.9rem', color: takeHomeIncome > 0 ? (Math.round((totalAllocated / takeHomeIncome) * 100) > 100 ? 'var(--accent-rose)' : 'var(--accent-emerald)') : 'var(--text-tertiary)', fontWeight: 'bold' }}>
                      ({takeHomeIncome > 0 ? Math.round((totalAllocated / takeHomeIncome) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div style={{ marginBottom: '1rem' }}>
                {Math.abs(remainingBalance) <= 1 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    ✅ You’re on track. You’re saving {activeSavingsRate}% of your income.
                  </div>
                ) : remainingBalance < 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>⚠️ Over budget by {formatCurrency(Math.abs(remainingBalance))}/mo.</span>
                    <button 
                      type="button"
                      className="list-builder-edit-btn" 
                      style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', borderColor: 'var(--accent-rose)', color: '#fda4af' }}
                      onClick={handleAutoReduceSavingsToBalance}
                    >
                      ⚖️ Auto-Reduce Savings
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>💡 {formatCurrency(remainingBalance)}/mo remains unallocated.</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button 
                        type="button" 
                        className="list-builder-edit-btn" 
                        style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                        onClick={() => handleAllocateRemaining('hysa')}
                      >
                        📥 Put in HYSA
                      </button>
                      <button 
                        type="button" 
                        className="list-builder-edit-btn" 
                        style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                        onClick={() => handleAllocateRemaining('brokerage')}
                      >
                        📥 Put in Brokerage
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Show Advanced Details Collapsible Trigger */}
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    padding: '0.25rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  {isAdvancedOpen ? 'Hide Advanced Details ▲' : 'Show Advanced Details ▼'}
                </button>

                {/* Collapsible Content */}
                <div className={`advanced-details-container ${isAdvancedOpen ? 'open' : ''}`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    
                    {/* Income Settings */}
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Income Settings</h4>
                      <div className="input-wrapper" style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.2rem' }}>
                          <span className="input-name" style={{ fontSize: '0.72rem', margin: 0 }}>Monthly Take-home Income ($)</span>
                          {activeC > 0 && activeChildBoost > 0 && (
                            <span style={{ 
                              fontSize: '0.65rem', 
                              padding: '0.1rem 0.35rem', 
                              background: 'rgba(245, 158, 11, 0.15)', 
                              border: '1px solid rgba(245, 158, 11, 0.35)', 
                              borderRadius: '4px', 
                              color: '#f59e0b',
                              fontWeight: '700'
                            }}>
                              +{formatCurrency(activeChildBoost)}/mo child boost
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                          value={budgetMonthlyIncome}
                          onChange={(e) => handleMonthlyIncomeChange(parseFloat(e.target.value) || 0)}
                          disabled={isRetirementPhase}
                        />
                      </div>
                      {activePhaseObj && activePhaseObj.incomeGrowthRate > 0 && !isRetirementPhase && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block' }}>
                          📈 Income grows {(activePhaseObj.incomeGrowthRate * 100).toFixed(1)}%/yr
                        </span>
                      )}
                    </div>

                    {/* Savings Settings */}
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Savings Settings</h4>
                      <div className="input-wrapper" style={{ marginBottom: '0.5rem' }}>
                        <span className="input-name" style={{ fontSize: '0.72rem' }}>Savings mode:</span>
                        <select
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                          value={savingsAllocMode}
                          onChange={(e) => handleToggleSavingsAllocMode(e.target.value)}
                          disabled={isMarriedMode || isRetirementPhase}
                        >
                          <option value="fixed">Fixed Amount ($)</option>
                          <option value="percentSurplus">Percent of Surplus (%)</option>
                        </select>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block' }}>
                        Target savings rate: {activeSavingsRate}%
                      </span>
                    </div>

                    {/* Tax & Simulation Settings */}
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Tax & Simulation</h4>
                      <div className="input-wrapper" style={{ marginBottom: '0.5rem' }}>
                        <span className="input-name" style={{ fontSize: '0.72rem' }}>Filing Status:</span>
                        <select
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                          value={isMarriedMode ? (marriageEvent.filingStatus || 'jointly') : budgetFilingStatus}
                          onChange={(e) => {
                            if (!isMarriedMode) setBudgetFilingStatus(e.target.value);
                          }}
                          disabled={isMarriedMode}
                        >
                          <option value="single">Single</option>
                          <option value="jointly">Married Jointly</option>
                          <option value="separate">Married Separate</option>
                          <option value="hoh">Head of Household</option>
                        </select>
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name" style={{ fontSize: '0.72rem' }}>HSA Coverage:</span>
                        <select
                          className="input-number-box"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                          value={budgetHsaCoverage}
                          onChange={(e) => setBudgetHsaCoverage(e.target.value)}
                        >
                          <option value="single">Single ($4,150 limit)</option>
                          <option value="family">Family ($8,300 limit)</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Warnings & Guardrails */}
              {(() => {
                const warnings = [];
                if (capped401k >= 23500 && (budgetSavings.trad401k || 0) * 12 > 23500) {
                  warnings.push(`401(k) exceeds employee limit ($23,500/yr). Capping tax deduction.`);
                }
                if ((budgetSavings.tradIra || 0) * 12 + (budgetSavings.rothIra || 0) * 12 > 7000) {
                  warnings.push(`Combined IRA contributions exceed the $7,000/yr limit.`);
                }
                if (cappedHsa >= (budgetHsaCoverage === 'family' ? 8300 : 4150) && (budgetSavings.hsa || 0) * 12 > (budgetHsaCoverage === 'family' ? 8300 : 4150)) {
                  warnings.push(`HSA exceeds IRS limit ($${budgetHsaCoverage === 'family' ? '8,300' : '4,150'}/yr). Capping tax deduction.`);
                }
                
                if (warnings.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                    {warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                        ⚠️ {w}
                      </div>
                    ))}
                  </div>
                );
              })()}
              </div>

              {/* Footer Controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
                  onClick={handleCloseBudgetModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                  onClick={handleSaveBudget}
                >
                  Save Budget
                </button>
              </div>

            </div>

            {/* Right Column: Breakdown Sidebar */}
            <div className={`budget-breakdown-sidebar ${showBreakdown ? 'open' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Breakdown</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>See what's included in each category.</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowBreakdown(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}
                >
                  ✖
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, maxHeight: 'calc(85vh - 7rem)', overflowY: 'auto', paddingRight: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Needs Breakdown */}
                {(!activeBreakdownTab || activeBreakdownTab === 'needs') && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>🏠 Needs</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(needsTotal)}/mo</strong>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                      {(isMarriedMode ? [
                        { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                        { key: 'utilities', label: 'Utilities & Subscriptions' },
                        { key: 'food', label: 'Food (Groceries)' },
                        { key: 'transportation', label: 'Transportation / Gas / Car' },
                        { key: 'healthcare', label: 'Healthcare & Insurance' },
                        { key: 'debt', label: 'Debt Payments' }
                      ] : [
                        { key: 'housing', label: 'Housing (Rent/Mortgage)' },
                        { key: 'utilities', label: 'Utilities & Subscriptions' },
                        { key: 'food', label: 'Food (Groceries)' },
                        { key: 'transportation', label: 'Transportation / Gas / Car' },
                        { key: 'healthcare', label: 'Healthcare & Insurance' }
                      ]).map(item => (
                        <div key={item.key} className="breakdown-row budget-input-row">
                          <span className="breakdown-row-label">{item.label}</span>
                          {isEditingNeeds ? (
                            <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                              <span className="currency-symbol">$</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                value={budgetExpenses[item.key] || 0}
                                onChange={(e) => setBudgetExpenses({
                                  ...budgetExpenses,
                                  [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                })}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="breakdown-row-dots" />
                              <span className="breakdown-row-value">{formatCurrency(budgetExpenses[item.key] || 0)}</span>
                            </>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        className="breakdown-edit-link"
                        onClick={() => setIsEditingNeeds(!isEditingNeeds)}
                      >
                        {isEditingNeeds ? 'Done Editing ✓' : 'Edit Needs →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Wants Breakdown */}
                {(!activeBreakdownTab || activeBreakdownTab === 'wants') && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 'bold' }}>🎉 Wants</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatCurrency(wantsTotal)}/mo</strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                      {[
                        { key: 'leisure', label: 'Leisure & Leisure Travel' },
                        { key: 'diningOut', label: 'Dining Out' },
                        { key: 'misc', label: 'Miscellaneous Expenses' }
                      ].map(item => (
                        <div key={item.key} className="breakdown-row budget-input-row">
                          <span className="breakdown-row-label">{item.label}</span>
                          {isEditingWants ? (
                            <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                              <span className="currency-symbol">$</span>
                              <input
                                type="number"
                                className="input-number-box"
                                style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                value={budgetExpenses[item.key] || 0}
                                onChange={(e) => setBudgetExpenses({
                                  ...budgetExpenses,
                                  [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                })}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="breakdown-row-dots" />
                              <span className="breakdown-row-value">{formatCurrency(budgetExpenses[item.key] || 0)}</span>
                            </>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        className="breakdown-edit-link"
                        onClick={() => setIsEditingWants(!isEditingWants)}
                      >
                        {isEditingWants ? 'Done Editing ✓' : 'Edit Wants →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Save & Invest Breakdown */}
                {(!activeBreakdownTab || activeBreakdownTab === 'savings') && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#c084fc', fontWeight: 'bold' }}>💰 Save & Invest</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {isRetirementPhase ? '$0' : formatCurrency(activeSavings)}/mo
                      </strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                      {isRetirementPhase ? (
                        <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                          🏖️ Savings are disabled during retirement. You are now drawing down from your portfolio to fund your living expenses.
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', margin: '0.25rem 0 0.15rem 0' }}>
                            {isMarriedMode ? '👤 Your Savings' : 'Monthly Savings'}
                          </span>
                          
                          {(isMarriedMode ? [
                            { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                            { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr' },
                            { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr' },
                            { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                            { key: 'brokerage', label: 'Taxable Brokerage' },
                            { key: 'checking', label: 'Checking Account' },
                            { key: 'hysa', label: 'High-Yield Savings' },
                            { key: 'emergency', label: 'Emergency Fund' },
                            { key: 'cash', label: 'Cash Savings' },
                            { key: 'debt', label: 'Debt Paydown' },
                            { key: 'other', label: 'Other Savings' }
                          ] : [
                            { key: 'trad401k', label: '401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                            { key: 'rothIra', label: 'Roth IRA', desc: 'Limit $7,000/yr combined' },
                            { key: 'tradIra', label: 'Traditional IRA', desc: 'Limit $7,000/yr combined' },
                            { key: 'hsa', label: 'HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                            { key: 'brokerage', label: 'Taxable Brokerage' },
                            { key: 'checking', label: 'Checking Account' },
                            { key: 'hysa', label: 'High-Yield Savings' },
                            { key: 'emergency', label: 'Emergency Fund' },
                            { key: 'debt', label: 'Debt Payoff' },
                            { key: 'other', label: 'Other Savings' }
                          ]).map(item => (
                            <div key={item.key} className="breakdown-row budget-input-row" style={{ minHeight: '22px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="breakdown-row-label">{item.label}</span>
                                {item.desc && !isEditingSavings && (
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                                    {item.desc}
                                  </span>
                                )}
                              </div>
                              {isEditingSavings ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                                  <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                                    <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                    <input
                                      type="number"
                                      className="input-number-box"
                                      style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                      value={budgetSavings[item.key] || 0}
                                      onChange={(e) => setBudgetSavings({
                                        ...budgetSavings,
                                        [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                      })}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="breakdown-row-dots" />
                                  <span className="breakdown-row-value">
                                    {savingsAllocMode === 'percentSurplus' 
                                      ? `${budgetSavings[item.key] || 0}%` 
                                      : formatCurrency(budgetSavings[item.key] || 0)}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}

                          {isMarriedMode && (
                            <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                                👥 Partner Savings
                              </span>
                              
                              {[
                                { key: 'trad401k', label: 'Partner 401(k) (Pre-Tax)', desc: 'Limit $23,500/yr' },
                                { key: 'rothIra', label: 'Partner Roth IRA', desc: 'Limit $7,000/yr' },
                                { key: 'tradIra', label: 'Partner Traditional IRA', desc: 'Limit $7,000/yr' },
                                { key: 'hsa', label: 'Partner HSA', desc: `Limit ${budgetHsaCoverage === 'family' ? '$8,300' : '$4,150'}/yr` },
                                { key: 'brokerage', label: 'Partner Brokerage' },
                                { key: 'checking', label: 'Partner Checking Account' },
                                { key: 'hysa', label: 'Partner High-Yield Savings' },
                                { key: 'emergency', label: 'Partner Emergency Fund' },
                                { key: 'cash', label: 'Partner Cash Savings' },
                                { key: 'debt', label: 'Partner Debt Paydown' },
                                { key: 'other', label: 'Partner Other Savings' }
                              ].map(item => (
                                <div 
                                  key={item.key} 
                                  className="budget-input-row"
                                  style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.5rem'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="breakdown-row-label">{item.label}</span>
                                    {item.desc && !isEditingSavings && (
                                      <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-0.15rem' }}>
                                        {item.desc}
                                      </span>
                                    )}
                                  </div>
                                  {isEditingSavings ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                                      <div className="input-prefix-wrapper" style={{ width: '100px' }}>
                                        <span className="currency-symbol">{savingsAllocMode === 'percentSurplus' ? '%' : '$'}</span>
                                        <input
                                          type="number"
                                          className="input-number-box"
                                          style={{ width: '100%', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                          value={budgetPartnerSavings[item.key] || 0}
                                          onChange={(e) => setBudgetPartnerSavings({
                                            ...budgetPartnerSavings,
                                            [item.key]: Math.max(0, parseFloat(e.target.value) || 0)
                                          })}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="breakdown-row-dots" />
                                      <span className="breakdown-row-value">
                                        {savingsAllocMode === 'percentSurplus' 
                                          ? `${budgetPartnerSavings[item.key] || 0}%` 
                                          : formatCurrency(budgetPartnerSavings[item.key] || 0)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            className="breakdown-edit-link"
                            onClick={() => setIsEditingSavings(!isEditingSavings)}
                          >
                            {isEditingSavings ? 'Done Editing ✓' : 'Edit Savings →'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

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
        <div className="today-screen-layout" style={{ alignItems: 'stretch' }}>
          {/* Inputs Grid */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Your Life Today</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.0rem', lineHeight: '1.45' }}>
              Let's estimate your path to financial independence. Fill in your current numbers to see your baseline projection instantly.
            </p>
            

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Age</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.currentAge}
                    placeholder="e.g. 35"
                    onChange={(e) => handleStep1Change('currentAge', parseInt(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your current age today (e.g. 35)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Life Expectancy</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.lifeExpectancy}
                    placeholder="e.g. 85"
                    onChange={(e) => handleStep1Change('lifeExpectancy', parseInt(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Age you expect to live to (e.g. 85)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Annual Income ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.simpleIncome}
                    placeholder="e.g. 120000"
                    onChange={(e) => handleStep1Change('simpleIncome', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your total yearly gross income (e.g. $120,000)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Pre-Tax Savings Rate (%)</span>
                    <button
                      type="button"
                      onClick={handleSetBudgetClick}
                      className="list-builder-edit-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      📊 Calculate from budget
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={simpleSavingsRate}
                    placeholder="e.g. 20"
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0;
                      const clampedRate = Math.min(100, Math.max(0, rate));
                      lastNonZeroSavingsRateRef.current = clampedRate;
                      const income = Number(inputs.simpleIncome) || 0;
                      const newExpenses = Math.round(income * (1 - clampedRate / 100));
                      handleStep1Change('simpleExpenses', newExpenses);
                    }}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Percent of income saved pre-tax (e.g. 20%)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Savings ($)</span>
                    <button
                      type="button"
                      onClick={handleOpenSavingsDetails}
                      className="list-builder-edit-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      ✏️ Details
                    </button>
                  </div>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                    value={inputs.simpleInvestments}
                    placeholder="e.g. 250000"
                    onChange={(e) => handleStep1Change('simpleInvestments', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
                  Your total savings, retirement, and investment accounts combined (e.g. $250,000)
                </span>
              </div>
            </div>

           </div>

          {/* Immediate Value Display Progress Board */}
          <div className="progress-board-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.25rem 1.5rem', height: 'auto' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Your Financial Snapshot</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Your current starting point parameters:
              </p>
            </div>

            {/* Positive Metrics Deck */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Annual Income
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.15' }}>
                  {formatCurrency(inputs.simpleIncome)}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Pre-Tax Savings Rate
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
                  {simpleSavingsRate}%
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Annual Surplus
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)', lineHeight: '1.15' }}>
                  {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
                  Current Net Worth
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
                  {formatCurrency(totalNetWorth)}
                </span>
              </div>
            </div>

            {/* Encouraging Insights */}
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Starting Point Insights
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                  <span>💡</span>
                  <span>
                    {simpleSavingsRate >= 15 
                      ? `Strong Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                      : simpleSavingsRate > 0
                        ? `Good Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                        : `Action Plan: Try adjusting your spending to create a surplus and start saving.`}
                  </span>
                </div>
                {inputs.simpleIncome - inputs.simpleExpenses > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                    <span>🌱</span>
                    <span>
                      {`Annual Investing: You have ${formatCurrency(inputs.simpleIncome - inputs.simpleExpenses)}/yr to build wealth.`}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                  <span>✨</span>
                  <span>
                    {`Current Status: This is your starting point. Life choices can change your timeline.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Next Step CTA */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: 'auto', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Next Step
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Now let’s see how future life choices affect your path.
                </span>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '0.65rem', fontSize: '1.05rem', fontWeight: '700', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
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

            const targetRetAge = Number(inputs.targetRetirementAge);
            const readyAge = activeResults.retirementReadyAge;
            const isNotAchieved = readyAge === null || targetRetAge < readyAge;

            const criteriaTarget = inputs.readinessCriteria === 'lastsLifeExp'
              ? activeResults.retirementReadyTargetSurvival
              : inputs.readinessCriteria === 'lastsComfortable'
                ? activeResults.retirementReadyTargetComfortable
                : activeResults.retirementReadyTarget;

            const gapAmount = activeResults.endingSurplusShortfall < 0 
              ? -activeResults.endingSurplusShortfall 
              : Math.max(0, criteriaTarget - activeResults.portfolioAtRetirement);
            
            const yearsAdditionalWork = readyAge ? Math.max(0, readyAge - targetRetAge) : 0;
            
            const yearsToRetire = targetRetAge - Number(inputs.currentAge);
            const additionalSavings = estimateAdditionalMonthlySavings(gapAmount, yearsToRetire, inputs.expectedReturn);
            
            const incomeVal = Number(inputs.simpleIncome) || 50000;
            const additionalSavingsPercent = incomeVal > 0 ? (additionalSavings * 12 / incomeVal) * 100 : 0;
            
            const yearsOfRetirement = Number(inputs.lifeExpectancy) - targetRetAge;
            const annualSpendingVal = activeResults.annualRetirementSpending || 40000;
            const spendingReductionPercent = Math.min(100, Math.max(1, Math.round((gapAmount / (annualSpendingVal * Math.max(1, yearsOfRetirement))) * 100)));

            return (
              <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
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

                {/* View Values In Preference Toggle */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end', 
                  gap: '0.5rem', 
                  marginBottom: '0.65rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span>View Values In:</span>
                  <div className="segmented-control" style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px', 
                    padding: '2px', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      className={`segmented-control-btn ${displayMode === 'future' ? 'active' : ''}`}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                        background: displayMode === 'future' ? 'var(--primary)' : 'transparent',
                        color: displayMode === 'future' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setDisplayMode('future')}
                    >
                      Future Dollars
                    </button>
                    <button
                      type="button"
                      className={`segmented-control-btn ${displayMode === 'today' ? 'active' : ''}`}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                        background: displayMode === 'today' ? 'var(--primary)' : 'transparent',
                        color: displayMode === 'today' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onClick={() => setDisplayMode('today')}
                    >
                      Today’s Dollars
                      <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                        <span className="toggle-tooltip-icon" style={{ width: '10px', height: '10px', fontSize: '7px', lineHeight: '10px' }}>i</span>
                        <span className="toggle-tooltip-text" style={{ textTransform: 'none', fontWeight: 'normal' }}>
                          Today’s Dollars adjusts future values for inflation to show equivalent purchasing power.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Outcome Banner (Compact) */}
                <div style={{ 
                  background: details.bg, 
                  border: `1px solid ${details.color}44`, 
                  borderRadius: '6px', 
                  padding: '0.35rem 0.75rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: '800', color: details.color }}>
                    {details.badge}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35', flex: 1, minWidth: '250px' }}>
                    {details.desc}
                  </p>
                </div>
                
                {/* Planning Concepts & Key Values Grid (6-Column Compact) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                  gap: '0.5rem', 
                  paddingTop: '0' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Planned Retirement</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>Age {inputs.targetRetirementAge}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'Sustainable Age' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                        ? 'Comfortable Age' 
                        : 'Indefinite Age'}
                    </span>
                    <strong style={{ fontSize: readyAge ? '1.05rem' : '0.8rem', color: readyAge ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', fontWeight: '800' }}>
                      {readyAge ? `Age ${readyAge}` : 'Current Plan Needs Adjustment'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      retire indefinitely without SS
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {formatCurrency(displayedResults.retirementReadyTargetNoSS)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? 'retire sustainably, taking SS at selected year' 
                        : inputs.readinessCriteria === 'lastsComfortable' 
                          ? 'retire comfortably, taking SS at the selected year' 
                          : 'retire indefinitely, taking SS at selected year'}
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {inputs.readinessCriteria === 'lastsLifeExp' 
                        ? formatCurrency(displayedResults.retirementReadyTargetSurvival)
                        : inputs.readinessCriteria === 'lastsComfortable' 
                          ? formatCurrency(displayedResults.retirementReadyTargetComfortable)
                          : formatCurrency(displayedResults.retirementReadyTarget)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Projected Portfolio</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                      {displayedResults.targetRetirementAge === inputs.lifeExpectancy ? 'Adjust plan' : formatCurrency(displayedResults.portfolioAtRetirement)}
                    </strong>
                  </div>
                </div>

                {/* 🏖 Retire Today Compact Secondary Card */}
                <div style={{ 
                  marginTop: '0.65rem', 
                  padding: '0.4rem 0.6rem', 
                  background: 'rgba(255, 255, 255, 0.015)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1rem' }}>🏖️</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-primary)' }}>🏖 Retire Today</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>“Portfolio needed today to replace your current spending.”</span>
                    </div>
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                    {formatCurrency(displayedResults.retireTodayTarget)}
                  </strong>
                </div>

                {/* Retirement Improvement Plan Banner (Compact) */}
                {activeStep === 2 && improvementPlan && improvementPlan.rankedPlan.length > 0 && (
                  <div className="improvement-banner-container" style={{ marginTop: '0.65rem', padding: '0.35rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--primary-light)' }}>💡 Action Plan Available:</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Adjustments are available to improve your projection.</span>
                    </div>
                    <button
                      type="button"
                      className="improvement-banner-btn"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', margin: 0 }}
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
          <div className="glass-card timeline-card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Interactive Roadmap</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Click milestones to view details</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ width: '100%', minWidth: '150px', maxWidth: '200px' }}>
                  <button
                    type="button"
                    className="add-event-dropdown"
                    style={{
                      width: '100%',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundImage: 'none',
                      paddingRight: '1rem',
                      paddingLeft: '1rem',
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={handleSetBudgetClick}
                  >
                    Set Budget
                  </button>
                </div>
                <div style={{ width: '100%', minWidth: '150px', maxWidth: '200px' }}>
                  <select
                    className="add-event-dropdown"
                    style={{ width: '100%', height: '32px', padding: '0 2rem 0 1rem', fontSize: '0.78rem', lineHeight: '30px' }}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCreateEvent(e.target.value);
                        e.target.value = ''; // reset selection
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>➕ Add Life Decision...</option>
                    <option value="marriage">💍 Get Married</option>
                    <option value="buyHouse">🏠 Buy a House</option>
                    <option value="haveChild">👶 Have a Child</option>
                    <option value="careerChange">💼 Career Change</option>
                    <option value="move">📍 Move / Relocate</option>
                    <option value="retire" disabled={(inputs.lifeEvents || []).some(e => e.type === 'retire')}>
                      🏖 Retire {(inputs.lifeEvents || []).some(e => e.type === 'retire') ? ' (Already Added)' : ''}
                    </option>
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
            </div>

            {/* Compact Summary Row */}
            {(() => {
              const currentAge = inputs.currentAge;
              const lifeExpectancy = inputs.lifeExpectancy;
              const targetRetirementAge = inputs.targetRetirementAge;

              // 1. Working & Retired
              const retiredStr = targetRetirementAge < lifeExpectancy;

              // 2. Homeownership spans
              const homeSpans = [];
              (inputs.lifeEvents || []).forEach(ev => {
                if (ev.enabled && ev.type === 'buyHouse' && ev.houseId) {
                  const asset = inputs.houseAssets?.find(h => h.id === ev.houseId);
                  const name = asset?.name || 'Primary Home';
                  const buyAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
                  const sellEv = (inputs.lifeEvents || []).find(e => e.type === 'sellHouse' && e.houseId === ev.houseId && e.enabled);
                  const sellAge = sellEv ? Number(sellEv.age) : null;
                  homeSpans.push({ name, buyAge, sellAge });
                }
              });

              // 3. Marriage span
              const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
              const divorceEvent = (inputs.lifeEvents || []).find(e => e.type === 'divorce' && e.enabled);
              const hasSpouseInHousehold = (inputs.householdMembers || []).some(m => m.id === 'spouse');
              let marriedStr = null;
              if (marriageEvent) {
                const start = Number(marriageEvent.age);
                const end = divorceEvent ? Number(divorceEvent.age) : null;
                marriedStr = end ? `💍 Married: ${start}–${end}` : `💍 Married: ${start}+`;
              } else if (hasSpouseInHousehold) {
                const end = divorceEvent ? Number(divorceEvent.age) : null;
                marriedStr = end ? `💍 Married: ${currentAge}–${end}` : `💍 Married: ${currentAge}+`;
              }

              // 4. Child Expenses span
              const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
              let childStr = null;
              if (childEvents.length > 0) {
                const minChildAge = Math.min(...childEvents.map(ev => Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30));
                const maxChildAge = Math.max(...childEvents.map(ev => (Number(ev.birthAge !== undefined ? ev.birthAge : ev.parentAgeAtBirth) || 30) + (ev.includeCollege ? 22 : 18)));
                childStr = `👶 Child Expenses: ${minChildAge}–${Math.min(lifeExpectancy, maxChildAge)}`;
              }

              return (
                <div className="timeline-summary-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.25rem 1rem 0.75rem 1rem', background: 'transparent', border: 'none', margin: 0 }}>
                  <div className="timeline-summary-title" style={{ marginRight: '0.5rem' }}>Current Plan</div>
                  <div className="timeline-summary-items" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div className="plan-chip">💼 Working: {currentAge}–{targetRetirementAge}</div>
                    {retiredStr && <div className="plan-chip">🏖️ Retired: {targetRetirementAge}–{lifeExpectancy}</div>}
                    {homeSpans.map((h, i) => (
                      <div className="plan-chip" key={i}>
                        🏠 Homeowner ({h.name}): {h.buyAge}{h.sellAge ? `–${h.sellAge}` : '+'}
                      </div>
                    ))}
                    {marriedStr && <div className="plan-chip">{marriedStr}</div>}
                    {childStr && <div className="plan-chip">{childStr}</div>}
                  </div>
                </div>
              );
            })()}

            {/* Timeline Layout Wrapper (Timeline + Details Drawer) */}
            <div className="timeline-layout-wrapper">
              
              {/* Horizontal Timeline */}
              <div className="timeline-wrapper" style={{ flexGrow: 1, overflowX: 'auto', minWidth: 0 }}>
                <div className="timeline-grid" style={{ minWidth: '850px' }}>
                  
                  {/* Layer 1: MILESTONES / EVENTS */}
                  {(() => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    if (totalYears <= 0) return null;

                    return (
                      <div className="timeline-row">
                        <div className="timeline-row-label">
                          <span style={{ fontWeight: 700 }}>Events</span>
                        </div>
                        <div className="timeline-row-content events-row-content">
                          <div className="timeline-track-inner">
                            <div className="events-axis-line" />
                            {timelineEvents.map((evt, idx) => {
                              const isDraggingThis = !!(draggingInfo && (
                                (evt.originalId && draggingInfo.originalId === evt.originalId) ||
                                (!evt.originalId && draggingInfo.type === evt.type)
                              ));

                              const displayAge = isDraggingThis ? draggingInfo.currentAge : evt.age;

                              if (draggingInfo) {
                                console.log('[Drag Debug]', {
                                  title: evt.title,
                                  type: evt.type,
                                  originalId: evt.originalId,
                                  childEventId: evt.childEventId,
                                  isDraggingThis,
                                  evtAge: evt.age,
                                  displayAge,
                                  draggingInfo
                                });
                              }
                              const percent = totalYears > 0 ? ((displayAge - inputs.currentAge) / totalYears) * 100 : 0;
                              const isFinancial = isFinancialEvent(evt);

                              if (isFinancial) {
                                return (
                                  <div
                                    key={idx}
                                    className={`financial-milestone-wrapper ${isDraggingThis ? 'dragging' : ''}`}
                                    style={{
                                      left: `${percent}%`,
                                      bottom: `${16 + (evt.stackIndex * 38)}px`
                                    }}
                                    onMouseDown={(e) => handleNodeDragStart(e, evt)}
                                    onTouchStart={(e) => handleNodeDragStart(e, evt)}
                                    onClick={(e) => {
                                      if (dragOccurredRef.current) {
                                        e.stopPropagation();
                                        return;
                                      }
                                      if (isEditableEvent(evt)) {
                                        handleEditRoadmapEvent(evt);
                                      }
                                    }}
                                  >
                                    <div className="financial-milestone-dot">
                                      {evt.icon}
                                    </div>

                                    {/* Tooltip on hover */}
                                    <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                                        {evt.icon} {evt.title}
                                      </div>
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                                        <div>Age {Math.floor(displayAge)} • {evt.description}</div>
                                        {/* Additional Tooltip Details */}
                                        {(() => {
                                          if (evt.type === 'mortgageOff') {
                                            const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                            if (asset) {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                  P&I Savings: {formatCurrency(propPIAmount(asset))}/yr
                                                </div>
                                              );
                                            }
                                          }
                                          if (evt.type === 'childSupportEnds') {
                                            return (
                                              <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                                                Support expenses have ended
                                              </div>
                                            );
                                          }
                                          if (evt.type === 'socialSecurity') {
                                            const ss = displayedResults.socialSecurityDetails;
                                            if (ss && ss.isEligible) {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                  Benefit: {formatCurrency(ss.monthlyBenefit)}/mo ({formatCurrency(ss.annualBenefit)}/yr)
                                                </div>
                                              );
                                            }
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Line connector down to axis */}
                                    {evt.stackIndex > 0 && (
                                      <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 38}px`, bottom: `-${evt.stackIndex * 38}px`, left: '50%', transform: 'translateX(-50%)' }} />
                                    )}
                                  </div>
                                );
                              } else {
                                const wrapperClass = (evt.isMilestone || evt.type === 'retire') ? 'milestone-event' : 'standard-milestone';
                                return (
                                  <div
                                    key={idx}
                                    className={`milestone-circle-wrapper ${wrapperClass} ${isDraggingThis ? 'dragging' : ''}`}
                                    style={{
                                      left: `${percent}%`,
                                      bottom: `${16 + (evt.stackIndex * 38)}px`
                                    }}
                                    onMouseDown={(e) => handleNodeDragStart(e, evt)}
                                    onTouchStart={(e) => handleNodeDragStart(e, evt)}
                                    onClick={(e) => {
                                      if (dragOccurredRef.current) {
                                        e.stopPropagation();
                                        return;
                                      }
                                      if (isEditableEvent(evt)) {
                                        handleEditRoadmapEvent(evt);
                                      }
                                    }}
                                  >
                                    <div className="milestone-glow-circle">
                                      {evt.icon}
                                    </div>

                                    {/* Tooltip on hover */}
                                    <div className={`timeline-tooltip ${percent < 20 ? 'align-left' : percent > 80 ? 'align-right' : ''}`}>
                                      <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.15rem', fontSize: '0.78rem' }}>
                                        {evt.icon} {evt.title}
                                      </div>
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'normal', minWidth: '180px', lineHeight: '1.3' }}>
                                        <div>Age {Math.floor(displayAge)} • {evt.description}</div>
                                        {/* Additional Tooltip Details */}
                                        {(() => {
                                          if (evt.type === 'buyHouse') {
                                            const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                            if (asset) {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                  Price: {formatCurrency(asset.purchasePrice || asset.homePrice || 0)} 
                                                  {asset.purchaseType !== 'cash' && ` (${asset.mortgageRate || 6.5}% APR)`}
                                                </div>
                                              );
                                            }
                                          }
                                          if (evt.type === 'sellHouse') {
                                            const asset = inputs.houseAssets?.find(h => h.id === evt.houseId);
                                            if (asset) {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                                                  Property: {asset.name}
                                                </div>
                                              );
                                            }
                                          }
                                          if (evt.type === 'haveChild') {
                                            const ev = inputs.lifeEvents?.find(e => e.id === evt.originalId);
                                            if (ev) {
                                              return (
                                                <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-orange)' }}>
                                                  Support Term: {ev.includeCollege ? 22 : 18} years
                                                </div>
                                              );
                                            }
                                          }
                                          if (evt.type === 'marriage') {
                                            return (
                                              <div style={{ marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.25rem', color: 'var(--accent-rose)' }}>
                                                Spouse Income: {formatCurrency(evt.spouseIncome)}/yr
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Line connector down to axis */}
                                    {evt.stackIndex > 0 && (
                                      <div className="milestone-connector-line" style={{ height: `${evt.stackIndex * 38}px`, bottom: `-${evt.stackIndex * 38}px`, left: '50%', transform: 'translateX(-50%)' }} />
                                    )}
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Layer 2: DECISION PHASES (MARRIAGE, CHILDCARE, HOMEOWNERSHIP) */}
                  {(() => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    if (totalYears <= 0) return null;

                    const activeCommitments = [];

                    // Homeownership spans
                    inputs.lifeEvents.forEach(ev => {
                      if (ev.enabled && ev.type === 'buyHouse' && ev.houseId) {
                        const asset = inputs.houseAssets?.find(h => h.id === ev.houseId);
                        const houseName = asset?.name || 'Primary Home';
                        const buyAge = Number(ev.purchaseAge !== undefined ? ev.purchaseAge : ev.age);
                        const sellEv = inputs.lifeEvents.find(e => e.type === 'sellHouse' && e.houseId === ev.houseId && e.enabled);
                        const sellAge = sellEv ? Number(sellEv.age) : inputs.lifeExpectancy;
                        activeCommitments.push({
                          id: `house-${ev.houseId}`,
                          label: houseName,
                          emoji: '🏠',
                          startAge: buyAge,
                          endAge: sellAge,
                          className: 'commitment-span home'
                        });
                      }
                    });

                    // Childcare support
                    const childEvents = (inputs.lifeEvents || []).filter(e => e.type === 'haveChild' && e.enabled);
                    if (childEvents.length > 0) {
                      const activeAges = [];
                      for (let age = inputs.currentAge; age < inputs.lifeExpectancy; age++) {
                        if (getActiveChildrenCountAtAge(age, inputs.lifeEvents) > 0) {
                          activeAges.push(age);
                        }
                      }
                      
                      const ccIntervals = [];
                      if (activeAges.length > 0) {
                        let start = activeAges[0];
                        let prev = activeAges[0];
                        for (let i = 1; i < activeAges.length; i++) {
                          if (activeAges[i] === prev + 1) {
                            prev = activeAges[i];
                          } else {
                            ccIntervals.push({ start, end: prev + 1 });
                            start = activeAges[i];
                            prev = activeAges[i];
                          }
                        }
                        ccIntervals.push({ start, end: prev + 1 });
                      }

                      ccIntervals.forEach((interval, idx) => {
                        activeCommitments.push({
                          id: `childcare-${idx}`,
                          label: 'Childcare & Support',
                          emoji: '👶',
                          startAge: interval.start,
                          endAge: interval.end,
                          className: 'commitment-span childcare'
                        });
                      });
                    }

                    // Marriage
                    const marriageEvent = (inputs.lifeEvents || []).find(e => e.type === 'marriage' && e.enabled);
                    const divorceEvent = (inputs.lifeEvents || []).find(e => e.type === 'divorce' && e.enabled);
                    const hasSpouseInHousehold = (inputs.householdMembers || []).some(m => m.id === 'spouse');
                    if (marriageEvent || hasSpouseInHousehold) {
                      const start = marriageEvent ? Number(marriageEvent.age) : inputs.currentAge;
                      const end = divorceEvent ? Number(divorceEvent.age) : inputs.lifeExpectancy;
                      activeCommitments.push({
                        id: 'marriage',
                        label: 'Marriage',
                        emoji: '💍',
                        startAge: start,
                        endAge: end,
                        className: 'commitment-span marriage'
                      });
                    }

                    return activeCommitments.map(c => {
                      const startPct = Math.max(0, Math.min(100, ((c.startAge - inputs.currentAge) / totalYears) * 100));
                      const endPct = Math.max(0, Math.min(100, ((c.endAge - inputs.currentAge) / totalYears) * 100));
                      const widthPct = endPct - startPct;
                      if (widthPct <= 0) return null;

                      return (
                        <div className="timeline-row" key={c.id}>
                          <div className="timeline-row-label">
                            <span style={{ marginRight: '0.25rem' }}>{c.emoji}</span> {c.label}
                          </div>
                          <div className="timeline-row-content commitment-track">
                            <div className="timeline-track-inner">
                              <div
                                className={c.className}
                                style={{
                                  left: `${startPct}%`,
                                  width: `${widthPct}%`
                                }}
                              >
                                {c.emoji} {c.label} (Age {c.startAge}–{c.endAge === inputs.lifeExpectancy ? `${c.startAge}+` : c.endAge})
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* Layer 3: LIFE PHASES */}
                  {(() => {
                    const totalYears = inputs.lifeExpectancy - inputs.currentAge;
                    if (totalYears <= 0) return null;
                    const retAge = inputs.targetRetirementAge || inputs.lifeExpectancy;
                    const workPct = Math.max(0, Math.min(100, ((retAge - inputs.currentAge) / totalYears) * 100));

                    return (
                      <div className="timeline-row">
                        <div className="timeline-row-label">Life Phases</div>
                        <div className="timeline-row-content life-phase-track">
                          <div className="timeline-track-inner">
                            {workPct > 0 && (
                              <div
                                className="life-phase-span work-save"
                                style={{
                                  left: '0%',
                                  width: `${workPct}%`
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: '1.2' }}>
                                  <span style={{ fontWeight: 700 }}>💼 Work & Save</span>
                                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Age {inputs.currentAge}–{retAge}</span>
                                </div>
                              </div>
                            )}
                            {workPct < 100 && (
                              <div
                                className="life-phase-span retirement"
                                style={{
                                  left: `${workPct}%`,
                                  width: `${100 - workPct}%`
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: '1.2' }}>
                                  <span style={{ fontWeight: 700 }}>🏖️ Retirement</span>
                                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Age {retAge}–{inputs.lifeExpectancy}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CHRONOLOGICAL AGE TICKS */}
                  <div className="timeline-row">
                    <div className="timeline-row-label" style={{ opacity: 0, borderRight: 'none' }}>Ages</div>
                    <div className="timeline-row-content ticks-row-content">
                      <div className="timeline-track-inner">
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
                            return (
                              <div key={idx} className="timeline-tick-new" style={{ left: `${percent}%` }}>
                                <div className="timeline-tick-mark-new" />
                                <span className="timeline-tick-label-new">{age}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>


          {/* Wealth Journey Graph (Full Width, directly below timeline) */}
          {validation.errors.length === 0 && (
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    Wealth Journey
                    <span className="toggle-tooltip-container" onClick={(e) => e.stopPropagation()}>
                      <span className="toggle-tooltip-icon">i</span>
                      <span className="toggle-tooltip-text" style={{ textTransform: 'none', fontWeight: 'normal' }}>
                        Shows values at the start of the fiscal year.
                      </span>
                    </span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Updates live • Click chart to view detailed benchmarks below</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={showAssets}
                      onChange={(e) => setShowAssets(e.target.checked)}
                      style={{ accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#10b981', fontWeight: '700' }}>Assets (Green)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={showDebt}
                      onChange={(e) => setShowDebt(e.target.checked)}
                      style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#ef4444', fontWeight: '700' }}>Debt (Red)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={showNetWorth}
                      onChange={(e) => setShowNetWorth(e.target.checked)}
                      style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#8b5cf6', fontWeight: '700' }}>Net Worth (Purple)</span>
                  </label>
                </div>
              </div>
              <div className="chart-container-inner" style={{ height: '240px', cursor: 'crosshair' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
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
                      dataKey="assets"
                      name="Total Assets"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      hide={!showAssets}
                    />
                    <Line
                      type="monotone"
                      dataKey="debt"
                      name="Total Debt"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      hide={!showDebt}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={false}
                      hide={!showNetWorth}
                    />

                    {/* 1. Planned Retirement Age */}
                    {displayedResults.targetRetirementAge && (
                      <ReferenceLine
                        x={displayedResults.targetRetirementAge}
                        stroke="#a855f7"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Retirement: Age ${displayedResults.targetRetirementAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 10
                        }}
                      />
                    )}

                    {/* 2. Retirement Ready Age */}
                    {displayedResults.retirementReadyAge && (
                      <ReferenceLine
                        x={displayedResults.retirementReadyAge}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `${inputs.readinessCriteria === 'lastsLifeExp' ? 'Sustainable' : inputs.readinessCriteria === 'lastsComfortable' ? 'Comfortable' : 'Indefinite'} Ready: Age ${displayedResults.retirementReadyAge}`,
                          position: 'insideTopRight',
                          fill: 'var(--text-primary)',
                          fontSize: 9,
                          dy: 25
                        }}
                      />
                    )}

                    {/* 3. Assets Depleted Age */}
                    {displayedResults.runOutAge && (
                      <ReferenceLine
                        x={displayedResults.runOutAge}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Assets Run Out: Age ${displayedResults.runOutAge}`,
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
              {((inputs.lifeEvents || []).some(e => e.type === 'haveChild' && e.enabled) || displayedResults.runOutAge !== null) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(99, 102, 241, 0.04)',
                  border: '1px dashed rgba(99, 102, 241, 0.25)',
                  borderRadius: '6px',
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.45'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>💡</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Lifecycle Planning Note:</strong> Temporary deficits or portfolio drawdowns (where your Net Worth line dips or flattens, such as during high-expense childcare/daycare years or early retirement) are a normal and <strong>perfectly acceptable part of a long-term financial roadmap</strong>. As long as your portfolio recovery projections climb back up in the long run, your plan remains sustainable.
                  </div>
                </div>
              )}
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
                {generateLifeStory(inputs, displayedResults)}
              </div>
              {renderChildCostsBuckets()}
            </div>

            {/* Right Column: Graphs, Snapshot, and Settings */}
            <div className="roadmap-grid-col-right">

              {/* Benchmarks Snapshot */}
              {validation.errors.length === 0 && (() => {
                const activeYear = selectedYear !== null ? selectedYear : Number(inputs.currentAge);
                const yearData = chartData.find(d => d.age === activeYear);
                if (!yearData) return null;

                const isWorking = activeYear < displayedResults.targetRetirementAge;
                
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

                    {/* Cash Flow Details Breakdown */}
                    <div style={{ marginTop: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                        📊 Cash Flow Details
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Base Annual Spending:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(Math.max(0, yearData.expenses - (yearData.taxes || 0) - (yearData.childCosts || 0)))}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Child Costs:</span>
                          <strong style={{ color: yearData.childCosts > 0 ? 'var(--accent-orange, #f59e0b)' : 'var(--text-primary)' }}>
                            {formatCurrency(yearData.childCosts || 0)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Total Annual Spending:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(yearData.expenses - (yearData.taxes || 0))}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Net Savings:</span>
                          <strong style={{ color: yearData.withdrawals > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                            {yearData.withdrawals > 0 ? `-${formatCurrency(yearData.withdrawals)}` : `+${formatCurrency(yearData.savings)}`}
                          </strong>
                        </div>
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

                    {/* Baseline Simulation Assumptions */}
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                        ⚙️ Baseline Assumptions (Screen 1)
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Current Age:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {inputs.currentAge}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Life Expectancy:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {inputs.lifeExpectancy}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Starting Savings:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(inputs.simpleInvestments)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Annual Income:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(inputs.simpleIncome)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Pre-Tax Savings Rate:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {simpleSavingsRate}%
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <span>Annual Savings:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
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




        </div>
      )}

      {/* Calculation Assumptions & Methodology Footer Section (Screen 2 Only, Collapsible) */}
      {activeStep === 2 && (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginTop: '2rem', textAlign: 'left' }}>
          <button
            type="button"
            className="collapsible-trigger-btn"
            onClick={() => setExpandedMethodology(!expandedMethodology)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              📝 Calculation Assumptions & Methodology
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{expandedMethodology ? 'Hide ▲' : 'Show Details ▼'}</span>
          </button>
          
          {expandedMethodology && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
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
                    💰 Social Security & PIA Formula
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    Calculates benefits dynamically from your simulated earnings history using the official-style formula:
                    <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
                      • <strong>Eligibility:</strong> Requires at least <strong>10 working years</strong> (earned income &gt; 0) to qualify; otherwise, benefits are $0.<br />
                      • <strong>AIME:</strong> Computes Average Indexed Monthly Earnings from your highest 35 earning years (padded with $0 if fewer) divided by 420 months.<br />
                      • <strong>PIA Bend Points (2026):</strong> Full retirement benefit (PIA) uses 2026 bend points: 90% of AIME up to $1,286 + 32% of AIME between $1,286 and $7,749 + 15% of AIME above $7,749.<br />
                      • <strong>Claiming Adjustments:</strong> FRA is 67. Claiming early (62–66) reduces benefit by 5/9% per month for the first 36 months and 5/12% per month thereafter (30% reduction at 62). Delaying (68–70) adds 8% per year (24% increase at 70).
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
                    ⚖️ Taxation & Early Withdrawal Penalties
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    Pre-tax withdrawals (Traditional 401k/IRA) are taxed as ordinary income. The engine simulates standard deductions and progressive federal income tax brackets (Single or Married Filing Jointly) adjusted annually for inflation. Additionally, a <strong>10% early withdrawal tax penalty</strong> is automatically enforced for all Traditional 401k/IRA drawdowns made before age <strong>59.5</strong>.
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    🏠 Home Ownership & Mortgage Rules
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    Models realistic homebuying and ownership cash flows:
                    <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
                      • <strong>Purchase Cash:</strong> Down payment + closing costs + points + renovation costs are deducted from liquid assets at the purchase age. If the down payment equals or exceeds the home price, it is treated as an all-cash purchase (no mortgage is created).<br />
                      • <strong>Mortgage P&I:</strong> Monthly Principal & Interest (P&I) is calculated using the standard amortization formula based on the loan amount (Home Price minus Down Payment), interest rate, and term.<br />
                      • <strong>Equity & Appreciation:</strong> Home value appreciates annually (default 3%), while the mortgage balance decreases over the loan term, increasing home equity.<br />
                      • <strong>Ongoing Costs:</strong> Property tax (default 1.1% of home value), homeowners insurance (default 0.35% of home value), and maintenance (default 1.0% of home value) scale with appreciated home value annually. HOA dues and utility increases are adjusted annually for inflation.<br />
                      • <strong>PMI & LTV Rules:</strong> If the down payment is less than 20% of the purchase price (initial Loan-to-Value, or LTV, ratio &gt; 80%), a Private Mortgage Insurance (PMI) fee (default 0.5% annually of the mortgage balance) is added to ongoing expenses. PMI automatically drops off once the outstanding mortgage balance falls to 80% or less of the original purchase price (LTV &le; 80%).<br />
                      • <strong>Home Sale:</strong> If a move-out age or sale year is configured, the property is sold, selling costs (default 6%) are deducted, the remaining mortgage is paid off, and net proceeds are added to brokerage assets. All homeownership expenses then cease.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editingEvent && renderEventForm(editingEvent)}
      {childImpactSummary && renderChildImpactModal()}
      {isBudgetModalOpen && renderBudgetModal()}
      {isSavingsDetailsOpen && renderSavingsDetailsModal()}
      {editingCondition && renderCurrentConditionModal()}

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
                const badgeStyle = getPaceBadgeStyles(scenario.savingsFocus);
                return (
                  <div 
                    key={scenario.type} 
                    className={`improvement-plan-card ${isBalanced ? 'improvement-plan-card-balanced' : ''} ${isBalanced ? 'improvement-plan-grid-balanced' : ''}`}
                  >
                    <div className="improvement-plan-card-main-content">
                      <div className="improvement-plan-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h4 className="improvement-plan-card-title" style={{ margin: 0 }}>
                          <span style={{ marginRight: '0.3rem' }}>{scenario.icon}</span>
                          <span>{scenario.title}</span>
                        </h4>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {isBalanced && (
                            <span className="improvement-plan-card-badge improvement-plan-card-badge-recommended" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)', letterSpacing: '0.05em' }}>
                              {scenario.badge}
                            </span>
                          )}
                          <span 
                            className="improvement-plan-card-badge" 
                            style={{ 
                              fontSize: '0.65rem', 
                              textTransform: 'uppercase', 
                              fontWeight: '800', 
                              padding: '0.15rem 0.45rem', 
                              borderRadius: '4px', 
                              letterSpacing: '0.05em',
                              background: badgeStyle.background,
                              color: badgeStyle.color,
                              border: badgeStyle.border
                            }}
                          >
                            {scenario.savingsFocus}
                          </span>
                        </div>
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

                    {scenario.isInfoOnly ? (
                      <button
                        type="button"
                        className="improvement-plan-card-apply-btn"
                        style={{ background: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        onClick={() => setShowImprovementModal(false)}
                      >
                        Got it
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="improvement-plan-card-apply-btn"
                        onClick={() => handleApplyImprovementScenario(scenario)}
                      >
                        Apply Scenario
                      </button>
                    )}
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
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: 'var(--bg-secondary, #1f2937)',
          borderLeft: '4px solid var(--accent-rose, #f43f5e)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
          color: 'var(--text-primary, #f3f4f6)',
          padding: '0.75rem 1.25rem',
          borderRadius: '0.375rem',
          zIndex: 9999,
          fontSize: '0.875rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚠️ {notification}
        </div>
      )}

    </div>
  );
}
