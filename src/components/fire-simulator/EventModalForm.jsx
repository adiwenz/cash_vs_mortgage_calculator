import { useState } from 'react';
import { formatCurrency } from './helpers';
import MarriageWizard from './MarriageWizard';

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
  tempSocialSecurityDetails
}) {
  const [showHouseAdvanced, setShowHouseAdvanced] = useState(false);

  const type = editingEvent.type;
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
          {type === 'retire' && '🏖 Schedule Retirement'}
          {type === 'socialSecurity' && '💰 Claim Social Security'}
          {type === 'pension' && '📜 Add Pension'}
          {type === 'rentalIncome' && '🏢 Add Rental Income'}
          {type === 'annuity' && '📈 Add Annuity'}
          {type === 'otherRetirementIncome' && '💵 Add Other Retirement Income'}
          {type === 'windfall' && '💰 Windfall / Inheritance'}
          {type === 'college' && '🎓 College Tuition'}
          {type === 'debtPayoff' && '💸 Debt Payoff Plan'}
          {type === 'custom' && '➕ Custom Life Event'}
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
                  onChange={(e) => setEditingEvent({ ...editingEvent, homePrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Down Payment ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.downPayment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, downPayment: parseFloat(e.target.value) || 0 })}
                />
              </div>

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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Monthly Payment (P&I):</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(summary.monthlyPI)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Cash Needed:</span>
                        <strong style={{ marginLeft: '0.25rem', color: 'var(--text-primary)' }}>{formatCurrency(summary.cashNeeded)}</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.2,rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
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
                  value={editingEvent.name}
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
              <div className="input-wrapper">
                <span className="input-name">New Annual Income ($)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.amount}
                  onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
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
            </>
          )}

          {/* RETIRE FIELDS */}
          {type === 'retire' && (
            <>
              <div className="input-wrapper">
                <span className="input-name">Retirement Age</span>
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
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: editingEvent.id ? 'space-between' : 'flex-end' }}>
          {editingEvent.id && (
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
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveEvent}
            >
              Save Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
