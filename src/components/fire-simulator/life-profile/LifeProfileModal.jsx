import { 
  ChevronRight, 
  Users, 
  Home as HomeIcon, 
  DollarSign, 
  Briefcase, 
  Check, 
  Info
} from 'lucide-react';
import { formatCurrency } from '../helpers';
import { getTimelineProjection, getLifeSnapshotAtAge } from '../../../models/lifeTimeline/index.js';
import { getProfileTotals, getProfileCompletion } from './lifeProfileDraftUtils';
import {
  LifeProfileHeader,
  LifeProfileTabs,
  HouseholdTab,
  HousingTab,
  ChildrenTab,
  IncomeTab,
  AssetsTab,
  DebtsTab,
  TimelineSnapshotTab,
  useLifeProfileDraft
} from './index.js';


export default function LifeProfileModal({
  isOpen,
  onClose,
  inputs,
  updateInput,
  initialTab = 'timeline',
  isMobile = false,
  simulation
}) {
  const {
    activeTab,
    setActiveTab,
    expandedCategories,
    setExpandedCategories,
    showAdvancedHome,
    setShowAdvancedHome,
    navStack,
    localProfile,
    setLocalProfile,
    localAge,
    setLocalAge,
    selectedAge,
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
  } = useLifeProfileDraft({
    isOpen,
    onClose,
    inputs,
    updateInput,
    initialTab,
    isMobile
  });

  if (!isOpen) return null;

  // Summary Metrics calculations
  const { totalAssetsSum, totalDebtsSum, totalDebtsMonthlyPayments } = getProfileTotals(localProfile);

  // Completion statuses
  const { isHouseholdCompleted, isHomeCompleted, isFinancesCompleted, isWorkCompleted } = getProfileCompletion({
    profile: localProfile,
    age: localAge,
    simpleIncome: localSimpleIncome,
    targetRetirementAge: localTargetRetirementAge,
    ssClaimingAge: localSSClaimingAge
  });

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
            updateChild={updateChild}
            addChild={addChild}
            removeChild={removeChild}
            triggerSave={triggerSave}
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
            localBuyHouseEnabled={localBuyHouseEnabled}
            setLocalBuyHouseEnabled={setLocalBuyHouseEnabled}
            localBuyHouseAge={localBuyHouseAge}
            setLocalBuyHouseAge={setLocalBuyHouseAge}
            localBuyHousePrice={localBuyHousePrice}
            setLocalBuyHousePrice={setLocalBuyHousePrice}
            showAdvancedHome={showAdvancedHome}
            setShowAdvancedHome={setShowAdvancedHome}
            triggerSave={triggerSave}
          />
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
            addIncomeSource={addIncomeSource}
            removeIncomeSource={removeIncomeSource}
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
            updateHomeField={updateHomeField}
            updateDebt={updateDebt}
            addDebt={addDebt}
            removeDebt={removeDebt}
            triggerSave={triggerSave}
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

  // Mobile layout rendering
  if (isMobile) {
    return (
      <div className="life-profile-mobile-modal-backdrop" onClick={onClose}>
        <div className="life-profile-mobile-modal-card" onClick={(e) => e.stopPropagation()}>
          
          <LifeProfileHeader
            isMobile={true}
            activeTab={activeTab}
            navStack={navStack}
            popScreenAndSave={popScreenAndSave}
            onClose={onClose}
            mobileScreenTitle={getMobileScreenTitle()}
          />

          <LifeProfileTabs
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobile={true}
          />
          
          <div className="life-profile-mobile-body" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {activeTab === 'timeline' ? (
              <TimelineSnapshotTab
                isMobile={true}
                inputs={inputs}
                projection={projection}
                snapshot={snapshot}
                selectedAge={selectedAge}
                expandedCategories={expandedCategories}
                setExpandedCategories={setExpandedCategories}
              />
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
        <LifeProfileHeader
          isMobile={false}
          onClose={onClose}
        />

        <LifeProfileTabs
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobile={false}
        />

        <div className={`life-profile-modal-body-layout ${activeTab === 'timeline' ? 'timeline-active' : ''}`}>
          {activeTab === 'timeline' ? (
            <TimelineSnapshotTab
              isMobile={false}
              inputs={inputs}
              projection={projection}
              snapshot={snapshot}
              selectedAge={selectedAge}
              expandedCategories={expandedCategories}
              setExpandedCategories={setExpandedCategories}
            />
          ) : (
            <>
              {/* Left Side: Form Editing Section */}
              <div className="life-profile-edit-column">
                <div className="life-profile-tab-content-panel">
                  {activeTab === 'household' && (
                    <HouseholdTab
                      isMobile={false}
                      currentScreen={{ name: 'household' }}
                      localAge={localAge}
                      setLocalAge={setLocalAge}
                      localLifeExpectancy={localLifeExpectancy}
                      setLocalLifeExpectancy={setLocalLifeExpectancy}
                      localProfile={localProfile}
                      setLocalProfile={setLocalProfile}
                      updateHouseholdField={updateHouseholdField}
                      updateChild={updateChild}
                      addChild={addChild}
                      removeChild={removeChild}
                      triggerSave={triggerSave}
                      pushScreen={pushScreen}
                      popScreen={popScreen}
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
                      triggerSave={triggerSave}
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
                      updateHomeField={updateHomeField}
                      updateDebt={updateDebt}
                      addDebt={addDebt}
                      removeDebt={removeDebt}
                      triggerSave={triggerSave}
                    />
                  )}

                  {activeTab === 'assets' && (
                    <AssetsTab
                      isMobile={false}
                      localProfile={localProfile}
                      updateAssetField={updateAssetField}
                      triggerSave={triggerSave}
                    />
                  )}

                  {activeTab === 'income' && (
                    <IncomeTab
                      isMobile={false}
                      currentScreen={{ name: 'finance_income' }}
                      localSimpleIncome={localSimpleIncome}
                      setLocalSimpleIncome={setLocalSimpleIncome}
                      localTargetRetirementAge={localTargetRetirementAge}
                      setLocalTargetRetirementAge={setLocalTargetRetirementAge}
                      localSSClaimingAge={localSSClaimingAge}
                      setLocalSSClaimingAge={setLocalSSClaimingAge}
                      localProfile={localProfile}
                      updateHouseholdField={updateHouseholdField}
                      updateIncomeSource={updateIncomeSource}
                      addIncomeSource={addIncomeSource}
                      removeIncomeSource={removeIncomeSource}
                      triggerSave={triggerSave}
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
