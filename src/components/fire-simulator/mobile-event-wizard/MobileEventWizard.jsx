import { useState, useMemo, useEffect } from 'react';
import { 
  Minus,
  Plus,
  Info
} from 'lucide-react';
import { formatCurrency } from '../helpers';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall,
  getSimulatedRetirementAge,
  calculateMaxAffordableHomePrice
} from '../houseAffordabilityUtils';
import { hasResolvedRecommendationTradeoffs } from '../../../features/fire/recommendations/recommendationUtils.js';

import { runFireSimulation } from '../../../fireCalculations';
import { generateChildRecommendations } from '../../../domain/events/child/childRecommendations';
import { getDefaultEvent } from '../../../features/fire/events/eventDefaults';

import {
  getStartAge,
  getEndAge,
  setStartAge,
  setEndAge,
  getWizardStepTitle,
  getEventFriendlyTitle,
  getPreviousStep
} from './mobileWizardUtils';

import WizardShell from './WizardShell';
import WizardStepHeader from './WizardStepHeader';
import EventTypeStep from './EventTypeStep';
import HouseWizardStep from './HouseWizardStep';
import ChildWizardStep from './ChildWizardStep';
import MarriageWizardStep from './MarriageWizardStep';
import DebtWizardStep from './DebtWizardStep';
import OtherEventWizardStep from './OtherEventWizardStep';
import RecommendationStep from './RecommendationStep';
import ReviewStep from './ReviewStep';

export default function MobileEventWizard({
  scenario,
  eventController,
  simulation,
  recommendationController,
  onClose,
  
  // Legacy support for direct mounts in unit/UI tests:
  inputs: legacyInputs,
  editingEvent: legacyEditingEvent,
  setEditingEvent: legacySetEditingEvent,
  handleSaveEvent: legacySaveEvent,
  handleDeleteEvent: legacyDeleteEvent,
  getInputsWithEvent: legacyGetInputsWithEvent,
  baselineResults: legacyBaselineResults,
  handleApplyMobileRecommendation: legacyHandleApplyMobileRecommendation,
  improvementPlan: legacyImprovementPlan,
  houseImpactSummary: legacyHouseImpactSummary,
  houseRebalanceSummary: legacyHouseRebalanceSummary,
  setHouseRebalanceSummary: legacySetHouseRebalanceSummary,
  handleApplyRebalanceStrategy: legacyHandleApplyRebalanceStrategy,
  setShowImprovementModal: legacySetShowImprovementModal
}) {
  const inputs = scenario?.inputs ?? legacyInputs;
  const getInputsWithEvent = scenario?.getInputsWithEvent ?? legacyGetInputsWithEvent;
  
  const editingEvent = eventController?.editingEvent ?? legacyEditingEvent;
  const setEditingEvent = eventController?.setEditingEvent ?? legacySetEditingEvent;
  const handleSaveEvent = eventController?.handleSaveEvent ?? legacySaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent ?? legacyDeleteEvent;
  const houseImpactSummary = eventController?.houseImpactSummary ?? legacyHouseImpactSummary;
  const houseRebalanceSummary = eventController?.houseRebalanceSummary ?? legacyHouseRebalanceSummary;
  const setHouseRebalanceSummary = eventController?.setHouseRebalanceSummary ?? legacySetHouseRebalanceSummary;

  const baselineResults = simulation?.baselineResults ?? legacyBaselineResults;

  const improvementPlan = recommendationController?.improvementPlan ?? legacyImprovementPlan;
  const handleApplyMobileRecommendation = recommendationController?.handleApplyMobileRecommendation ?? legacyHandleApplyMobileRecommendation;
  const handleApplyRebalanceStrategy = recommendationController?.handleApplyRebalanceStrategy ?? legacyHandleApplyRebalanceStrategy;
  const setShowImprovementModal = recommendationController?.setShowImprovementModal ?? legacySetShowImprovementModal;

  const isNew = !editingEvent || !!editingEvent.isNew || editingEvent.type === 'selectType';

  // Determine initial step
  const [step, setStep] = useState(() => {
    if (isNew) return 2; // Choose Event Type
    return 8; // Event Details / Manage page
  });

  const [showComparisons, setShowComparisons] = useState(false);
  const [outcomeDetails, setOutcomeDetails] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [timingMode, setTimingMode] = useState('age'); // 'age' | 'year'
  const [hasEndAge, setHasEndAge] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Local draft of editing event
  const [draftEvent, setDraftEvent] = useState(() => {
    if (editingEvent) {
      const isNewEvent = editingEvent.isNew !== false && (!editingEvent.id || editingEvent.isNew);
      return {
        ...editingEvent,
        isPriceTouched: !isNewEvent
      };
    }
    return { type: 'selectType', isNew: true };
  });

  // Sync draftEvent if editingEvent changes
  useEffect(() => {
    if (editingEvent) {
      const isNewEvent = editingEvent.isNew !== false && (!editingEvent.id || editingEvent.isNew);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftEvent({
        ...editingEvent,
        isPriceTouched: !isNewEvent
      });
      const startAge = getStartAge(editingEvent, inputs.currentAge);
      const endAge = getEndAge(editingEvent, inputs.currentAge, inputs.lifeEvents);
      if (endAge && endAge > startAge && endAge < (inputs.lifeExpectancy || 85)) {
        setHasEndAge(true);
      } else {
        setHasEndAge(false);
      }
    } else {
      setDraftEvent({ type: 'selectType', isNew: true });
      setHasEndAge(false);
    }
  }, [editingEvent, inputs.currentAge, inputs.lifeExpectancy, inputs.lifeEvents]);

  // Reset recommendationApplied if a new cash shortfall is created on mobile
  useEffect(() => {
    if (draftEvent && draftEvent.type === 'buyHouse' && draftEvent.recommendationApplied) {
      const purchaseAge = draftEvent.purchaseAge !== undefined ? draftEvent.purchaseAge : (draftEvent.age || 35);
      const simulationResults = baselineResults;
      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
      const totalCashRequired = calculateTotalCashRequired(draftEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      if (cashShortfall > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftEvent(prev => ({
          ...prev,
          recommendationApplied: false
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftEvent?.homePrice,
    draftEvent?.downPayment,
    draftEvent?.purchaseAge,
    draftEvent?.age,
    draftEvent?.recommendationApplied,
    inputs,
    baselineResults
  ]);

  const afterReadyAge = useMemo(() => {
    if (draftEvent?.type !== 'buyHouse') return null;
    return getSimulatedRetirementAge(inputs, draftEvent);
  }, [
    draftEvent,
    inputs
  ]);

  // Update specific fields of draft event
  const updateDraft = (key, val) => {
    setDraftEvent(prev => {
      const updated = { ...prev, [key]: val };
      if (key === 'homePrice') {
        updated.isPriceTouched = true;
      }
      return updated;
    });
  };

  // Auto-update home price in Mobile Wizard when purchase age changes, until user touches/edits the price
  useEffect(() => {
    if (draftEvent && draftEvent.type === 'buyHouse' && !draftEvent.isPriceTouched) {
      const aff = calculateMaxAffordableHomePrice(
        inputs,
        null,
        null,
        draftEvent,
        baselineResults
      );
      if (aff.recommendedPrice !== draftEvent.homePrice) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftEvent(prev => ({
          ...prev,
          homePrice: aff.recommendedPrice,
          downPayment: Math.round(aff.recommendedPrice * 0.20)
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftEvent?.purchaseAge,
    draftEvent?.age,
    draftEvent?.isPriceTouched,
    inputs,
    baselineResults
  ]);

  // Define event types meta
  const eventTypes = [
    { type: 'haveChild', label: 'Child / Adoption', category: 'Family', icon: '👶', popular: true },
    { type: 'marriage', label: 'Marriage / Partner', category: 'Family', icon: '💍', popular: true },
    
    { type: 'careerChange', label: 'Income Change', category: 'Career', icon: '💼', popular: true },
    { type: 'sabbatical', label: 'Sabbatical', category: 'Career', icon: '🌴', popular: false },
    
    { type: 'buyHouse', label: 'Home Purchase', category: 'Housing', icon: '🏠', popular: true },
    { type: 'sellHouse', label: 'Sell House', category: 'Housing', icon: '🏠', popular: false },
    { type: 'move', label: 'Move / Relocate', category: 'Housing', icon: '📍', popular: false },
    
    { type: 'studentLoan', label: 'Student Loan', category: 'Debt', icon: '🎓', popular: true },
    { type: 'creditCard', label: 'Credit Card', category: 'Debt', icon: '💳', popular: false },
    { type: 'carLoan', label: 'Auto Loan', category: 'Debt', icon: '🚗', popular: false },
    { type: 'personalLoan', label: 'Personal Loan', category: 'Debt', icon: '💸', popular: false },
    { type: 'debtPayoff', label: 'Debt Payoff', category: 'Debt', icon: '💸', popular: false },
    
    { type: 'college', label: 'College Tuition', category: 'Goals', icon: '🎓', popular: false },
    { type: 'windfall', label: 'Windfall / Inflow', category: 'Goals', icon: '💰', popular: false },
    { type: 'custom', label: 'Custom Goal', category: 'Goals', icon: '🎯', popular: true },
    
    { type: 'retire', label: 'Stop Working', category: 'Stop Working', icon: '🏖️', popular: true },
    { type: 'socialSecurity', label: 'Social Security', category: 'Stop Working', icon: '💰', popular: true },
    { type: 'pension', label: 'Pension Inflow', category: 'Stop Working', icon: '📜', popular: false },
    { type: 'rentalIncome', label: 'Rental Income', category: 'Stop Working', icon: '🏢', popular: false },
    { type: 'annuity', label: 'Annuity', category: 'Stop Working', icon: '📈', popular: false },
    { type: 'otherRetirementIncome', label: 'Other Income', category: 'Stop Working', icon: '💵', popular: false }
  ];

  // Initialize event with defaults
  const selectEventType = (type) => {
    if (type === 'haveChild') {
      const baseDefaults = getDefaultEvent('haveChild', { inputs, isMobile: true });
      setEditingEvent({ ...baseDefaults, isNew: true });
      return;
    }
    if (type === 'marriage') {
      const baseDefaults = getDefaultEvent('marriage', { inputs, isMobile: true });
      setEditingEvent({ ...baseDefaults, isNew: true });
      return;
    }
    if (type === 'careerChange') {
      const baseDefaults = getDefaultEvent('careerChange', { inputs, isMobile: true });
      setEditingEvent({ ...baseDefaults, isNew: true });
      return;
    }

    const preserveFields = draftEvent && (
      draftEvent.type === type || 
      (draftEvent.type === 'borrowing' && draftEvent.borrowingType === type)
    );

    let defaults;
    if (preserveFields) {
      defaults = { ...draftEvent, type: draftEvent.type, isNew: !draftEvent.id };
    } else {
      const baseDefaults = getDefaultEvent(type, { inputs, isMobile: true });
      defaults = { ...baseDefaults, isNew: true };
      if (type === 'buyHouse') {
        const aff = calculateMaxAffordableHomePrice(inputs, null, null, defaults, baselineResults);
        defaults.homePrice = aff.recommendedPrice;
        defaults.downPayment = Math.round(aff.recommendedPrice * 0.20);
        defaults.isPriceTouched = false;
      }
    }

    setDraftEvent(defaults);
    setStep(3); // Advance to Timing screen
  };

  // Run temp simulation and compile impact metrics
  const impactMetrics = useMemo(() => {
    if (step !== 5 || !getInputsWithEvent) return null;
    
    try {
      const { newInputs, savedEvent } = getInputsWithEvent(inputs, draftEvent);
      const tempResults = runFireSimulation(newInputs);
      
      const baselineAge = baselineResults?.retirementReadyAge ? baselineResults.retirementReadyAge : "Needs Adjustment";
      const tempAge = tempResults?.retirementReadyAge ? tempResults.retirementReadyAge : "Needs Adjustment";
      
      const getSavingsRate = (res) => {
        if (!res || !res.deflatedData) return 0;
        const curAge = inputs.currentAge || 35;
        const row = res.deflatedData.find(d => d.age === curAge);
        if (row && row.income > 0) {
          return Math.round((row.savings / row.income) * 100);
        }
        return 0;
      };
      
      const baselineSR = getSavingsRate(baselineResults);
      const tempSR = getSavingsRate(tempResults);
      
      const getNetWorthAt85 = (res) => {
        if (!res || !res.deflatedData) return 0;
        const rowAt85 = res.deflatedData.find(d => d.age === 85);
        if (rowAt85) return Math.round(rowAt85.netWorth);
        return Math.round(res.deflatedData[res.deflatedData.length - 1]?.netWorth || 0);
      };
      
      const baselineNW = getNetWorthAt85(baselineResults);
      const tempNW = getNetWorthAt85(tempResults);
      
      let annualCost = 0;
      const t = draftEvent.type;
      if (t === 'haveChild') {
        annualCost = Number(draftEvent.customAges0to4 || 15000);
      } else if (t === 'careerChange') {
        annualCost = -Number(draftEvent.amount || 0);
      } else if (t === 'buyHouse') {
        annualCost = Number(draftEvent.homePrice || 0) * 0.08;
      } else if (t === 'borrowing') {
        annualCost = Number(draftEvent.minPayment || 0) * 12;
      } else if (t === 'college') {
        annualCost = Number(draftEvent.tuitionCost || 0);
      } else if (t === 'custom') {
        annualCost = -Number(draftEvent.amount || 0);
      } else if (t === 'sabbatical') {
        annualCost = (Number(inputs.simpleIncome || 100000) * Number(draftEvent.incomeReduction || 100) / 100);
      } else if (t === 'windfall') {
        annualCost = -Number(draftEvent.amount || 0);
      } else if (t === 'socialSecurity' || t === 'pension' || t === 'rentalIncome') {
        annualCost = -Number(draftEvent.monthlyBenefit || 0) * 12;
      }
      
      let createdPhaseText = null;
      if (t === 'haveChild') {
        createdPhaseText = `👶 Childcare Years (Age ${getStartAge(draftEvent, inputs.currentAge)}–${getEndAge({ ...draftEvent, includeCollege: draftEvent.includeCollege }, inputs.currentAge, inputs.lifeEvents)})`;
      } else if (t === 'sabbatical') {
        createdPhaseText = `🌴 Sabbatical (Age ${draftEvent.startAge}–${draftEvent.endAge})`;
      } else if (t === 'buyHouse') {
        createdPhaseText = `🏠 Home Ownership (Age ${draftEvent.purchaseAge}+)`;
      } else if (t === 'marriage') {
        createdPhaseText = `💍 Married Life (Age ${draftEvent.age}+)`;
      } else if (t === 'retire') {
        createdPhaseText = `🏖️ Stopped Working (Age ${draftEvent.age}+)`;
      }
      
      return {
        annualCost,
        retirementAge: { before: baselineAge, after: tempAge },
        savingsRate: { before: baselineSR, after: tempSR },
        netWorth: { before: baselineNW, after: tempNW },
        createdPhase: createdPhaseText,
        savedEventObj: savedEvent
      };
    } catch (e) {
      console.error("Simulation error in impact preview:", e);
      return null;
    }
  }, [step, draftEvent, inputs, baselineResults, getInputsWithEvent]);

  // Handle Event Saving
  const onSave = () => {
    setEditingEvent(draftEvent);
    setTimeout(() => {
      handleSaveEvent(draftEvent);
      setStep(7);
    }, 50);
  };

  // Duplicate event
  const onDuplicate = () => {
    const copy = {
      ...draftEvent,
      id: undefined,
      name: draftEvent.name ? `${draftEvent.name} (Copy)` : undefined,
      childName: draftEvent.childName ? `${draftEvent.childName} (Copy)` : undefined,
      isNew: true
    };
    
    setEditingEvent(copy);
    setTimeout(() => {
      handleSaveEvent(copy);
      onClose();
    }, 50);
  };

  // Delete event
  const onDelete = () => {
    handleDeleteEvent(draftEvent);
    onClose();
  };

  // Search filter
  const filteredEventTypes = eventTypes.filter(e => 
    e.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startAgeVal = getStartAge(draftEvent, inputs.currentAge);
  const endAgeVal = getEndAge(draftEvent, inputs.currentAge, inputs.lifeEvents) || (startAgeVal + 5);

  const title = getWizardStepTitle(step, isNew);

  // Computed values for child recommendation flow (for RecommendationStep)
  const beforeAge = baselineResults?.retirementReadyAge !== undefined && baselineResults?.retirementReadyAge !== null ? baselineResults.retirementReadyAge : "Needs Adjustment";
  
  const newInputs = useMemo(() => {
    if (!getInputsWithEvent) return inputs;
    try {
      const res = getInputsWithEvent(inputs, draftEvent);
      return res?.newInputs || inputs;
    } catch {
      return inputs;
    }
  }, [getInputsWithEvent, inputs, draftEvent]);
  
  // Calculate child-specific recommendations locally
  const displayRankedPlan = useMemo(() => {
    if (draftEvent.type !== 'haveChild' || step !== 7) return [];
    const tempResults = runFireSimulation(newInputs);
    const afterAgeVal = tempResults?.retirementReadyAge ? tempResults.retirementReadyAge : "Needs Adjustment";
    const currentReadyAge = typeof afterAgeVal === 'number' ? afterAgeVal : null;
    const localRankedPlan = generateChildRecommendations(newInputs, currentReadyAge);

    const plan = [...localRankedPlan];
    if (improvementPlan?.rankedPlan) {
      improvementPlan.rankedPlan.forEach(p => {
        const isDuplicate = localRankedPlan.some(lp => lp.type === p.type);
        if (!isDuplicate) {
          plan.push(p);
        }
      });
    }
    return plan;
  }, [draftEvent.type, step, newInputs, improvementPlan]);

  const afterAge = useMemo(() => {
    if (step !== 7) return "Needs Adjustment";
    const tempResults = runFireSimulation(newInputs);
    return tempResults?.retirementReadyAge ? tempResults.retirementReadyAge : "Needs Adjustment";
  }, [step, newInputs]);

  // Compute CTA for Step 5 Impact Preview
  const ctaStep5 = useMemo(() => {
    let primaryCta = 'Next';
    let onPrimaryClick = onSave;

    if (draftEvent.type === 'buyHouse') {
      const needsReviewOptions = !hasResolvedRecommendationTradeoffs(draftEvent, inputs, baselineResults);

      const purchaseAge = draftEvent.purchaseAge !== undefined ? draftEvent.purchaseAge : (draftEvent.age || 35);
      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, baselineResults);
      const totalCashRequired = calculateTotalCashRequired(draftEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      const hasCashShortfall = cashShortfall > 0;

      const beforeReadyAge = baselineResults?.retirementReadyAge || inputs.targetRetirementAge || 65;
      const afterReadyAgeVal = afterReadyAge !== null && afterReadyAge !== undefined ? afterReadyAge : (inputs.targetRetirementAge || 65);
      const retirementDelayYears = Math.max(0, afterReadyAgeVal - beforeReadyAge);
      const hasRetirementDelay = retirementDelayYears > 0;

      if (hasCashShortfall) {
        if (draftEvent.recommendationApplied) {
          primaryCta = 'Save Home Purchase';
        } else {
          primaryCta = 'Review Options';
        }
      } else if (hasRetirementDelay) {
        primaryCta = 'Save & Adjust Retirement';
      } else {
        primaryCta = 'Save Home Purchase';
      }

      if (needsReviewOptions) {
        onPrimaryClick = () => {
          onSave();
        };
      }
    }

    return { primaryCta, onPrimaryClick };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEvent, inputs, baselineResults, afterReadyAge]);

  // Compute CTA for Step 6 Review / Save
  const ctaStep6 = useMemo(() => {
    let primaryCta = isNew ? 'Add to Plan' : 'Save Changes';
    let onPrimaryClick = onSave;

    if (draftEvent.type === 'buyHouse') {
      const needsReviewOptions = !hasResolvedRecommendationTradeoffs(draftEvent, inputs, baselineResults);

      const purchaseAge = draftEvent.purchaseAge !== undefined ? draftEvent.purchaseAge : (draftEvent.age || 35);
      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, baselineResults);
      const totalCashRequired = calculateTotalCashRequired(draftEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      const hasCashShortfall = cashShortfall > 0;

      const beforeReadyAge = baselineResults?.retirementReadyAge || inputs.targetRetirementAge || 65;
      const afterReadyAgeVal = afterReadyAge !== null && afterReadyAge !== undefined ? afterReadyAge : (inputs.targetRetirementAge || 65);
      const retirementDelayYears = Math.max(0, afterReadyAgeVal - beforeReadyAge);
      const hasRetirementDelay = retirementDelayYears > 0;

      if (hasCashShortfall) {
        if (draftEvent.recommendationApplied) {
          primaryCta = 'Save Home Purchase';
        } else {
          primaryCta = 'Review Options';
        }
      } else if (hasRetirementDelay) {
        primaryCta = 'Save & Adjust Retirement';
      } else {
        primaryCta = 'Save Home Purchase';
      }

      if (needsReviewOptions) {
        onPrimaryClick = () => {
          onSave();
        };
      }
    }

    return { primaryCta, onPrimaryClick };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEvent, inputs, baselineResults, isNew, afterReadyAge]);

  return (
    <WizardShell
      step={step}
      isNew={isNew}
      title={title}
      onBack={() => {
        const prev = getPreviousStep(step, isNew);
        setStep(prev);
      }}
      onClose={onClose}
    >
      {/* STEP 2: Choose Event Type */}
      {step === 2 && (
        <EventTypeStep
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFocused={searchFocused}
          setSearchFocused={setSearchFocused}
          eventTypes={eventTypes}
          selectEventType={selectEventType}
          filteredEventTypes={filteredEventTypes}
          inputs={inputs}
        />
      )}

      {/* STEP 3: Timing */}
      {step === 3 && (
        <div className="mobile-wizard-step-content animate-slide-up">
          <h3 className="mobile-wizard-title">When does this happen?</h3>

          {/* Age / Year Selector */}
          <div className="mobile-wizard-segmented-control">
            <button 
              type="button"
              className={`control-btn ${timingMode === 'age' ? 'active' : ''}`}
              onClick={() => setTimingMode('age')}
            >
              Age
            </button>
            <button 
              type="button"
              className={`control-btn ${timingMode === 'year' ? 'active' : ''}`}
              onClick={() => setTimingMode('year')}
            >
              Year
            </button>
          </div>

          {/* Start Age Picker */}
          <div className="mobile-wizard-picker-box">
            <span className="picker-label">
              {timingMode === 'age' ? 'At what age?' : 'In what year?'}
            </span>
            
            <div className="picker-value-display">
              <span className="picker-value">
                {timingMode === 'age' 
                  ? startAgeVal 
                  : (new Date().getFullYear() + (startAgeVal - (inputs.currentAge || 35)))
                }
              </span>
              <span className="picker-unit">
                {timingMode === 'age' ? 'years old' : 'calendar year'}
              </span>
            </div>

            <div className="picker-slider-row">
              <button 
                type="button" 
                className="slider-adjust-btn"
                onClick={() => {
                  const prev = Math.max(18, startAgeVal - 1);
                  setDraftEvent(setStartAge(draftEvent, prev));
                }}
              >
                <Minus size={16} />
              </button>
              
              <input 
                type="range" 
                min={18} 
                max={85} 
                value={startAgeVal}
                onChange={(e) => setDraftEvent(setStartAge(draftEvent, e.target.value))}
                className="mobile-wizard-slider"
              />
              
              <button 
                type="button" 
                className="slider-adjust-btn"
                onClick={() => {
                  const next = Math.min(85, startAgeVal + 1);
                  setDraftEvent(setStartAge(draftEvent, next));
                }}
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="slider-endpoints">
              <span>18</span>
              <span>85</span>
            </div>
          </div>

          {/* End Age toggle & picker (If applicable) */}
          {!['retire', 'socialSecurity', 'pension', 'rentalIncome', 'buyHouse', 'sellHouse', 'windfall', 'medicareEligibility', 'marriage'].includes(draftEvent.type) && (
            <div className="mobile-wizard-end-age-container">
              <div className="end-age-toggle-row">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Optional end age</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>For duration-based items</span>
                </div>
                
                <label className="mobile-switch">
                  <input 
                    type="checkbox" 
                    checked={hasEndAge}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasEndAge(checked);
                      if (checked) {
                        const end = Math.min(85, startAgeVal + 5);
                        setDraftEvent(setEndAge(draftEvent, end, inputs.currentAge));
                      } else {
                        const updated = { ...draftEvent };
                        delete updated.endAge;
                        setDraftEvent(updated);
                      }
                    }}
                  />
                  <span className="slider-round"></span>
                </label>
              </div>

              {hasEndAge && (
                <div className="mobile-wizard-picker-box" style={{ marginTop: '1.25rem' }}>
                  <span className="picker-label">At what end age?</span>
                  
                  <div className="picker-value-display">
                    <span className="picker-value">
                      {timingMode === 'age' 
                        ? Math.max(startAgeVal + 1, endAgeVal) 
                        : (new Date().getFullYear() + (Math.max(startAgeVal + 1, endAgeVal) - (inputs.currentAge || 35)))
                      }
                    </span>
                    <span className="picker-unit">years old</span>
                  </div>

                  <div className="picker-slider-row">
                    <button 
                      type="button" 
                      className="slider-adjust-btn"
                      onClick={() => {
                        const prev = Math.max(startAgeVal + 1, endAgeVal - 1);
                        setDraftEvent(setEndAge(draftEvent, prev, inputs.currentAge));
                      }}
                    >
                      <Minus size={16} />
                    </button>
                    
                    <input 
                      type="range" 
                      min={startAgeVal + 1} 
                      max={85} 
                      value={Math.max(startAgeVal + 1, endAgeVal)}
                      onChange={(e) => setDraftEvent(setEndAge(draftEvent, e.target.value, inputs.currentAge))}
                      className="mobile-wizard-slider"
                    />
                    
                    <button 
                      type="button" 
                      className="slider-adjust-btn"
                      onClick={() => {
                        const next = Math.min(85, endAgeVal + 1);
                        setDraftEvent(setEndAge(draftEvent, next, inputs.currentAge));
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  <div className="slider-endpoints">
                    <span>{startAgeVal + 1}</span>
                    <span>85</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Timeline Preview */}
          <div className="mobile-wizard-timeline-preview">
            <span className="preview-heading">Timeline Preview</span>
            <div className="preview-bar-row">
              <span className="preview-age-lbl">{startAgeVal}</span>
              <div className="preview-track">
                <div 
                  className="preview-filled-bar"
                  style={{
                    left: `${((startAgeVal - 18) / 67) * 100}%`,
                    width: hasEndAge 
                      ? `${((Math.max(1, endAgeVal - startAgeVal)) / 67) * 100}%` 
                      : '4px',
                    borderRadius: hasEndAge ? '4px' : '50%'
                  }}
                />
              </div>
              <span className="preview-age-lbl">
                {hasEndAge ? Math.max(startAgeVal + 1, endAgeVal) : 'Life'}
              </span>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: '600', marginTop: '0.4rem' }}>
              {hasEndAge 
                ? `Active for ${Math.max(1, endAgeVal - startAgeVal)} years`
                : 'Single point event'
              }
            </div>
          </div>

          {/* Next Button */}
          <div className="mobile-wizard-footer">
            <button 
              type="button" 
              className="mobile-wizard-btn-primary"
              onClick={() => setStep(4)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Custom Event-Specific Details Form */}
      {step === 4 && (
        <div className="mobile-wizard-step-content animate-slide-up">
          <WizardStepHeader
            draftEvent={draftEvent}
            startAgeVal={startAgeVal}
            endAgeVal={endAgeVal}
            hasEndAge={hasEndAge}
          />

          <h3 className="mobile-wizard-title" style={{ marginTop: 0 }}>Configure details</h3>

          <div className="mobile-wizard-form-fields">
            {draftEvent.type === 'haveChild' && (
              <ChildWizardStep
                draftEvent={draftEvent}
                setDraftEvent={setDraftEvent}
                updateDraft={updateDraft}
              />
            )}

            {draftEvent.type === 'buyHouse' && (
              <HouseWizardStep
                draftEvent={draftEvent}
                setDraftEvent={setDraftEvent}
                updateDraft={updateDraft}
                inputs={inputs}
                baselineResults={baselineResults}
                setShowImprovementModal={setShowImprovementModal}
                onClose={onClose}
              />
            )}

            {draftEvent.type === 'marriage' && (
              <MarriageWizardStep
                draftEvent={draftEvent}
                updateDraft={updateDraft}
              />
            )}

            {draftEvent.type === 'borrowing' && (
              <DebtWizardStep
                draftEvent={draftEvent}
                updateDraft={updateDraft}
              />
            )}

            {!['haveChild', 'buyHouse', 'marriage', 'borrowing'].includes(draftEvent.type) && (
              <OtherEventWizardStep
                draftEvent={draftEvent}
                setDraftEvent={setDraftEvent}
                updateDraft={updateDraft}
              />
            )}

            {/* Optional Notes */}
            <div className="form-group-item" style={{ marginTop: '1.25rem' }}>
              <label className="form-group-label">Notes (optional)</label>
              <textarea 
                value={draftEvent.notes || ''} 
                onChange={(e) => updateDraft('notes', e.target.value)} 
                className="mobile-wizard-textarea"
                placeholder="Include relevant details..."
                rows={3}
              />
            </div>
          </div>

          {/* Next Button */}
          <div className="mobile-wizard-footer">
            <button 
              type="button" 
              className="mobile-wizard-btn-primary"
              onClick={() => setStep(5)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Impact Preview */}
      {step === 5 && (
        <div className="mobile-wizard-step-content animate-slide-up">
          <h3 className="mobile-wizard-title">Here's how this affects your plan</h3>
          
          {impactMetrics ? (
            <div className="mobile-wizard-impact-metrics">
              
              {/* Summary row */}
              <div className="impact-main-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="impact-main-lbl">{getEventFriendlyTitle(draftEvent.type, draftEvent.borrowingType, draftEvent.name, draftEvent.childName)} Cost</span>
                  <strong className="impact-main-val">
                    {impactMetrics.annualCost > 0 
                      ? `+${formatCurrency(impactMetrics.annualCost)}/yr`
                      : `${formatCurrency(Math.abs(impactMetrics.annualCost))}/yr`
                    }
                  </strong>
                </div>
              </div>

              <h4 className="mobile-wizard-section-lbl" style={{ marginTop: '1.25rem' }}>Impact Metrics</h4>
              <div className="impact-grid">
                
                {/* Savings Rate Card */}
                <div className="impact-metric-card">
                  <span className="metric-lbl">Savings Rate</span>
                  <div className="metric-vals">
                    <span className="metric-before">{impactMetrics.savingsRate.before}%</span>
                    <span className="metric-arrow">→</span>
                    <span className={`metric-after ${
                      impactMetrics.savingsRate.after < impactMetrics.savingsRate.before ? 'negative' : 'positive'
                    }`}>{impactMetrics.savingsRate.after}%</span>
                  </div>
                </div>

                {/* Retirement Age Card */}
                <div className="impact-metric-card">
                  <span className="metric-lbl">Can Stop Working Age</span>
                  <div className="metric-vals">
                    <span className="metric-before">
                      {typeof impactMetrics.retirementAge.before === 'number' 
                        ? `Age ${impactMetrics.retirementAge.before}` 
                        : impactMetrics.retirementAge.before
                      }
                    </span>
                    <span className="metric-arrow">→</span>
                    <span className={`metric-after ${
                      impactMetrics.retirementAge.after === "Needs Adjustment" || 
                      (typeof impactMetrics.retirementAge.after === 'number' && 
                       typeof impactMetrics.retirementAge.before === 'number' && 
                       impactMetrics.retirementAge.after > impactMetrics.retirementAge.before)
                        ? 'negative' 
                        : 'positive'
                    }`}>
                      {typeof impactMetrics.retirementAge.after === 'number' 
                        ? `Age ${impactMetrics.retirementAge.after}` 
                        : impactMetrics.retirementAge.after
                      }
                    </span>
                  </div>
                </div>

                {/* Net Worth Card */}
                <div className="impact-metric-card" style={{ gridColumn: 'span 2' }}>
                  <span className="metric-lbl">Net Worth at Age 85</span>
                  <div className="metric-vals">
                    <span className="metric-before">{formatCurrency(impactMetrics.netWorth.before)}</span>
                    <span className="metric-arrow">→</span>
                    <span className={`metric-after ${
                      impactMetrics.netWorth.after < impactMetrics.netWorth.before ? 'negative' : 'positive'
                    }`}>{formatCurrency(impactMetrics.netWorth.after)}</span>
                  </div>
                </div>
              </div>

              {/* Phase Changes */}
              {impactMetrics.createdPhase && (
                <div className="impact-phase-creation-box">
                  <Info size={16} className="info-icon" />
                  <div className="phase-text-col">
                    <span className="phase-headline">This event creates a new budget phase</span>
                    <span className="phase-detail">{impactMetrics.createdPhase}</span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1.5rem', lineHeight: '1.4' }}>
                *These figures are derived from the core projection engine using your active configurations and lifestyle variables.
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
              <div className="mobile-loading-spinner" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>Recalculating plan impacts...</span>
            </div>
          )}

          {/* Next Button */}
          <div className="mobile-wizard-footer">
            <button 
              type="button" 
              className="mobile-wizard-btn-primary"
              onClick={ctaStep5.onPrimaryClick}
            >
              {ctaStep5.primaryCta}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Confirm Event */}
      {step === 6 && (
        <ReviewStep
          step={step}
          draftEvent={draftEvent}
          inputs={inputs}
          isNew={isNew}
          hasEndAge={hasEndAge}
          startAgeVal={startAgeVal}
          endAgeVal={endAgeVal}
          primaryCta={ctaStep6.primaryCta}
          onConfirm={ctaStep6.onPrimaryClick}
          onEdit={() => setStep(4)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={onClose}
        />
      )}

      {/* STEP 7: Event Added / Recommendation adjustments */}
      {step === 7 && (
        <RecommendationStep
          isNew={isNew}
          draftEvent={draftEvent}
          inputs={inputs}
          beforeAge={beforeAge}
          afterAge={afterAge}
          displayRankedPlan={displayRankedPlan}
          houseRebalanceSummary={houseRebalanceSummary}
          houseImpactSummary={houseImpactSummary}
          outcomeDetails={outcomeDetails}
          onSetOutcomeDetails={setOutcomeDetails}
          showComparisons={showComparisons}
          onSetShowComparisons={setShowComparisons}
          onApplyMobileRecommendation={(scenario) => {
            handleApplyMobileRecommendation(scenario);
            window.pulsePhaseId = 'childcare';
            onClose();
          }}
          onApplyRebalanceStrategy={(strategy) => {
            if (strategy === 'incomeBoost') {
              handleApplyRebalanceStrategy('incomeBoost');
              setDraftEvent(prev => ({
                ...prev,
                recommendationApplied: true,
                appliedRecommendationType: 'incomeBoost',
                appliedRecommendationAt: Date.now()
              }));
              setHouseRebalanceSummary(null);
              setStep(5);
            } else if (strategy === 'saveForDownPayment') {
              handleApplyRebalanceStrategy('saveForDownPayment');
              setDraftEvent(prev => ({
                ...prev,
                recommendationApplied: true,
                appliedRecommendationType: 'saveForDownPayment',
                appliedRecommendationAt: Date.now()
              }));
              setHouseRebalanceSummary(null);
              setStep(5);
            } else {
              handleApplyRebalanceStrategy(strategy);
            }
          }}
          onClose={onClose}
          onReviewAndSave={() => {
            setDraftEvent(prev => ({
              ...prev,
              homePrice: outcomeDetails.affordablePrice,
              downPayment: outcomeDetails.downPayment,
              recommendationApplied: true,
              appliedRecommendationType: 'updatePrice',
              appliedRecommendationAt: Date.now()
            }));
            setHouseRebalanceSummary(null);
            setOutcomeDetails(null);
            setStep(5);
          }}
          onDone={() => {
            if (draftEvent.type === 'haveChild') {
              window.pulsePhaseId = 'childcare';
            }
            setHouseRebalanceSummary(null);
            onClose();
          }}
        />
      )}

      {/* STEP 8: Manage Event details */}
      {step === 8 && (
        <ReviewStep
          step={step}
          draftEvent={draftEvent}
          inputs={inputs}
          isNew={isNew}
          hasEndAge={hasEndAge}
          startAgeVal={startAgeVal}
          endAgeVal={endAgeVal}
          onConfirm={undefined}
          onEdit={() => setStep(3)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={onClose}
        />
      )}
    </WizardShell>
  );
}
