import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyInput, PercentInput, NumberInput } from '../ui/PlainInputs';
import { formatCurrency } from './helpers';

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

  // Sync state with inputs when modal opens
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, inputs.lifeProfile, initialTab]);

  if (!isOpen) return null;

  const updateHouseholdField = (field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      household: {
        ...prev.household,
        [field]: val
      }
    }));
  };

  const updateHomeField = (field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      home: {
        ...prev.home,
        [field]: val
      }
    }));
  };

  const updateAssetField = (field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      assets: {
        ...prev.assets,
        [field]: val
      }
    }));
  };

  // List builder handlers for children
  const addChild = () => {
    setLocalProfile(prev => ({
      ...prev,
      children: [
        ...(prev.children || []),
        { id: `child-${Date.now()}`, name: `Child ${prev.children.length + 1}`, age: 0, includeCollege: false }
      ]
    }));
  };

  const updateChild = (id, field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      children: (prev.children || []).map(c => c.id === id ? { ...c, [field]: val } : c)
    }));
  };

  const removeChild = (id) => {
    setLocalProfile(prev => ({
      ...prev,
      children: (prev.children || []).filter(c => c.id !== id)
    }));
  };

  // List builder handlers for debts
  const addDebt = () => {
    setLocalProfile(prev => ({
      ...prev,
      debts: [
        ...(prev.debts || []),
        { id: `debt-${Date.now()}`, name: '', balance: 0, interestRate: 0, monthlyPayment: 0 }
      ]
    }));
  };

  const updateDebt = (id, field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      debts: (prev.debts || []).map(d => d.id === id ? { ...d, [field]: val } : d)
    }));
  };

  const removeDebt = (id) => {
    setLocalProfile(prev => ({
      ...prev,
      debts: (prev.debts || []).filter(d => d.id !== id)
    }));
  };

  // List builder handlers for income sources
  const addIncomeSource = () => {
    setLocalProfile(prev => ({
      ...prev,
      incomeSources: [
        ...(prev.incomeSources || []),
        { id: `income-${Date.now()}`, name: '', amount: 0, growthRate: 3, startAge: Number(inputs.currentAge || 35), endAge: Number(inputs.targetRetirementAge || 65), isTaxable: true }
      ]
    }));
  };

  const updateIncomeSource = (id, field, val) => {
    setLocalProfile(prev => ({
      ...prev,
      incomeSources: (prev.incomeSources || []).map(i => i.id === id ? { ...i, [field]: val } : i)
    }));
  };

  const removeIncomeSource = (id) => {
    setLocalProfile(prev => ({
      ...prev,
      incomeSources: (prev.incomeSources || []).filter(i => i.id !== id)
    }));
  };

  // Save profile updates to scenario state
  const handleSave = () => {
    // Determine new simpleInvestments value from localProfile assets
    const totalAssets = Object.values(localProfile.assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
    
    // We update lifeProfile first
    updateInput('lifeProfile', localProfile);
    
    // Update simpleInvestments in inputs to keep it synced
    updateInput('simpleInvestments', totalAssets);

    // Also sync raw assets object just in case other panels expect it
    const legacyAssets = {
      cash: Number(localProfile.assets.cash || 0),
      brokerage: Number(localProfile.assets.brokerage || 0),
      trad401k: Number(localProfile.assets.trad401k || 0),
      tradIra: Number(localProfile.assets.tradIra || 0),
      rothIra: Number(localProfile.assets.rothIra || 0),
      hsa: Number(localProfile.assets.hsa || 0),
      other: Number(localProfile.assets.crypto || 0) + Number(localProfile.assets.businessEquity || 0)
    };
    updateInput('assets', legacyAssets);

    // Set useLifeProfile to true to activate runtime derivation
    updateInput('useLifeProfile', true);

    onClose();
  };

  // Summary Metrics calculations
  const totalAssetsSum = Object.values(localProfile.assets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalDebtsSum = (localProfile.debts || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0) + 
                        (localProfile.home.status === 'own' ? Number(localProfile.home.mortgageBalance || 0) : 0);
  const totalDebtsMonthlyPayments = (localProfile.debts || []).reduce((sum, d) => sum + (Number(d.monthlyPayment) || 0), 0) + 
                                   (localProfile.home.status === 'own' ? Number(localProfile.home.monthlyPayment || 0) : 0);

  // Tabs definitions
  const tabs = [
    { id: 'household', label: '💍 Household', icon: '💍' },
    { id: 'home', label: '🏠 Home', icon: '🏠' },
    { id: 'children', label: '👶 Children', icon: '👶' },
    { id: 'debts', label: '💳 Debts', icon: '💳' },
    { id: 'assets', label: '🏦 Assets', icon: '🏦' },
    { id: 'income', label: '💵 Income', icon: '💵' }
  ];

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
                                value={debt.monthlyPayment}
                                onChange={(e) => updateDebt(debt.id, 'monthlyPayment', e.target.value === '' ? 0 : parseFloat(e.target.value))}
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

          {/* Right Side: Tinted Summary Cards (Hidden on mobile unless accordion is expanded) */}
          <div className={`life-profile-summary-column ${isMobile ? 'mobile-accordion' : ''}`}>
            {isMobile ? (
              <div 
                className="mobile-summary-accordion-header"
                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              >
                <span>🔍 View Summary (Life Today)</span>
                <span>{isSummaryExpanded ? '▴' : '▾'}</span>
              </div>
            ) : (
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                🔍 Life Today Summary
              </h4>
            )}

            {(!isMobile || isSummaryExpanded) && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
