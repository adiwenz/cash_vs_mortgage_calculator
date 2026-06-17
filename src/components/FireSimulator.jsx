/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Wallet, TrendingUp, Home, Target, User, ChevronRight } from 'lucide-react';
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
import { getActiveDebtsForAge } from '../calculators/fire/debts';
import './FireSimulator.css';

import MarriageWizard from './fire-simulator/MarriageWizard';
import ChildImpactModal, { ChildCostsBuckets } from './fire-simulator/ChildImpactModal';
import SavingsDetailsModal from './fire-simulator/SavingsDetailsModal';
import CurrentConditionsPanel, { CurrentConditionModal } from './fire-simulator/CurrentConditionsPanel';
import BudgetModal from './fire-simulator/BudgetModal';
import EventModalForm from './fire-simulator/EventModalForm';
import TodayScreen from './fire-simulator/TodayScreen';
import LifePlanScreen from './fire-simulator/LifePlanScreen';
import MobileFireSimulator from './fire-simulator/MobileFireSimulator';

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
  const [childImpactSummary, setChildImpactSummary] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null);
  const [budgetMonthlyIncome, setBudgetMonthlyIncome] = useState(4167);
  const [budgetMonthlySpending, setBudgetMonthlySpending] = useState(3542);
  const [budgetMonthlySavings, setBudgetMonthlySavings] = useState(625);
  const [expandedAdvancedDetail, setExpandedAdvancedDetail] = useState(false);
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
    
    const startingBorrowingSum = (inputs.lifeEvents || [])
      .filter(e => e.type === 'borrowing' && e.enabled && (e.timing === 'current' || (e.timing !== 'future' && (e.isExisting !== false || Number(e.startAge) === Number(inputs.currentAge)))))
      .reduce((sum, e) => sum + (Number(e.balance) || 0), 0);
    
    const houseAssets = inputs.houseAssets || [];
    const houseMortgagesSum = houseAssets.reduce((sum, h) => {
      if (h.hasMortgage && h.mortgage) {
        return sum + (Number(h.mortgage.balance) || 0);
      }
      return sum;
    }, 0);
    
    const startingDebt = baseActiveLoansSum + customDebtsSum + houseMortgagesSum + startingBorrowingSum;
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
    
    const startingBorrowingSum = (inputs.lifeEvents || [])
      .filter(e => e.type === 'borrowing' && e.enabled && (e.timing === 'current' || (e.timing !== 'future' && (e.isExisting !== false || Number(e.startAge) === Number(inputs.currentAge)))))
      .reduce((sum, e) => sum + (Number(e.balance) || 0), 0);
    
    const houseAssets = inputs.houseAssets || [];
    const houseMortgagesSum = houseAssets.reduce((sum, h) => {
      if (h.hasMortgage && h.mortgage) {
        return sum + (Number(h.mortgage.balance) || 0);
      }
      return sum;
    }, 0);
    
    const startingDebt = baseActiveLoansSum + customDebtsSum + houseMortgagesSum + startingBorrowingSum;
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
    const currentReadyAge = recResults.retirementReadyAge;

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

    const activePhaseObj = normPhases.find(p => currentAge >= p.startAge && currentAge < p.endAge) || normPhases[0];
    const activeDebts = getActiveDebtsForAge(inputs, currentAge);
    const activeDebtsTotal = activeDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const baseExpenses = Object.keys(activePhaseObj?.expenses || {}).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (activePhaseObj.expenses[v] || 0), 0);
    const activeSavings = activePhaseObj?.savingsAllocMode === 'percentSurplus' ? 0 : Object.values(activePhaseObj?.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const activeTaxes = inputs.includeTaxes ? Math.round(calculateUSTaxForModal(activePhaseObj?.income * 12 || 0, 0, inputs.filingStatus || 'single') / 12) : 0;
    const totalAllocated = baseExpenses + activeDebtsTotal + activeSavings + activeTaxes;
    const debtDeficit = Math.max(0, totalAllocated - (activePhaseObj?.income || 0));

    const hasShortfall = recResults.endingSurplusShortfall < 0 || 
                         !recResults.moneyLasts ||
                         (recResults.retirementReadyAge && inputs.targetRetirementAge < recResults.retirementReadyAge) ||
                         (hasChildcarePhase && unfundedMaxChildCostsMonthly > 0);

    const hasBuyHouse = (inputs.lifeEvents || []).some(e => e.type === 'buyHouse' && e.enabled);
    if (!hasShortfall && !hasBuyHouse && !(debtDeficit > 0)) return null;

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

    if (debtDeficit > 0 && activeDebts.length > 0) {
      list.push({
        type: 'startDebtPayoff',
        icon: '📈',
        title: 'Start a debt payoff plan',
        details: `Create a debt payoff plan to pay down your highest-interest debts faster and eliminate the deficit.`,
        bulletPoints: [
          `Add an extra monthly payment to accelerate your payoff timeline.`,
          `Once paid off, your Needs expenses will drop, increasing your future savings.`,
          `This helps you reach financial independence sooner.`
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: debtDeficit,
        savingsFocus: 'Debt Payoff',
        savingsEffortScore: 2,
        activeDebts
      });

      list.push({
        type: 'increaseDebtIncome',
        icon: '💰',
        title: `Increase income by $${debtDeficit}/month`,
        details: `Increase your monthly gross income by earning extra money to fully cover your new debt obligations.`,
        bulletPoints: [
          `Earn an extra $${debtDeficit}/month ($${debtDeficit * 12}/year) gross income.`,
          `This covers the monthly deficit without changing your savings or wants allocations.`,
          `Your retirement timeline remains fully on track.`
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: debtDeficit,
        savingsFocus: 'Earn More',
        savingsEffortScore: 1
      });

      list.push({
        type: 'reduceDiscretionary',
        icon: '💸',
        title: `Reduce discretionary spending by $${debtDeficit}/month`,
        details: `Reduce your wants budget categories (leisure, dining out, misc) by $${debtDeficit}/month to balance your budget.`,
        bulletPoints: [
          `Decrease leisure, dining out, and misc expenses by a combined $${debtDeficit}/month.`,
          `This eliminates the deficit using your existing income.`,
          `Your savings rate and retirement timeline are fully protected.`
        ],
        readyAge: currentReadyAge || targetRetirementAge,
        yearsImprovement: null,
        value: debtDeficit,
        savingsFocus: 'Reduce Wants',
        savingsEffortScore: 3
      });
    }

    return {
      showImprovementPlan: true,
      rankedPlan: list,
      currentReadyAge
    };
  }, [inputs]);

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
    } else if (scenario.type === 'startDebtPayoff') {
      // Handled during handleSaveBudget
    } else if (scenario.type === 'increaseDebtIncome') {
      // Handled during handleSaveBudget
    } else if (scenario.type === 'reduceDiscretionary') {
      if (targetExpensesMap) {
        let remainingReduction = scenario.value;
        const keysToReduce = ['leisure', 'diningOut', 'misc'];
        for (const key of keysToReduce) {
          if (targetExpensesMap[key] !== undefined && targetExpensesMap[key] > 0) {
            const reduceAmt = Math.min(targetExpensesMap[key], remainingReduction);
            targetExpensesMap[key] -= reduceAmt;
            remainingReduction -= reduceAmt;
            if (remainingReduction <= 0) break;
          }
        }
      }
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
          const spouseCatSpend = userNonHousingTotal > 0
            ? remainingToDistribute * ((Number(userExpenses[cat]) || 0) / userNonHousingTotal)
            : remainingToDistribute / nonHousingCats.length;
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
    
    // Reset redesign states (now handled by component mount/unmount in BudgetModal)
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

  const handleSaveBudget = (updatedDefaultTemplate) => {
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
      if (updatedDefaultTemplate) {
        newInputs.budgetDetails.defaultTemplate = updatedDefaultTemplate;
      }
      
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
        newInputs.simpleExpenses = Object.keys(currentPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (currentPhase.expenses[v] || 0), 0) * 12;
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
          const totalMonthlyExpenses = Object.keys(matchingPhase.expenses).filter(k => !k.startsWith('debt_')).reduce((sum, v) => sum + (matchingPhase.expenses[v] || 0), 0);
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
        } else if (scenario.type === 'startDebtPayoff') {
          const activeLoan = scenario.activeDebts.find(d => d.type !== 'mortgage');
          if (activeLoan) {
            const payoffId = `payoff-plan-auto-${Date.now()}`;
            const payoffEvent = {
              id: payoffId,
              type: 'payoffPlan',
              borrowingId: activeLoan.id,
              extraPayment: 100,
              startAge: currentAgeVal,
              linked: true,
              enabled: true,
              name: `Payoff Plan: ${activeLoan.name}`
            };
            newInputs.lifeEvents = [...(newInputs.lifeEvents || []), payoffEvent];
          }
        } else if (scenario.type === 'increaseDebtIncome') {
          const extraIncomeItem = {
            id: `debt-income-boost-${Date.now()}`,
            name: `Extra Income (to cover debt)`,
            amount: scenario.value * 12,
            frequency: 'yearly',
            startAge: currentAgeVal,
            endAge: targetRetAgeVal,
            growthRate: 0.03,
            isTaxable: true
          };
          newInputs.incomeList = [...(newInputs.incomeList || []), extraIncomeItem];
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
    } else if (['studentLoan', 'carLoan', 'personalLoan', 'creditCard'].includes(type)) {
      defaults = {
        ...defaults,
        type: 'borrowing',
        borrowingType: type,
        startAge: curAge,
        isExisting: true,
        timing: 'current',
        payoffPlanEnabled: true,
        notes: ''
      };
      
      if (type === 'studentLoan') {
        defaults.name = 'Student Loan';
        defaults.balance = 30000;
        defaults.interestRate = 5.0;
        defaults.minPayment = 318.20;
      } else if (type === 'carLoan') {
        defaults.name = 'Car Loan';
        defaults.purchasePrice = 25000;
        defaults.downPayment = 5000;
        defaults.balance = 20000;
        defaults.interestRate = 6.0;
        defaults.isExisting = false;
        defaults.timing = 'future';
        defaults.startAge = curAge + 1;
        defaults.minPayment = 386.66;
      } else if (type === 'personalLoan') {
        defaults.name = 'Personal Loan';
        defaults.balance = 10000;
        defaults.interestRate = 8.0;
        defaults.minPayment = 313.36;
      } else if (type === 'creditCard') {
        defaults.name = 'Credit Card Balance';
        defaults.balance = 5000;
        defaults.interestRate = 22.0;
        defaults.minPayment = 100;
      }
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

      } else if (type === 'borrowing') {
        const calculatePayoffAgeInline = (balance, apr, monthlyPayment, extraPayment, startAge) => {
          const r = (apr / 100) / 12;
          const pmt = monthlyPayment + extraPayment;
          if (balance <= 0) return startAge;
          if (pmt <= 0) return Infinity;
          if (pmt <= balance * r) return Infinity;
          if (r === 0) {
            return startAge + (balance / pmt) / 12;
          }
          const months = Math.log(pmt / (pmt - r * balance)) / Math.log(1 + r);
          return startAge + months / 12;
        };

        const borrowId = editingEvent.id && editingEvent.id.startsWith('borrowing-') ? editingEvent.id : `borrowing-${Date.now()}`;
        const newEventObj = {
          id: borrowId,
          type: 'borrowing',
          enabled: true,
          borrowingType: editingEvent.borrowingType,
          name: editingEvent.name || 'Borrowing',
          balance: Number(editingEvent.balance) || 0,
          interestRate: Number(editingEvent.interestRate) || 0,
          minPayment: Number(editingEvent.minPayment) || 0,
          startAge: editingEvent.timing === 'current' ? newInputs.currentAge : (Number(editingEvent.startAge) || (newInputs.currentAge + 1)),
          notes: editingEvent.notes || '',
          isExisting: editingEvent.timing === 'current',
          timing: editingEvent.timing || (editingEvent.isExisting !== false ? 'current' : 'future'),
          payoffPlanEnabled: !!editingEvent.payoffPlanEnabled
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== borrowId && e.id !== editingEvent.id);

        if (newEventObj.payoffPlanEnabled) {
          const existingPayoff = newInputs.lifeEvents.find(e => e.type === 'payoffPlan' && e.borrowingId === borrowId);
          const extraPmt = existingPayoff ? (Number(existingPayoff.extraPayment) || 0) : 100;
          const linkedVal = existingPayoff ? existingPayoff.linked !== false : true;

          const startAgeForPayoff = linkedVal ? newEventObj.startAge : (existingPayoff ? Number(existingPayoff.startAge) : newEventObj.startAge);
          const payoffAge = calculatePayoffAgeInline(newEventObj.balance, newEventObj.interestRate, newEventObj.minPayment, extraPmt, startAgeForPayoff);

          const payoffObj = {
            id: existingPayoff ? existingPayoff.id : `payoffPlan-${Date.now()}`,
            type: 'payoffPlan',
            enabled: true,
            name: `Payoff Plan: ${newEventObj.name}`,
            borrowingId: borrowId,
            linked: linkedVal,
            extraPayment: extraPmt,
            startAge: startAgeForPayoff,
            payoffAge: payoffAge,
            notes: existingPayoff ? existingPayoff.notes || '' : ''
          };

          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffObj.id && !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
          newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj, payoffObj];
        } else {
          newInputs.lifeEvents = newInputs.lifeEvents.filter(e => !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
          newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];
        }

        savedEvent = newEventObj;

      } else if (type === 'payoffPlan') {
        const calculatePayoffAgeInline = (balance, apr, monthlyPayment, extraPayment, startAge) => {
          const r = (apr / 100) / 12;
          const pmt = monthlyPayment + extraPayment;
          if (balance <= 0) return startAge;
          if (pmt <= 0) return Infinity;
          if (pmt <= balance * r) return Infinity;
          if (r === 0) {
            return startAge + (balance / pmt) / 12;
          }
          const months = Math.log(pmt / (pmt - r * balance)) / Math.log(1 + r);
          return startAge + months / 12;
        };

        const payoffId = editingEvent.id && editingEvent.id.startsWith('payoffPlan-') ? editingEvent.id : `payoffPlan-${Date.now()}`;
        const borrowing = newInputs.lifeEvents.find(b => b.id === editingEvent.borrowingId);
        
        let startAge = Number(editingEvent.startAge);
        if (editingEvent.linked !== false && borrowing) {
          startAge = Number(borrowing.startAge);
        }

        const balance = borrowing ? Number(borrowing.balance) || 0 : 0;
        const interestRate = borrowing ? Number(borrowing.interestRate) || 0 : 0;
        const minPayment = borrowing ? Number(borrowing.minPayment) || 0 : 0;
        const extraPayment = Number(editingEvent.extraPayment) || 0;

        let payoffAge = calculatePayoffAgeInline(balance, interestRate, minPayment, extraPayment, startAge);

        if (editingEvent.targetPayoffAge && editingEvent.targetPayoffAge > startAge) {
          payoffAge = Number(editingEvent.targetPayoffAge);
        }

        const newEventObj = {
          id: payoffId,
          type: 'payoffPlan',
          enabled: true,
          name: editingEvent.name || 'Payoff Plan',
          borrowingId: editingEvent.borrowingId,
          linked: editingEvent.linked !== false,
          extraPayment: extraPayment,
          startAge: startAge,
          payoffAge: payoffAge,
          targetPayoffAge: editingEvent.targetPayoffAge || null,
          notes: editingEvent.notes || ''
        };

        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffId && e.id !== editingEvent.id);
        newInputs.lifeEvents = [...newInputs.lifeEvents, newEventObj];

        savedEvent = newEventObj;

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
        if (matchEvent.type === 'borrowing') {
          newEvents = newEvents.filter(e => !(e.type === 'payoffPlan' && e.borrowingId === matchEvent.id));
        }
        if (matchEvent.type === 'payoffPlan') {
          newEvents = newEvents.map(e => {
            if (e.id === matchEvent.borrowingId && e.type === 'borrowing') {
              return { ...e, payoffPlanEnabled: false };
            }
            return e;
          });
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
      } else if (evt.type === 'borrowing') {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId && e.type === 'borrowing') {
            const updatedBorrowing = { ...e, startAge: newAge, age: newAge };
            return updatedBorrowing;
          }
          if (e.type === 'payoffPlan' && e.borrowingId === evt.originalId) {
            const updatedPayoff = { ...e };
            if (e.linked) {
              const shift = newAge - e.startAge;
              updatedPayoff.startAge = newAge;
              updatedPayoff.payoffAge = e.payoffAge + shift;
              if (updatedPayoff.targetPayoffAge) {
                updatedPayoff.targetPayoffAge = updatedPayoff.targetPayoffAge + shift;
              }
            }
            return updatedPayoff;
          }
          return e;
        });
      } else if (evt.type === 'payoffPlanEnd') {
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === evt.originalId && e.type === 'payoffPlan') {
            const updatedPayoff = { ...e };
            const borrowing = newInputs.lifeEvents.find(b => b.id === e.borrowingId);
            if (borrowing) {
              const startAge = borrowing.startAge !== undefined ? Number(borrowing.startAge) : newInputs.currentAge;
              const targetPayoffAge = Math.max(startAge + 1, newAge);
              updatedPayoff.payoffAge = targetPayoffAge;
              updatedPayoff.targetPayoffAge = targetPayoffAge;

              const r = (Number(borrowing.interestRate) || 0) / 100 / 12;
              const n = (targetPayoffAge - startAge) * 12;
              const balance = Number(borrowing.balance) || 0;
              const minPayment = Number(borrowing.minPayment) || 0;

              let requiredTotal = 0;
              if (n > 0) {
                if (r === 0) {
                  requiredTotal = balance / n;
                } else {
                  requiredTotal = (balance * r) / (1 - Math.pow(1 + r, -n));
                }
              }
              updatedPayoff.extraPayment = Math.max(0, requiredTotal - minPayment);
            }
            return updatedPayoff;
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
    const initialAge = typeof evt.age === 'number' && !isNaN(evt.age) ? evt.age : (inputs.currentAge || 35);

    let childEndOffset = 0;
    if (evt.type === 'haveChild') {
      const linkedEndEvent = timelineEvents.find(e => e.type === 'childSupportEnds' && String(e.childEventId) === String(evt.originalId));
      if (linkedEndEvent) {
        childEndOffset = linkedEndEvent.age - evt.age;
      } else {
        const lifeEv = inputs.lifeEvents?.find(e => e.id === evt.originalId);
        childEndOffset = lifeEv?.includeCollege ? 22 : 18;
      }
    }

    dragOccurredRef.current = false;

    // Initialize draggingInfo in state
    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX,
      childEndOffset
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
      } else if (evt.type === 'haveChild') {
        const offset = childEndOffset || 18;
        newAge = Math.max(minAge, Math.min(maxAge - offset, newAge));
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
      } else if (matchEvent.type === 'borrowing') {
        defaults = {
          ...defaults,
          borrowingType: matchEvent.borrowingType,
          name: matchEvent.name,
          balance: matchEvent.balance,
          interestRate: matchEvent.interestRate,
          minPayment: matchEvent.minPayment,
          startAge: matchEvent.startAge,
          notes: matchEvent.notes,
          isExisting: matchEvent.isExisting !== false,
          timing: matchEvent.timing || (matchEvent.isExisting !== false || Number(matchEvent.startAge) === inputs.currentAge ? 'current' : 'future'),
          payoffPlanEnabled: !!matchEvent.payoffPlanEnabled
        };
      } else if (matchEvent.type === 'payoffPlan') {
        defaults = {
          ...defaults,
          borrowingId: matchEvent.borrowingId,
          linked: matchEvent.linked !== false,
          extraPayment: matchEvent.extraPayment,
          startAge: matchEvent.startAge,
          payoffAge: matchEvent.payoffAge,
          targetPayoffAge: matchEvent.targetPayoffAge || null,
          notes: matchEvent.notes
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
        const age = Number(
          ev.purchaseAge !== undefined ? ev.purchaseAge :
          ev.birthAge !== undefined ? ev.birthAge :
          ev.parentAgeAtBirth !== undefined ? ev.parentAgeAtBirth :
          ev.startAge !== undefined ? ev.startAge :
          ev.claimingAge !== undefined ? ev.claimingAge :
          ev.ageReceived !== undefined ? ev.ageReceived :
          ev.transferAge !== undefined ? ev.transferAge :
          ev.age !== undefined ? ev.age :
          35
        );
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
            
            let currentValue = 0;
            let remainingMortgageBalance = 0;
            let netProceeds = 0;
            let yearsOwned = 0;
            
            if (asset) {
              const purchasePrice = Number(asset.purchasePrice || asset.homePrice || 0);
              const purchaseAge = Number(asset.purchaseAge || 40);
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
              const sellingCosts = currentValue * (sellingCostRate / 100);
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
                childEventId: ev.id,
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
          } else if (ev.type === 'borrowing') {
            events.push({
              originalId: ev.id,
              age,
              title: ev.name,
              label: ev.name,
              icon: ev.borrowingType === 'studentLoan' ? '🎓' : ev.borrowingType === 'carLoan' ? '🚗' : ev.borrowingType === 'personalLoan' ? '💸' : '💳',
              type: 'borrowing',
              description: `Took out a ${ev.name} of ${formatCurrency(ev.balance)} at ${ev.interestRate}% interest (min monthly payment: ${formatCurrency(ev.minPayment)}).`
            });
          } else if (ev.type === 'payoffPlan') {
            const payoffAge = Number(ev.payoffAge);
            if (payoffAge >= inp.currentAge && payoffAge <= inp.lifeExpectancy) {
              const borrowing = inp.lifeEvents.find(b => b.id === ev.borrowingId);
              const bName = borrowing ? borrowing.name : 'Borrowing';
              events.push({
                originalId: ev.id,
                age: payoffAge,
                title: `Payoff End: ${bName}`,
                label: `${bName} Paid Off`,
                icon: '🏁',
                type: 'payoffPlanEnd',
                description: `Payoff Plan for "${bName}" is scheduled to complete at age ${Math.round(payoffAge * 10) / 10}.`
              });
            }
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
      if (m.type === 'debtPayoff' && inp.lifeEvents.some(e => e.type === 'borrowing' && `${e.name} Paid Off` === m.label)) {
        return; // Skip duplicate payoff milestones for borrowing events
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

    const deduplicatedSorted = sorted.filter((evt, index) => {
      if (evt.type === 'lifestyle' || evt.type === 'career') {
        const hasPrimaryDuplicate = sorted.some((otherEvt, otherIndex) => {
          if (otherIndex === index) return false;
          if (otherEvt.age !== evt.age) return false;
          
          const isPrimary = ['haveChild', 'marriage', 'buyHouse', 'sellHouse', 'retire', 'college', 'sabbatical', 'windfall', 'assetTransfer'].includes(otherEvt.type);
          if (!isPrimary) return false;
          
          if (otherEvt.icon === evt.icon) return true;
          if (evt.icon === '👶' && otherEvt.type === 'haveChild') return true;
          if (evt.icon === '💍' && otherEvt.type === 'marriage') return true;
          if (evt.icon === '🏠' && (otherEvt.type === 'buyHouse' || otherEvt.type === 'sellHouse')) return true;
          if ((evt.icon === '🏖️' || evt.icon === '🏖') && otherEvt.type === 'retire') return true;
          
          return false;
        });
        if (hasPrimaryDuplicate) return false;
      }
      return true;
    });

    return deduplicatedSorted.map(evt => {
      let stackIndex;
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
  const todayLog = chartData[0] || { assets: 0, debt: 0, netWorth: 0 };
  const todayAssets = todayLog.assets || 0;
  const todayDebt = todayLog.debt || 0;
  const todayNetWorth = todayLog.netWorth !== undefined ? todayLog.netWorth : totalNetWorth;
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


  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  if (isMobile) {
    return (
      <>
        <MobileFireSimulator
          inputs={inputs}
          updateInput={updateInput}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          activeResults={activeResults}
          displayedResults={displayedResults}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          chartData={chartData}
          validation={validation}
          handleCreateEvent={handleCreateEvent}
          handleEditRoadmapEvent={handleEditRoadmapEvent}
          handleSetBudgetClick={handleSetBudgetClick}
          handleOpenSavingsDetails={handleOpenSavingsDetails}
          isMobile={isMobile}
          totalNetWorth={totalNetWorth}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          timelineEvents={timelineEvents}
          editingEvent={editingEvent}
          displayedBaselineResults={displayedBaselineResults}
          baselineResults={baselineResults}
        />
        
        {editingEvent && (
          <EventModalForm
            inputs={inputs}
            editingEvent={editingEvent}
            setEditingEvent={setEditingEvent}
            isFullPartnerProfileOpen={isFullPartnerProfileOpen}
            setIsFullPartnerProfileOpen={setIsFullPartnerProfileOpen}
            isZeroSpendingConfirmed={isZeroSpendingConfirmed}
            setIsZeroSpendingConfirmed={setIsZeroSpendingConfirmed}
            isPartnerZeroSpendingConfirmed={isPartnerZeroSpendingConfirmed}
            setIsPartnerZeroSpendingConfirmed={setIsPartnerZeroSpendingConfirmed}
            handleDeleteEvent={handleDeleteEvent}
            handleSaveEvent={handleSaveEvent}
            handleSetBudgetClick={handleSetBudgetClick}
            setIsBudgetOpenFromMarriageWizard={setIsBudgetOpenFromMarriageWizard}
            tempSocialSecurityDetails={tempSocialSecurityDetails}
          />
        )}
        <ChildImpactModal
          childImpactSummary={childImpactSummary}
          inputs={inputs}
          setChildImpactSummary={setChildImpactSummary}
          setEditingEvent={setEditingEvent}
          setShowImprovementModal={setShowImprovementModal}
        />
        {isBudgetModalOpen && (
          <BudgetModal
            inputs={inputs}
            isBudgetOpenFromMarriageWizard={isBudgetOpenFromMarriageWizard}
            editingEvent={editingEvent}
            budgetMonthlyIncome={budgetMonthlyIncome}
            setBudgetMonthlyIncome={setBudgetMonthlyIncome}
            budgetExpenses={budgetExpenses}
            setBudgetExpenses={setBudgetExpenses}
            budgetSavings={budgetSavings}
            setBudgetSavings={setBudgetSavings}
            budgetPartnerSavings={budgetPartnerSavings}
            setBudgetPartnerSavings={setBudgetPartnerSavings}
            activeBudgetPhase={activeBudgetPhase}
            handleSwitchBudgetPhase={handleSwitchBudgetPhase}
            savingsAllocMode={savingsAllocMode}
            handleToggleSavingsAllocMode={handleToggleSavingsAllocMode}
            budgetHsaCoverage={budgetHsaCoverage}
            setBudgetHsaCoverage={setBudgetHsaCoverage}
            budgetFilingStatus={budgetFilingStatus}
            setBudgetFilingStatus={setBudgetFilingStatus}
            budgetMonthlySpending={budgetMonthlySpending}
            setBudgetMonthlySpending={setBudgetMonthlySpending}
            budgetMonthlySavings={budgetMonthlySavings}
            setBudgetMonthlySavings={setBudgetMonthlySavings}
            pendingImprovement={pendingImprovement}
            handleCloseBudgetModal={handleCloseBudgetModal}
            handleSaveBudget={handleSaveBudget}
          />
        )}
        {isSavingsDetailsOpen && (
          <SavingsDetailsModal
            savingsDetails={savingsDetails}
            setSavingsDetails={setSavingsDetails}
            setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
            handleSaveSavingsDetails={handleSaveSavingsDetails}
          />
        )}
        <CurrentConditionModal
          editingCondition={editingCondition}
          inputs={inputs}
          setEditingCondition={setEditingCondition}
          handleSaveCurrentCondition={handleSaveCurrentCondition}
        />
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
      </>
    );
  }

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
        <TodayScreen
          inputs={inputs}
          handleStep1Change={handleStep1Change}
          handleSetBudgetClick={handleSetBudgetClick}
          handleOpenSavingsDetails={handleOpenSavingsDetails}
          lastNonZeroSavingsRateRef={lastNonZeroSavingsRateRef}
          todayAssets={todayAssets}
          todayDebt={todayDebt}
          todayNetWorth={todayNetWorth}
          setActiveStep={setActiveStep}
          displayedResults={displayedResults}
        />
      )}

      {activeStep === 2 && (
        <LifePlanScreen
          inputs={inputs}
          updateInput={updateInput}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          activeResults={activeResults}
          displayedResults={displayedResults}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          chartData={chartData}
          validation={validation}
          handleCreateEvent={handleCreateEvent}
          handleEditRoadmapEvent={handleEditRoadmapEvent}
          handleApplyImprovementScenario={handleApplyImprovementScenario}
          improvementPlan={improvementPlan}
          showImprovementModal={showImprovementModal}
          setShowImprovementModal={setShowImprovementModal}
          handleSetBudgetClick={handleSetBudgetClick}
          handleRemoveCurrentCondition={handleRemoveCurrentCondition}
          setEditingCondition={setEditingCondition}
          isMobile={isMobile}
          totalNetWorth={totalNetWorth}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          handleNodeDragStart={handleNodeDragStart}
          draggingInfo={draggingInfo}
          timelineEvents={timelineEvents}
          editingEvent={editingEvent}
          dragOccurredRef={dragOccurredRef}
      />
    )}

    {editingEvent && (
        <EventModalForm
          inputs={inputs}
          editingEvent={editingEvent}
          setEditingEvent={setEditingEvent}
          isFullPartnerProfileOpen={isFullPartnerProfileOpen}
          setIsFullPartnerProfileOpen={setIsFullPartnerProfileOpen}
          isZeroSpendingConfirmed={isZeroSpendingConfirmed}
          setIsZeroSpendingConfirmed={setIsZeroSpendingConfirmed}
          isPartnerZeroSpendingConfirmed={isPartnerZeroSpendingConfirmed}
          setIsPartnerZeroSpendingConfirmed={setIsPartnerZeroSpendingConfirmed}
          handleDeleteEvent={handleDeleteEvent}
          handleSaveEvent={handleSaveEvent}
          handleSetBudgetClick={handleSetBudgetClick}
          setIsBudgetOpenFromMarriageWizard={setIsBudgetOpenFromMarriageWizard}
          tempSocialSecurityDetails={tempSocialSecurityDetails}
        />
      )}
      <ChildImpactModal
        childImpactSummary={childImpactSummary}
        inputs={inputs}
        setChildImpactSummary={setChildImpactSummary}
        setEditingEvent={setEditingEvent}
        setShowImprovementModal={setShowImprovementModal}
      />
      {isBudgetModalOpen && (
        <BudgetModal
          inputs={inputs}
          isBudgetOpenFromMarriageWizard={isBudgetOpenFromMarriageWizard}
          editingEvent={editingEvent}
          budgetMonthlyIncome={budgetMonthlyIncome}
          setBudgetMonthlyIncome={setBudgetMonthlyIncome}
          budgetExpenses={budgetExpenses}
          setBudgetExpenses={setBudgetExpenses}
          budgetSavings={budgetSavings}
          setBudgetSavings={setBudgetSavings}
          budgetPartnerSavings={budgetPartnerSavings}
          setBudgetPartnerSavings={setBudgetPartnerSavings}
          activeBudgetPhase={activeBudgetPhase}
          handleSwitchBudgetPhase={handleSwitchBudgetPhase}
          savingsAllocMode={savingsAllocMode}
          handleToggleSavingsAllocMode={handleToggleSavingsAllocMode}
          budgetHsaCoverage={budgetHsaCoverage}
          setBudgetHsaCoverage={setBudgetHsaCoverage}
          budgetFilingStatus={budgetFilingStatus}
          setBudgetFilingStatus={setBudgetFilingStatus}
          budgetMonthlySpending={budgetMonthlySpending}
          setBudgetMonthlySpending={setBudgetMonthlySpending}
          budgetMonthlySavings={budgetMonthlySavings}
          setBudgetMonthlySavings={setBudgetMonthlySavings}
          pendingImprovement={pendingImprovement}
          handleCloseBudgetModal={handleCloseBudgetModal}
          handleSaveBudget={handleSaveBudget}
        />
      )}
      {isSavingsDetailsOpen && (
        <SavingsDetailsModal
          savingsDetails={savingsDetails}
          setSavingsDetails={setSavingsDetails}
          setIsSavingsDetailsOpen={setIsSavingsDetailsOpen}
          handleSaveSavingsDetails={handleSaveSavingsDetails}
        />
      )}
      <CurrentConditionModal
        editingCondition={editingCondition}
        inputs={inputs}
        setEditingCondition={setEditingCondition}
        handleSaveCurrentCondition={handleSaveCurrentCondition}
      />

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
