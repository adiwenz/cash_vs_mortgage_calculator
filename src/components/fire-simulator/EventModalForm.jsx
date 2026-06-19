import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from './helpers';
import MarriageWizard from './MarriageWizard';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall,
  getSimulatedRetirementAge
} from './houseAffordabilityUtils';
import { hasResolvedRecommendationTradeoffs } from '../../features/fire/recommendations/recommendationUtils.js';

export default function EventModalForm({
  inputs,
  editingEvent,
  setEditingEvent,
  isFullPartnerProfileOpen,
  setIsFullPartnerProfileOpen,
  isZeroSpendingConfirmed,
  setIsZeroSpendingConfirmed,
  isPartnerZeroSpendingConfirmed,
  setIsPartnerZeroSpendingConfirmed,
  handleDeleteEvent,
  handleSaveEvent,
  handleSetBudgetClick,
  setIsBudgetOpenFromMarriageWizard,
  tempSocialSecurityDetails,
  activeResults,
  baselineResults,
  setShowImprovementModal
}) {
  const [showHouseAdvanced, setShowHouseAdvanced] = useState(false);

  // Reset recommendationApplied if a new cash shortfall is created
  useEffect(() => {
    if (editingEvent && editingEvent.type === 'buyHouse' && editingEvent.recommendationApplied) {
      const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
      const simulationResults = activeResults || baselineResults;
      const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
      const totalCashRequired = calculateTotalCashRequired(editingEvent);
      const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
      if (cashShortfall > 0) {
        setEditingEvent(prev => ({
          ...prev,
          recommendationApplied: false
        }));
      }
    }
  }, [
    editingEvent?.homePrice,
    editingEvent?.downPayment,
    editingEvent?.purchaseAge,
    editingEvent?.age,
    editingEvent?.recommendationApplied,
    inputs,
    activeResults,
    baselineResults,
    setEditingEvent
  ]);  const afterReadyAge = useMemo(() => {
    if (editingEvent?.type !== 'buyHouse') return null;
    return getSimulatedRetirementAge(inputs, editingEvent);
  }, [
    editingEvent?.type,
    inputs,
    editingEvent?.homePrice,
    editingEvent?.downPayment,
    editingEvent?.purchaseAge,
    editingEvent?.age,
    editingEvent?.mortgageRate,
    editingEvent?.loanTerm,
    editingEvent?.propertyTax,
    editingEvent?.insurance,
    editingEvent?.hoa,
    editingEvent?.utilitiesIncrease,
    editingEvent?.maintenance,
    editingEvent?.renovationCost,
    editingEvent?.appreciationRate,
    editingEvent?.sellingCost,
    editingEvent?.keepRent
  ]);

  const type = editingEvent.type;

  const borrowing = type === 'payoffPlan'
    ? (inputs.lifeEvents || []).find(b => b.id === editingEvent.borrowingId)
    : null;

  const handleCarPriceChange = (price) => {
    const dp = Number(editingEvent.downPayment) || 0;
    const bal = Math.max(0, price - dp);
    setEditingEvent({
      ...editingEvent,
      purchasePrice: price,
      balance: bal
    });
  };

  const handleDownPaymentChange = (dp) => {
    const price = Number(editingEvent.purchasePrice) || 0;
    const bal = Math.max(0, price - dp);
    setEditingEvent({
      ...editingEvent,
      downPayment: dp,
      balance: bal
    });
  };
  if (type === 'marriage') {
    return (
      <MarriageWizard
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
      />
    );
  }

  const calculateHouseSummary = () => {
    const p = parseFloat(editingEvent.homePrice) || 0;
    const dp = parseFloat(editingEvent.downPayment) || 0;
    const rate = (parseFloat(editingEvent.mortgageRate) || 6.5) / 100;
    const mortgageTerm = parseInt(editingEvent.loanTerm) || 30;
    
    const loanAmount = Math.max(0, p - dp);
    let monthlyPI = 0;
    if (loanAmount > 0 && mortgageTerm > 0) {
      const r = rate / 12;
      const n = mortgageTerm * 12;
      monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    
    const monthlyPropertyTax = (p * ((parseFloat(editingEvent.propertyTax) || 1.1) / 100)) / 12;
    const monthlyInsurance = (p * ((parseFloat(editingEvent.insurance) || 0.35) / 100)) / 12;
    const monthlyMaintenance = (p * ((parseFloat(editingEvent.maintenance) || 1.0) / 100)) / 12;
    const monthlyHOA = parseFloat(editingEvent.hoa) || 0;
    const monthlyUtilities = parseFloat(editingEvent.utilitiesIncrease) || 0;
    
    const hasPMI = dp < p * 0.2;
    const monthlyPMI = hasPMI ? (loanAmount * ((parseFloat(editingEvent.pmi) || 0.5) / 100)) / 12 : 0;
    
    const monthlyOwnershipCost = monthlyPI + monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyHOA + monthlyUtilities + monthlyPMI;
    
    const closingCostRate = parseFloat(editingEvent.closingCosts) || 3;
    const closingCosts = p * (closingCostRate / 100);
    const points = parseFloat(editingEvent.points) || 0;
    const renovation = parseFloat(editingEvent.renovationCost) || 0;
    
    const cashNeeded = dp + closingCosts + points + renovation;
    
    const currentRent = parseFloat(editingEvent.currentRent) || 0;
    const renterInsurance = parseFloat(editingEvent.renterInsurance) || 0;
    const totalCurrentRentCost = currentRent + renterInsurance;
    const rentDifference = monthlyOwnershipCost - totalCurrentRentCost;
    
    return {
      monthlyPI,
      monthlyOwnershipCost,
      cashNeeded,
      rentDifference,
      currentRentConfigured: currentRent > 0
    };
  };

  return (
    <div className="modal-backdrop" onClick={() => setEditingEvent(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={type === 'buyHouse' || type === 'sellHouse' ? { maxWidth: '650px', width: '90%' } : {}}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
          {type === 'buyHouse' && '🏠 Buy a House'}
          {type === 'sellHouse' && '🏠 Sell a House'}
          {type === 'haveChild' && '👶 Have a Child'}
          {type === 'careerChange' && '💼 Career Change'}
          {type === 'move' && '📍 Move / Relocate'}
          {type === 'retire' && '🏖 Schedule Stop Working'}
          {type === 'socialSecurity' && '💰 Claim Social Security'}
          {type === 'pension' && '📜 Add Pension'}
          {type === 'rentalIncome' && '🏢 Add Rental Income'}
          {type === 'annuity' && '📈 Add Annuity'}
          {type === 'otherRetirementIncome' && '💵 Add Other Non-Work Income'}
          {type === 'windfall' && '💰 Windfall / Inheritance'}
          {type === 'college' && '🎓 College Tuition'}
          {type === 'debtPayoff' && '💸 Debt Payoff Plan'}
          {type === 'custom' && '➕ Custom Life Event'}
          {type === 'borrowing' && (
            editingEvent.borrowingType === 'studentLoan' ? '🎓 Student Loan' :
            editingEvent.borrowingType === 'carLoan' ? '🚗 Car Loan' :
            editingEvent.borrowingType === 'personalLoan' ? '💸 Personal Loan' :
            '💳 Credit Card Balance'
          )}
          {type === 'payoffPlan' && '🏁 Payoff Plan'}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* BUY HOUSE FIELDS */}
          {type === 'buyHouse' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Purchase Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.purchaseAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, purchaseAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Home Price ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.homePrice}
                  onChange={(e) => {
                    const newPrice = parseFloat(e.target.value) || 0;
                    const currentPct = editingEvent.homePrice > 0 ? (editingEvent.downPayment / editingEvent.homePrice) : 0.20;
                    setEditingEvent({
                      ...editingEvent,
                      homePrice: newPrice,
                      downPayment: Math.round(newPrice * currentPct)
                    });
                  }}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Down Payment (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.homePrice > 0 ? Math.round((editingEvent.downPayment / editingEvent.homePrice) * 100) : 20}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value) || 0;
                    setEditingEvent({
                      ...editingEvent,
                      downPayment: Math.round((editingEvent.homePrice || 0) * (pct / 100))
                    });
                  }}
                />
              </div>

              {(() => {
                const simulationResults = activeResults || baselineResults;
                const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
                const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
                const totalCashRequired = calculateTotalCashRequired(editingEvent);

                let projectionsAvailable = false;
                if (simulationResults && (simulationResults.nominalData || simulationResults.data)) {
                  const logs = simulationResults.nominalData || simulationResults.data;
                  const logBefore = logs.find(l => l.age === purchaseAge - 1);
                  if (logBefore) {
                    projectionsAvailable = true;
                  }
                }

                if (totalCashRequired > liquidAssets) {
                  const shortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
                  return (
                    <div style={{
                      gridColumn: 'span 2',
                      background: 'rgba(245, 158, 11, 0.08)',
                      color: '#f59e0b',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      borderLeft: '4px solid #f59e0b',
                      fontSize: '0.85rem',
                      lineHeight: '1.45',
                      marginTop: '0.5rem',
                      marginBottom: '0.5rem',
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
                            alignSelf: 'flex-start',
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary, #6366f1)',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '0.85rem',
                            textDecoration: 'underline',
                            marginTop: '0.35rem'
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


              {/* COLLAPSIBLE ADVANCED SETTINGS TRIGGER */}
              <div style={{ gridColumn: 'span 2', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowHouseAdvanced(!showHouseAdvanced)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: 0,
                    fontSize: '0.85rem'
                  }}
                >
                  {showHouseAdvanced ? '▼ Hide Advanced Settings' : '▶ Advanced Settings'}
                </button>
              </div>

              {showHouseAdvanced && (
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  {/* GROUP 1: Mortgage */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>💳</span> Mortgage Settings
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Mortgage Rate (%)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.mortgageRate}
                          onChange={(e) => setEditingEvent({ ...editingEvent, mortgageRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Loan Term (years)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.loanTerm}
                          onChange={(e) => setEditingEvent({ ...editingEvent, loanTerm: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Points / Fees ($)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.points}
                          onChange={(e) => setEditingEvent({ ...editingEvent, points: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Closing Costs (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.closingCosts}
                          onChange={(e) => setEditingEvent({ ...editingEvent, closingCosts: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      {editingEvent.downPayment < editingEvent.homePrice * 0.2 && (
                        <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                          <span className="input-name">PMI Rate (% / year)</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-number-box"
                            style={{ width: '100%' }}
                            value={editingEvent.pmi}
                            onChange={(e) => setEditingEvent({ ...editingEvent, pmi: parseFloat(e.target.value) || 0 })}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                            Required because down payment is less than 20%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GROUP 2: Ownership Costs */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>🏡</span> Ownership Costs
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Property Tax (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.propertyTax}
                          onChange={(e) => setEditingEvent({ ...editingEvent, propertyTax: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Homeowners Insurance (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.insurance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, insurance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">HOA Dues ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.hoa}
                          onChange={(e) => setEditingEvent({ ...editingEvent, hoa: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Maintenance (% / year)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.maintenance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, maintenance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Renovation / Furnishing ($)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.renovationCost}
                          onChange={(e) => setEditingEvent({ ...editingEvent, renovationCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Utilities Increase ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.utilitiesIncrease}
                          onChange={(e) => setEditingEvent({ ...editingEvent, utilitiesIncrease: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GROUP 3: Home Value Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📈</span> Home Value Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Home Appreciation (% / year)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.appreciationRate}
                          onChange={(e) => setEditingEvent({ ...editingEvent, appreciationRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Selling Cost (%)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.sellingCost}
                          onChange={(e) => setEditingEvent({ ...editingEvent, sellingCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GROUP 4: Rent Comparison Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📊</span> Rent Comparison Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Current Rent ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.currentRent}
                          onChange={(e) => setEditingEvent({ ...editingEvent, currentRent: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Rent Growth (% / year)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.rentGrowth}
                          onChange={(e) => setEditingEvent({ ...editingEvent, rentGrowth: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                        <span className="input-name">Renter's Insurance ($ / month)</span>
                        <input
                          type="number"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.renterInsurance}
                          onChange={(e) => setEditingEvent({ ...editingEvent, renterInsurance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="keep-rent"
                            checked={!!editingEvent.keepRent}
                            onChange={(e) => setEditingEvent({ ...editingEvent, keepRent: e.target.checked })}
                            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                          />
                          <label htmlFor="keep-rent" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                            Keep rent after purchase (advanced)
                          </label>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
                          Preserves rent payments alongside the new mortgage payment rather than replacing them.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GROUP 5: Investment Assumptions */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>📈</span> Investment Assumptions
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="input-wrapper">
                        <span className="input-name">Investment Return (%)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.investmentReturn}
                          onChange={(e) => setEditingEvent({ ...editingEvent, investmentReturn: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="input-wrapper">
                        <span className="input-name">Inflation Rate (%)</span>
                        <input
                          type="number"
                          step="0.1"
                          className="input-number-box"
                          style={{ width: '100%' }}
                          value={editingEvent.inflation}
                          onChange={(e) => setEditingEvent({ ...editingEvent, inflation: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Box */}
              {(() => {
                const summary = calculateHouseSummary();
                return (
                  <div style={{
                    gridColumn: 'span 2',
                    background: 'rgba(99, 102, 241, 0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>
                      🏠 Purchase & Cost Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment (P&I):</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(summary.monthlyPI)}</strong>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px dashed rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Cash Needed:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(summary.cashNeeded)}</strong>
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--text-tertiary)', 
                          display: 'flex', 
                          gap: '0.4rem', 
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <span>Down Payment: <strong>{formatCurrency(parseFloat(editingEvent.downPayment) || 0)}</strong></span>
                          <span>+</span>
                          <span>Closing Costs: <strong>{formatCurrency((parseFloat(editingEvent.homePrice) || 0) * ((parseFloat(editingEvent.closingCosts) || 3) / 100))}</strong></span>
                          {(parseFloat(editingEvent.points) || 0) > 0 && (
                            <>
                              <span>+</span>
                              <span>Points: <strong>{formatCurrency(parseFloat(editingEvent.points) || 0)}</strong></span>
                            </>
                          )}
                          {(parseFloat(editingEvent.renovationCost) || 0) > 0 && (
                            <>
                              <span>+</span>
                              <span>Renovations: <strong>{formatCurrency(parseFloat(editingEvent.renovationCost) || 0)}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Monthly Ownership Cost:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(summary.monthlyOwnershipCost)}/mo</strong>
                        </div>
                        {summary.currentRentConfigured && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Difference vs Current Rent:</span>
                            <strong style={{ color: summary.rentDifference > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                              {summary.rentDifference > 0 ? '+' : ''}{formatCurrency(summary.rentDifference)}/mo
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {type === 'sellHouse' && (() => {
            const asset = inputs.houseAssets?.find(h => h.id === editingEvent.houseId);
            const buyEv = inputs.lifeEvents?.find(e => e.type === 'buyHouse' && e.houseId === editingEvent.houseId);
            const purchaseAge = buyEv ? Number(buyEv.purchaseAge !== undefined ? buyEv.purchaseAge : buyEv.age) : 30;
            const saleAge = Number(editingEvent.age) || 50;
            const yearsOwned = Math.max(0, saleAge - purchaseAge);

            const purchasePrice = Number(asset?.purchasePrice) || 0;
            const downPayment = Number(asset?.downPayment) || 0;
            const appreciationRate = (Number(asset?.appreciationRate) || 3.0) / 100;
            const sellingCostRate = Number(editingEvent.sellingCost !== undefined ? editingEvent.sellingCost : 6.0);
            const mortgageRate = (Number(asset?.mortgageRate) || 6.5) / 100;
            const loanTermYears = Number(asset?.loanTermYears) || 30;
            const isCash = asset?.purchaseType === 'cash' || downPayment >= purchasePrice;

            const currentValue = purchasePrice * Math.pow(1 + appreciationRate, yearsOwned);

            let remainingMortgageBalance = 0;
            if (!isCash) {
              const loanAmount = Math.max(0, purchasePrice - downPayment);
              const elapsedYears = Math.max(0, yearsOwned - 1);
              if (elapsedYears >= loanTermYears) {
                remainingMortgageBalance = 0;
              } else if (loanAmount > 0 && loanTermYears > 0) {
                const r = mortgageRate / 12;
                const n = loanTermYears * 12;
                const monthlyPayment = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                const elapsedMonths = elapsedYears * 12;
                const remainingMonths = n - elapsedMonths;
                remainingMortgageBalance = r === 0 ? monthlyPayment * remainingMonths : monthlyPayment * (1 - Math.pow(1 + r, -remainingMonths)) / r;
              }
            }

            const sellingCosts = currentValue * (sellingCostRate / 100);
            const equity = currentValue - remainingMortgageBalance - sellingCosts;

            return (
              <>
                <div className="input-wrapper">
                  <span className="input-name">Sale Age</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.age}
                    onChange={(e) => {
                      const newAge = parseInt(e.target.value) || 50;
                      setEditingEvent({ ...editingEvent, age: Math.max(purchaseAge, newAge) });
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                    Must be at or after purchase age ({purchaseAge})
                  </span>
                </div>
                <div className="input-wrapper">
                  <span className="input-name">Selling Cost Rate (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.sellingCost}
                    onChange={(e) => setEditingEvent({ ...editingEvent, sellingCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Proceeds Destination</span>
                  <select
                    className="input-number-box"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={editingEvent.proceedsDestination || 'investments'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, proceedsDestination: e.target.value })}
                  >
                    <option value="investments">📈 Liquid Investments (Brokerage)</option>
                    <option value="cash">💰 Cash Reserves</option>
                  </select>
                </div>

                <div style={{
                  gridColumn: 'span 2',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginTop: '0.5rem'
                }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>💰</span> Sale Proceeds Preview (Age {saleAge})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Appreciated Home Value ({yearsOwned} yrs owned):</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(currentValue)}</span>
                    </div>
                    {!isCash && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Remaining Mortgage Balance:</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-rose, #f43f5e)' }}>-{formatCurrency(remainingMortgageBalance)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Selling Costs ({sellingCostRate}%):</span>
                      <span style={{ fontWeight: '600', color: 'var(--accent-rose, #f43f5e)' }}>-{formatCurrency(sellingCosts)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Estimated Net Proceeds:</span>
                      <span style={{ color: 'var(--accent-emerald, #10b981)' }}>{formatCurrency(equity)}</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {type === 'haveChild' && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Child's Name (Optional)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.childName || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, childName: e.target.value })}
                  placeholder="e.g. Liam"
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Child's Current Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0}
                  onChange={(e) => {
                    const startAge = Math.max(0, Math.min(22, parseInt(e.target.value) || 0));
                    const birthAge = Math.max(0, (inputs.currentAge || 35) - startAge);
                    setEditingEvent({
                      ...editingEvent,
                      childStartAge: startAge,
                      birthAge: birthAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Parent's Age when Born</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.birthAge !== undefined ? editingEvent.birthAge : inputs.currentAge}
                  onChange={(e) => {
                    const birthAge = Math.max(0, parseInt(e.target.value) || 0);
                    const startAge = Math.max(0, (inputs.currentAge || 35) - birthAge);
                    setEditingEvent({
                      ...editingEvent,
                      birthAge: birthAge,
                      childStartAge: startAge
                    });
                  }}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Cost Estimate Method</span>
                <select
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
                  value={editingEvent.costMethod || 'default'}
                  onChange={(e) => setEditingEvent({ ...editingEvent, costMethod: e.target.value })}
                >
                  <option value="default">Use default estimate</option>
                  <option value="custom">Enter my own estimate</option>
                  <option value="budget">Refine in Budget Builder</option>
                </select>
              </div>

              {(editingEvent.costMethod === 'default' || !editingEvent.costMethod) && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Default Estimate:</div>
                  <ul style={{ paddingLeft: '1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Child-Rearing Years (Ages 0–18): {formatCurrency(15000)}/yr</li>
                    {editingEvent.includeCollege && (
                      <li>College / Young Adult Support (Ages 19–22): {formatCurrency(15000)}/yr</li>
                    )}
                  </ul>
                </div>
              )}

              {editingEvent.costMethod === 'custom' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Custom Annual Child Cost ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingEvent({
                        ...editingEvent,
                        customAges0to4: val,
                        customAges5to12: val,
                        customAges13to18: val,
                        customAges19to22: val
                      });
                    }}
                  />
                </div>
              )}

              {editingEvent.costMethod === 'budget' && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(124, 58, 237, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124, 58, 237, 0.15)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  ℹ️ This will save the child event with default estimates. You can then click <strong>Refine Child Costs</strong> or use the <strong>Set Budget</strong> button on your Life Plan dashboard to distribute child costs across specific categories (housing, food, childcare, etc.).
                </div>
              )}

              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="include-college"
                    checked={!!editingEvent.includeCollege}
                    onChange={(e) => setEditingEvent({ ...editingEvent, includeCollege: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="include-college" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Include College / Young Adult Support (Ages 19–22)
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
                  Adds an additional <strong>{formatCurrency(editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : 15000)}/yr</strong> per child from age 19 to 22.
                </span>
              </div>
            </>
          )}

          {/* CAREER CHANGE FIELDS */}
          {type === 'careerChange' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Job Title / Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Change Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Income Change Type</span>
                <select
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
                  value={editingEvent.incomeChangeType || 'newIncomeLevel'}
                  onChange={(e) => setEditingEvent({ ...editingEvent, incomeChangeType: e.target.value })}
                >
                  <option value="newIncomeLevel">New Income Level</option>
                  <option value="increaseByAmount">Increase By Amount</option>
                </select>
              </div>

              {(editingEvent.incomeChangeType === 'increaseByAmount') ? (
                <div className="input-wrapper">
                  <span className="input-name">Salary Increase Amount ($/yr)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.salaryIncrease !== undefined ? editingEvent.salaryIncrease : editingEvent.amount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingEvent({ ...editingEvent, salaryIncrease: val, amount: val });
                    }}
                  />
                </div>
              ) : (
                <div className="input-wrapper">
                  <span className="input-name">New Annual Income ($/yr)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.amount}
                    onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              <div className="input-wrapper">
                <span className="input-name">Raise / Growth Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.growthRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, growthRate: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="permanent-raise"
                    checked={editingEvent.permanent !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, permanent: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="permanent-raise" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Permanent Raise
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
                  If checked, the raise continues after child rearing or specific phases end, becoming available for additional savings.
                </span>
              </div>
            </>
          )}

          {/* MOVE FIELDS */}
          {type === 'move' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Where? (Location Name)</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.location}
                  placeholder="e.g. Dominican Republic"
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Moving Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.moveAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, moveAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">New Annual Spending ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.newSpending}
                  onChange={(e) => setEditingEvent({ ...editingEvent, newSpending: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">One-time Moving Cost ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.movingCost !== undefined ? editingEvent.movingCost : 0}
                  onChange={(e) => setEditingEvent({ ...editingEvent, movingCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* RETIRE FIELDS */}
          {type === 'retire' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Can Stop Working Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Spending Replacement Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70}
                  onChange={(e) => setEditingEvent({ ...editingEvent, spendingPercent: parseInt(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* SOCIAL SECURITY FIELDS */}
          {['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type) && (
            <>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Income Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">
                  {type === 'socialSecurity' ? 'Claiming Age' : 'Start Age'}
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65)}
                  onChange={(e) => setEditingEvent({ ...editingEvent, claimingAge: parseInt(e.target.value) || 62, startAge: parseInt(e.target.value) || 62, age: parseInt(e.target.value) || 62 })}
                />
              </div>
              {type === 'socialSecurity' && editingEvent.useEarnings === true && (
                <div className="input-wrapper">
                  <span className="input-name">Age Started Working</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.ageStartedWorking !== undefined ? editingEvent.ageStartedWorking : 22}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ageStartedWorking: parseInt(e.target.value) || 22 })}
                  />
                </div>
              )}
              {(!editingEvent.useEarnings || type !== 'socialSecurity') ? (
                <div className="input-wrapper">
                  <span className="input-name">Monthly Amount ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000}
                    onChange={(e) => setEditingEvent({ ...editingEvent, monthlyBenefit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Estimated Monthly Amount ($)</span>
                  <div style={{ 
                    height: '2.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0 0.75rem', 
                    background: 'var(--bg-primary, #111827)', 
                    borderRadius: 'var(--radius-sm, 6px)', 
                    border: '1px solid var(--border-color, #374151)', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold', 
                    color: tempSocialSecurityDetails?.isEligible ? 'var(--text-primary)' : 'var(--accent-rose, #f43f5e)'
                  }}>
                    <span>
                      {tempSocialSecurityDetails?.isEligible 
                        ? formatCurrency(tempSocialSecurityDetails.annualBenefit / 12) 
                        : '$0 (Not Eligible)'}
                    </span>
                    {tempSocialSecurityDetails?.isEligible && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                        ({formatCurrency((tempSocialSecurityDetails.annualBenefit / 12) * Math.pow(1 + (Number(inputs.inflationRate || 3) / 100), tempSocialSecurityDetails.claimAge - (Number(inputs.currentAge) || 35)))}/mo in future nominal dollars at age {tempSocialSecurityDetails.claimAge})
                      </span>
                    )}
                  </div>
                </div>
              )}
              {type === 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-use-earnings" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Calculate from earning years
                  </label>
                  <input
                    type="checkbox"
                    id="ret-use-earnings"
                    checked={editingEvent.useEarnings === true}
                    onChange={(e) => setEditingEvent({ ...editingEvent, useEarnings: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type !== 'socialSecurity' && (
                <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label htmlFor="ret-inflation-adj" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                    Inflation Adjusted (increases with cost of living)
                  </label>
                  <input
                    type="checkbox"
                    id="ret-inflation-adj"
                    checked={editingEvent.inflationAdjusted !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, inflationAdjusted: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </div>
              )}
              {type === 'socialSecurity' && (
                <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                  💡 Calculated in Today's Dollars (purchasing power). In future dollars (nominal mode), the benefit is adjusted for inflation (currently {Number(inputs.inflationRate || 3)}% yearly) starting from your current age.
                </div>
              )}
            </>
          )}

          {/* WINDFALL FIELDS */}
          {type === 'windfall' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Age Received</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.ageReceived}
                  onChange={(e) => setEditingEvent({ ...editingEvent, ageReceived: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Tax Rate (%)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.taxRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* COLLEGE FIELDS */}
          {type === 'college' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Start Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Annual Tuition Cost ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.tuitionCost}
                  onChange={(e) => setEditingEvent({ ...editingEvent, tuitionCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Duration (years)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.duration}
                  onChange={(e) => setEditingEvent({ ...editingEvent, duration: parseInt(e.target.value) || 4 })}
                />
              </div>
            </>
          )}

          {/* DEBT PAYOFF FIELDS */}
          {type === 'debtPayoff' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Payoff Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.payoffAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, payoffAge: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Payoff Amount ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* CUSTOM FIELDS */}
          {type === 'custom' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Event Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.age}
                  onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Cash Flow ($: negative for cost)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* BORROWING FIELDS */}
          {type === 'borrowing' && (
            <>
              {/* When does this start? */}
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">When does this start?</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="timing"
                      checked={editingEvent.timing === 'current'}
                      onChange={() => setEditingEvent({
                        ...editingEvent,
                        timing: 'current',
                        startAge: inputs.currentAge
                      })}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Happening now
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="timing"
                      checked={editingEvent.timing === 'future'}
                      onChange={() => setEditingEvent({
                        ...editingEvent,
                        timing: 'future',
                        startAge: editingEvent.startAge <= inputs.currentAge ? inputs.currentAge + 1 : editingEvent.startAge
                      })}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Future age
                  </label>
                </div>
              </div>

              {/* Start Age */}
              <div className="input-wrapper">
                <span className="input-name">
                  Start Age
                </span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || inputs.currentAge })}
                  disabled={editingEvent.timing === 'current'}
                />
              </div>

              {/* Name */}
              <div className="input-wrapper">
                <span className="input-name">Friendly Name</span>
                <input
                  type="text"
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                />
              </div>

              {editingEvent.timing === 'future' && Number(editingEvent.startAge) <= inputs.currentAge && (
                <div className="warning-box" style={{ gridColumn: 'span 2', background: 'rgba(244, 63, 94, 0.08)', color: 'var(--accent-rose, #f43f5e)', padding: '0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose, #f43f5e)', fontWeight: '500', fontSize: '0.85rem' }}>
                  ⚠️ <strong>Validation Error:</strong> Start age for future borrowing must be greater than your current age ({inputs.currentAge}).
                </div>
              )}

              {/* Car loan type specific pricing framing */}
              {editingEvent.borrowingType === 'carLoan' ? (
                <>
                  <div className="input-wrapper">
                    <span className="input-name">Car Price ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.purchasePrice !== undefined ? editingEvent.purchasePrice : ''}
                      onChange={(e) => handleCarPriceChange(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Down Payment ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.downPayment !== undefined ? editingEvent.downPayment : ''}
                      onChange={(e) => handleDownPaymentChange(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                    <span className="input-name">Loan Amount / Starting Balance ($)</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.balance}
                      onChange={(e) => setEditingEvent({ ...editingEvent, balance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </>
              ) : (
                <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                  <span className="input-name">Starting Balance / Amount ($)</span>
                  <input
                    type="number"
                    className="input-number-box"
                    style={{ width: '100%' }}
                    value={editingEvent.balance}
                    placeholder="Add a balance"
                    onChange={(e) => setEditingEvent({ ...editingEvent, balance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              {/* Interest Rate */}
              <div className="input-wrapper">
                <span className="input-name">Interest Rate (APR %)</span>
                <input
                  type="number"
                  step="0.1"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.interestRate}
                  onChange={(e) => setEditingEvent({ ...editingEvent, interestRate: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Minimum Monthly Payment */}
              <div className="input-wrapper">
                <span className="input-name">Minimum Monthly Payment ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.minPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, minPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Type-Specific Estimators and Warnings */}
              <div style={{ gridColumn: 'span 2', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {editingEvent.borrowingType === 'studentLoan' && (() => {
                  const balance = Number(editingEvent.balance) || 0;
                  const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
                  let estPayment = 0;
                  if (balance > 0) {
                    if (r === 0) estPayment = balance / 120;
                    else estPayment = (balance * r) / (1 - Math.pow(1 + r, -120));
                  }
                  return (
                    <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                      💡 <em>You're not stuck with this number.</em> Typical student loans use a 10-year term. Est. standard payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                    </div>
                  );
                })()}

                {editingEvent.borrowingType === 'carLoan' && (() => {
                  const balance = Number(editingEvent.balance) || 0;
                  const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
                  let estPayment = 0;
                  if (balance > 0) {
                    if (r === 0) estPayment = balance / 60;
                    else estPayment = (balance * r) / (1 - Math.pow(1 + r, -60));
                  }
                  return (
                    <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                      🚗 Fixed 5-year auto loan term. Est. car payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                    </div>
                  );
                })()}

                {editingEvent.borrowingType === 'personalLoan' && (() => {
                  const balance = Number(editingEvent.balance) || 0;
                  const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
                  let estPayment = 0;
                  if (balance > 0) {
                    if (r === 0) estPayment = balance / 36;
                    else estPayment = (balance * r) / (1 - Math.pow(1 + r, -36));
                  }
                  return (
                    <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                      💸 Medium term 3-year personal loan. Est. fixed payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                    </div>
                  );
                })()}

                {editingEvent.borrowingType === 'creditCard' && (() => {
                  const balance = Number(editingEvent.balance) || 0;
                  const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
                  const monthlyInterest = balance * r;
                  const minPayment = Number(editingEvent.minPayment) || 0;
                  const isInterestTrap = minPayment <= monthlyInterest;
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isInterestTrap && (
                        <div className="warning-box" style={{ background: 'rgba(244, 63, 94, 0.08)', color: 'var(--accent-rose, #f43f5e)', padding: '0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose, #f43f5e)', fontWeight: '500' }}>
                          ⚠️ <strong>Interest Trap Alert:</strong> Your minimum payment of {formatCurrency(minPayment)} is less than or equal to the monthly interest accrued ({formatCurrency(monthlyInterest)}). The balance will never decrease and will grow over time!
                        </div>
                      )}
                      <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                        💳 Credit card rates are higher. <em>Small changes can move the payoff date.</em> Pay more than the minimum to avoid paying massive interest.
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Payoff Plan Toggle */}
              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
                  <input
                    type="checkbox"
                    checked={editingEvent.payoffPlanEnabled}
                    onChange={(e) => setEditingEvent({ ...editingEvent, payoffPlanEnabled: e.target.checked })}
                    style={{ marginRight: '0.6rem', width: '16px', height: '16px' }}
                  />
                  Create a payoff plan too
                </label>
              </div>

              {/* Notes */}
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Notes (Optional)</span>
                <textarea
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', minHeight: '60px', padding: '0.4rem 0.6rem' }}
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                />
              </div>
            </>
          )}

          {/* PAYOFF PLAN FIELDS */}
          {type === 'payoffPlan' && (
            <>
              {/* Linked Borrowing Event Info */}
              {borrowing ? (
                <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Linked Borrowing: {borrowing.name}</div>
                  <div>Starting Balance: <strong>{formatCurrency(borrowing.balance)}</strong></div>
                  <div>Interest Rate: <strong>{borrowing.interestRate}% APR</strong></div>
                  <div>Minimum Payment: <strong>{formatCurrency(borrowing.minPayment)}/mo</strong></div>
                </div>
              ) : (
                <div style={{ gridColumn: 'span 2', color: 'var(--accent-rose, #f43f5e)', fontSize: '0.85rem' }}>
                  ⚠️ Error: Associated borrowing event not found.
                </div>
              )}

              {/* Link toggle */}
              <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={editingEvent.linked !== false}
                    onChange={(e) => {
                      const isLinked = e.target.checked;
                      const nextEvent = { ...editingEvent, linked: isLinked };
                      if (isLinked && borrowing) {
                        nextEvent.startAge = borrowing.startAge;
                      }
                      setEditingEvent(nextEvent);
                    }}
                    style={{ marginRight: '0.6rem', width: '16px', height: '16px' }}
                  />
                  Link start age to borrowing start age
                </label>
              </div>

              {/* Start Age (if not linked) */}
              <div className="input-wrapper">
                <span className="input-name">Start Age</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.startAge}
                  onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || inputs.currentAge })}
                  disabled={editingEvent.linked !== false}
                />
              </div>

              {/* Extra Payment */}
              <div className="input-wrapper">
                <span className="input-name">Extra Monthly Payoff Allocation ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.extraPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, extraPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Projected Payoff Result Box */}
              {borrowing && (() => {
                const balance = Number(borrowing.balance) || 0;
                const apr = Number(borrowing.interestRate) || 0;
                const minPayment = Number(borrowing.minPayment) || 0;
                const extraPayment = Number(editingEvent.extraPayment) || 0;
                const startAge = Number(editingEvent.startAge) || inputs.currentAge;
                
                const calculatePayoffAgeInline = (b, rate, minPay, extraPay, start) => {
                  const r = (rate / 100) / 12;
                  const pmt = minPay + extraPay;
                  if (b <= 0) return start;
                  if (pmt <= 0) return Infinity;
                  if (pmt <= b * r) return Infinity;
                  if (r === 0) {
                    return start + (b / pmt) / 12;
                  }
                  const months = Math.log(pmt / (pmt - r * b)) / Math.log(1 + r);
                  return start + months / 12;
                };

                const projectedAge = calculatePayoffAgeInline(balance, apr, minPayment, extraPayment, startAge);
                const formatPayoffAge = (ageVal) => {
                  if (!isFinite(ageVal)) return 'Never (payment too low to cover interest)';
                  return `Age ${Math.round(ageVal * 10) / 10}`;
                };

                return (
                  <div style={{ gridColumn: 'span 2', fontSize: '0.85rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>Total Monthly Payment: <strong>{formatCurrency(minPayment + extraPayment)}</strong></div>
                      <div>Projected Payoff Age: <strong style={{ color: isFinite(projectedAge) ? 'var(--primary)' : 'var(--accent-rose)' }}>{formatPayoffAge(projectedAge)}</strong></div>
                      <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        💡 <em>Small changes can move the payoff date.</em> Increase the extra payoff allocation to pay it off faster!
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Notes (Optional)</span>
                <textarea
                  className="input-number-box"
                  style={{ width: '100%', textAlign: 'left', minHeight: '60px', padding: '0.4rem 0.6rem' }}
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: (editingEvent.id && type !== 'retire' && type !== 'socialSecurity') ? 'space-between' : 'flex-end' }}>
          {editingEvent.id && type !== 'retire' && type !== 'socialSecurity' && (
            <button
              type="button"
              className="btn-secondary"
              style={{
                color: 'var(--accent-rose, #f43f5e)',
                borderColor: 'rgba(244, 63, 94, 0.2)',
                backgroundColor: 'rgba(244, 63, 94, 0.05)',
                fontWeight: '700'
              }}
              onClick={handleDeleteEvent}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.2)';
              }}
            >
              Delete Event
            </button>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setEditingEvent(null)}
            >
              Cancel
            </button>
            {(() => {
              let primaryCta = 'Save Event';
              let onPrimaryClick = handleSaveEvent;

              if (type === 'buyHouse') {
                const simulationResults = activeResults || baselineResults;
                const needsReviewOptions = !hasResolvedRecommendationTradeoffs(editingEvent, inputs, simulationResults);

                const purchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : (editingEvent.age || 35);
                const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulationResults);
                const totalCashRequired = calculateTotalCashRequired(editingEvent);
                const cashShortfall = calculateCashShortfall(totalCashRequired, liquidAssets);
                const hasCashShortfall = cashShortfall > 0;

                const beforeReadyAge = baselineResults?.retirementReadyAge || inputs.targetRetirementAge || 65;
                const afterReadyAgeVal = afterReadyAge !== null && afterReadyAge !== undefined ? afterReadyAge : (inputs.targetRetirementAge || 65);
                const retirementDelayYears = Math.max(0, afterReadyAgeVal - beforeReadyAge);
                const hasRetirementDelay = retirementDelayYears > 0;

                if (hasCashShortfall) {
                  if (editingEvent.recommendationApplied) {
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
                    if (setShowImprovementModal) {
                      setShowImprovementModal(true);
                    }
                  };
                }
              }

              return (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onPrimaryClick}
                  disabled={type === 'borrowing' && editingEvent.timing === 'future' && Number(editingEvent.startAge) <= inputs.currentAge}
                  style={{
                    opacity: (type === 'borrowing' && editingEvent.timing === 'future' && Number(editingEvent.startAge) <= inputs.currentAge) ? 0.5 : 1,
                    cursor: (type === 'borrowing' && editingEvent.timing === 'future' && Number(editingEvent.startAge) <= inputs.currentAge) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {primaryCta}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
