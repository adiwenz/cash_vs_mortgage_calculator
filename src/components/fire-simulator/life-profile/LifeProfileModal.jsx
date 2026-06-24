import React, { useState, useEffect } from 'react';
import { CurrencyInput, PercentInput, NumberInput } from '../../ui/PlainInputs';
import { formatCurrency, clampAgeValue, formatCompactCurrency } from '../helpers';
import { setLastChartChangeType } from '../changeTypeTracker';
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
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings
} from 'lucide-react';
import { getTimelineProjection, getLifeSnapshotAtAge } from '../../../models/lifeTimeline/index.js';
import { buildTimelineRows, getTimelineItemObjectKey, doesItemBelongToObject, resolveHouseIdForEvent } from '../../../utils/timelineRowBuilder.js';

import LifeProfileHeader from './LifeProfileHeader';
import LifeProfileTabs from './LifeProfileTabs';
import HouseholdTab from './HouseholdTab';
import HousingTab from './HousingTab';
import ChildrenTab from './ChildrenTab';
import IncomeTab from './IncomeTab';
import AssetsTab from './AssetsTab';
import DebtsTab from './DebtsTab';
import TimelineSnapshotTab from './TimelineSnapshotTab';



export default function LifeProfileModal({
  isOpen,
  onClose,
  inputs,
  updateInput,
  initialTab = 'timeline',
  isMobile = false,
  simulation
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [expandedCategories, setExpandedCategories] = useState({
    children: true,
    housing: true,
    income: true,
    relationship: true,
    education: true,
    debt: true,
    assets: true,
    'major-events': true
  });
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
  const [selectedAge, setSelectedAge] = useState(inputs.currentAge || 35);
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
      setSelectedAge(inputs.currentAge || 35);
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
        return 'Life Planner';
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
        return 'Life Planner';
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

      case 'household':
      case 'child_details':
        return (
          <HouseholdTab
            isMobile={true}
            currentScreen={currentScreen}
            localAge={localAge}
            setLocalAge={setLocalAge}
            localLifeExpectancy={localLifeExpectancy}
            setLocalLifeExpectancy={setLocalLifeExpectancy}
            localProfile={localProfile}
            setLocalProfile={setLocalProfile}
            updateHouseholdField={updateHouseholdField}
            triggerSave={triggerSave}
            updateChild={updateChild}
            removeChild={removeChild}
            addChild={addChild}
            pushScreen={pushScreen}
            popScreen={popScreen}
          />
        );

      case 'home':
        return (
          <HousingTab
            isMobile={true}
            localProfile={localProfile}
            updateHomeField={updateHomeField}
            triggerSave={triggerSave}
            localBuyHouseEnabled={localBuyHouseEnabled}
            setLocalBuyHouseEnabled={setLocalBuyHouseEnabled}
            localBuyHouseAge={localBuyHouseAge}
            setLocalBuyHouseAge={setLocalBuyHouseAge}
            localBuyHousePrice={localBuyHousePrice}
            setLocalBuyHousePrice={setLocalBuyHousePrice}
            showAdvancedHome={showAdvancedHome}
            setShowAdvancedHome={setShowAdvancedHome}
          />
        );

      case 'finance_income':
      case 'work_retirement':
        return (
          <IncomeTab
            isMobile={true}
            currentScreen={currentScreen}
            localSimpleIncome={localSimpleIncome}
            setLocalSimpleIncome={setLocalSimpleIncome}
            localTargetRetirementAge={localTargetRetirementAge}
            setLocalTargetRetirementAge={setLocalTargetRetirementAge}
            localSSClaimingAge={localSSClaimingAge}
            setLocalSSClaimingAge={setLocalSSClaimingAge}
            localProfile={localProfile}
            updateHouseholdField={updateHouseholdField}
            updateIncomeSource={updateIncomeSource}
            removeIncomeSource={removeIncomeSource}
            addIncomeSource={addIncomeSource}
            triggerSave={triggerSave}
          />
        );

      case 'finance_assets':
        return (
          <AssetsTab
            isMobile={true}
            localProfile={localProfile}
            updateAssetField={updateAssetField}
            triggerSave={triggerSave}
          />
        );

      case 'finance_debts':
        return (
          <DebtsTab
            isMobile={true}
            localProfile={localProfile}
            updateDebt={updateDebt}
            removeDebt={removeDebt}
            addDebt={addDebt}
            triggerSave={triggerSave}
            updateHomeField={updateHomeField}
          />
        );

      default:
        return null;
    }
  };

  // Tabs definitions for desktop & mobile
  const tabs = [
    { id: 'timeline', label: '📈 Timeline', icon: '📈' },
    { id: 'household', label: '💍 Household', icon: '💍' },
    { id: 'home', label: '🏠 Home', icon: '🏠' },
    { id: 'children', label: '👶 Children', icon: '👶' },
    { id: 'debts', label: '💳 Debts', icon: '💳' },
    { id: 'assets', label: '🏦 Assets', icon: '🏦' },
    { id: 'income', label: '💵 Income', icon: '💵' }
  ];

  // Derive projection and snapshot
  const projection = getTimelineProjection(inputs, { selectedAge, simulation });
  const snapshot = getLifeSnapshotAtAge(inputs, selectedAge);

  const getCategoryBg = (rowId) => {
    switch (rowId) {
      case 'relationship': return '#f3e8ff';
      case 'housing': return '#dcfce7';
      case 'children': return '#ffedd5';
      case 'education': return '#dbeafe';
      case 'debt': return '#fae8ff';
      case 'income': return '#ccfbf1';
      case 'assets': return '#fef9c3';
      default: return '#f3f4f6';
    }
  };

  const getMilestoneIcon = (category) => {
    switch (category) {
      case 'relationship': return '❤️';
      case 'housing': return '🏠';
      case 'children': return '👶';
      case 'education': return '🎓';
      case 'debt': return '💸';
      case 'income': return '💼';
      default: return '⭐️';
    }
  };

  const getMilestoneIconBg = (category) => {
    return getCategoryBg(category);
  };

  const formatRelationshipStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Single';
  };

  const formatChildrenSnapshot = (children) => {
    if (!children || children.length === 0) return 'None';
    return children.map(c => `${c.name} (Age ${Math.floor(c.age)})`).join(', ');
  };

  const formatNetWorthValue = (proj, age, fallback) => {
    const assetsRow = proj.rows.find(r => r.id === 'assets');
    const seriesItem = assetsRow?.items.find(item => item.type === 'series');
    const points = seriesItem?.metadata?.points || [];
    const pointAtAge = points.find(p => p.age === age);
    const netWorthVal = pointAtAge ? pointAtAge.value : fallback;
    return formatCurrency(netWorthVal);
  };

  const formatDebtsList = (activeDebts) => {
    if (!activeDebts || activeDebts.length === 0) return 'None';
    return activeDebts.map(d => d.name).join(', ');
  };

  const renderSnapshotRow = (icon, label, value) => {
    return (
      <div className="life-snapshot-row-item" key={label}>
        <div className="life-snapshot-row-item-left">
          <div className="life-snapshot-row-item-icon-circle">
            {icon}
          </div>
          <span className="life-snapshot-row-item-label">{label}</span>
        </div>
        <span className="life-snapshot-row-item-value">{value}</span>
      </div>
    );
  };

  const renderPeriodBar = (item, minAge, maxAge) => {
    const range = maxAge - minAge || 1;
    const start = Math.max(minAge, item.startAge);
    const end = Math.min(maxAge, item.endAge);
    if (start >= end) return null;
    const left = ((start - minAge) / range) * 100;
    const width = ((end - start) / range) * 100;
    return (
      <div 
        key={item.id}
        style={{ 
          position: 'absolute', 
          left: `${left}%`, 
          width: `${width}%`, 
          display: 'flex', 
          alignItems: 'center',
          top: '50%',
          transform: 'translateY(-50%)',
          height: '24px'
        }}
      >
        <div 
          className={`timeline-period-bar cat-${item.category}`} 
          style={{ width: '100%', position: 'relative', top: 'auto', transform: 'none' }}
          title={`${item.title} (Ages ${item.startAge}-${item.endAge})`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </span>
        </div>
        {width < 60 && !(item.id && item.id.startsWith('status-')) && (
          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginLeft: '6px', whiteSpace: 'nowrap' }}>
            Age {item.startAge}-{item.endAge}
          </span>
        )}
      </div>
    );
  };

  const renderPointMarker = (item, minAge, maxAge) => {
    const range = maxAge - minAge || 1;
    const age = item.age !== null ? item.age : item.startAge;
    if (age < minAge || age > maxAge) return null;
    const left = ((age - minAge) / range) * 100;
    return (
      <div key={item.id} className="timeline-point-marker" style={{ left: `${left}%` }}>
        <div className={`timeline-point-dot dot-${item.category}`} />
        <div className="timeline-point-label-card" style={{ bottom: '14px', zIndex: 15 }}>
          <span style={{ fontWeight: '700' }}>{item.title}</span>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>Age {age}</span>
        </div>
      </div>
    );
  };

  const renderSeriesLine = (item, minAge, maxAge) => {
    const points = item.metadata?.points || [];
    if (points.length === 0) return null;
    const values = points.map(p => p.value);
    const maxNW = Math.max(...values, 100000);
    const minNW = Math.min(...values, 0);
    const rangeNW = maxNW - minNW || 1;
    const range = maxAge - minAge || 1;
    
    const svgPoints = points.map(p => {
      const x = ((p.age - minAge) / range) * 100;
      const y = 80 - ((p.value - minNW) / rangeNW) * 60;
      return { x, y, age: p.age, value: p.value };
    });

    const lineD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = svgPoints.length > 0 
      ? `${lineD} L ${svgPoints[svgPoints.length - 1].x} 100 L ${svgPoints[0].x} 100 Z` 
      : '';

    const nodeAges = [projection.currentAge, Number(inputs.targetRetirementAge) || 65, maxAge];
    const nodes = svgPoints.filter(p => nodeAges.includes(p.age));

    return (
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill="url(#netWorthGradient)" />}
          {lineD && <path d={lineD} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3 3" />}
        </svg>
        {nodes.map(n => (
          <div 
            key={n.age} 
            style={{ 
              position: 'absolute', 
              left: `${n.x}%`, 
              top: `${n.y}%`, 
              transform: 'translate(-50%, -50%)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              zIndex: 11
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', border: '1.5px solid #ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#2563eb', background: '#ffffff', padding: '1px 3px', borderRadius: '4px', border: '1px solid #e5e7eb', marginTop: '-18px', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {formatCompactCurrency(n.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderTimelineRows = (proj, age) => {
    const minAge = proj.minAge;
    const maxAge = proj.maxAge;

    const allDescriptors = buildTimelineRows(inputs);

    // Normalize all timeline items by category ID to have objectType, objectId, and rowKey.
    const normalizedItemsByCategoryId = {};
    proj.rows.forEach(categoryRow => {
      let items = categoryRow.items || [];
      if (categoryRow.id === 'housing') {
        // Filter out status-housing- items (renting, homeowner)
        items = items.filter(item => !String(item.id || '').startsWith('status-housing-'));
      }

      normalizedItemsByCategoryId[categoryRow.id] = items.map(item => {
        const rowKey = getTimelineItemObjectKey(item, inputs);
        let objectType = null;
        let objectId = null;
        if (rowKey) {
          const parts = rowKey.split('-');
          objectType = parts[0];
          objectId = parts.slice(1).join('-');
        }
        return {
          ...item,
          objectType,
          objectId,
          rowKey
        };
      });
    });

    // Add custom ownership period bars for each house asset in the Housing category
    const housingObjects = allDescriptors.filter(d => d.type === 'object' && d.parent === 'housing');
    if (!normalizedItemsByCategoryId['housing']) {
      normalizedItemsByCategoryId['housing'] = [];
    }

    housingObjects.forEach(houseRow => {
      const houseId = houseRow.objectId;
      const enabledEvents = (inputs.lifeEvents || []).filter(e => e.enabled !== false);
      
      const buyEv = enabledEvents.find(e => e.type === 'buyHouse' && (e.houseId === houseId || e.id === houseId || resolveHouseIdForEvent(e, inputs) === houseId));
      const startAge = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : (buyEv.age || 35)) : (Number(inputs.currentAge) || 35);
      
      const sellEv = enabledEvents.find(e => e.type === 'sellHouse' && (e.houseId === houseId || e.id === houseId || resolveHouseIdForEvent(e, inputs) === houseId));
      const endAge = sellEv ? Number(sellEv.age || 85) : (Number(inputs.lifeExpectancy) || 85);

      if (startAge < endAge) {
        normalizedItemsByCategoryId['housing'].push({
          id: `housing-own-period-${houseId}`,
          type: 'period',
          category: 'housing',
          title: `${houseRow.label} (Owned)`,
          startAge,
          endAge,
          rowKey: houseRow.rowKey,
          objectType: 'housing',
          objectId: houseId
        });
      }
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '140px', right: 0, top: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
          {proj.currentAge >= minAge && proj.currentAge <= maxAge && (
            <div 
              style={{
                position: 'absolute',
                left: `${((proj.currentAge - minAge) / (maxAge - minAge || 1)) * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'rgba(22, 163, 74, 0.25)',
                borderLeft: '1px dashed #16a34a',
              }}
            />
          )}
        </div>

        {allDescriptors.map(descriptor => {
          if (descriptor.type === 'category') {
            const isExpanded = !!expandedCategories[descriptor.id];
            const parentItems = normalizedItemsByCategoryId[descriptor.id] || [];

            // If expanded, render only category-level items (rowKey is null)
            // If collapsed, render all items in the category
            const visibleItems = isExpanded
              ? parentItems.filter(item => !item.rowKey)
              : parentItems;

            const isAssets = descriptor.id === 'assets';
            const seriesItem = visibleItems.find(item => item.type === 'series');
            const hasSeriesData = isAssets && seriesItem && seriesItem.metadata?.points && seriesItem.metadata.points.length > 0;

            return (
              <div key={descriptor.id} className="timeline-row-track">
                <div 
                  className="timeline-row-label-col"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpandedCategories(prev => ({
                    ...prev,
                    [descriptor.id]: !prev[descriptor.id]
                  }))}
                >
                  <span style={{ fontSize: '0.65rem', width: '12px', display: 'inline-block', color: 'var(--text-secondary)' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <div className="timeline-row-icon-wrapper" style={{ background: getCategoryBg(descriptor.id) }}>
                    <span style={{ fontSize: '0.85rem' }}>{descriptor.icon}</span>
                  </div>
                  <span className="timeline-row-label-text">
                    {descriptor.label}
                    {descriptor.count > 0 && (
                      <span className="category-count-badge" style={{ color: 'var(--text-tertiary)', marginLeft: '4px', fontSize: '0.72rem' }}>
                        [{descriptor.count}]
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
                  <div className="timeline-row-baseline-track-line" />
                  
                  {isAssets ? (
                    hasSeriesData ? (
                      renderSeriesLine(seriesItem, minAge, maxAge)
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '1rem', color: 'var(--text-tertiary)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        No Net Worth projection series data available
                      </div>
                    )
                  ) : (
                    visibleItems.map(item => {
                      if (item.type === 'period') {
                        return renderPeriodBar(item, minAge, maxAge);
                      }
                      if (item.type === 'point') {
                        return renderPointMarker(item, minAge, maxAge);
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
            );
          } else if (descriptor.type === 'object') {
            const isParentExpanded = !!expandedCategories[descriptor.parent];
            if (!isParentExpanded) return null;

            const parentItems = normalizedItemsByCategoryId[descriptor.parent] || [];
            const objectItems = parentItems.filter(item => item.rowKey === descriptor.rowKey);

            return (
              <div key={descriptor.rowKey} className="timeline-row-track sub-row">
                <div className="timeline-row-label-col sub-row" style={{ paddingLeft: '1.25rem' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginRight: '6px', opacity: 0.6 }}>
                    ├─
                  </span>
                  <div className="timeline-row-icon-wrapper sub-icon" style={{ background: getCategoryBg(descriptor.parent), width: '22px', height: '22px', minWidth: '22px' }}>
                    <span style={{ fontSize: '0.7rem' }}>{descriptor.icon}</span>
                  </div>
                  <span className="timeline-row-label-text sub-label" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {descriptor.label}
                  </span>
                </div>
                
                <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
                  <div className="timeline-row-baseline-track-line" />
                  
                  {objectItems.map(item => {
                    if (item.type === 'period') {
                      return renderPeriodBar(item, minAge, maxAge);
                    }
                    if (item.type === 'point') {
                      return renderPointMarker(item, minAge, maxAge);
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderAgeAxis = (minAge, maxAge, currentAge) => {
    const range = maxAge - minAge || 1;
    const step = range > 40 ? 10 : (range > 20 ? 5 : 2);
    const startTick = Math.ceil(minAge / step) * step;
    const ticks = [];
    for (let a = startTick; a <= maxAge; a += step) {
      ticks.push(a);
    }
    return (
      <div className="timeline-row-track" style={{ height: '32px', borderBottom: '1px solid #f3f4f6', marginBottom: '8px' }}>
        <div className="timeline-row-label-col">
          <span className="timeline-row-label-text" style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Age</span>
        </div>
        <div className="timeline-row-plot-col" style={{ overflow: 'visible' }}>
          {ticks.map(a => {
            const pct = ((a - minAge) / range) * 100;
            return (
              <div key={a} className="timeline-tick-new" style={{ left: `${pct}%` }}>
                <div className="timeline-tick-mark-new" />
                <span className="timeline-tick-label-new">{a}</span>
              </div>
            );
          })}
          
          {currentAge >= minAge && currentAge <= maxAge && (
            <div 
              style={{ 
                position: 'absolute', 
                left: `${((currentAge - minAge) / range) * 100}%`, 
                transform: 'translateX(-50%)', 
                top: '-14px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                zIndex: 12 
              }}
            >
              <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', marginBottom: '2px' }}>Today</span>
              <div 
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  background: '#16a34a', 
                  color: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '0.65rem', 
                  fontWeight: '800', 
                  border: '2px solid #ffffff', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)' 
                }}
              >
                {currentAge}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Mobile layout rendering
  if (isMobile) {
    return (
      <div className="life-profile-mobile-modal-backdrop" onClick={onClose}>
        <div className="life-profile-mobile-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="life-profile-mobile-header">
            {navStack.length > 1 && activeTab !== 'timeline' ? (
              <button type="button" className="life-profile-mobile-back-btn" onClick={popScreenAndSave}>
                <ChevronLeft size={20} />
                <span>Back</span>
              </button>
            ) : (
              <div style={{ width: 60 }} />
            )}
            
            <span className="life-profile-mobile-title">
              {activeTab === 'timeline' ? 'Timeline' : getMobileScreenTitle()}
            </span>
            
            <button type="button" className="life-profile-mobile-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Mobile Tabs navigation row */}
          <div className="life-profile-tabs-row" style={{ display: 'flex', overflowX: 'auto', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', gap: '0.5rem', background: '#ffffff' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                className={`life-profile-tab-button ${activeTab === t.id ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          
          <div className="life-profile-mobile-body" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {activeTab === 'timeline' ? (
              <div className="timeline-workspace-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                <div className="timeline-canvas-card" style={{ padding: '1rem' }}>
                  <div className="timeline-header-section" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Timeline</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>See how the major aspects of your life change over time.</p>
                  </div>
                  <div className="timeline-canvas-body" style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                    <div style={{ minWidth: '600px', position: 'relative' }}>
                      {renderAgeAxis(projection.minAge, projection.maxAge, projection.currentAge)}
                      {renderTimelineRows(projection, selectedAge)}
                    </div>
                  </div>
                </div>
                
                <div className="life-snapshot-panel" style={{ padding: '1rem' }}>
                  <div className="life-snapshot-header">
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Life Snapshot</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>View your life at any age.</p>
                  </div>
                  <div className="life-snapshot-age-selector-row" style={{ margin: '0.5rem 0' }}>
                    <span className="age-selector-text">Age {selectedAge} {selectedAge === projection.currentAge ? '(Today)' : ''}</span>
                  </div>
                  <div className="life-snapshot-rows-list">
                    {renderSnapshotRow('❤️', 'Relationship', formatRelationshipStatus(snapshot.relationshipStatus))}
                    {renderSnapshotRow('🏠', 'Housing', snapshot.housingStatus === 'own' ? 'Homeowner' : 'Renting')}
                    {renderSnapshotRow('👶', 'Children', formatChildrenSnapshot(snapshot.children))}
                    {renderSnapshotRow('💼', 'Annual Income', formatCurrency(snapshot.income.annualIncome) + ' / yr')}
                    {renderSnapshotRow('📈', 'Net Worth', formatNetWorthValue(projection, selectedAge, snapshot.assets.investedAssets))}
                    {renderSnapshotRow('💸', 'Debts', formatDebtsList(snapshot.debts.activeDebts))}
                  </div>
                  
                  <div className="upcoming-milestones-container">
                    <h5 style={{ fontSize: '0.82rem', fontWeight: '800', margin: '0.5rem 0 0 0' }}>Upcoming Milestones</h5>
                    {projection.upcomingMilestones.length === 0 ? (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>No upcoming milestones</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {projection.upcomingMilestones.map(m => (
                          <div key={m.id} className="upcoming-milestone-card">
                            <div className="upcoming-milestone-icon-circle" style={{ background: getMilestoneIconBg(m.category) }}>
                              {getMilestoneIcon(m.category)}
                            </div>
                            <div className="upcoming-milestone-text-group">
                              <span className="upcoming-milestone-title-text">{m.title}</span>
                              <span className="upcoming-milestone-timing-text">Age {m.age} (In {m.age - projection.currentAge} years)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              renderMobileScreenContent()
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop tabbed layout rendering
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="life-profile-modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: activeTab === 'timeline' ? '1400px' : '960px', 
          width: '95%', 
          transition: 'max-width 0.2s' 
        }}
      >
        <div className="life-profile-modal-header">
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            💼 Life Planner
          </h3>
          <button type="button" className="life-profile-modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Tabs Row (moved here to span full width of the card) */}
        <div className="life-profile-tabs-row" style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', background: '#ffffff' }}>
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

        <div className={`life-profile-modal-body-layout ${activeTab === 'timeline' ? 'timeline-active' : ''}`}>
          {activeTab === 'timeline' ? (
            <div className="timeline-workspace-container">
              {/* Left Column: Timeline Canvas */}
              <div className="timeline-canvas-card">
                <div className="timeline-header-section">
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Timeline</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>See how the major aspects of your life change over time.</p>
                  </div>
                  
                  <div className="timeline-controls-row">
                    <button type="button" className="timeline-btn" disabled><ZoomOut size={14} /> Zoom Out</button>
                    <button type="button" className="timeline-btn" disabled><ZoomIn size={14} /> Zoom In</button>
                    <button type="button" className="timeline-btn" disabled><Maximize2 size={14} /> Fit to View</button>
                    <button type="button" className="timeline-btn" disabled>Legend</button>
                    <button type="button" className="timeline-btn" disabled><Settings size={14} /> Settings</button>
                  </div>
                </div>

                <div className="timeline-canvas-body" style={{ marginTop: '1rem' }}>
                  {renderAgeAxis(projection.minAge, projection.maxAge, projection.currentAge)}
                  {renderTimelineRows(projection, selectedAge)}
                </div>
              </div>

              {/* Right Column: Life Snapshot */}
              <div className="life-snapshot-panel">
                <div className="life-snapshot-header">
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Life Snapshot</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>View your life at any age.</p>
                </div>

                {/* Selected Age Indicator */}
                <div className="life-snapshot-age-selector-row">
                  <button type="button" className="age-selector-arrow-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>&larr;</button>
                  <span className="age-selector-text">Age {selectedAge} {selectedAge === projection.currentAge ? '(Today)' : ''}</span>
                  <button type="button" className="age-selector-arrow-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>&rarr;</button>
                </div>

                {/* Snapshot Rows */}
                <div className="life-snapshot-rows-list">
                  {renderSnapshotRow('❤️', 'Relationship', formatRelationshipStatus(snapshot.relationshipStatus))}
                  {renderSnapshotRow('🏠', 'Housing', snapshot.housingStatus === 'own' ? 'Homeowner' : 'Renting')}
                  {renderSnapshotRow('👶', 'Children', formatChildrenSnapshot(snapshot.children))}
                  {renderSnapshotRow('💼', 'Annual Income', formatCurrency(snapshot.income.annualIncome) + ' / yr')}
                  {renderSnapshotRow('📈', 'Net Worth', formatNetWorthValue(projection, selectedAge, snapshot.assets.investedAssets))}
                  {renderSnapshotRow('💸', 'Debts', formatDebtsList(snapshot.debts.activeDebts))}
                </div>

                {/* Upcoming Milestones */}
                <div className="upcoming-milestones-container">
                  <h5 style={{ fontSize: '0.85rem', fontWeight: '800', margin: '0.5rem 0 0 0', color: 'var(--text-primary)' }}>Upcoming Milestones</h5>
                  {projection.upcomingMilestones.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>No upcoming milestones</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {projection.upcomingMilestones.map(m => (
                        <div key={m.id} className="upcoming-milestone-card">
                          <div className="upcoming-milestone-icon-circle" style={{ background: getMilestoneIconBg(m.category) }}>
                            {getMilestoneIcon(m.category)}
                          </div>
                          <div className="upcoming-milestone-text-group">
                            <span className="upcoming-milestone-title-text">{m.title}</span>
                            <span className="upcoming-milestone-timing-text">Age {m.age} (In {m.age - projection.currentAge} years)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button type="button" className="timeline-btn" disabled style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    View Full Events List
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Left Side: Form Editing Section */}
              <div className="life-profile-edit-column">
                {/* Active Tab Content Panel */}
                <div className="life-profile-tab-content-panel">
                  {activeTab === 'household' && (
                    <HouseholdTab
                      isMobile={false}
                      localAge={localAge}
                      setLocalAge={setLocalAge}
                      localProfile={localProfile}
                      updateHouseholdField={updateHouseholdField}
                      updateChild={updateChild}
                      removeChild={removeChild}
                      addChild={addChild}
                    />
                  )}

                  {activeTab === 'home' && (
                    <HousingTab
                      isMobile={false}
                      localProfile={localProfile}
                      updateHomeField={updateHomeField}
                      localBuyHouseEnabled={localBuyHouseEnabled}
                      setLocalBuyHouseEnabled={setLocalBuyHouseEnabled}
                      localBuyHouseAge={localBuyHouseAge}
                      setLocalBuyHouseAge={setLocalBuyHouseAge}
                      localBuyHousePrice={localBuyHousePrice}
                      setLocalBuyHousePrice={setLocalBuyHousePrice}
                      showAdvancedHome={showAdvancedHome}
                      setShowAdvancedHome={setShowAdvancedHome}
                    />
                  )}

                  {activeTab === 'children' && (
                    <ChildrenTab
                      localProfile={localProfile}
                      addChild={addChild}
                      updateChild={updateChild}
                      removeChild={removeChild}
                    />
                  )}

                  {activeTab === 'debts' && (
                    <DebtsTab
                      isMobile={false}
                      localProfile={localProfile}
                      updateDebt={updateDebt}
                      removeDebt={removeDebt}
                      addDebt={addDebt}
                    />
                  )}

                  {activeTab === 'assets' && (
                    <AssetsTab
                      isMobile={false}
                      localProfile={localProfile}
                      updateAssetField={updateAssetField}
                    />
                  )}

                  {activeTab === 'income' && (
                    <IncomeTab
                      isMobile={false}
                      localSimpleIncome={localSimpleIncome}
                      setLocalSimpleIncome={setLocalSimpleIncome}
                      localTargetRetirementAge={localTargetRetirementAge}
                      setLocalTargetRetirementAge={setLocalTargetRetirementAge}
                      localSSClaimingAge={localSSClaimingAge}
                      setLocalSSClaimingAge={setLocalSSClaimingAge}
                      localProfile={localProfile}
                      updateIncomeSource={updateIncomeSource}
                      removeIncomeSource={removeIncomeSource}
                      addIncomeSource={addIncomeSource}
                    />
                  )}
                </div>

                <div className="life-profile-actions-panel" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={handleSave} style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>
                    Save Profile
                  </button>
                </div>
              </div>

              {/* Right Side: Summary Section */}
              <div className="life-profile-summary-column">
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Your Profile Summary</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Household Card */}
                  <div className="summary-tinted-card card-household">
                    <div className="card-header">
                      <span className="card-emoji">💍</span>
                      <span className="card-title">Household</span>
                    </div>
                    <div className="card-body">
                      <div>
                        <span className="card-highlight">👤 Age {localAge}</span>
                        <div className="card-details">Life Expectancy: {localLifeExpectancy} yrs</div>
                      </div>
                      <div style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '0.4rem' }}>
                        {localProfile.household.status === 'single' ? (
                          <span className="card-highlight">👤 Single</span>
                        ) : (
                          <div>
                            <span className="card-highlight">👥 {localProfile.household.status === 'married' ? 'Married' : 'Partnered'}</span>
                            <div className="card-details">
                              <div>Partner Age: {localProfile.household.partnerAge || 35}</div>
                              <div>Partner Salary: {formatCurrency(localProfile.household.partnerIncome)}/yr</div>
                              {localProfile.household.partnerSavings > 0 && <div>Partner savings: {formatCurrency(localProfile.household.partnerSavings)}</div>}
                              {localProfile.household.partnerRetirement > 0 && <div>Partner retirement: {formatCurrency(localProfile.household.partnerRetirement)}</div>}
                              {localProfile.household.partnerDebts > 0 && <div>Partner debts: {formatCurrency(localProfile.household.partnerDebts)}</div>}
                            </div>
                          </div>
                        )}
                      </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
