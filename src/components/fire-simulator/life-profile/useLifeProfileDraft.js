import { useState, useEffect, useRef } from 'react';
import { defaultProfile } from './lifeProfileDraftUtils';
import { getSaveUpdates } from './lifeProfileSaveAdapter';
import { setLastChartChangeType } from '../changeTypeTracker';

export default function useLifeProfileDraft({
  isOpen,
  onClose,
  inputs,
  updateInput,
  initialTab = 'timeline',
  isMobile = false
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

  const wasOpenRef = useRef(false);

  // Sync state with inputs when modal opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
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
      wasOpenRef.current = false;
    }
  }, [isOpen, inputs, initialTab]);

  // Save profile updates to scenario state
  const saveToParent = (profileData, ageData, lifeExpData, salaryData, retireAgeData, ssAgeData, bhEnabled, bhAge, bhPrice) => {
    setLastChartChangeType('profile_value_change');
    
    const updates = getSaveUpdates({
      profile: profileData,
      age: ageData,
      lifeExp: lifeExpData,
      salary: salaryData,
      retireAge: retireAgeData,
      ssAge: ssAgeData,
      bhEnabled,
      bhAge,
      bhPrice
    }, inputs);

    Object.entries(updates).forEach(([key, val]) => {
      updateInput(key, val);
    });
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

  return {
    activeTab,
    setActiveTab,
    expandedCategories,
    setExpandedCategories,
    showAdvancedHome,
    setShowAdvancedHome,
    isSummaryExpanded,
    setIsSummaryExpanded,
    navStack,
    setNavStack,
    localProfile,
    setLocalProfile,
    localAge,
    setLocalAge,
    selectedAge,
    setSelectedAge,
    localLifeExpectancy,
    setLocalLifeExpectancy,
    localSimpleIncome,
    setLocalSimpleIncome,
    localTargetRetirementAge,
    setLocalTargetRetirementAge,
    localSSClaimingAge,
    setLocalSSClaimingAge,
    localBuyHouseEnabled,
    setLocalBuyHouseEnabled,
    localBuyHouseAge,
    setLocalBuyHouseAge,
    localBuyHousePrice,
    setLocalBuyHousePrice,
    updateHouseholdField,
    updateHomeField,
    updateAssetField,
    addChild,
    updateChild,
    removeChild,
    addDebt,
    updateDebt,
    removeDebt,
    addIncomeSource,
    updateIncomeSource,
    removeIncomeSource,
    pushScreen,
    popScreen,
    popScreenAndSave,
    triggerSave,
    handleSave
  };
}
