import { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  X, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  Info,
  Trash2, 
  Copy, 
  Edit
} from 'lucide-react';
import { formatCurrency } from './helpers';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall 
} from './houseAffordabilityUtils';
import { runFireSimulation } from '../../fireCalculations';
import { getChildCostOffsetRecommendations } from '../../recommendations';

export default function MobileEventWizard({
  inputs,
  editingEvent,
  setEditingEvent,
  handleSaveEvent,
  handleDeleteEvent,
  onClose,
  getInputsWithEvent, // Refactored function we'll add to FireSimulator
  baselineResults, // Simulation results before this event was added/modified
  handleApplyMobileRecommendation,
  improvementPlan,
  houseImpactSummary,
  setHouseImpactSummary,
  houseRebalanceSummary,
  setHouseRebalanceSummary,
  handleApplyRebalanceStrategy,
  setShowImprovementModal
}) {
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
    return editingEvent ? { ...editingEvent } : { type: 'selectType', isNew: true };
  });

  // Sync draftEvent if editingEvent changes
  useEffect(() => {
    if (editingEvent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftEvent({ ...editingEvent });
      const startAge = getStartAge(editingEvent);
      const endAge = getEndAge(editingEvent);
      if (endAge && endAge > startAge && endAge < (inputs.lifeExpectancy || 85)) {
        setHasEndAge(true);
      } else {
        setHasEndAge(false);
      }
    } else {
      setDraftEvent({ type: 'selectType', isNew: true });
      setHasEndAge(false);
    }
  }, [editingEvent]);

  // Helpers to get start and end age
  function getStartAge(evt) {
    if (!evt) return inputs.currentAge || 35;
    const val = evt.purchaseAge !== undefined ? evt.purchaseAge :
                evt.birthAge !== undefined ? evt.birthAge :
                evt.startAge !== undefined ? evt.startAge :
                evt.claimingAge !== undefined ? evt.claimingAge :
                evt.ageReceived !== undefined ? evt.ageReceived :
                evt.moveAge !== undefined ? evt.moveAge :
                evt.age !== undefined ? evt.age :
                (inputs.currentAge || 35);
    return Number(val);
  }

  function getEndAge(evt) {
    if (!evt) return null;
    if (evt.type === 'haveChild') {
      const maxAge = evt.includeCollege ? 22 : 18;
      const birth = evt.birthAge !== undefined ? evt.birthAge : (inputs.currentAge || 35);
      return birth + maxAge;
    }
    if (evt.type === 'borrowing') {
      // Find matching payoffPlan
      const payoff = inputs.lifeEvents?.find(e => e.type === 'payoffPlan' && e.borrowingId === evt.id);
      if (payoff) return Math.round(Number(payoff.payoffAge));
      return null;
    }
    return evt.endAge !== undefined ? Number(evt.endAge) : null;
  }

  function setStartAge(evt, age) {
    const updated = { ...evt };
    const numAge = Number(age);
    if (evt.purchaseAge !== undefined) updated.purchaseAge = numAge;
    else if (evt.birthAge !== undefined) updated.birthAge = numAge;
    else if (evt.startAge !== undefined) updated.startAge = numAge;
    else if (evt.claimingAge !== undefined) updated.claimingAge = numAge;
    else if (evt.ageReceived !== undefined) updated.ageReceived = numAge;
    else if (evt.moveAge !== undefined) updated.moveAge = numAge;
    else if (evt.age !== undefined) updated.age = numAge;
    else {
      updated.age = numAge;
    }
    return updated;
  }

  function setEndAge(evt, age) {
    const updated = { ...evt };
    const numAge = Number(age);
    if (evt.type === 'haveChild') {
      const start = getStartAge(evt);
      const diff = numAge - start;
      updated.includeCollege = diff >= 20;
    } else {
      updated.endAge = numAge;
    }
    return updated;
  }

  // Update specific fields of draft event
  const updateDraft = (key, val) => {
    setDraftEvent(prev => ({ ...prev, [key]: val }));
  };

  // Define event types meta
  const eventTypes = [
    { type: 'haveChild', label: 'Child / Adoption', category: 'Family', icon: '👶', popular: true },
    { type: 'marriage', label: 'Marriage / Partner', category: 'Family', icon: '💍', popular: true },
    
    { type: 'careerChange', label: 'Career Change', category: 'Career', icon: '💼', popular: true },
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
    
    { type: 'retire', label: 'Retirement', category: 'Retirement', icon: '🏖️', popular: true },
    { type: 'socialSecurity', label: 'Social Security', category: 'Retirement', icon: '💰', popular: true },
    { type: 'pension', label: 'Pension Inflow', category: 'Retirement', icon: '📜', popular: false },
    { type: 'rentalIncome', label: 'Rental Income', category: 'Retirement', icon: '🏢', popular: false }
  ];

  // Initialize event with defaults
  const selectEventType = (type) => {
    const preserveFields = draftEvent && (
      draftEvent.type === type || 
      (draftEvent.type === 'borrowing' && draftEvent.borrowingType === type)
    );

    let defaults;
    if (preserveFields) {
      defaults = { ...draftEvent, type: draftEvent.type, isNew: !draftEvent.id };
    } else {
      defaults = { type, isNew: true };
      const curAge = inputs.currentAge || 35;
      
      if (type === 'buyHouse') {
        defaults = {
          ...defaults,
          purchaseAge: Math.min(85, curAge + 5),
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
          utilitiesIncrease: 0,
          appreciationRate: 3,
          sellingCost: 6,
          currentRent: 0,
          rentGrowth: 3,
          renterInsurance: 0,
          investmentReturn: 7,
          inflation: 3
        };
      } else if (type === 'haveChild') {
        defaults = {
          ...defaults,
          childName: 'Child',
          childStartAge: 0,
          birthAge: curAge,
          costMethod: 'default',
          customAges0to4: 15000,
          customAges5to12: 9000,
          customAges13to18: 12000,
          customAges19to22: 20000,
          includeCollege: false
        };
      } else if (type === 'careerChange') {
      defaults = { 
        ...defaults, 
        name: 'Senior Role', 
        startAge: Math.min(85, curAge + 3), 
        amount: 150000, 
        growthRate: 3.5 
      };
    } else if (type === 'sabbatical') {
      defaults = {
        ...defaults,
        name: 'Sabbatical',
        startAge: Math.min(85, curAge + 5),
        endAge: Math.min(85, curAge + 6),
        incomeReduction: 100,
        spendingAdjustment: 0
      };
    } else if (type === 'move') {
      defaults = { 
        ...defaults, 
        location: 'New City', 
        moveAge: Math.min(85, curAge + 5), 
        newSpending: 40000,
        movingCost: 0
      };
    } else if (type === 'retire') {
      defaults = { 
        ...defaults, 
        age: 55, 
        spendingPercent: 70 
      };
    } else if (type === 'windfall') {
      defaults = { 
        ...defaults, 
        ageReceived: Math.min(85, curAge + 10), 
        amount: 100000, 
        taxRate: 15 
      };
    } else if (type === 'college') {
      defaults = { 
        ...defaults, 
        startAge: Math.min(85, curAge + 13), 
        tuitionCost: 30000, 
        duration: 4 
      };
    } else if (type === 'debtPayoff') {
      defaults = { 
        ...defaults, 
        payoffAge: Math.min(85, curAge + 3), 
        amount: 5000 
      };
    } else if (type === 'custom') {
      defaults = { 
        ...defaults, 
        name: 'Custom Goal', 
        age: Math.min(85, curAge + 5), 
        amount: -15000 
      };
    } else if (type === 'socialSecurity') {
      defaults = { 
        ...defaults, 
        claimingAge: 67, 
        monthlyBenefit: 2000, 
        inflationAdjusted: true, 
        name: 'Social Security', 
        ageStartedWorking: 22 
      };
    } else if (['pension', 'rentalIncome'].includes(type)) {
      defaults = { 
        ...defaults, 
        claimingAge: 60, 
        monthlyBenefit: 1500, 
        inflationAdjusted: true, 
        name: type === 'pension' ? 'Pension' : 'Rental Income' 
      };
    } else if (type === 'marriage') {
      const userIncome = Number(inputs.simpleIncome) || 50000;
      const userSavingsRate = Number(inputs.preTaxSavingsRate) || 15;
      defaults = {
        ...defaults,
        age: curAge,
        spouseIncome: userIncome,
        incomeGrowthRate: 3,
        cash: 0,
        investments: 0,
        retirement: 0,
        debtStudent: 0,
        debtCredit: 0,
        debtOther: 0,
        savingsRate: userSavingsRate,
        housingOption: 'move',
        housingSavings: 0,
        housingCost: 0,
        lifestyleOption: 'same',
        lifestyleAdjustment: 0,
        includeWeddingCost: false,
        weddingCost: 20000,
        weddingFundingMethod: 'savings',
        weddingAge: curAge,
        filingStatus: 'jointly',
        spouseCurrentAge: curAge,
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
        defaults.name = 'Credit Card';
        defaults.balance = 5000;
        defaults.interestRate = 22.0;
        defaults.minPayment = 100;
      }
    }
  }

  setDraftEvent(defaults);
  setStep(3); // Advance to Timing screen
  };

  // Run temp simulation and compile impact metrics
  const impactMetrics = useMemo(() => {
    if (step !== 5 || !getInputsWithEvent) return null;
    
    try {
      // 1. Get inputs with the draft event applied
      const { newInputs, savedEvent } = getInputsWithEvent(inputs, draftEvent);
      
      // 2. Run simulation on the new inputs
      const tempResults = runFireSimulation(newInputs);
      
      // 3. Extract baseline metrics
      const baselineAge = baselineResults?.retirementReadyAge ? baselineResults.retirementReadyAge : "Needs Adjustment";
      const tempAge = tempResults?.retirementReadyAge ? tempResults.retirementReadyAge : "Needs Adjustment";
      
      // Compute savings rate
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
      
      // Compute net worth at 85
      const getNetWorthAt85 = (res) => {
        if (!res || !res.deflatedData) return 0;
        const rowAt85 = res.deflatedData.find(d => d.age === 85);
        if (rowAt85) return Math.round(rowAt85.netWorth);
        return Math.round(res.deflatedData[res.deflatedData.length - 1]?.netWorth || 0);
      };
      
      const baselineNW = getNetWorthAt85(baselineResults);
      const tempNW = getNetWorthAt85(tempResults);
      
      // Compute annual cost
      let annualCost = 0;
      const t = draftEvent.type;
      if (t === 'haveChild') {
        annualCost = Number(draftEvent.customAges0to4 || 15000);
      } else if (t === 'careerChange') {
        annualCost = -Number(draftEvent.amount || 0); // Negative indicates income boost
      } else if (t === 'buyHouse') {
        annualCost = Number(draftEvent.homePrice || 0) * 0.08; // Roughly 8% annual housing cost estimate
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
      
      // Check if it creates a budget phase
      let createdPhaseText = null;
      if (t === 'haveChild') {
        createdPhaseText = `👶 Childcare Years (Age ${getStartAge(draftEvent)}–${getEndAge({ ...draftEvent, includeCollege: draftEvent.includeCollege })})`;
      } else if (t === 'sabbatical') {
        createdPhaseText = `🌴 Sabbatical (Age ${draftEvent.startAge}–${draftEvent.endAge})`;
      } else if (t === 'buyHouse') {
        createdPhaseText = `🏠 Home Ownership (Age ${draftEvent.purchaseAge}+)`;
      } else if (t === 'marriage') {
        createdPhaseText = `💍 Married Life (Age ${draftEvent.age}+)`;
      } else if (t === 'retire') {
        createdPhaseText = `🏖️ Retired (Age ${draftEvent.age}+)`;
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
      id: undefined, // remove ID to create a new one
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

  const startAgeVal = getStartAge(draftEvent);
  const endAgeVal = getEndAge(draftEvent) || (startAgeVal + 5);
  const getEventNameDisplay = () => {
    if (!draftEvent.type) return 'Life Event';
    if (draftEvent.type === 'haveChild' && draftEvent.childName) {
      return `Child: ${draftEvent.childName}`;
    }
    if (draftEvent.name) return draftEvent.name;
    const found = eventTypes.find(e => e.type === draftEvent.type || (draftEvent.borrowingType && e.type === draftEvent.borrowingType));
    return found ? found.label : 'Life Event';
  };

  const getEventIcon = () => {
    if (draftEvent.type === 'borrowing') {
      if (draftEvent.borrowingType === 'studentLoan') return '🎓';
      if (draftEvent.borrowingType === 'carLoan') return '🚗';
      if (draftEvent.borrowingType === 'personalLoan') return '💸';
      return '💳';
    }
    const found = eventTypes.find(e => e.type === draftEvent.type);
    return found ? found.icon : '🎯';
  };

  return (
    <div className="mobile-wizard-backdrop">
      <div className="mobile-wizard-container">
        
        {/* HEADER */}
        <header className="mobile-wizard-header">
          {step > 2 && step !== 7 ? (
            <button type="button" className="mobile-wizard-header-btn" onClick={() => {
              if (step === 8) onClose();
              else if (step === 3 && isNew) setStep(2);
              else if (step === 3 && !isNew) setStep(8);
              else setStep(step - 1);
            }}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <button type="button" className="mobile-wizard-header-btn" onClick={onClose}>
              <X size={22} />
            </button>
          )}
          
          <h2 className="mobile-wizard-header-title">
            {step === 8 ? 'Event Details' : isNew ? 'Add Life Event' : 'Edit Event'}
          </h2>
          
          <div style={{ width: '40px' }} /> {/* Spacer */}
        </header>

        {/* BODY */}
        <main className="mobile-wizard-body">
          
          {/* STEP 2: Choose Event Type */}
          {step === 2 && (
            <div className="mobile-wizard-step-content animate-slide-up">
              <h3 className="mobile-wizard-title">What would you like to plan?</h3>
              
              {/* Search Bar */}
              <div className={`mobile-wizard-search-container ${searchFocused ? 'focused' : ''}`}>
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  className="mobile-wizard-search-input" 
                  placeholder="Search events..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>

              {searchQuery === '' && (
                <>
                  {/* Popular Events Section */}
                  <h4 className="mobile-wizard-section-lbl">Popular Events</h4>
                  <div className="mobile-wizard-list">
                    {eventTypes.filter(e => e.popular).map((item) => (
                      <button 
                        key={item.type} 
                        type="button" 
                        className="mobile-wizard-list-item"
                        onClick={() => selectEventType(item.type)}
                      >
                        <span className="item-icon">{item.icon}</span>
                        <span className="item-label">{item.label}</span>
                        <span className="item-arrow">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {searchQuery !== '' && (
                <div className="mobile-wizard-list" style={{ marginTop: '1rem' }}>
                  {filteredEventTypes.map((item) => (
                    <button 
                      key={item.type} 
                      type="button" 
                      className="mobile-wizard-list-item"
                      onClick={() => selectEventType(item.type)}
                    >
                      <span className="item-icon">{item.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span className="item-label">{item.label}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{item.category}</span>
                      </div>
                      <span className="item-arrow">→</span>
                    </button>
                  ))}
                  {filteredEventTypes.length === 0 && (
                    <div className="mobile-wizard-no-results">
                      No matching events found. Try search keywords like "Child", "Job", "House", "Loan".
                    </div>
                  )}
                </div>
              )}

              {searchQuery === '' && (
                <>
                  {/* Categories Sections */}
                  {['Family', 'Career', 'Housing', 'Debt', 'Goals', 'Retirement'].map((cat) => {
                    const catItems = eventTypes.filter(e => e.category === cat && !e.popular);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat} style={{ marginTop: '1.25rem' }}>
                        <h4 className="mobile-wizard-section-lbl">{cat}</h4>
                        <div className="mobile-wizard-list">
                          {catItems.map((item) => (
                            <button 
                              key={item.type} 
                              type="button" 
                              className="mobile-wizard-list-item"
                              onClick={() => selectEventType(item.type)}
                            >
                              <span className="item-icon">{item.icon}</span>
                              <span className="item-label">{item.label}</span>
                              <span className="item-arrow">→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* STEP 3: Timing (When does this happen?) */}
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
                            setDraftEvent(setEndAge(draftEvent, end));
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
                            setDraftEvent(setEndAge(draftEvent, prev));
                          }}
                        >
                          <Minus size={16} />
                        </button>
                        
                        <input 
                          type="range" 
                          min={startAgeVal + 1} 
                          max={85} 
                          value={Math.max(startAgeVal + 1, endAgeVal)}
                          onChange={(e) => setDraftEvent(setEndAge(draftEvent, e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        
                        <button 
                          type="button" 
                          className="slider-adjust-btn"
                          onClick={() => {
                            const next = Math.min(85, endAgeVal + 1);
                            setDraftEvent(setEndAge(draftEvent, next));
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
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{getEventIcon()}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>{getEventNameDisplay()}</h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Active Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}
                  </span>
                </div>
              </div>

              <h3 className="mobile-wizard-title" style={{ marginTop: 0 }}>Configure details</h3>

              {/* Event Specific Form Renderers */}
              <div className="mobile-wizard-form-fields">
                
                {/* 1. HAVE CHILD */}
                {draftEvent.type === 'haveChild' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Child Name</label>
                      <input 
                        type="text" 
                        value={draftEvent.childName || ''} 
                        onChange={(e) => updateDraft('childName', e.target.value)} 
                        className="mobile-wizard-input-text"
                        placeholder="Child name"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">How many children?</label>
                      <div className="counter-row">
                        <button 
                          type="button" 
                          className="counter-btn"
                          disabled={Number(draftEvent.childCount || 1) <= 1}
                          onClick={() => updateDraft('childCount', Math.max(1, Number(draftEvent.childCount || 1) - 1))}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="counter-val">{draftEvent.childCount || 1}</span>
                        <button 
                          type="button" 
                          className="counter-btn"
                          onClick={() => updateDraft('childCount', Number(draftEvent.childCount || 1) + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Annual cost per child</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={0} 
                          max={50000} 
                          step={1000} 
                          value={draftEvent.customAges0to4 || 15000}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDraftEvent(prev => ({
                              ...prev,
                              customAges0to4: val,
                              customAges5to12: Math.round(val * 0.6),
                              customAges13to18: Math.round(val * 0.8),
                              customAges19to22: Math.round(val * 1.33)
                            }));
                          }}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {formatCurrency(draftEvent.customAges0to4 || 15000)}/yr
                        </div>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <div className="toggle-row-item">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.8rem' }}>Include college tuition?</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Adds expenses from ages 19–22</span>
                        </div>
                        <label className="mobile-switch">
                          <input 
                            type="checkbox" 
                            checked={!!draftEvent.includeCollege}
                            onChange={(e) => updateDraft('includeCollege', e.target.checked)}
                          />
                          <span className="slider-round"></span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. CAREER CHANGE */}
                {draftEvent.type === 'careerChange' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">New Title / Job Name</label>
                      <input 
                        type="text" 
                        value={draftEvent.name || ''} 
                        onChange={(e) => updateDraft('name', e.target.value)} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">New Annual Salary</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={30000} 
                          max={300000} 
                          step={5000} 
                          value={draftEvent.amount || 150000}
                          onChange={(e) => updateDraft('amount', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {formatCurrency(draftEvent.amount || 150000)}/yr
                        </div>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Salary Growth Rate (Raises)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={0} 
                          max={10} 
                          step={0.5} 
                          value={draftEvent.growthRate || 3.5}
                          onChange={(e) => updateDraft('growthRate', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {(draftEvent.growthRate || 3.5)}%
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. BORROWING (Student loan, auto loan, etc.) */}
                {draftEvent.type === 'borrowing' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Loan Name</label>
                      <input 
                        type="text" 
                        value={draftEvent.name || ''} 
                        onChange={(e) => updateDraft('name', e.target.value)} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Loan Balance</label>
                      <input 
                        type="number" 
                        value={draftEvent.balance || 0} 
                        onChange={(e) => updateDraft('balance', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Interest Rate</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={0} 
                          max={30} 
                          step={0.1} 
                          value={draftEvent.interestRate || 5}
                          onChange={(e) => updateDraft('interestRate', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {(draftEvent.interestRate || 5)}%
                        </div>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Monthly Minimum Payment</label>
                      <input 
                        type="number" 
                        value={draftEvent.minPayment || 0} 
                        onChange={(e) => updateDraft('minPayment', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <div className="toggle-row-item">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.8rem' }}>Set up payoff plan?</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Auto-deducts until balance reaches $0</span>
                        </div>
                        <label className="mobile-switch">
                          <input 
                            type="checkbox" 
                            checked={!!draftEvent.payoffPlanEnabled}
                            onChange={(e) => updateDraft('payoffPlanEnabled', e.target.checked)}
                          />
                          <span className="slider-round"></span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. BUY HOUSE */}
                {draftEvent.type === 'buyHouse' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Home Price</label>
                      <input 
                        type="number" 
                        value={draftEvent.homePrice || 500000} 
                        onChange={(e) => {
                          const p = Number(e.target.value) || 0;
                          setDraftEvent(prev => {
                            const pct = prev.homePrice > 0 ? (prev.downPayment / prev.homePrice) : 0.20;
                            return {
                              ...prev,
                              homePrice: p,
                              downPayment: Math.round(p * pct)
                            };
                          });
                        }} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Down Payment (%)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={0} 
                          max={100} 
                          step={1} 
                          value={draftEvent.homePrice > 0 ? Math.round(((draftEvent.downPayment || 0) / draftEvent.homePrice) * 100) : 20}
                          onChange={(e) => updateDraft('downPayment', Math.round((draftEvent.homePrice || 0) * (Number(e.target.value) / 100)))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {draftEvent.homePrice > 0 ? Math.round(((draftEvent.downPayment || 0) / draftEvent.homePrice) * 100) : 20}% ({formatCurrency(draftEvent.downPayment || 0)})
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const purchaseAge = draftEvent.purchaseAge !== undefined ? draftEvent.purchaseAge : (draftEvent.age || 35);
                      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, baselineResults);
                      const totalCashRequired = calculateTotalCashRequired(draftEvent);

                      let projectionsAvailable = false;
                      if (baselineResults && (baselineResults.nominalData || baselineResults.data)) {
                        const logs = baselineResults.nominalData || baselineResults.data;
                        const logBefore = logs.find(l => l.age === purchaseAge - 1);
                        if (logBefore) {
                          projectionsAvailable = true;
                        }
                      }

                      if (totalCashRequired > liquidAssets) {
                        const shortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
                        return (
                          <div style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: '#f59e0b',
                            padding: '0.85rem',
                            borderRadius: '6px',
                            borderLeft: '4px solid #f59e0b',
                            fontSize: '0.85rem',
                            lineHeight: '1.45',
                            marginTop: '0.25rem',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                          }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>⚠️</span> Not Enough Liquid Assets
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
                                <span>Total cash required:</span>
                                <strong>{formatCurrency(totalCashRequired)}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
                                <span>Projected liquid assets at age {purchaseAge}:</span>
                                <strong>{formatCurrency(liquidAssets)}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0', borderTop: '1px dashed rgba(245, 158, 11, 0.2)', paddingTop: '0.25rem' }}>
                                <span>Additional cash needed:</span>
                                <strong>{formatCurrency(shortfall)}</strong>
                              </div>
                            </div>
                            {!projectionsAvailable && (
                              <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.85 }}>
                                Using current liquid assets.
                              </div>
                            )}
                            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>
                              Liquid assets include cash and taxable brokerage accounts. Retirement accounts are excluded to avoid taxes and withdrawal penalties.
                            </div>
                            {setShowImprovementModal && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowImprovementModal(true);
                                  onClose();
                                  setTimeout(() => {
                                    const housingTypes = [
                                      'reduceHomePrice', 'increaseDownPayment', 'delayHomePurchase', 'increaseHomeIncome',
                                      'redirectSavingsDownPayment', 'pauseNonRetirementSavings', 'redirectBrokerageHouseFund',
                                      'increaseDownPaymentIncome', 'delayHomePurchaseDownPayment', 'purchaseWithPartner',
                                      'purchaseWithRoommate'
                                    ];
                                    for (const type of housingTypes) {
                                      const el = document.getElementById(`rec-card-${type}`);
                                      if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        el.style.outline = '2px solid var(--primary)';
                                        setTimeout(() => {
                                          el.style.outline = 'none';
                                        }, 2000);
                                        break;
                                      }
                                    }
                                  }, 150);
                                }}
                                style={{
                                  alignSelf: 'stretch',
                                  marginTop: '0.35rem',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary, #6366f1)',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  padding: '0.5rem 0',
                                  fontSize: '0.85rem',
                                  textDecoration: 'underline',
                                  textAlign: 'center'
                                }}
                              >
                                View Affordability Recommendations
                              </button>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}


                    <div className="form-group-item">
                      <label className="form-group-label">Mortgage Rate (Interest)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={1} 
                          max={15} 
                          step={0.1} 
                          value={draftEvent.mortgageRate || 6.5}
                          onChange={(e) => updateDraft('mortgageRate', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {(draftEvent.mortgageRate || 6.5)}%
                        </div>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Loan Term (Years)</label>
                      <select 
                        value={draftEvent.loanTerm || 30} 
                        onChange={(e) => updateDraft('loanTerm', Number(e.target.value))}
                        className="mobile-wizard-select"
                      >
                        <option value={30}>30 Years Fixed</option>
                        <option value={15}>15 Years Fixed</option>
                        <option value={10}>10 Years Fixed</option>
                      </select>
                    </div>

                    <div className="form-group-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <div style={{ paddingRight: '0.5rem' }}>
                        <label className="form-group-label" style={{ marginBottom: 0 }}>Keep rent after purchase</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '0.15rem' }}>Do not replace rent with mortgage</span>
                      </div>
                      <div>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!draftEvent.keepRent}
                            onChange={(e) => updateDraft('keepRent', e.target.checked)}
                          />
                          <span className="slider-round"></span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* 5. RETIREMENT */}
                {draftEvent.type === 'retire' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Desired Work Optional Age</label>
                      <div className="picker-slider-row">
                        <button 
                          type="button" 
                          className="slider-adjust-btn"
                          onClick={() => updateDraft('age', Math.max(18, Number(draftEvent.age || 55) - 1))}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{draftEvent.age || 55}</span>
                        <button 
                          type="button" 
                          className="slider-adjust-btn"
                          onClick={() => updateDraft('age', Math.min(85, Number(draftEvent.age || 55) + 1))}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Retirement Spending Need (% of pre-retire lifestyle)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={20} 
                          max={150} 
                          step={5} 
                          value={draftEvent.spendingPercent || 70}
                          onChange={(e) => updateDraft('spendingPercent', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {(draftEvent.spendingPercent || 70)}%
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 6. SOCIAL SECURITY */}
                {draftEvent.type === 'socialSecurity' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Claiming Age</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={62} 
                          max={70} 
                          step={1} 
                          value={draftEvent.claimingAge || 67}
                          onChange={(e) => {
                            const age = Number(e.target.value);
                            setDraftEvent(prev => ({
                              ...prev,
                              claimingAge: age,
                              age: age,
                              startAge: age
                            }));
                          }}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          Age {draftEvent.claimingAge || 67}
                        </div>
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Estimated Monthly Benefit (at age 67)</label>
                      <input 
                        type="number" 
                        value={draftEvent.monthlyBenefit || 2000} 
                        onChange={(e) => updateDraft('monthlyBenefit', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>
                  </>
                )}

                {/* 7. MARRIAGE */}
                {draftEvent.type === 'marriage' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Spouse Annual Income</label>
                      <input 
                        type="number" 
                        value={draftEvent.spouseIncome || 0} 
                        onChange={(e) => updateDraft('spouseIncome', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Spouse Pre-tax Savings Rate (%)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={0} 
                          max={50} 
                          value={draftEvent.savingsRate || 15}
                          onChange={(e) => updateDraft('savingsRate', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {draftEvent.savingsRate || 15}%
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 8. MOVE */}
                {draftEvent.type === 'move' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">New Location</label>
                      <input 
                        type="text" 
                        value={draftEvent.location || ''} 
                        onChange={(e) => updateDraft('location', e.target.value)} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Expected Annual Core Spending</label>
                      <input 
                        type="number" 
                        value={draftEvent.newSpending || 0} 
                        onChange={(e) => updateDraft('newSpending', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">One-time Moving Cost ($)</label>
                      <input 
                        type="number" 
                        value={draftEvent.movingCost !== undefined ? draftEvent.movingCost : 0} 
                        onChange={(e) => updateDraft('movingCost', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>
                  </>
                )}

                {/* 9. SABBATICAL */}
                {draftEvent.type === 'sabbatical' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Income Reduction (%)</label>
                      <div className="slider-input-group">
                        <input 
                          type="range" 
                          min={10} 
                          max={100} 
                          step={10} 
                          value={draftEvent.incomeReduction || 100}
                          onChange={(e) => updateDraft('incomeReduction', Number(e.target.value))}
                          className="mobile-wizard-slider"
                        />
                        <div className="slider-val-box">
                          {draftEvent.incomeReduction || 100}%
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 10. CUSTOM */}
                {draftEvent.type === 'custom' && (
                  <>
                    <div className="form-group-item">
                      <label className="form-group-label">Goal Name</label>
                      <input 
                        type="text" 
                        value={draftEvent.name || ''} 
                        onChange={(e) => updateDraft('name', e.target.value)} 
                        className="mobile-wizard-input-text"
                      />
                    </div>

                    <div className="form-group-item">
                      <label className="form-group-label">Amount (Negative for cost, positive for inflow)</label>
                      <input 
                        type="number" 
                        value={draftEvent.amount || 0} 
                        onChange={(e) => updateDraft('amount', Number(e.target.value))} 
                        className="mobile-wizard-input-text"
                      />
                    </div>
                  </>
                )}

                {/* FALLBACK FOR OTHER TYPES */}
                {!['haveChild', 'careerChange', 'borrowing', 'buyHouse', 'retire', 'socialSecurity', 'marriage', 'move', 'sabbatical', 'custom'].includes(draftEvent.type) && (
                  <>
                    {draftEvent.amount !== undefined && (
                      <div className="form-group-item">
                        <label className="form-group-label">Amount / Value</label>
                        <input 
                          type="number" 
                          value={draftEvent.amount || 0} 
                          onChange={(e) => updateDraft('amount', Number(e.target.value))} 
                          className="mobile-wizard-input-text"
                        />
                      </div>
                    )}
                    {draftEvent.monthlyBenefit !== undefined && (
                      <div className="form-group-item">
                        <label className="form-group-label">Monthly Benefit</label>
                        <input 
                          type="number" 
                          value={draftEvent.monthlyBenefit || 0} 
                          onChange={(e) => updateDraft('monthlyBenefit', Number(e.target.value))} 
                          className="mobile-wizard-input-text"
                        />
                      </div>
                    )}
                  </>
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
                      <span className="impact-main-lbl">{getEventNameDisplay()} Cost</span>
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
                      <span className="metric-lbl">Work Optional Age</span>
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
                  onClick={onSave}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Confirm Event */}
          {step === 6 && (
            <div className="mobile-wizard-step-content animate-slide-up">
              <h3 className="mobile-wizard-title">Review Event</h3>

              <div className="confirm-summary-card">
                <div className="confirm-header">
                  <span className="confirm-icon">{getEventIcon()}</span>
                  <div className="confirm-title-col">
                    <span className="confirm-name">{getEventNameDisplay()}</span>
                    <span className="confirm-age">Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}</span>
                  </div>
                </div>

                <div className="confirm-grid">
                  <div className="confirm-item">
                    <span className="confirm-lbl">Starts</span>
                    <strong className="confirm-val">Age {startAgeVal}</strong>
                  </div>
                  {hasEndAge && (
                    <div className="confirm-item">
                      <span className="confirm-lbl">Ends</span>
                      <strong className="confirm-val">Age {endAgeVal}</strong>
                    </div>
                  )}

                  {draftEvent.type === 'haveChild' && (
                    <>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Children</span>
                        <strong className="confirm-val">{draftEvent.childCount || 1}</strong>
                      </div>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Annual Cost</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.customAges0to4 || 15000)}</strong>
                      </div>
                    </>
                  )}

                  {draftEvent.type === 'careerChange' && (
                    <>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Salary</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.amount || 150000)}</strong>
                      </div>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Annual raise</span>
                        <strong className="confirm-val">{(draftEvent.growthRate || 3.5)}%</strong>
                      </div>
                    </>
                  )}

                  {draftEvent.type === 'borrowing' && (
                    <>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Balance</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.balance || 0)}</strong>
                      </div>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Interest</span>
                        <strong className="confirm-val">{(draftEvent.interestRate || 5)}%</strong>
                      </div>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Min. Payment</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.minPayment || 0)}/mo</strong>
                      </div>
                    </>
                  )}

                  {draftEvent.type === 'buyHouse' && (
                    <>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Home Price</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.homePrice || 500000)}</strong>
                      </div>
                      <div className="confirm-item">
                        <span className="confirm-lbl">Down Payment</span>
                        <strong className="confirm-val">{formatCurrency(draftEvent.downPayment || 100000)}</strong>
                      </div>
                    </>
                  )}

                  {draftEvent.notes && (
                    <div className="confirm-item" style={{ gridColumn: 'span 2' }}>
                      <span className="confirm-lbl">Notes</span>
                      <p className="confirm-notes">{draftEvent.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirm Buttons */}
              <div className="mobile-wizard-footer">
                <button 
                  type="button" 
                  className="mobile-wizard-btn-primary"
                  onClick={onSave}
                >
                  {isNew ? 'Add to Plan' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="mobile-wizard-btn-link"
                  onClick={() => setStep(4)}
                >
                  Edit Details
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Event Added */}
          {step === 7 && (() => {
            const beforeAge = baselineResults?.retirementReadyAge ? baselineResults.retirementReadyAge : "Needs Adjustment";
            const { newInputs } = getInputsWithEvent ? getInputsWithEvent(inputs, draftEvent) : { newInputs: inputs };
            const tempResults = runFireSimulation(newInputs);
            const afterAge = tempResults?.retirementReadyAge ? tempResults.retirementReadyAge : "Needs Adjustment";
            const isChildFlow = draftEvent.type === 'haveChild';
            const isHouseFlow = draftEvent.type === 'buyHouse';

            if (isHouseFlow) {
              if (houseRebalanceSummary) {
                const { 
                  deficit, 
                  affordablePriceConservative,
                  affordablePriceBalanced,
                  affordablePriceAggressive,
                  liquidFundsAvailable
                } = houseRebalanceSummary;

                const currentHomePriceValue = houseRebalanceSummary.currentHomePrice || 0;
                const currentShortfall = Math.max(0, (houseRebalanceSummary.totalCashNeeded || 0) - (liquidFundsAvailable || 0));

                const selectedOption = houseRebalanceSummary.selectedOption || 'balanced';
                const selectedAffordablePrice = houseRebalanceSummary.selectedAffordablePrice !== undefined
                  ? houseRebalanceSummary.selectedAffordablePrice
                  : houseRebalanceSummary.affordablePriceBalanced;
                
                const isUpdateActionEnabled = selectedAffordablePrice !== null && selectedAffordablePrice !== undefined && selectedAffordablePrice > 0;

                const downPaymentNeeded = selectedOption === 'conservative' 
                  ? (houseRebalanceSummary.totalCashNeededConservative || 0)
                  : selectedOption === 'aggressive'
                  ? (houseRebalanceSummary.totalCashNeededAggressive || 0)
                  : (houseRebalanceSummary.totalCashNeededBalanced || 0);

                const additionalNeeded = Math.max(0, downPaymentNeeded - (liquidFundsAvailable || 0));

                const actualDownPayment = selectedOption === 'conservative'
                  ? (houseRebalanceSummary.downPaymentConservative !== undefined ? houseRebalanceSummary.downPaymentConservative : (houseRebalanceSummary.totalCashNeededConservative || 0))
                  : selectedOption === 'aggressive' || selectedOption === 'stretch'
                  ? (houseRebalanceSummary.downPaymentAggressive !== undefined ? houseRebalanceSummary.downPaymentAggressive : (houseRebalanceSummary.totalCashNeededAggressive || 0))
                  : (houseRebalanceSummary.downPaymentBalanced !== undefined ? houseRebalanceSummary.downPaymentBalanced : (houseRebalanceSummary.totalCashNeededBalanced || 0));

                const recommendedPayment = selectedOption === 'conservative'
                  ? houseRebalanceSummary.affordablePaymentConservative
                  : selectedOption === 'aggressive'
                  ? houseRebalanceSummary.affordablePaymentAggressive
                  : houseRebalanceSummary.affordablePaymentBalanced;

                const selectedRetirementAge = selectedOption === 'conservative'
                  ? houseRebalanceSummary.conservativeRetirementAge
                  : selectedOption === 'aggressive'
                  ? houseRebalanceSummary.aggressiveRetirementAge
                  : houseRebalanceSummary.balancedRetirementAge;

                const renderRetirementAgeText = (age) => {
                  const baseAge = houseRebalanceSummary.baselineRetirementAge;
                  if (age === null || age === undefined || age === "Not achievable" || baseAge === null || baseAge === undefined) {
                    return 'Not achievable';
                  }
                  return `${baseAge} → ${age}`;
                };

                if (outcomeDetails) {
                  const strategyName = outcomeDetails.option === 'conservative' ? 'Comfortable' : outcomeDetails.option === 'aggressive' || outcomeDetails.option === 'stretch' ? 'Stretch' : 'Balanced';
                  return (
                    <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>
                          🎉 House Purchase Updated
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                          Your plan has been updated to purchase a <strong>{formatCurrency(outcomeDetails.affordablePrice)}</strong> home using the <strong>{strategyName}</strong> strategy.
                        </p>

                        {/* Outcome Details Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left', margin: '0.75rem 0', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Full Mortgage Price:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.affordablePrice)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Down Payment:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.downPayment)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Mortgage P&I:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {outcomeDetails.pi > 0 ? `${formatCurrency(outcomeDetails.pi)}/mo` : 'Paid in full (Cash)'}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Housing Cost:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(outcomeDetails.recommendedPayment)}/mo</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>New Work Optional Age:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{renderRetirementAgeText(outcomeDetails.retirementAge)}</strong>
                          </div>
                        </div>

                        {/* Budget Adjustments section */}
                        <div style={{ padding: '0.75rem', background: 'rgba(249, 115, 22, 0.03)', border: '1px dashed var(--accent-orange, #f97316)', borderRadius: '12px', textAlign: 'left', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 0.4rem 0', color: 'var(--accent-orange, #f97316)' }}>
                            📈 Budget Adjustments
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                            {outcomeDetails.wantsReduction > 0 ? (
                              <div>
                                • <strong>Decrease Wants:</strong> reduced by <strong>{formatCurrency(outcomeDetails.wantsReduction)}/mo</strong> (from {formatCurrency(outcomeDetails.originalWants)} to <strong>{formatCurrency(outcomeDetails.newWants)}/mo</strong>)
                              </div>
                            ) : (
                              <div>• Wants budget remained unchanged at <strong>{formatCurrency(outcomeDetails.originalWants)}/mo</strong>.</div>
                            )}
                            {outcomeDetails.savingsReduction > 0 ? (
                              <div>
                                • <strong>Decrease Savings:</strong> reduced by <strong>{formatCurrency(outcomeDetails.savingsReduction)}/mo</strong> (from {formatCurrency(outcomeDetails.originalSavings)} to <strong>{formatCurrency(outcomeDetails.newSavings)}/mo</strong>)
                              </div>
                            ) : (
                              outcomeDetails.originalSavings > 0 && (
                                <div>• Savings budget remained unchanged at <strong>{formatCurrency(outcomeDetails.originalSavings)}/mo</strong>.</div>
                              )
                            )}
                          </div>
                        </div>

                        {renderRetirementAgeText(outcomeDetails.retirementAge) === 'Not achievable' && (
                          <div style={{ 
                            padding: '0.75rem', 
                            background: 'rgba(239, 68, 68, 0.03)', 
                            border: '1px solid var(--accent-red, #ef4444)', 
                            borderRadius: '12px', 
                            textAlign: 'left', 
                            margin: '0 0 1rem 0',
                            fontSize: '0.75rem'
                          }}>
                            <div style={{ fontWeight: 'bold', color: 'var(--accent-red, #ef4444)', marginBottom: '0.4rem' }}>
                              Plan is not achievable:
                            </div>
                            <p style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>
                              Housing cost increased by <strong>{formatCurrency(outcomeDetails.recommendedPayment - (houseRebalanceSummary.oldHousingCost || 0))}/mo</strong> and savings dropped by <strong>{formatCurrency(outcomeDetails.savingsReduction)}/mo</strong>.
                            </p>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                              Recommended Actions:
                            </div>
                            <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <li>Create Income Boost for remaining gap</li>
                              <li>Save larger down payment</li>
                              <li>Reduce house price further</li>
                            </ol>
                          </div>
                        )}

                        <button
                          type="button"
                          className="mobile-wizard-btn-primary"
                          onClick={() => {
                            setHouseRebalanceSummary(null);
                            onClose();
                          }}
                          style={{ padding: '0.75rem 1rem', width: '100%', fontWeight: 'bold', margin: 0 }}
                        >
                          Close & View Simulator
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>
                        🏠 Home Purchase Recommendation
                      </h3>

                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: '1.4', padding: '0 0.5rem' }}>
                        {houseRebalanceSummary.constraint === 'cash' 
                          ? 'Your retirement plan can support a higher home price, but your available liquid assets at the purchase age are the limiting factor.'
                          : houseRebalanceSummary.constraint === 'both'
                          ? 'This purchase is limited by both upfront cash and monthly affordability.'
                          : 'Your upfront cash is sufficient, but the monthly ownership costs would delay retirement.'}
                      </p>
                      
                      {/* Primary Focus Card */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left', margin: '0.75rem 0', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Home:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{currentHomePriceValue ? formatCurrency(currentHomePriceValue) : 'N/A'}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Recommended:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedAffordablePrice !== null ? formatCurrency(selectedAffordablePrice) : 'N/A'}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Constraint:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {houseRebalanceSummary.constraint === 'cash' ? 'Upfront Cash' : houseRebalanceSummary.constraint === 'both' ? 'Both' : 'Monthly Budget'}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{recommendedPayment !== null && recommendedPayment !== undefined ? `${formatCurrency(recommendedPayment)}/mo` : 'N/A'}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Retirement:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{renderRetirementAgeText(selectedRetirementAge)}</strong>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.1rem 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Cash Required:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(downPaymentNeeded)}</strong>
                        </div>
                        {downPaymentNeeded - actualDownPayment > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0.5rem', marginTop: '0.15rem', gap: '0.15rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              <span>• Down Payment:</span>
                              <span>{formatCurrency(actualDownPayment)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              <span>• Closing Costs & Upfront:</span>
                              <span>{formatCurrency(downPaymentNeeded - actualDownPayment)}</span>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Liquid Funds:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(liquidFundsAvailable)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Additional Needed:</span>
                          <strong style={{ color: additionalNeeded > 0 ? 'var(--accent-orange, #f97316)' : 'var(--text-primary)' }}>{formatCurrency(additionalNeeded)}</strong>
                        </div>
                      </div>

                      {/* Collapsible Comparisons */}
                      <div style={{ margin: '0.5rem 0', textAlign: 'left' }}>
                        <button
                          type="button"
                          onClick={() => setShowComparisons(!showComparisons)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--primary)', 
                            fontSize: '0.75rem', 
                            cursor: 'pointer', 
                            padding: 0, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.2rem',
                            fontWeight: '500'
                          }}
                        >
                          {showComparisons ? '▼ Hide Option Comparisons' : '▶ Show Option Comparisons'}
                        </button>
                        
                        {showComparisons && (
                          <div className="animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Comfortable:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{affordablePriceConservative !== null ? formatCurrency(affordablePriceConservative) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.conservativeRetirementAge)})</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Balanced (Default):</span>
                              <strong style={{ color: 'var(--primary)' }}>{affordablePriceBalanced !== null ? formatCurrency(affordablePriceBalanced) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.balancedRetirementAge)})</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Stretch:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{affordablePriceAggressive !== null ? formatCurrency(affordablePriceAggressive) : 'N/A'} (Retirement: {renderRetirementAgeText(houseRebalanceSummary.aggressiveRetirementAge)})</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Action 1: Create Income Boost */}
                      <button
                        type="button"
                        className="mobile-wizard-btn-primary"
                        onClick={() => {
                          handleApplyRebalanceStrategy('incomeBoost');
                          setHouseRebalanceSummary(null);
                          onClose();
                        }}
                        style={{ padding: '0.65rem 0.75rem', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', height: 'auto' }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>💰 Create Income Boost</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>+{formatCurrency((houseRebalanceSummary.remainingBalancedDeficit !== undefined ? houseRebalanceSummary.remainingBalancedDeficit : deficit) * 12)}/yr starting at purchase</span>
                      </button>

                      {/* Action 2: Update House Purchase */}
                      <button
                        type="button"
                        className="mobile-wizard-btn-primary"
                        disabled={!isUpdateActionEnabled}
                        onClick={() => {
                          handleApplyRebalanceStrategy('updatePrice');
                          setOutcomeDetails({
                            affordablePrice: selectedAffordablePrice,
                            downPayment: actualDownPayment,
                            recommendedPayment: recommendedPayment,
                            retirementAge: selectedRetirementAge,
                            option: selectedOption,
                            originalWants: houseRebalanceSummary.originalWants,
                            originalSavings: houseRebalanceSummary.originalSavings,
                            wantsReduction: selectedOption === 'conservative' ? 0 : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.wantsReductionAggressive : houseRebalanceSummary.wantsReductionBalanced),
                            savingsReduction: selectedOption === 'conservative' ? 0 : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.savingsReductionAggressive : houseRebalanceSummary.savingsReductionBalanced),
                            newWants: selectedOption === 'conservative' ? houseRebalanceSummary.originalWants : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.newWantsAggressive : houseRebalanceSummary.newWantsBalanced),
                            newSavings: selectedOption === 'conservative' ? houseRebalanceSummary.originalSavings : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.newSavingsAggressive : houseRebalanceSummary.newSavingsBalanced),
                            pi: selectedOption === 'conservative' ? houseRebalanceSummary.piConservative : (selectedOption === 'aggressive' || selectedOption === 'stretch' ? houseRebalanceSummary.piAggressive : houseRebalanceSummary.piBalanced),
                          });
                        }}
                        style={{ 
                          padding: '0.65rem 0.75rem', 
                          width: '100%', 
                          margin: 0,
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          gap: '0.15rem',
                          height: 'auto',
                          opacity: isUpdateActionEnabled ? 1 : 0.5,
                          cursor: isUpdateActionEnabled ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🏠 Update House Purchase</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                          {isUpdateActionEnabled ? (
                            `Set price to ${selectedOption === 'conservative' ? 'Comfortable' : selectedOption === 'aggressive' ? 'Stretch' : 'Balanced'} option: ${formatCurrency(selectedAffordablePrice)}`
                          ) : (
                            'Plan is unsustainable'
                          )}
                        </span>
                      </button>

                      {/* Action 3: Save for Down Payment */}
                      <button
                        type="button"
                        className="mobile-wizard-btn-primary"
                        onClick={() => {
                          handleApplyRebalanceStrategy('saveForDownPayment');
                          setHouseRebalanceSummary(null);
                          onClose();
                        }}
                        style={{ padding: '0.65rem 0.75rem', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', height: 'auto' }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📅 Save for Down Payment</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Prioritize saving {formatCurrency(additionalNeeded)} down payment gap</span>
                      </button>
                    </div>

                    <div className="mobile-wizard-footer" style={{ display: 'flex', marginTop: '0.5rem' }}>
                      <button 
                        type="button" 
                        className="mobile-wizard-btn-secondary"
                        style={{ flex: 1, margin: 0 }}
                        onClick={() => {
                          setHouseRebalanceSummary(null);
                          onClose();
                        }}
                      >
                        Skip / Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              if (houseImpactSummary) {
                const { 
                  housingCostChange, 
                  wantsReduction, 
                  savingsReduction, 
                  totalCashFlowImprovement, 
                  baselineRetirementAge, 
                  newRetirementAge, 
                  retirementReadyAge 
                } = houseImpactSummary;

                const hasAdjustments = (wantsReduction > 0 || savingsReduction > 0);
                const isDelayed = baselineRetirementAge !== undefined && baselineRetirementAge !== null && newRetirementAge !== undefined && newRetirementAge !== null && newRetirementAge > baselineRetirementAge;
                const retirementColor = isDelayed ? 'var(--accent-orange, #f97316)' : 'var(--accent-emerald)';

                const renderRetirementImpact = () => {
                  if (baselineRetirementAge === undefined || baselineRetirementAge === null || newRetirementAge === undefined || newRetirementAge === null) {
                    return `Age ${retirementReadyAge || 'N/A'}`;
                  }
                  if (baselineRetirementAge === newRetirementAge) {
                    return `Unchanged (Age ${newRetirementAge})`;
                  }
                  return `${baselineRetirementAge} → ${newRetirementAge}`;
                };

                return (
                  <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0', textAlign: 'center' }}>
                    <div className="success-circle animate-pulse" style={{ margin: '0 auto 0.75rem' }}>
                      <Check size={36} className="success-icon" />
                    </div>
                    <h3 className="success-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                      🏠 Home Purchase Added!
                    </h3>
                    <p className="success-desc" style={{ fontSize: '0.8rem', margin: '0 auto 1rem', maxWidth: '300px' }}>
                      Congratulations! Your retirement plan remains fully on track and sustainable with this home purchase.
                    </p>

                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Housing Cost Change:</span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {housingCostChange >= 0 ? `+${formatCurrency(housingCostChange)}/mo` : `${formatCurrency(housingCostChange)}/mo`}
                        </strong>
                      </div>
                      
                      {!hasAdjustments ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Budget Adjustments:</span>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            +$0/mo
                          </strong>
                        </div>
                      ) : (
                        <>
                          {wantsReduction > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Wants Reduction:</span>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                +{formatCurrency(wantsReduction)}/mo
                              </strong>
                            </div>
                          )}
                          {savingsReduction > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>• Savings Reduction:</span>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                +{formatCurrency(savingsReduction)}/mo
                              </strong>
                            </div>
                          )}
                        </>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Cash Flow Improvement:</span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {totalCashFlowImprovement >= 0 ? `+${formatCurrency(totalCashFlowImprovement)}/mo` : `${formatCurrency(totalCashFlowImprovement)}/mo`}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Retirement Impact:</span>
                        <strong style={{ fontSize: '0.85rem', color: retirementColor }}>
                          {renderRetirementImpact()}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1.25rem', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.9rem' }}>✓</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-emerald)' }}>Your plan still works</span>
                    </div>

                    <div className="mobile-wizard-footer" style={{ width: '100%' }}>
                      <button 
                        type="button" 
                        className="mobile-wizard-btn-primary"
                        onClick={() => {
                          setHouseImpactSummary(null);
                          onClose();
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              }
            }
            
            const hasLocalShortfall = afterAge === "Needs Adjustment" || (typeof afterAge === 'number' && afterAge > (inputs.targetRetirementAge || 65));
            const hasShortfall = hasLocalShortfall || (improvementPlan && improvementPlan.rankedPlan && improvementPlan.rankedPlan.length > 0);
            
            // Calculate child-specific recommendations locally to bypass parent state updates lag
            let localRankedPlan = [];
            if (isChildFlow) {
              const childRecs = getChildCostOffsetRecommendations(newInputs);
              const targetRetirementAge = Number(inputs.targetRetirementAge) || 65;
              const currentReadyAge = typeof afterAge === 'number' ? afterAge : null;
              childRecs.forEach(rec => {
                const clonedInputs = JSON.parse(JSON.stringify(newInputs));
                const promoEvent = {
                  id: `promo-${rec.childEventId}`,
                  type: 'careerChange',
                  name: rec.childName ? `Promotion (${rec.childName})` : 'Get a Promotion',
                  startAge: rec.parentStartAge,
                  endAge: inputs.targetRetirementAge,
                  growthRate: 0.03, // Saved as decimal for simulation (displayed as 3.0% in edit form)
                  isTaxable: true,
                  amount: rec.peakCost,
                  salaryIncrease: rec.peakCost,
                  incomeChangeType: 'increaseByAmount',
                  permanent: true,
                  parentEventId: rec.childEventId
                };

                clonedInputs.incomeList = [...(clonedInputs.incomeList || []), promoEvent];
                const boostResults = runFireSimulation(clonedInputs);
                const readyAge = boostResults.retirementReadyAge;
                const yearsImprovement = currentReadyAge ? Math.max(0, currentReadyAge - (readyAge || currentReadyAge)) : null;
                
                localRankedPlan.push({
                  type: `childPromotion-${rec.childEventId}`,
                  icon: '🟦',
                  title: 'Get a Promotion',
                  details: `Increase your income by ${formatCurrency(rec.peakCost)}/year permanently.`,
                  bulletPoints: [
                    `This offsets childcare costs today and helps you build additional savings after childcare expenses end.`,
                    `A promotion or career advancement that offsets childcare costs and keeps your retirement plan on track. After childcare ends, the additional income becomes available for savings.`
                  ],
                  readyAge: readyAge || targetRetirementAge,
                  yearsImprovement,
                  value: rec.peakCost,
                  promoEvent: promoEvent,
                  savingsFocus: 'Earn More',
                  savingsEffortScore: 2
                });
              });
            }

            const displayRankedPlan = [...localRankedPlan];
            if (improvementPlan?.rankedPlan) {
              improvementPlan.rankedPlan.forEach(p => {
                const isDuplicate = localRankedPlan.some(lp => lp.type === p.type);
                if (!isDuplicate) {
                  displayRankedPlan.push(p);
                }
              });
            }

            if (isChildFlow && hasShortfall && displayRankedPlan.length > 0) {
              return (
                <div className="mobile-wizard-step-content animate-slide-up" style={{ padding: '1rem 0' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div className="success-circle animate-pulse" style={{ margin: '0 auto 0.75rem' }}>
                      <Check size={36} className="success-icon" />
                    </div>
                    <h3 className="success-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                      👶 Child Added to Timeline!
                    </h3>
                    <p className="success-desc" style={{ fontSize: '0.8rem', margin: '0 auto 0.75rem', maxWidth: '300px' }}>
                      Welcoming a child changes your financial timeline. Here is the projected impact on your retirement:
                    </p>
                    
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '12px', padding: '0.5rem 1rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready Age:</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent-orange, #f59e0b)' }}>
                        {typeof beforeAge === 'number' ? `Age ${beforeAge}` : beforeAge} ➔ {typeof afterAge === 'number' ? `Age ${afterAge}` : afterAge}
                      </strong>
                    </div>
                  </div>

                  <div className="mobile-rec-container" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 'bold', margin: '0 0 0.5rem' }}>
                      Recommended Adjustments
                    </h4>
                    {displayRankedPlan.map((scenario, idx) => {
                      const badgeColor = scenario.savingsFocus === 'Earn More' ? '#10b981' : scenario.savingsFocus === 'Save More' ? '#6366f1' : '#f59e0b';
                      const badgeBg = scenario.savingsFocus === 'Earn More' ? 'rgba(16, 185, 129, 0.12)' : scenario.savingsFocus === 'Save More' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)';
                      return (
                        <div className="mobile-rec-card" key={scenario.type || idx}>
                          <div className="mobile-rec-card-header">
                            <h5 className="mobile-rec-card-title">
                              {scenario.icon} {scenario.title}
                            </h5>
                            <span 
                              className="mobile-rec-focus-badge"
                              style={{ color: badgeColor, backgroundColor: badgeBg }}
                            >
                              {scenario.savingsFocus}
                            </span>
                          </div>
                          
                          <p className="mobile-rec-details">
                            {scenario.details}
                          </p>

                          {scenario.bulletPoints && scenario.bulletPoints.length > 0 && (
                            <ul className="mobile-rec-bullets">
                              {scenario.bulletPoints.map((bp, bIdx) => (
                                <li key={bIdx}>{bp}</li>
                              ))}
                            </ul>
                          )}

                          <div className="mobile-rec-kpis">
                            <div>
                              <span className="mobile-rec-kpi-lbl">New Ready Age</span>
                              <strong className="mobile-rec-kpi-val" style={{ color: scenario.readyAge <= (inputs.targetRetirementAge || 65) ? 'var(--accent-emerald, #10b981)' : 'var(--accent-orange, #f59e0b)' }}>
                                Age {scenario.readyAge}
                              </strong>
                            </div>
                            <div>
                              <span className="mobile-rec-kpi-lbl">Effort / Difficulty</span>
                              <strong className="mobile-rec-kpi-val">
                                {scenario.savingsEffortScore === 1 ? '⚡ Low' : scenario.savingsEffortScore === 2 ? '⚡⚡ Medium' : '⚡⚡⚡ High'}
                              </strong>
                            </div>
                          </div>

                          {!scenario.isInfoOnly && (
                            <button 
                              type="button"
                              className="mobile-rec-apply-btn"
                              onClick={() => {
                                handleApplyMobileRecommendation(scenario);
                                // Play standard success glow and close wizard
                                window.pulsePhaseId = 'childcare';
                                onClose();
                              }}
                            >
                              Apply Adjustment
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mobile-wizard-footer" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button 
                      type="button" 
                      className="mobile-wizard-btn-secondary"
                      style={{ flex: 1, margin: 0 }}
                      onClick={() => {
                        window.pulsePhaseId = 'childcare';
                        onClose();
                      }}
                    >
                      Skip for Now
                    </button>
                  </div>
                </div>
              );
            }

            // Normal success screen
            return (
              <div className="mobile-wizard-step-content animate-scale-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
                <div className="success-circle animate-pulse">
                  <Check size={48} className="success-icon" />
                </div>

                <h3 className="success-title">
                  {isNew ? `${getEventNameDisplay()} Added!` : 'Changes Saved!'}
                </h3>
                
                <p className="success-desc">
                  We've recalculated your roadmap. The interactive timeline, budget intervals, and retirement projection curves are now fully updated.
                </p>

                <div className="mobile-wizard-footer" style={{ width: '100%' }}>
                  <button 
                    type="button" 
                    className="mobile-wizard-btn-primary"
                    onClick={() => {
                      if (draftEvent.type === 'haveChild') {
                        window.pulsePhaseId = 'childcare';
                      }
                      onClose();
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 8: EDIT / MANAGE Details Screen */}
          {step === 8 && (
            <div className="mobile-wizard-step-content animate-slide-up">
              
              {/* Event Badge Summary */}
              <div className="manage-event-badge">
                <span className="manage-event-icon">{getEventIcon()}</span>
                <div className="manage-event-header-col">
                  <h3 className="manage-event-name">{getEventNameDisplay()}</h3>
                  <span className="manage-event-age">Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}</span>
                </div>
              </div>

              {/* Actions Stack */}
              <div className="manage-actions-list">
                <button 
                  type="button" 
                  className="manage-action-row"
                  onClick={() => setStep(3)}
                >
                  <div className="action-left">
                    <Edit size={18} className="action-icon purple" />
                    <span>Edit Event Details</span>
                  </div>
                  <span className="action-arrow">→</span>
                </button>

                <button 
                  type="button" 
                  className="manage-action-row"
                  onClick={onDuplicate}
                >
                  <div className="action-left">
                    <Copy size={18} className="action-icon blue" />
                    <span>Duplicate Event</span>
                  </div>
                  <span className="action-arrow">→</span>
                </button>

                <button 
                  type="button" 
                  className="manage-action-row delete"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this event? This will immediately remove it from your roadmap and recalculate your projection.")) {
                      onDelete();
                    }
                  }}
                >
                  <div className="action-left">
                    <Trash2 size={18} className="action-icon red" />
                    <span>Delete Event</span>
                  </div>
                  <span className="action-arrow">→</span>
                </button>
              </div>

              {/* Event Timeline */}
              <h4 className="mobile-wizard-section-lbl" style={{ marginTop: '1.5rem' }}>Event Timeline</h4>
              <div className="manage-event-timeline">
                <div className="timeline-event-item">
                  <div className="timeline-node" />
                  <div className="timeline-text-col">
                    <span className="timeline-age-lbl">Age {startAgeVal}</span>
                    <span className="timeline-desc-lbl">{getEventNameDisplay()} Begins</span>
                  </div>
                </div>
                {hasEndAge && (
                  <div className="timeline-event-item">
                    <div className="timeline-node" />
                    <div className="timeline-text-col">
                      <span className="timeline-age-lbl">Age {endAgeVal}</span>
                      <span className="timeline-desc-lbl">{getEventNameDisplay()} Ends</span>
                    </div>
                  </div>
                )}
              </div>

              {/* About This Event details */}
              <h4 className="mobile-wizard-section-lbl" style={{ marginTop: '1.5rem' }}>About This Event</h4>
              <div className="manage-about-card">
                <Info size={16} className="about-info-icon" />
                <p className="about-text">
                  {draftEvent.description || `This event affects your plan starting at Age ${startAgeVal}. Adjusting it recalculates your savings allocation rate and retirement sustainability age.`}
                </p>
              </div>

              {/* Footer Done Button */}
              <div className="mobile-wizard-footer">
                <button 
                  type="button" 
                  className="mobile-wizard-btn-primary"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
