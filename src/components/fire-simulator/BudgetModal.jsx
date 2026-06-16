import { useState } from 'react';
import { getNormalizedPhases } from '../../fireCalculations';
import { calculateUSTaxForModal } from '../../simulatorMathUtils';
import { formatCurrency } from './helpers';

export default function BudgetModal({
  inputs,
  isBudgetOpenFromMarriageWizard,
  editingEvent,
  budgetMonthlyIncome,
  setBudgetMonthlyIncome,
  budgetExpenses,
  setBudgetExpenses,
  budgetSavings,
  setBudgetSavings,
  budgetPartnerSavings,
  setBudgetPartnerSavings,
  activeBudgetPhase,
  handleSwitchBudgetPhase,
  savingsAllocMode,
  handleToggleSavingsAllocMode,
  budgetHsaCoverage,
  setBudgetHsaCoverage,
  budgetFilingStatus,
  setBudgetFilingStatus,
  budgetMonthlySpending,
  setBudgetMonthlySpending,
  setBudgetMonthlySavings,
  pendingImprovement,
  handleCloseBudgetModal,
  handleSaveBudget
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('needs');
  const [isEditingNeeds, setIsEditingNeeds] = useState(false);
  const [isEditingWants, setIsEditingWants] = useState(false);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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
    let baseSalaryMonthly;
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

  const est401kMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.trad401k || 0) / 100)) 
    : (budgetSavings.trad401k || 0);
  const estTradIraMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.tradIra || 0) / 100)) 
    : (budgetSavings.tradIra || 0);
  const estHsaMonthly = savingsAllocMode === 'percentSurplus' 
    ? Math.round(surplusMonthly * ((budgetSavings.hsa || 0) / 100)) 
    : (budgetSavings.hsa || 0);

  const capped401k = Math.min(23500, est401kMonthly * 12);
  const cappedTradIra = Math.min(7000, estTradIraMonthly * 12);
  const cappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estHsaMonthly * 12);
  let preTaxDeductionsAnnual = capped401k + cappedTradIra + cappedHsa;

  if (isMarriedMode) {
    const estPartner401k = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.trad401k || 0) / 100)) : (budgetPartnerSavings.trad401k || 0);
    const estPartnerTradIra = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.tradIra || 0) / 100)) : (budgetPartnerSavings.tradIra || 0);
    const estPartnerHsa = savingsAllocMode === 'percentSurplus' ? Math.round(surplusMonthly * ((budgetPartnerSavings.hsa || 0) / 100)) : (budgetPartnerSavings.hsa || 0);

    const partnerCapped401k = Math.min(23500, estPartner401k * 12);
    const partnerCappedTradIra = Math.min(7000, estPartnerTradIra * 12);
    const partnerCappedHsa = Math.min(budgetHsaCoverage === 'family' ? 8300 : 4150, estPartnerHsa * 12);
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

  const handleMonthlyIncomeChange = (val) => {
    const newIncome = Math.max(0, val);
    setBudgetMonthlyIncome(newIncome);

    if (totalSavingsMonthly === 0) {
      setBudgetMonthlySavings(Math.max(0, newIncome - activeSpending));
    } else if (totalExpensesMonthly === 0) {
      setBudgetMonthlySpending(Math.max(0, newIncome - totalSavingsMonthly));
    }
  };



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
                              { key: 'debt', label: 'Partner Other Debt' },
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
}
