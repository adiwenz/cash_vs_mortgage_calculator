import React, { useState } from 'react';
import { formatCurrency } from '../helpers';
import { LiquidAssetsWarning } from './EventValidationMessages';
import { CurrencyInput, PercentInput, NumberInput } from '../../ui/PlainInputs';

export default function HouseFields({
  type,
  editingEvent,
  setEditingEvent,
  inputs,
  activeResults,
  baselineResults,
  setShowImprovementModal
}) {
  const [showHouseAdvanced, setShowHouseAdvanced] = useState(false);

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
    <>
      {type === 'buyHouse' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Purchase Age</span>
            <NumberInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.purchaseAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, purchaseAge: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Home Price ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.homePrice}
              onChange={(e) => {
                const newPrice = parseFloat(e.target.value) || 0;
                const currentPct = editingEvent.homePrice > 0 ? (editingEvent.downPayment / editingEvent.homePrice) : 0.20;
                setEditingEvent({
                  ...editingEvent,
                  homePrice: newPrice,
                  downPayment: Math.round(newPrice * currentPct),
                  recommendationApplied: false
                });
              }}
            />
          </div>
          <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
            <span className="input-name">Down Payment (%)</span>
            <PercentInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.homePrice > 0 ? Math.round((editingEvent.downPayment / editingEvent.homePrice) * 100) : 20}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                setEditingEvent({
                  ...editingEvent,
                  downPayment: Math.round((editingEvent.homePrice || 0) * (pct / 100)),
                  recommendationApplied: false
                });
              }}
            />
          </div>

          <LiquidAssetsWarning
            editingEvent={editingEvent}
            inputs={inputs}
            activeResults={activeResults}
            baselineResults={baselineResults}
            setShowImprovementModal={setShowImprovementModal}
          />

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
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.mortgageRate}
                      onChange={(e) => setEditingEvent({ ...editingEvent, mortgageRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Loan Term (years)</span>
                    <NumberInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.loanTerm}
                      onChange={(e) => setEditingEvent({ ...editingEvent, loanTerm: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Points / Fees ($)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.points}
                      onChange={(e) => setEditingEvent({ ...editingEvent, points: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Closing Costs (%)</span>
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.closingCosts}
                      onChange={(e) => setEditingEvent({ ...editingEvent, closingCosts: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {editingEvent.downPayment < editingEvent.homePrice * 0.2 && (
                    <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                      <span className="input-name">PMI Rate (% / year)</span>
                      <PercentInput
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
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.propertyTax}
                      onChange={(e) => setEditingEvent({ ...editingEvent, propertyTax: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Homeowners Insurance (% / year)</span>
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.insurance}
                      onChange={(e) => setEditingEvent({ ...editingEvent, insurance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">HOA Dues ($ / month)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.hoa}
                      onChange={(e) => setEditingEvent({ ...editingEvent, hoa: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Maintenance (% / year)</span>
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.maintenance}
                      onChange={(e) => setEditingEvent({ ...editingEvent, maintenance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Renovation / Furnishing ($)</span>
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.renovationCost}
                      onChange={(e) => setEditingEvent({ ...editingEvent, renovationCost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Utilities Increase ($ / month)</span>
                    <CurrencyInput
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
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.appreciationRate}
                      onChange={(e) => setEditingEvent({ ...editingEvent, appreciationRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Selling Cost (%)</span>
                    <PercentInput
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
                    <CurrencyInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.currentRent}
                      onChange={(e) => setEditingEvent({ ...editingEvent, currentRent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Rent Growth (% / year)</span>
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.rentGrowth}
                      onChange={(e) => setEditingEvent({ ...editingEvent, rentGrowth: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                    <span className="input-name">Renter's Insurance ($ / month)</span>
                    <CurrencyInput
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
                    <PercentInput
                      className="input-number-box"
                      style={{ width: '100%' }}
                      value={editingEvent.investmentReturn}
                      onChange={(e) => setEditingEvent({ ...editingEvent, investmentReturn: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="input-wrapper">
                    <span className="input-name">Inflation Rate (%)</span>
                    <PercentInput
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2' + 'rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
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
              <NumberInput
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
              <PercentInput
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
    </>
  );
}
