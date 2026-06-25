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
import LifeItemsWorkspace from './LifeItemsWorkspace';
import SettingsPanel from './SettingsPanel';
import LifeSnapshotPanel from './LifeSnapshotPanel';
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
  useLifeProfileDraft,
  EventsWorkspace
} from './index.js';


export default function LifeProfileModal({
  isOpen,
  onClose,
  inputs,
  updateInput,
  initialTab = 'timeline',
  isMobile = false,
  simulation,
  handleCreateEvent,
  handleEditRoadmapEvent,
  handleDeleteEvent
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
    handleSave,
    localLifePlan,
    setLocalLifePlan,
    editingItemId,
    setEditingItemId
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

  // Tabs definitions for desktop & mobile
  const tabs = [
    { id: 'timeline', label: '📈 Timeline', icon: '📈' },
    { id: 'lifeItems', label: '📁 Life Items', icon: '📁' },
    { id: 'events', label: '📅 Events', icon: '📅' },
    { id: 'snapshot', label: '📋 Snapshot', icon: '📋' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' }
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
            mobileScreenTitle={activeTab === 'timeline' ? 'Timeline' : activeTab === 'lifeItems' ? 'Life Items' : activeTab === 'events' ? 'Events' : activeTab === 'snapshot' ? 'Snapshot' : 'Settings'}
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
                currentAge={localAge}
                lifeExpectancy={localLifeExpectancy}
                onSelectedAgeChange={setSelectedAge}
                expandedCategories={expandedCategories}
                setExpandedCategories={setExpandedCategories}
              />
            ) : activeTab === 'lifeItems' ? (
              <LifeItemsWorkspace
                isMobile={true}
                inputs={inputs}
                localLifePlan={localLifePlan}
                setLocalLifePlan={setLocalLifePlan}
                currentAge={localAge}
                lifeExpectancy={localLifeExpectancy}
                triggerSave={triggerSave}
                editingItemId={editingItemId}
                setEditingItemId={setEditingItemId}
                initialTab={initialTab}
              />
            ) : activeTab === 'events' ? (
              <EventsWorkspace
                isMobile={true}
                inputs={inputs}
                projection={projection}
                snapshot={snapshot}
                selectedAge={selectedAge}
                currentAge={localAge}
                lifeExpectancy={localLifeExpectancy}
                onSelectedAgeChange={setSelectedAge}
                expandedCategories={expandedCategories}
                setExpandedCategories={setExpandedCategories}
                handleCreateEvent={handleCreateEvent}
                handleEditRoadmapEvent={handleEditRoadmapEvent}
                handleDeleteEvent={handleDeleteEvent}
                simulation={simulation}
              />
            ) : activeTab === 'snapshot' ? (
              <LifeSnapshotPanel
                isMobile={true}
                projection={projection}
                snapshot={snapshot}
                selectedAge={selectedAge}
                currentAge={localAge}
                lifeExpectancy={localLifeExpectancy}
                onSelectedAgeChange={setSelectedAge}
                onEditObject={(objectId) => {
                  setEditingItemId(objectId);
                  setActiveTab('lifeItems');
                }}
              />
            ) : activeTab === 'settings' ? (
              <div style={{ padding: '1rem' }}>
                <SettingsPanel
                  settings={localLifePlan ? (localLifePlan.settings || localLifePlan.assumptions) : {}}
                  onChange={(key, val) => {
                    if (localLifePlan) {
                      const updated = {
                        ...localLifePlan,
                        settings: {
                          ...(localLifePlan.settings || localLifePlan.assumptions),
                          [key]: val
                        }
                      };
                      setLocalLifePlan(updated);
                      triggerSave({ lifePlan: updated });
                    }
                  }}
                  onReset={() => {
                    if (localLifePlan) {
                      const updated = {
                        ...localLifePlan,
                        settings: {
                          expectedReturn: 7.0,
                          postRetirementReturn: 5.0,
                          inflationRate: 3.0,
                          salaryGrowthRate: 3.0,
                          cashReturnRate: 2.0,
                          lifestyleUpgrades: 0.0,
                          swr: 4.0,
                          lifeExpectancy: 85,
                          socialSecurityEnabled: true,
                          socialSecurityClaimingAge: 67,
                          taxMode: false,
                          taxState: 'CA',
                          filingStatus: 'single',
                          timestep: 'yearly',
                          cashFlowTiming: 'endOfYear'
                        }
                      };
                      setLocalLifePlan(updated);
                      triggerSave({ lifePlan: updated });
                    }
                  }}
                  onClose={onClose}
                />
              </div>
            ) : null}
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
          maxWidth: (activeTab === 'timeline') ? '1400px' : (activeTab === 'lifeItems' || activeTab === 'events') ? '1280px' : '960px', 
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

        <div className={`life-profile-modal-body-layout ${(activeTab === 'timeline' || activeTab === 'events' || activeTab === 'lifeItems') ? 'timeline-active' : ''}`}>
          {activeTab === 'timeline' ? (
            <TimelineSnapshotTab
              isMobile={false}
              inputs={inputs}
              projection={projection}
              snapshot={snapshot}
              selectedAge={selectedAge}
              currentAge={localAge}
              lifeExpectancy={localLifeExpectancy}
              onSelectedAgeChange={setSelectedAge}
              expandedCategories={expandedCategories}
              setExpandedCategories={setExpandedCategories}
            />
          ) : (
            <>
              {/* Left Side: Form Editing Section */}
              <div className="life-profile-edit-column">
                <div className="life-profile-tab-content-panel">
                  {activeTab === 'lifeItems' && (
                    <LifeItemsWorkspace
                      isMobile={false}
                      inputs={inputs}
                      localLifePlan={localLifePlan}
                      setLocalLifePlan={setLocalLifePlan}
                      currentAge={localAge}
                      lifeExpectancy={localLifeExpectancy}
                      triggerSave={triggerSave}
                      editingItemId={editingItemId}
                      setEditingItemId={setEditingItemId}
                      initialTab={initialTab}
                    />
                  )}

                  {activeTab === 'events' && (
                    <EventsWorkspace
                      isMobile={false}
                      inputs={inputs}
                      projection={projection}
                      snapshot={snapshot}
                      selectedAge={selectedAge}
                      currentAge={localAge}
                      lifeExpectancy={localLifeExpectancy}
                      onSelectedAgeChange={setSelectedAge}
                      expandedCategories={expandedCategories}
                      setExpandedCategories={setExpandedCategories}
                      handleCreateEvent={handleCreateEvent}
                      handleEditRoadmapEvent={handleEditRoadmapEvent}
                      handleDeleteEvent={handleDeleteEvent}
                      simulation={simulation}
                    />
                  )}

                  {activeTab === 'snapshot' && (
                    <LifeSnapshotPanel
                      isMobile={false}
                      projection={projection}
                      snapshot={snapshot}
                      selectedAge={selectedAge}
                      currentAge={localAge}
                      lifeExpectancy={localLifeExpectancy}
                      onSelectedAgeChange={setSelectedAge}
                      onEditObject={(objectId) => {
                        setEditingItemId(objectId);
                        setActiveTab('lifeItems');
                      }}
                    />
                  )}

                  {activeTab === 'settings' && (
                    <SettingsPanel
                      settings={localLifePlan ? (localLifePlan.settings || localLifePlan.assumptions) : {}}
                      onChange={(key, val) => {
                        if (localLifePlan) {
                          const updated = {
                            ...localLifePlan,
                            settings: {
                              ...(localLifePlan.settings || localLifePlan.assumptions),
                              [key]: val
                            }
                          };
                          setLocalLifePlan(updated);
                          triggerSave({ lifePlan: updated });
                        }
                      }}
                      onReset={() => {
                        if (localLifePlan) {
                          const updated = {
                            ...localLifePlan,
                            settings: {
                              expectedReturn: 7.0,
                              postRetirementReturn: 5.0,
                              inflationRate: 3.0,
                              salaryGrowthRate: 3.0,
                              cashReturnRate: 2.0,
                              lifestyleUpgrades: 0.0,
                              swr: 4.0,
                              lifeExpectancy: 85,
                              socialSecurityEnabled: true,
                              socialSecurityClaimingAge: 67,
                              taxMode: false,
                              taxState: 'CA',
                              filingStatus: 'single',
                              timestep: 'yearly',
                              cashFlowTiming: 'endOfYear'
                            }
                          };
                          setLocalLifePlan(updated);
                          triggerSave({ lifePlan: updated });
                        }
                      }}
                      onClose={onClose}
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
              {activeTab !== 'events' && activeTab !== 'lifeItems' && (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
