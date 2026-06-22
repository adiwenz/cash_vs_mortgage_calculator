import React, { useState, useEffect } from 'react';
import { CurrencyInput, PercentInput, NumberInput } from '../ui/PlainInputs';
import { formatCurrency, clampAgeValue } from './helpers';
import { setLastChartChangeType } from './changeTypeTracker';
import { 
  ChevronRight, 
  ChevronLeft, 
  Users, 
  Home as HomeIcon, 
  DollarSign, 
  Briefcase, 
  Plus, 
  Trash2, 
  Check, 
  Info,
  ArrowLeft,
  X 
} from 'lucide-react';

export default function LifeProfileModal({
  isOpen,
  onClose,
  inputs,
  updateInput,
  initialTab = 'household',
  isMobile = false
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showAdvancedHome, setShowAdvancedHome] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Mobile navigation stack
  const [navStack, setNavStack] = useState([{ name: 'root' }]);

  // Default lifeProfile structure
  const defaultProfile = {
    household: { status: 'single', partnerIncome: 0, partnerSavings: 0, partnerRetirement: 0, partnerDebts: 0 },
    home: { status: 'rent', monthlyRent: 1500, homeValue: 0, mortgageBalance: 0, monthlyPayment: 0, propertyTaxes: 0, insurance: 0, hoa: 0 },
    children: [],
    debts: [],
    assets: { cash: 0, brokerage: 5000, trad401k: 0, tradIra: 0, rothIra: 0, hsa: 0, crypto: 0, businessEquity: 0 },
    incomeSources: []
  };

  // Local state for profile edits prior to saving
  const [localProfile, setLocalProfile] = useState(defaultProfile);
  const [localAge, setLocalAge] = useState(inputs.currentAge || 35);
  const [localLifeExpectancy, setLocalLifeExpectancy] = useState(inputs.lifeExpectancy || 85);
  const [localSimpleIncome, setLocalSimpleIncome] = useState(inputs.simpleIncome || 50000);
  const [localTargetRetirementAge, setLocalTargetRetirementAge] = useState(inputs.targetRetirementAge || 65);
  
  // Find social security event claiming age
  const initialSS = (inputs.lifeEvents || []).find(e => e.type === 'socialSecurity');
  const [localSSClaimingAge, setLocalSSClaimingAge] = useState(initialSS ? initialSS.claimingAge || 67 : 67);

  // Buy house event local state
  const buyHouseEv = (inputs.lifeEvents || []).find(e => e.type === 'buyHouse');
  const [localBuyHouseEnabled, setLocalBuyHouseEnabled] = useState(buyHouseEv ? buyHouseEv.enabled : false);
  const [localBuyHouseAge, setLocalBuyHouseAge] = useState(buyHouseEv ? buyHouseEv.purchaseAge || buyHouseEv.age || 40 : 40);
  const [localBuyHousePrice, setLocalBuyHousePrice] = useState(buyHouseEv ? buyHouseEv.homePrice || 300000 : 300000);

  const [wasOpen, setWasOpen] = useState(false);

  // Sync state with inputs when modal opens
  useEffect(() => {
    if (isOpen && !wasOpen) {
      setWasOpen(true);
      setLocalAge(inputs.currentAge || 35);
      setLocalLifeExpectancy(inputs.lifeExpectancy || 85);
      setLocalSimpleIncome(inputs.simpleIncome || 50000);
      setLocalTargetRetirementAge(inputs.targetRetirementAge || 65);

      const ssEv = (inputs.lifeEvents || []).find(e => e.type === 'socialSecurity');
      setLocalSSClaimingAge(ssEv ? ssEv.claimingAge || 67 : 67);

      const bhEv = (inputs.lifeEvents || []).find(e => e.type === 'buyHouse');
      setLocalBuyHouseEnabled(bhEv ? bhEv.enabled : false);
      setLocalBuyHouseAge(bhEv ? bhEv.purchaseAge || bhEv.age || 40 : 40);
      setLocalBuyHousePrice(bhEv ? bhEv.homePrice || 300000 : 300000);

      const merged = JSON.parse(JSON.stringify({
        ...defaultProfile,
        ...(inputs.lifeProfile || {})
      }));
      // Merge assets carefully
      merged.assets = {
        ...defaultProfile.assets,
        ...(inputs.lifeProfile?.assets || {})
      };
      // Merge household carefully
      merged.household = {
        ...defaultProfile.household,
        ...(inputs.lifeProfile?.household || {})
      };
      // Merge home carefully
      merged.home = {
        ...defaultProfile.home,
        ...(inputs.lifeProfile?.home || {})
      };
      setLocalProfile(merged);
      setActiveTab(initialTab);
      setShowAdvancedHome(false);
      setIsSummaryExpanded(false);
      setNavStack([{ name: 'root' }]);
    } else if (!isOpen) {
      setWasOpen(false);
    }
  }, [isOpen, wasOpen, inputs, initialTab]);

  if (!isOpen) return null;

  // Save profile updates to scenario state
  const saveToParent = (profileData, ageData, lifeExpData, salaryData, retireAgeData, ssAgeData, bhEnabled, bhAge, bhPrice) => {
    setLastChartChangeType('profile_value_change');
    const totalAssets = Object.values(profileData.assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
    
    updateInput('lifeProfile', profileData);
    updateInput('simpleInvestments', totalAssets);

    const clampedAge = clampAgeValue(ageData);
    const resolvedAge = clampedAge !== null ? clampedAge : 35;
    updateInput('currentAge', resolvedAge);
    updateInput('lifeExpectancy', Number(lifeExpData) || 85);
    updateInput('simpleIncome', Number(salaryData) || 50000);
    updateInput('targetRetirementAge', Number(retireAgeData) || 65);

    // Update SS claiming age & buyHouse event in lifeEvents
    const updatedEvents = (inputs.lifeEvents || []).map(e => {
      if (e.type === 'socialSecurity') {
        return { ...e, claimingAge: Number(ssAgeData) };
      }
      if (e.type === 'buyHouse') {
        return { 
          ...e, 
          enabled: bhEnabled, 
          purchaseAge: Number(bhAge), 
          age: Number(bhAge), 
          homePrice: Number(bhPrice) 
        };
      }
      return e;
    });

    const hasBuyHouse = updatedEvents.some(e => e.type === 'buyHouse');
    if (!hasBuyHouse && bhEnabled) {
      updatedEvents.push({
        id: 'derived-buy-house',
        type: 'buyHouse',
        enabled: true,
        name: 'Buy House',
        purchaseAge: Number(bhAge),
        age: Number(bhAge),
        homePrice: Number(bhPrice),
        downPayment: Math.round(Number(bhPrice) * 0.2),
        purchaseType: 'mortgage',
        mortgageRate: 6.5,
        loanTerm: 30,
        isDerived: true
      });
    }
    updateInput('lifeEvents', updatedEvents);

    const legacyAssets = {
      cash: Number(profileData.assets.cash || 0),
      brokerage: Number(profileData.assets.brokerage || 0),
      trad401k: Number(profileData.assets.trad401k || 0),
      tradIra: Number(profileData.assets.tradIra || 0),
      rothIra: Number(profileData.assets.rothIra || 0),
      hsa: Number(profileData.assets.hsa || 0),
      other: Number(profileData.assets.crypto || 0) + Number(profileData.assets.businessEquity || 0)
    };
    updateInput('assets', legacyAssets);
    updateInput('useLifeProfile', true);
  };

  const triggerSave = (overrides = {}) => {
    const profile = overrides.profile !== undefined ? overrides.profile : localProfile;
    const age = overrides.age !== undefined ? overrides.age : localAge;
    const lifeExp = overrides.lifeExp !== undefined ? overrides.lifeExp : localLifeExpectancy;
    const salary = overrides.salary !== undefined ? overrides.salary : localSimpleIncome;
    const retireAge = overrides.retireAge !== undefined ? overrides.retireAge : localTargetRetirementAge;
    const ssAge = overrides.ssAge !== undefined ? overrides.ssAge : localSSClaimingAge;
    const bhEnabled = overrides.bhEnabled !== undefined ? overrides.bhEnabled : localBuyHouseEnabled;
    const bhAge = overrides.bhAge !== undefined ? overrides.bhAge : localBuyHouseAge;
    const bhPrice = overrides.bhPrice !== undefined ? overrides.bhPrice : localBuyHousePrice;
    
    saveToParent(profile, age, lifeExp, salary, retireAge, ssAge, bhEnabled, bhAge, bhPrice);
  };

  const handleSave = () => {
    triggerSave();
    onClose();
  };

  const updateHouseholdField = (field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        household: {
          ...prev.household,
          [field]: val
        }
      };
      if (isMobile) {
        if (field === 'status' || field === 'partnerGender' || field === 'partnerEmploymentStatus') {
          triggerSave({ profile: next });
        }
      }
      return next;
    });
  };

  const updateHomeField = (field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        home: {
          ...prev.home,
          [field]: val
        }
      };
      if (isMobile) {
        if (field === 'status') {
          triggerSave({ profile: next });
        }
      }
      return next;
    });
  };

  const updateAssetField = (field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        assets: {
          ...prev.assets,
          [field]: val
        }
      };
      return next;
    });
  };

  // Children list builders
  const addChild = () => {
    const newId = `child-${Date.now()}`;
    const newChild = { id: newId, name: '', age: 0, includeCollege: false };
    setLocalProfile(prev => {
      const next = {
        ...prev,
        children: [...(prev.children || []), newChild]
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
    return newId;
  };

  const updateChild = (id, field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        children: (prev.children || []).map(c => c.id === id ? { ...c, [field]: val } : c)
      };
      if (isMobile) {
        if (field === 'includeCollege') {
          triggerSave({ profile: next });
        }
      }
      return next;
    });
  };

  const removeChild = (id) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        children: (prev.children || []).filter(c => c.id !== id)
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
  };

  // Debts list builders
  const addDebt = () => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        debts: [
          ...(prev.debts || []),
          { id: `debt-${Date.now()}`, name: '', balance: 0, interestRate: 0, monthlyPayment: 0 }
        ]
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
  };

  const updateDebt = (id, field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        debts: (prev.debts || []).map(d => d.id === id ? { ...d, [field]: val } : d)
      };
      return next;
    });
  };

  const removeDebt = (id) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        debts: (prev.debts || []).filter(d => d.id !== id)
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
  };

  // Income sources list builders
  const addIncomeSource = () => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        incomeSources: [
          ...(prev.incomeSources || []),
          { id: `income-${Date.now()}`, name: '', amount: 0, growthRate: 3, startAge: Number(inputs.currentAge || 35), endAge: Number(inputs.targetRetirementAge || 65), isTaxable: true }
        ]
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
  };

  const updateIncomeSource = (id, field, val) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        incomeSources: (prev.incomeSources || []).map(i => i.id === id ? { ...i, [field]: val } : i)
      };
      if (isMobile) {
        if (field === 'isTaxable') {
          triggerSave({ profile: next });
        }
      }
      return next;
    });
  };

  const removeIncomeSource = (id) => {
    setLocalProfile(prev => {
      const next = {
        ...prev,
        incomeSources: (prev.incomeSources || []).filter(i => i.id !== id)
      };
      if (isMobile) {
        triggerSave({ profile: next });
      }
      return next;
    });
  };

  // Mobile Navigation Stack methods
  const pushScreen = (screenName, extraData = {}) => {
    setNavStack(prev => [...prev, { name: screenName, ...extraData }]);
  };

  const popScreen = () => {
    if (navStack.length > 1) {
      setNavStack(prev => prev.slice(0, -1));
    }
  };

  const popScreenAndSave = () => {
    popScreen();
    triggerSave();
  };

  // Summary Metrics calculations
  const totalAssetsSum = Object.values(localProfile.assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalDebtsSum = (localProfile.debts || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0) + 
                        (localProfile.home.status === 'own' ? Number(localProfile.home.mortgageBalance || 0) : 0);
  const totalDebtsMonthlyPayments = (localProfile.debts || []).reduce((sum, d) => sum + (Number(d.monthlyPayment) || 0), 0) + 
                                   (localProfile.home.status === 'own' ? Number(localProfile.home.monthlyPayment || 0) : 0);

  // Completion statuses (Plain variables to comply with Rules of Hooks)
  const isHouseholdCompleted = !!localAge && (localProfile.household.status === 'single' || (Number(localProfile.household.partnerIncome) > 0 || Number(localProfile.household.partnerSavings) > 0));
  
  const isHomeCompleted = localProfile.home.status === 'rent'
    ? Number(localProfile.home.monthlyRent) > 0
    : Number(localProfile.home.homeValue) > 0;

  const isFinancesCompleted = Number(localSimpleIncome) > 0 || totalAssetsSum > 0 || totalDebtsSum > 0;

  const isWorkCompleted = Number(localTargetRetirementAge) > 0 && Number(localSSClaimingAge) > 0;

  const getMobileScreenTitle = () => {
    const current = navStack[navStack.length - 1];
    switch (current.name) {
      case 'root':
        return 'Life Profile';
      case 'household':
        return 'Household';
      case 'child_details':
        return 'Child Details';
      case 'home':
        return 'Home';
      case 'finances_menu':
        return 'Finances';
      case 'finance_income':
        return 'Income';
      case 'finance_assets':
        return 'Assets';
      case 'finance_debts':
        return 'Debts';
      case 'work_retirement':
        return 'Work & Retirement';
      default:
        return 'Life Profile';
    }
  };

  const renderMobileScreenContent = () => {
    const currentScreen = navStack[navStack.length - 1];
    
    switch (currentScreen.name) {
      case 'root':
        return (
          <div className="life-profile-mobile-root">
            <p className="life-profile-mobile-subtitle">
              Tell us about your life so we can personalize your plan.
            </p>
            
            <div className="life-profile-mobile-menu">
              {/* Household */}
              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('household')}>
                <div className="menu-item-icon-container household-icon">
                  <Users size={20} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Household</span>
                  <span className="menu-item-desc">You, partner, children</span>
                  {isHouseholdCompleted && (
                    <span className="completion-status text-success">
                      <Check size={12} style={{ marginRight: '2px', strokeWidth: 3 }} /> Completed
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>

              {/* Home */}
              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('home')}>
                <div className="menu-item-icon-container home-icon">
                  <HomeIcon size={20} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Home</span>
                  <span className="menu-item-desc">Where you live</span>
                  {isHomeCompleted && (
                    <span className="completion-status text-success">
                      <Check size={12} style={{ marginRight: '2px', strokeWidth: 3 }} /> Completed
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>

              {/* Finances */}
              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('finances_menu')}>
                <div className="menu-item-icon-container finances-icon">
                  <DollarSign size={20} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Finances</span>
                  <span className="menu-item-desc">Income, assets, debts</span>
                  {isFinancesCompleted && (
                    <span className="completion-status text-success">
                      <Check size={12} style={{ marginRight: '2px', strokeWidth: 3 }} /> Completed
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>

              {/* Work & Retirement */}
              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('work_retirement')}>
                <div className="menu-item-icon-container work-icon">
                  <Briefcase size={20} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Work & Retirement</span>
                  <span className="menu-item-desc">Career and retirement plans</span>
                  {isWorkCompleted && (
                    <span className="completion-status text-success">
                      <Check size={12} style={{ marginRight: '2px', strokeWidth: 3 }} /> Completed
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>
            </div>

            <div className="life-profile-mobile-info-banner">
              <Info size={16} />
              <span>You can update any section at any time. All fields are optional.</span>
            </div>
          </div>
        );

      case 'household':
        const hasPartner = localProfile.household.status !== 'single';
        return (
          <div className="life-profile-mobile-screen">
            {/* You section */}
            <div className="life-profile-mobile-section-header">You</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label id="label-age">Age</label>
                <NumberInput
                  aria-labelledby="label-age"
                  className="mobile-input-field"
                  value={localAge === null ? '' : localAge}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalAge(val === '' ? '' : parseInt(val, 10));
                  }}
                  onBlur={(e) => {
                    const clamped = clampAgeValue(e.target.value);
                    const finalAge = clamped !== null ? clamped : 35;
                    setLocalAge(finalAge);
                    triggerSave({ age: finalAge });
                  }}
                />
              </div>
              <div className="mobile-form-group">
                <label id="label-life-expectancy">Life Expectancy</label>
                <NumberInput
                  aria-labelledby="label-life-expectancy"
                  className="mobile-input-field"
                  value={localLifeExpectancy === null ? '' : localLifeExpectancy}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalLifeExpectancy(val === '' ? '' : parseInt(val, 10));
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const finalLifeExp = val === '' ? 85 : parseInt(val, 10);
                    setLocalLifeExpectancy(finalLifeExp);
                    triggerSave({ lifeExp: finalLifeExp });
                  }}
                />
              </div>
            </div>

            {/* Partner section */}
            <div className="life-profile-mobile-section-header-row">
              <span>Partner (Optional)</span>
              <label className="mobile-switch-container">
                <input
                  type="checkbox"
                  checked={hasPartner}
                  onChange={(e) => {
                    const nextStatus = e.target.checked ? 'married' : 'single';
                    const nextProfile = {
                      ...localProfile,
                      household: {
                        ...localProfile.household,
                        status: nextStatus
                      }
                    };
                    setLocalProfile(nextProfile);
                    triggerSave({ profile: nextProfile });
                  }}
                />
                <span className="mobile-switch-slider"></span>
              </label>
            </div>
            
            {hasPartner && (
              <div className="life-profile-mobile-form-card">
                <div className="mobile-form-group">
                  <label>Partner Age</label>
                  <NumberInput
                    className="mobile-input-field"
                    value={localProfile.household.partnerAge === undefined ? '' : localProfile.household.partnerAge}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHouseholdField('partnerAge', val === '' ? 35 : parseInt(val, 10));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
                <div className="mobile-form-group">
                  <label>Annual Income</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={localProfile.household.partnerIncome}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHouseholdField('partnerIncome', val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
                <div className="mobile-form-group">
                  <label>Cash & Savings</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={localProfile.household.partnerSavings}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHouseholdField('partnerSavings', val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
                <div className="mobile-form-group">
                  <label>Retirement Accounts</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={localProfile.household.partnerRetirement}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHouseholdField('partnerRetirement', val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
                <div className="mobile-form-group">
                  <label>Other Debts</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={localProfile.household.partnerDebts}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHouseholdField('partnerDebts', val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
              </div>
            )}

            {/* Children section */}
            <div className="life-profile-mobile-section-header">Children</div>
            <div className="life-profile-mobile-children-list">
              {(localProfile.children || []).length === 0 ? (
                <div className="mobile-empty-state-card">
                  No children configured. Add one if you have dependent children today.
                </div>
              ) : (
                <div className="mobile-items-grid">
                  {(localProfile.children || []).map((child, idx) => (
                    <div 
                      key={child.id} 
                      className="mobile-item-nav-row"
                      onClick={() => pushScreen('child_details', { childId: child.id })}
                    >
                      <div className="item-row-info">
                        <span className="item-row-title">{child.name || `Child ${idx + 1}`}</span>
                        <span className="item-row-subtitle">Age {child.age || 0} {child.includeCollege ? '• Tuition' : ''}</span>
                      </div>
                      <ChevronRight size={16} className="chevron-icon" />
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="button" 
                className="mobile-add-btn-full" 
                onClick={() => {
                  const newId = addChild();
                  pushScreen('child_details', { childId: newId });
                }}
              >
                <Plus size={16} /> Add Child
              </button>
            </div>
          </div>
        );

      case 'child_details':
        const childId = currentScreen.childId;
        const child = (localProfile.children || []).find(c => c.id === childId);
        if (!child) {
          return <div className="mobile-empty-state-card">Child not found.</div>;
        }
        return (
          <div className="life-profile-mobile-screen">
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Name (optional)</label>
                <input
                  type="text"
                  className="mobile-input-field text-input"
                  value={child.name}
                  placeholder={`Child`}
                  onChange={(e) => updateChild(childId, 'name', e.target.value)}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Current Age</label>
                <NumberInput
                  className="mobile-input-field"
                  value={child.age === null || child.age === '' ? '' : child.age}
                  placeholder="0"
                  onChange={(e) => {
                    const val = e.target.value;
                    updateChild(childId, 'age', val === '' ? 0 : parseInt(val, 10));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group checkbox-group">
                <label>Plan for Education?</label>
                <label className="mobile-switch-container">
                  <input
                    type="checkbox"
                    checked={!!child.includeCollege}
                    onChange={(e) => updateChild(childId, 'includeCollege', e.target.checked)}
                  />
                  <span className="mobile-switch-slider"></span>
                </label>
              </div>
            </div>

            <button 
              type="button" 
              className="mobile-delete-btn-full"
              onClick={() => {
                removeChild(childId);
                popScreen();
              }}
            >
              <Trash2 size={16} />
              <span>Delete Child</span>
            </button>
          </div>
        );

      case 'home':
        const home = localProfile.home;
        return (
          <div className="life-profile-mobile-screen">
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Housing Status</label>
                <select
                  className="mobile-select-field"
                  value={home.status}
                  onChange={(e) => updateHomeField('status', e.target.value)}
                >
                  <option value="rent">Renting</option>
                  <option value="own">Own Home</option>
                </select>
              </div>

              {home.status === 'rent' ? (
                <div className="mobile-form-group">
                  <label>Monthly Rent</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={home.monthlyRent}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateHomeField('monthlyRent', val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
              ) : (
                <>
                  <div className="mobile-form-group">
                    <label>Home Value</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.homeValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('homeValue', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label>Mortgage Balance</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.mortgageBalance}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('mortgageBalance', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label>Monthly Mortgage Payment</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.monthlyPayment}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('monthlyPayment', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                  
                  <div className="mobile-form-group">
                    <label>Property Taxes ($/yr)</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.propertyTaxes}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('propertyTaxes', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label>Insurance ($/yr)</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.insurance}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('insurance', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label>HOA Fees ($/mo)</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={home.hoa}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('hoa', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Plan to buy home */}
            <div className="life-profile-mobile-section-header-row">
              <span>Plan to Buy a Home?</span>
              <label className="mobile-switch-container">
                <input
                  type="checkbox"
                  checked={localBuyHouseEnabled}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    setLocalBuyHouseEnabled(nextVal);
                    triggerSave({ bhEnabled: nextVal });
                  }}
                />
                <span className="mobile-switch-slider"></span>
              </label>
            </div>

            {localBuyHouseEnabled && (
              <div className="life-profile-mobile-form-card">
                <div className="mobile-form-group">
                  <label>Target Purchase Age</label>
                  <NumberInput
                    className="mobile-input-field"
                    value={localBuyHouseAge === null ? '' : localBuyHouseAge}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalBuyHouseAge(val === '' ? '' : parseInt(val, 10));
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      const finalAge = val === '' ? 40 : parseInt(val, 10);
                      setLocalBuyHouseAge(finalAge);
                      triggerSave({ bhAge: finalAge });
                    }}
                  />
                </div>
                <div className="mobile-form-group">
                  <label>Home Price</label>
                  <CurrencyInput
                    className="mobile-input-field"
                    value={localBuyHousePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalBuyHousePrice(val === '' ? 0 : parseFloat(val));
                    }}
                    onBlur={() => triggerSave()}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'finances_menu':
        return (
          <div className="life-profile-mobile-root">
            <div className="life-profile-mobile-menu">
              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('finance_income')}>
                <div className="menu-item-icon-container finances-icon">
                  <DollarSign size={20} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Income</span>
                  <span className="menu-item-desc">Salary and extra income</span>
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>

              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('finance_assets')}>
                <div className="menu-item-icon-container assets-icon">
                  <DollarSign size={20} style={{ color: '#16a34a' }} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Assets</span>
                  <span className="menu-item-desc">Cash and investments</span>
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>

              <div className="life-profile-mobile-menu-item" onClick={() => pushScreen('finance_debts')}>
                <div className="menu-item-icon-container debts-icon">
                  <DollarSign size={20} style={{ color: '#dc2626' }} />
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-title">Debts</span>
                  <span className="menu-item-desc">Mortgages and other loans</span>
                </div>
                <ChevronRight size={18} className="chevron-icon" />
              </div>
            </div>
          </div>
        );

      case 'finance_income':
        return (
          <div className="life-profile-mobile-screen">
            <div className="life-profile-mobile-section-header">Primary Annual Income</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Salary</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localSimpleIncome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalSimpleIncome(val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
            </div>

            <div className="life-profile-mobile-section-header">Additional Incomes</div>
            <div className="life-profile-mobile-list">
              {(localProfile.incomeSources || []).length === 0 ? (
                <div className="mobile-empty-state-card">
                  No additional income configured. Add rental incomes, pension commitments, side hustles, etc.
                </div>
              ) : (
                <div className="mobile-items-list-container">
                  {(localProfile.incomeSources || []).map((inc) => (
                    <div key={inc.id} className="mobile-list-item-card">
                      <div className="mobile-list-item-header">
                        <input
                          type="text"
                          className="mobile-item-title-input"
                          value={inc.name}
                          placeholder="Rental Income"
                          onChange={(e) => updateIncomeSource(inc.id, 'name', e.target.value)}
                          onBlur={() => triggerSave()}
                        />
                        <button type="button" className="mobile-item-delete-btn" onClick={() => removeIncomeSource(inc.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mobile-list-item-fields">
                        <div className="mobile-form-group-half">
                          <label>Amount ($/yr)</label>
                          <CurrencyInput
                            className="mobile-input-field-small"
                            value={inc.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateIncomeSource(inc.id, 'amount', val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                        <div className="mobile-form-group-quarter">
                          <label>Growth (%)</label>
                          <PercentInput
                            className="mobile-input-field-small"
                            value={inc.growthRate}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateIncomeSource(inc.id, 'growthRate', val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                        <div className="mobile-form-group-eighth">
                          <label>Start</label>
                          <NumberInput
                            className="mobile-input-field-small"
                            value={inc.startAge}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateIncomeSource(inc.id, 'startAge', val === '' ? 0 : parseInt(val, 10));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                        <div className="mobile-form-group-eighth">
                          <label>End</label>
                          <NumberInput
                            className="mobile-input-field-small"
                            value={inc.endAge}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateIncomeSource(inc.id, 'endAge', val === '' ? 0 : parseInt(val, 10));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                      </div>
                      <div className="mobile-list-item-footer">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!inc.isTaxable}
                            onChange={(e) => updateIncomeSource(inc.id, 'isTaxable', e.target.checked)}
                          />
                          <span>Taxable income</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="mobile-add-btn-full" onClick={addIncomeSource}>
                <Plus size={16} /> Add Income
              </button>
            </div>
          </div>
        );

      case 'finance_assets':
        return (
          <div className="life-profile-mobile-screen">
            <div className="life-profile-mobile-section-header">Liquid Assets</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Cash (Checking / HYSA)</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.cash}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('cash', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Taxable Brokerage</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.brokerage}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('brokerage', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Traditional 401(k)</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.trad401k}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('trad401k', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Traditional IRA</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.tradIra}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('tradIra', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Roth IRA</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.rothIra}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('rothIra', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>HSA Balance</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.hsa}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('hsa', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Crypto Balance</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.crypto}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('crypto', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Business Equity</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.assets.businessEquity}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateAssetField('businessEquity', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
            </div>
          </div>
        );

      case 'finance_debts':
        return (
          <div className="life-profile-mobile-screen">
            {localProfile.home.status === 'own' && (
              <>
                <div className="life-profile-mobile-section-header">Primary Mortgage</div>
                <div className="life-profile-mobile-form-card">
                  <div className="mobile-form-group">
                    <label>Mortgage Balance</label>
                    <CurrencyInput
                      className="mobile-input-field"
                      value={localProfile.home.mortgageBalance}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateHomeField('mortgageBalance', val === '' ? 0 : parseFloat(val));
                      }}
                      onBlur={() => triggerSave()}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="life-profile-mobile-section-header">Other Debts & Loans</div>
            <div className="life-profile-mobile-list">
              {(localProfile.debts || []).length === 0 ? (
                <div className="mobile-empty-state-card">
                  No debts configured. Add loans like car payments, student loans, or credit cards here.
                </div>
              ) : (
                <div className="mobile-items-list-container">
                  {(localProfile.debts || []).map((debt) => (
                    <div key={debt.id} className="mobile-list-item-card">
                      <div className="mobile-list-item-header">
                        <input
                          type="text"
                          className="mobile-item-title-input"
                          value={debt.name}
                          placeholder="e.g. Student Loan"
                          onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                          onBlur={() => triggerSave()}
                        />
                        <button type="button" className="mobile-item-delete-btn" onClick={() => removeDebt(debt.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mobile-list-item-fields">
                        <div className="mobile-form-group-third">
                          <label>Balance ($)</label>
                          <CurrencyInput
                            className="mobile-input-field-small"
                            value={debt.balance}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateDebt(debt.id, 'balance', val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                        <div className="mobile-form-group-third">
                          <label>Rate (%)</label>
                          <PercentInput
                            className="mobile-input-field-small"
                            value={debt.interestRate}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateDebt(debt.id, 'interestRate', val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                        <div className="mobile-form-group-third">
                          <label>Payment ($/mo)</label>
                          <CurrencyInput
                            className="mobile-input-field-small"
                            value={debt.monthlyPayment}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateDebt(debt.id, 'monthlyPayment', val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={() => triggerSave()}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="mobile-add-btn-full" onClick={addDebt}>
                <Plus size={16} /> Add Debt
              </button>
            </div>
          </div>
        );

      case 'work_retirement':
        return (
          <div className="life-profile-mobile-screen">
            <div className="life-profile-mobile-section-header">Employment</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Employment Status</label>
                <select
                  className="mobile-select-field"
                  value={localProfile.household.employmentStatus || 'Employed'}
                  onChange={(e) => updateHouseholdField('employmentStatus', e.target.value)}
                >
                  <option value="Employed">Employed</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Retired">Retired</option>
                  <option value="Not Employed">Not Employed</option>
                </select>
              </div>
              <div className="mobile-form-group">
                <label>Annual Salary</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localSimpleIncome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalSimpleIncome(val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
            </div>

            <div className="life-profile-mobile-section-header">Retirement Goal</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Target Retirement Age</label>
                <NumberInput
                  className="mobile-input-field"
                  value={localTargetRetirementAge === null ? '' : localTargetRetirementAge}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalTargetRetirementAge(val === '' ? '' : parseInt(val, 10));
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const finalRetAge = val === '' ? 65 : parseInt(val, 10);
                    setLocalTargetRetirementAge(finalRetAge);
                    triggerSave({ retireAge: finalRetAge });
                  }}
                />
              </div>
              <div className="mobile-form-group">
                <label>Social Security Claim Age</label>
                <NumberInput
                  className="mobile-input-field"
                  value={localSSClaimingAge === null ? '' : localSSClaimingAge}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalSSClaimingAge(val === '' ? '' : parseInt(val, 10));
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const finalSSAge = val === '' ? 67 : parseInt(val, 10);
                    setLocalSSClaimingAge(finalSSAge);
                    triggerSave({ ssAge: finalSSAge });
                  }}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Tabs definitions for desktop
  const tabs = [
    { id: 'household', label: '💍 Household', icon: '💍' },
    { id: 'home', label: '🏠 Home', icon: '🏠' },
    { id: 'children', label: '👶 Children', icon: '👶' },
    { id: 'debts', label: '💳 Debts', icon: '💳' },
    { id: 'assets', label: '🏦 Assets', icon: '🏦' },
    { id: 'income', label: '💵 Income', icon: '💵' }
  ];

  // Mobile layout rendering
  if (isMobile) {
    return (
      <div className="life-profile-mobile-modal-backdrop" onClick={onClose}>
        <div className="life-profile-mobile-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="life-profile-mobile-header">
            {navStack.length > 1 ? (
              <button type="button" className="life-profile-mobile-back-btn" onClick={popScreenAndSave}>
                <ChevronLeft size={20} />
                <span>Back</span>
              </button>
            ) : (
              <div style={{ width: 60 }} />
            )}
            
            <span className="life-profile-mobile-title">{getMobileScreenTitle()}</span>
            
            <button type="button" className="life-profile-mobile-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          
          <div className="life-profile-mobile-body">
            {renderMobileScreenContent()}
          </div>
        </div>
      </div>
    );
  }

  // Desktop tabbed layout rendering (UNCHANGED)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="life-profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="life-profile-modal-header">
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            💼 Edit Life Profile
          </h3>
          <button type="button" className="life-profile-modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="life-profile-modal-body-layout">
          {/* Left Side: Form Editing Section */}
          <div className="life-profile-edit-column">
            {/* Tabs List */}
            <div className="life-profile-tabs-row">
              {tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`life-profile-tab-button ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Active Tab Content Panel */}
            <div className="life-profile-tab-content-panel">
              {activeTab === 'household' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="life-profile-row-two-col">
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-bold">Your Age</label>
                      <NumberInput
                        className="life-profile-input-field"
                        value={localAge === null ? '' : localAge}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalAge(val === '' ? '' : parseInt(val, 10));
                        }}
                        onBlur={(e) => {
                          const clamped = clampAgeValue(e.target.value);
                          setLocalAge(clamped !== null ? clamped : 35);
                        }}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-bold">Relationship Status</label>
                      <select
                        className="life-profile-select-field"
                        value={localProfile.household.status}
                        onChange={(e) => updateHouseholdField('status', e.target.value)}
                      >
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="partnered">Partnered</option>
                      </select>
                    </div>
                  </div>

                  {(localProfile.household.status === 'married' || localProfile.household.status === 'partnered') && (
                    <div className="life-profile-sub-section">
                      <h4 className="life-profile-sub-section-title" style={{ color: '#7c3aed' }}>Spouse / Partner Financials</h4>
                      <div className="life-profile-row-two-col">
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Annual Income ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.household.partnerIncome}
                            onChange={(e) => updateHouseholdField('partnerIncome', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Cash & Invested Savings ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.household.partnerSavings}
                            onChange={(e) => updateHouseholdField('partnerSavings', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="life-profile-row-two-col">
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Retirement Accounts ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.household.partnerRetirement}
                            onChange={(e) => updateHouseholdField('partnerRetirement', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Other Debts ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.household.partnerDebts}
                            onChange={(e) => updateHouseholdField('partnerDebts', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'home' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="life-profile-form-group">
                    <label className="life-profile-label-bold">Housing Status</label>
                    <select
                      className="life-profile-select-field"
                      value={localProfile.home.status}
                      onChange={(e) => updateHomeField('status', e.target.value)}
                    >
                      <option value="rent">Renting</option>
                      <option value="own">Own Home</option>
                    </select>
                  </div>

                  {localProfile.home.status === 'rent' ? (
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-bold">Monthly Rent ($)</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.home.monthlyRent}
                        onChange={(e) => updateHomeField('monthlyRent', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="life-profile-row-three-col">
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Home Value ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.home.homeValue}
                            onChange={(e) => updateHomeField('homeValue', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Mortgage Balance ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.home.mortgageBalance}
                            onChange={(e) => updateHomeField('mortgageBalance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="life-profile-form-group">
                          <label className="life-profile-label-small">Monthly Payment ($)</label>
                          <CurrencyInput
                            className="life-profile-input-field"
                            value={localProfile.home.monthlyPayment}
                            onChange={(e) => updateHomeField('monthlyPayment', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          className="btn-text-toggle"
                          onClick={() => setShowAdvancedHome(!showAdvancedHome)}
                          style={{ fontSize: '0.8rem', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        >
                          {showAdvancedHome ? 'Hide Advanced Housing Details ▴' : 'Show Advanced Housing Details ▾'}
                        </button>

                        {showAdvancedHome && (
                          <div className="life-profile-row-three-col life-profile-sub-section" style={{ marginTop: '0.75rem' }}>
                            <div className="life-profile-form-group">
                              <label className="life-profile-label-small">Property Taxes ($/yr)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                value={localProfile.home.propertyTaxes}
                                onChange={(e) => updateHomeField('propertyTaxes', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div className="life-profile-form-group">
                              <label className="life-profile-label-small">Insurance ($/yr)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                value={localProfile.home.insurance}
                                onChange={(e) => updateHomeField('insurance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div className="life-profile-form-group">
                              <label className="life-profile-label-small">HOA Fees ($/mo)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                value={localProfile.home.hoa}
                                onChange={(e) => updateHomeField('hoa', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'children' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="life-profile-label-bold" style={{ margin: 0 }}>Children Active Today</label>
                    <button type="button" className="btn-secondary" onClick={addChild} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                      + Add Child
                    </button>
                  </div>

                  {(localProfile.children || []).length === 0 ? (
                    <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No children configured. Add one if you have dependent children today.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {(localProfile.children || []).map((child, index) => (
                        <div key={child.id} className="life-profile-list-item">
                          <div style={{ flex: 2 }}>
                            <input
                              type="text"
                              className="life-profile-text-input"
                              style={{ width: '100%', padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                              value={child.name}
                              placeholder="Child Name"
                              onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                            />
                          </div>
                          <div style={{ width: '60px' }}>
                            <NumberInput
                              className="life-profile-text-input"
                              style={{ width: '100%', padding: '0.25rem 0.45rem', fontSize: '0.85rem', textAlign: 'right' }}
                              value={child.age}
                              placeholder="Age"
                              onChange={(e) => updateChild(child.id, 'age', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <input
                              type="checkbox"
                              checked={child.includeCollege}
                              onChange={(e) => updateChild(child.id, 'includeCollege', e.target.checked)}
                            />
                            <span>Tuition</span>
                          </div>
                          <button type="button" className="btn-icon-delete" onClick={() => removeChild(child.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'debts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="life-profile-label-bold" style={{ margin: 0 }}>Debts & Loans (Excluding Mortgage)</label>
                    <button type="button" className="btn-secondary" onClick={addDebt} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                      + Add Debt
                    </button>
                  </div>

                  {(localProfile.debts || []).length === 0 ? (
                    <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No debts configured. Add loans like car payments, student loans, or credit cards here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {(localProfile.debts || []).map((debt, index) => (
                        <div key={debt.id} className="life-profile-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="life-profile-text-input"
                              style={{ flex: 1, padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                              value={debt.name}
                              placeholder="e.g. Car Loan"
                              onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                            />
                            <button type="button" className="btn-icon-delete" onClick={() => removeDebt(debt.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                              🗑️
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Balance ($)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                value={debt.balance}
                                onChange={(e) => updateDebt(debt.id, 'balance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div style={{ width: '60px' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Rate (%)</label>
                              <PercentInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                value={debt.interestRate}
                                onChange={(e) => updateDebt(debt.id, 'interestRate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Payment ($/mo)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                value={debt.interestRate}
                                onChange={(e) => updateDebt(debt.id, 'interestRate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'assets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="life-profile-label-bold" style={{ margin: 0 }}>Liquid Assets Today</label>
                  <div className="life-profile-row-two-col">
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">💵 Cash (Checking / HYSA)</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.cash}
                        onChange={(e) => updateAssetField('cash', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">📈 Taxable Brokerage</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.brokerage}
                        onChange={(e) => updateAssetField('brokerage', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="life-profile-row-three-col">
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">💼 Traditional 401(k)</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.trad401k}
                        onChange={(e) => updateAssetField('trad401k', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">💼 Traditional IRA</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.tradIra}
                        onChange={(e) => updateAssetField('tradIra', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">💼 Roth IRA</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.rothIra}
                        onChange={(e) => updateAssetField('rothIra', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="life-profile-row-three-col">
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">🏥 HSA Balance</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.hsa}
                        onChange={(e) => updateAssetField('hsa', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">🪙 Crypto Balance</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.crypto}
                        onChange={(e) => updateAssetField('crypto', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="life-profile-form-group">
                      <label className="life-profile-label-small">🏢 Business Equity</label>
                      <CurrencyInput
                        className="life-profile-input-field"
                        value={localProfile.assets.businessEquity}
                        onChange={(e) => updateAssetField('businessEquity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'income' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="life-profile-label-bold" style={{ margin: 0 }}>Additional Incomes Active Today</label>
                    <button type="button" className="btn-secondary" onClick={addIncomeSource} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                      + Add Income
                    </button>
                  </div>

                  {(localProfile.incomeSources || []).length === 0 ? (
                    <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No additional income configured. Add rental incomes, pension commitments, side hustles, etc.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {(localProfile.incomeSources || []).map((inc, index) => (
                        <div key={inc.id} className="life-profile-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="life-profile-text-input"
                              style={{ flex: 1, padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                              value={inc.name}
                              placeholder="e.g. Rental Income"
                              onChange={(e) => updateIncomeSource(inc.id, 'name', e.target.value)}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={inc.isTaxable}
                                onChange={(e) => updateIncomeSource(inc.id, 'isTaxable', e.target.checked)}
                              />
                              <span>Taxable</span>
                            </div>
                            <button type="button" className="btn-icon-delete" onClick={() => removeIncomeSource(inc.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                              🗑️
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <div style={{ flex: 1.5 }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Amount ($/yr)</label>
                              <CurrencyInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                value={inc.amount}
                                onChange={(e) => updateIncomeSource(inc.id, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div style={{ width: '55px' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Growth (%)</label>
                              <PercentInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                                value={inc.growthRate}
                                onChange={(e) => updateIncomeSource(inc.id, 'growthRate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </div>
                            <div style={{ width: '45px' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Start</label>
                              <NumberInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem', textAlign: 'right' }}
                                value={inc.startAge}
                                onChange={(e) => updateIncomeSource(inc.id, 'startAge', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                              />
                            </div>
                            <div style={{ width: '45px' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>End</label>
                              <NumberInput
                                className="life-profile-input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem', textAlign: 'right' }}
                                value={inc.endAge}
                                onChange={(e) => updateIncomeSource(inc.id, 'endAge', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="life-profile-actions">
              <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1.25rem', borderRadius: '6px' }}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave} style={{ padding: '0.5rem 1.5rem', borderRadius: '6px' }}>
                Save Profile
              </button>
            </div>
          </div>

          {/* Right Side: Tinted Summary Cards */}
          <div className="life-profile-summary-column">
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              🔍 Life Today Summary
            </h4>

            <div className="life-profile-summary-cards-container">
              {/* Household Card */}
              <div className="summary-tinted-card card-household">
                <div className="card-header">
                  <span className="card-emoji">💍</span>
                  <span className="card-title">Household status</span>
                </div>
                <div className="card-body">
                  {localProfile.household.status === 'single' ? (
                    <span className="card-highlight">👤 Single</span>
                  ) : (
                    <div>
                      <span className="card-highlight">💍 {localProfile.household.status === 'married' ? 'Married' : 'Partnered'}</span>
                      <div className="card-details">
                        <div>Partner income: {formatCurrency(localProfile.household.partnerIncome)}/yr</div>
                        <div>Partner net assets: {formatCurrency(Number(localProfile.household.partnerSavings || 0) + Number(localProfile.household.partnerRetirement || 0))}</div>
                        {localProfile.household.partnerDebts > 0 && (
                          <div style={{ color: 'var(--danger)' }}>Partner debts: {formatCurrency(localProfile.household.partnerDebts)}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Home Card */}
              <div className="summary-tinted-card card-home">
                <div className="card-header">
                  <span className="card-emoji">🏠</span>
                  <span className="card-title">Housing Status</span>
                </div>
                <div className="card-body">
                  {localProfile.home.status === 'rent' ? (
                    <div>
                      <span className="card-highlight">🏢 Renting</span>
                      <div className="card-details">Rent: {formatCurrency(localProfile.home.monthlyRent)}/mo</div>
                    </div>
                  ) : (
                    <div>
                      <span className="card-highlight">🏠 Home Owner</span>
                      <div className="card-details">
                        <div>Home value: {formatCurrency(localProfile.home.homeValue)}</div>
                        {localProfile.home.mortgageBalance > 0 ? (
                          <>
                            <div>Mortgage: {formatCurrency(localProfile.home.mortgageBalance)}</div>
                            <div>Payment: {formatCurrency(localProfile.home.monthlyPayment)}/mo</div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>Mortgage-Free!</div>
                        )}
                        {(localProfile.home.propertyTaxes > 0 || localProfile.home.insurance > 0 || localProfile.home.hoa > 0) && (
                          <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>
                            Other housing cost: {formatCurrency((Number(localProfile.home.propertyTaxes || 0) + Number(localProfile.home.insurance || 0)) / 12 + Number(localProfile.home.hoa || 0))}/mo
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Children Card */}
              <div className="summary-tinted-card card-children">
                <div className="card-header">
                  <span className="card-emoji">👶</span>
                  <span className="card-title">Children</span>
                </div>
                <div className="card-body">
                  {localProfile.children.length === 0 ? (
                    <span className="card-highlight" style={{ opacity: 0.6 }}>No dependents</span>
                  ) : (
                    <div>
                      <span className="card-highlight">👶 {localProfile.children.length} {localProfile.children.length === 1 ? 'Child' : 'Children'}</span>
                      <div className="card-details">
                        {localProfile.children.map((c, i) => (
                          <div key={c.id}>
                            • {c.name || `Child ${i+1}`} (Age {c.age}) {c.includeCollege ? '🎓 Tuition included' : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Debts Card */}
              <div className="summary-tinted-card card-debts">
                <div className="card-header">
                  <span className="card-emoji">💳</span>
                  <span className="card-title">Debts Today</span>
                </div>
                <div className="card-body">
                  {totalDebtsSum === 0 ? (
                    <span className="card-highlight" style={{ color: 'var(--success)' }}>🎉 Debt-Free!</span>
                  ) : (
                    <div>
                      <span className="card-highlight" style={{ color: 'var(--danger)' }}>💳 {formatCurrency(totalDebtsSum)} Total</span>
                      <div className="card-details">
                        <div>Total payments: {formatCurrency(totalDebtsMonthlyPayments)}/mo</div>
                        {(localProfile.debts || []).map(d => (
                          <div key={d.id} style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                            • {d.name || 'Loan'}: {formatCurrency(d.balance)} @ {d.interestRate}% ({formatCurrency(d.monthlyPayment)}/mo)
                          </div>
                        ))}
                        {localProfile.home.status === 'own' && localProfile.home.mortgageBalance > 0 && (
                          <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                            • Home Mortgage: {formatCurrency(localProfile.home.mortgageBalance)} ({formatCurrency(localProfile.home.monthlyPayment)}/mo)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Assets Card */}
              <div className="summary-tinted-card card-assets">
                <div className="card-header">
                  <span className="card-emoji">🏦</span>
                  <span className="card-title">Liquid Assets Today</span>
                </div>
                <div className="card-body">
                  <span className="card-highlight" style={{ color: 'var(--success)' }}>🏦 {formatCurrency(totalAssetsSum)}</span>
                  <div className="card-details">
                    {localProfile.assets.cash > 0 && <div>Cash: {formatCurrency(localProfile.assets.cash)}</div>}
                    {localProfile.assets.brokerage > 0 && <div>Brokerage: {formatCurrency(localProfile.assets.brokerage)}</div>}
                    {localProfile.assets.trad401k > 0 && <div>Traditional 401(k): {formatCurrency(localProfile.assets.trad401k)}</div>}
                    {localProfile.assets.tradIra > 0 && <div>Traditional IRA: {formatCurrency(localProfile.assets.tradIra)}</div>}
                    {localProfile.assets.rothIra > 0 && <div>Roth IRA: {formatCurrency(localProfile.assets.rothIra)}</div>}
                    {localProfile.assets.hsa > 0 && <div>HSA: {formatCurrency(localProfile.assets.hsa)}</div>}
                    {localProfile.assets.crypto > 0 && <div>Crypto: {formatCurrency(localProfile.assets.crypto)}</div>}
                    {localProfile.assets.businessEquity > 0 && <div>Business: {formatCurrency(localProfile.assets.businessEquity)}</div>}
                  </div>
                </div>
              </div>

              {/* Additional Income Card */}
              <div className="summary-tinted-card card-income">
                <div className="card-header">
                  <span className="card-emoji">💵</span>
                  <span className="card-title">Additional Income</span>
                </div>
                <div className="card-body">
                  {localProfile.incomeSources.length === 0 ? (
                    <span className="card-highlight" style={{ opacity: 0.6 }}>No additional income</span>
                  ) : (
                    <div>
                      <span className="card-highlight">💵 {formatCurrency(localProfile.incomeSources.reduce((sum, i) => sum + Number(i.amount || 0), 0))}/yr</span>
                      <div className="card-details">
                        {localProfile.incomeSources.map(i => (
                          <div key={i.id} style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                            • {i.name || 'Income'}: {formatCurrency(i.amount)}/yr ({i.growthRate}% raises, ages {i.startAge}-{i.endAge})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
