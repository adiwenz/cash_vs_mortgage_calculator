import React, { useState, useMemo, useEffect } from 'react';
import { Info, AlertCircle, Star, Home, Sparkles, TrendingUp, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from './helpers';
import { runFireSimulation } from '../../fireCalculations';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  getHousingCostForPrice,
  grossUpIncome,
  calculateMaxAffordableHomePrice
} from '../../domain/housing/houseAffordability';
import { getOldRentBeforePurchase } from '../../domain/housing/houseRecommendationSolver';

export default function MobileHousePlanningModal({
  scenario,
  eventController,
  simulation,
  uiState,
  onClose
}) {
  const inputs = scenario?.inputs || {};
  const editingEvent = eventController?.editingEvent;
  const handleSaveEvent = eventController?.handleSaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent;

  const isNew = !editingEvent || !editingEvent.id || editingEvent.isNew;
  const [isPriceTouched, setIsPriceTouched] = useState(!isNew);

  // Local state for Step 1
  const [homePrice, setHomePrice] = useState(() => {
    if (editingEvent && !editingEvent.isNew && editingEvent.id && editingEvent.homePrice !== undefined) {
      return editingEvent.homePrice;
    }
    const defaultPurchaseAge = editingEvent?.purchaseAge !== undefined ? editingEvent.purchaseAge : Math.min(85, (inputs.currentAge || 35) + 5);
    return calculateMaxAffordableHomePrice(
      inputs,
      null,
      null,
      { ...editingEvent, purchaseAge: defaultPurchaseAge },
      simulation
    ).recommendedPrice;
  });

  const [priceInput, setPriceInput] = useState(() => {
    if (editingEvent && !editingEvent.isNew && editingEvent.id && editingEvent.homePrice !== undefined) {
      return editingEvent.homePrice.toLocaleString();
    }
    const defaultPurchaseAge = editingEvent?.purchaseAge !== undefined ? editingEvent.purchaseAge : Math.min(85, (inputs.currentAge || 35) + 5);
    const val = calculateMaxAffordableHomePrice(
      inputs,
      null,
      null,
      { ...editingEvent, purchaseAge: defaultPurchaseAge },
      simulation
    ).recommendedPrice;
    return val.toLocaleString();
  });

  const [purchaseAge, setPurchaseAge] = useState(
    editingEvent?.purchaseAge !== undefined ? editingEvent.purchaseAge : Math.min(85, (inputs.currentAge || 35) + 5)
  );

  const [downPaymentPct, setDownPaymentPct] = useState(
    editingEvent?.homePrice > 0 
      ? Math.round((editingEvent.downPayment / editingEvent.homePrice) * 100) 
      : 20
  );

  // Advanced options state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [purchaseType, setPurchaseType] = useState(editingEvent?.purchaseType || 'mortgage');
  const [mortgageRate, setMortgageRate] = useState(editingEvent?.mortgageRate !== undefined ? editingEvent.mortgageRate : 6.5);
  const [loanTerm, setLoanTerm] = useState(editingEvent?.loanTerm !== undefined ? editingEvent.loanTerm : 30);
  const [closingCosts, setClosingCosts] = useState(editingEvent?.closingCosts !== undefined ? editingEvent.closingCosts : 3);
  const [propertyTax, setPropertyTax] = useState(editingEvent?.propertyTax !== undefined ? editingEvent.propertyTax : 1.1);
  const [insurance, setInsurance] = useState(editingEvent?.insurance !== undefined ? editingEvent.insurance : 0.35);
  const [hoa, setHoa] = useState(editingEvent?.hoa !== undefined ? editingEvent.hoa : 0);
  const [maintenance, setMaintenance] = useState(editingEvent?.maintenance !== undefined ? editingEvent.maintenance : 1.0);

  // Step state: 'details', 'options', 'confirmation'
  const [step, setStep] = useState('details');

  // Option choice in options step: 'A' (Affordable Home) or 'B' (Keep target home)
  const [selectedOption, setSelectedOption] = useState('A');

  // Sync on edit changes
  useEffect(() => {
    if (editingEvent) {
      const isNewEvent = !editingEvent.id || editingEvent.isNew;
      setIsPriceTouched(!isNewEvent);
      const defaultPurchaseAge = editingEvent.purchaseAge !== undefined ? editingEvent.purchaseAge : Math.min(85, (inputs.currentAge || 35) + 5);
      const price = (!isNewEvent && editingEvent.homePrice !== undefined)
        ? editingEvent.homePrice
        : calculateMaxAffordableHomePrice(inputs, null, null, { ...editingEvent, purchaseAge: defaultPurchaseAge }, simulation).recommendedPrice;
      setHomePrice(price);
      setPriceInput(price.toLocaleString());
      setPurchaseAge(defaultPurchaseAge);
      setDownPaymentPct(
        editingEvent.homePrice > 0 
          ? Math.round((editingEvent.downPayment / editingEvent.homePrice) * 100) 
          : 20
      );
      if (editingEvent.purchaseType) setPurchaseType(editingEvent.purchaseType);
      if (editingEvent.mortgageRate !== undefined) setMortgageRate(editingEvent.mortgageRate);
      if (editingEvent.loanTerm !== undefined) setLoanTerm(editingEvent.loanTerm);
      if (editingEvent.closingCosts !== undefined) setClosingCosts(editingEvent.closingCosts);
      if (editingEvent.propertyTax !== undefined) setPropertyTax(editingEvent.propertyTax);
      if (editingEvent.insurance !== undefined) setInsurance(editingEvent.insurance);
      if (editingEvent.hoa !== undefined) setHoa(editingEvent.hoa);
      if (editingEvent.maintenance !== undefined) setMaintenance(editingEvent.maintenance);
    }
  }, [editingEvent]);

  // Auto-update price based on affordable solver until user edits manually
  useEffect(() => {
    if (!isPriceTouched) {
      const aff = calculateMaxAffordableHomePrice(
        inputs,
        null,
        null,
        {
          ...editingEvent,
          downPaymentPct,
          closingCosts,
          mortgageRate,
          loanTerm,
          purchaseAge
        },
        simulation
      );
      setHomePrice(aff.recommendedPrice);
      setPriceInput(aff.recommendedPrice.toLocaleString());
    }
  }, [purchaseAge, isPriceTouched, inputs, editingEvent, downPaymentPct, closingCosts, mortgageRate, loanTerm, simulation]);

  // Price change formatting
  const handlePriceChange = (e) => {
    setIsPriceTouched(true);
    const cleanStr = e.target.value.replace(/[^0-9]/g, '');
    if (cleanStr === '') {
      setHomePrice(0);
      setPriceInput('');
    } else {
      const num = parseInt(cleanStr, 10) || 0;
      setHomePrice(num);
      setPriceInput(num.toLocaleString());
    }
  };

  // Calculations
  const liquidAssets = useMemo(() => {
    return calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulation);
  }, [inputs, purchaseAge, simulation]);

  const tempEvent = useMemo(() => {
    const dp = Math.round(homePrice * (downPaymentPct / 100));
    return {
      homePrice,
      downPayment: dp,
      purchaseType,
      mortgageRate,
      loanTerm,
      closingCosts,
      propertyTax,
      insurance,
      hoa,
      maintenance
    };
  }, [homePrice, downPaymentPct, purchaseType, mortgageRate, loanTerm, closingCosts, propertyTax, insurance, hoa, maintenance]);

  const totalCashRequired = useMemo(() => {
    return calculateTotalCashRequired(tempEvent);
  }, [tempEvent]);

  const hasShortfall = useMemo(() => {
    return totalCashRequired > liquidAssets;
  }, [totalCashRequired, liquidAssets]);

  const oldHousingCost = useMemo(() => {
    return getOldRentBeforePurchase(inputs, purchaseAge);
  }, [inputs, purchaseAge]);

  const affordabilityData = useMemo(() => {
    return calculateMaxAffordableHomePrice(
      inputs,
      null,
      null,
      {
        ...editingEvent,
        downPaymentPct,
        closingCosts,
        mortgageRate,
        loanTerm,
        purchaseAge
      },
      simulation
    );
  }, [inputs, editingEvent, downPaymentPct, closingCosts, mortgageRate, loanTerm, purchaseAge, simulation]);

  const affordableHomePrice = affordabilityData.recommendedPrice;
  const cashAffordablePrice = affordabilityData.cashAffordablePrice;
  const monthlyAffordablePrice = affordabilityData.monthlyAffordablePrice;

  const shortfallAmount = useMemo(() => {
    return Math.max(0, totalCashRequired - liquidAssets);
  }, [totalCashRequired, liquidAssets]);

  const newHousingCost = useMemo(() => {
    return getHousingCostForPrice(homePrice, tempEvent);
  }, [homePrice, tempEvent]);

  const raiseAmount = useMemo(() => {
    if (newHousingCost <= oldHousingCost) return 0;
    const netRaise = (newHousingCost - oldHousingCost) * 12;
    if (inputs.includeTaxes) {
      const currentGross = inputs.incomeList?.[0]?.amount || 100000;
      return grossUpIncome(netRaise, currentGross, inputs.filingStatus || 'single');
    }
    return Math.round(netRaise);
  }, [newHousingCost, oldHousingCost, inputs]);

  const needWindfall = shortfallAmount > 0;
  const needRaise = raiseAmount > 0;

  // Outcome Projections for summary card
  const simulatedOutcome = useMemo(() => {
    const tempInputs = JSON.parse(JSON.stringify(inputs));
    const targetPrice = selectedOption === 'A' && hasShortfall ? affordableHomePrice : homePrice;
    const dp = Math.round(targetPrice * (downPaymentPct / 100));

    const houseId = editingEvent?.houseId || `house-${Date.now()}`;
    const buyEvId = editingEvent?.id && editingEvent.id.startsWith('buy-') ? editingEvent.id : `buy-${Date.now()}`;

    const buyEvObj = {
      id: buyEvId,
      type: 'buyHouse',
      enabled: true,
      name: 'Buy House',
      purchaseAge: Number(purchaseAge),
      age: Number(purchaseAge),
      houseId: houseId,
      homePrice: targetPrice,
      downPayment: dp,
      purchaseType: targetPrice >= dp && downPaymentPct === 100 ? 'cash' : 'mortgage',
      mortgageRate: Number(mortgageRate),
      loanTerm: Number(loanTerm),
      closingCosts: Number(closingCosts),
      propertyTax: Number(propertyTax),
      insurance: Number(insurance),
      hoa: Number(hoa),
      maintenance: Number(maintenance),
      keepRent: false
    };

    const houseAssetObj = {
      id: houseId,
      name: editingEvent?.name || 'Primary Home',
      purchasePrice: targetPrice,
      downPayment: dp,
      purchaseType: targetPrice >= dp && downPaymentPct === 100 ? 'cash' : 'mortgage',
      mortgageRate: Number(mortgageRate),
      loanTermYears: Number(loanTerm),
      closingCosts: Number(closingCosts),
      propertyTaxRate: Number(propertyTax),
      insuranceCost: Number(insurance),
      hoaCost: Number(hoa),
      maintenanceRate: Number(maintenance)
    };

    if (!tempInputs.houseAssets) tempInputs.houseAssets = [];
    tempInputs.houseAssets = tempInputs.houseAssets.filter(h => h.id !== houseId);
    tempInputs.houseAssets.push(houseAssetObj);

    if (!tempInputs.lifeEvents) tempInputs.lifeEvents = [];
    tempInputs.lifeEvents = tempInputs.lifeEvents.filter(e => e.id !== buyEvId && e.houseId !== houseId);
    tempInputs.lifeEvents.push(buyEvObj);

    if (selectedOption === 'B' && hasShortfall) {
      if (needWindfall) {
        tempInputs.lifeEvents.push({
          id: `windfall-sim-${Date.now()}`,
          type: 'windfall',
          enabled: true,
          name: 'Down Payment Windfall',
          ageReceived: Number(purchaseAge),
          amount: shortfallAmount,
          taxRate: 0
        });
      }
      if (needRaise) {
        const promoId = `inc-sim-${Date.now()}`;
        const currentIncomeAmount = tempInputs.incomeList?.[0]?.amount || 100000;
        const newIncomeAmount = currentIncomeAmount + raiseAmount;

        const promotionIncome = {
          id: promoId,
          name: 'Promotion',
          amount: newIncomeAmount,
          frequency: 'yearly',
          startAge: Number(purchaseAge),
          endAge: tempInputs.targetRetirementAge || 65,
          growthRate: 0.035,
          isTaxable: true,
          incomeChangeType: 'newIncomeLevel',
          permanent: true,
          parentEventId: null
        };
        if (!tempInputs.incomeList) tempInputs.incomeList = [];
        tempInputs.incomeList.push(promotionIncome);

        tempInputs.lifeEvents.push({
          id: promoId,
          type: 'careerChange',
          enabled: true,
          name: 'Promotion',
          startAge: Number(purchaseAge),
          amount: newIncomeAmount,
          growthRate: 3.5
        });
      }
    }

    return runFireSimulation(tempInputs);
  }, [inputs, selectedOption, affordableHomePrice, homePrice, downPaymentPct, purchaseAge, mortgageRate, loanTerm, closingCosts, propertyTax, insurance, hoa, maintenance, needWindfall, shortfallAmount, needRaise, raiseAmount, editingEvent, hasShortfall]);

  const beforeReadyAge = simulation?.retirementReadyAge || inputs.targetRetirementAge || 65;
  const afterReadyAge = simulatedOutcome?.retirementReadyAge || inputs.targetRetirementAge || 65;

  const handleStep1Continue = () => {
    if (hasShortfall) {
      setStep('options');
    } else {
      setStep('confirmation');
    }
  };

  const handleStep2Continue = () => {
    setStep('confirmation');
  };

  const onSave = () => {
    const finalPrice = selectedOption === 'A' && hasShortfall ? affordableHomePrice : homePrice;
    const finalDp = Math.round(finalPrice * (downPaymentPct / 100));

    const updatedEvent = {
      ...editingEvent,
      type: 'buyHouse',
      homePrice: finalPrice,
      downPayment: finalDp,
      purchaseAge: Number(purchaseAge),
      age: Number(purchaseAge),
      purchaseType: finalPrice >= finalDp && downPaymentPct === 100 ? 'cash' : 'mortgage',
      mortgageRate: Number(mortgageRate),
      loanTerm: Number(loanTerm),
      closingCosts: Number(closingCosts),
      propertyTax: Number(propertyTax),
      insurance: Number(insurance),
      hoa: Number(hoa),
      maintenance: Number(maintenance),
      optionBSelected: hasShortfall && selectedOption === 'B',
      shortfallAmount: shortfallAmount,
      raiseAmount: raiseAmount
    };

    handleSaveEvent(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    handleDeleteEvent(editingEvent);
    onClose();
  };

  // Age change formatting comparison string
  const formatAgeCompare = () => {
    if (beforeReadyAge === afterReadyAge) {
      return `${beforeReadyAge} → ${afterReadyAge} (No Change)`;
    }
    const diff = afterReadyAge - beforeReadyAge;
    if (diff > 0) {
      return `${beforeReadyAge} → ${afterReadyAge} (${diff} year${diff > 1 ? 's' : ''} later)`;
    } else {
      return `${beforeReadyAge} → ${afterReadyAge} (${Math.abs(diff)} year${Math.abs(diff) > 1 ? 's' : ''} earlier)`;
    }
  };

  // Emojis floating decorations for Step 1
  const decorations = [
    { char: '✨', style: { left: '10%', top: '10%', fontSize: '1.25rem', '--child-dec-rot': '-15deg', opacity: 0.7 } },
    { char: '⭐', style: { left: '18%', top: '48%', fontSize: '1.3rem', '--child-dec-rot': '10deg', opacity: 0.9 } },
    { char: '🏡', style: { left: '46%', top: '18%', fontSize: '2.5rem', '--child-dec-rot': '0deg', opacity: 1.0 } },
    { char: '🎉', style: { right: '12%', top: '12%', fontSize: '1.25rem', '--child-dec-rot': '15deg', opacity: 0.9 } },
    { char: '🌱', style: { right: '15%', top: '50%', fontSize: '1.2rem', '--child-dec-rot': '5deg', opacity: 0.8 } }
  ];

  return (
    <div className="mobile-house-modal-backdrop" onClick={onClose}>
      <div 
        className="mobile-house-card-content" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle drag handle */}
        <div className="mobile-house-drag-handle" />

        {/* Step 1: Details */}
        {step === 'details' && (
          <>
            <div className="mobile-house-scroll-content">
              {/* Floating emoji header */}
              <div style={{ position: 'relative', textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ height: '3.5rem' }} />
                <h2 className="mobile-house-title-purple">Congrats! 🎉</h2>
                <p className="mobile-house-subtitle">You’re planning your new home.</p>

                {decorations.map((dec, idx) => (
                  <span
                    key={idx}
                    className="mobile-house-dec-item"
                    style={{
                      position: 'absolute',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      ...dec.style
                    }}
                  >
                    {dec.char}
                  </span>
                ))}
              </div>

              <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '1rem 0' }} />

              {/* Form inputs */}
              <div className="mobile-house-form-group">
                <label htmlFor="mobile-house-price" className="mobile-house-label">Home Price</label>
                <div className="mobile-house-input-cost-wrapper">
                  <span className="mobile-house-input-cost-prefix">$</span>
                  <input
                    id="mobile-house-price"
                    type="text"
                    className="mobile-house-input-cost"
                    value={priceInput}
                    onChange={handlePriceChange}
                    placeholder="e.g. 250,000"
                  />
                </div>
              </div>

              {/* Purchase Age & Down Payment columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="mobile-house-form-group">
                  <label htmlFor="mobile-house-purchase-age" className="mobile-house-label">Purchase Age</label>
                  <input
                    id="mobile-house-purchase-age"
                    type="number"
                    className="mobile-house-input"
                    value={purchaseAge}
                    onChange={(e) => setPurchaseAge(Math.max(18, Math.min(85, parseInt(e.target.value, 10) || 35)))}
                    min={18}
                    max={85}
                  />
                </div>

                <div className="mobile-house-form-group">
                  <label htmlFor="mobile-house-down-payment" className="mobile-house-label">Down Payment</label>
                  <select
                    id="mobile-house-down-payment"
                    className="mobile-house-input"
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(parseInt(e.target.value, 10) || 20)}
                    style={{ 
                      appearance: 'none', 
                      background: '#f9fafb url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center', 
                      backgroundSize: '16px' 
                    }}
                  >
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                    <option value="25">25%</option>
                    <option value="30">30%</option>
                    <option value="40">40%</option>
                    <option value="50">50%</option>
                    <option value="100">100% (Cash)</option>
                  </select>
                </div>
              </div>

              {/* Advanced Options collapsible */}
              <div className="mobile-house-advanced-toggle" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                <span style={{ 
                  transform: isAdvancedOpen ? 'rotate(90deg)' : 'none', 
                  transition: 'transform 0.15s ease', 
                  display: 'inline-block' 
                }}>
                  ▶
                </span>
                <span>Advanced Options</span>
              </div>

              {isAdvancedOpen && (
                <div className="mobile-house-advanced-panel">
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-rate" className="mobile-house-label">Rate (%)</label>
                    <input
                      id="mobile-house-rate"
                      type="number"
                      step="0.1"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={mortgageRate}
                      onChange={(e) => setMortgageRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-term" className="mobile-house-label">Term (Yrs)</label>
                    <input
                      id="mobile-house-term"
                      type="number"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={loanTerm}
                      onChange={(e) => setLoanTerm(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-closing" className="mobile-house-label">Closing (%)</label>
                    <input
                      id="mobile-house-closing"
                      type="number"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={closingCosts}
                      onChange={(e) => setClosingCosts(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-tax" className="mobile-house-label">Tax (%)</label>
                    <input
                      id="mobile-house-tax"
                      type="number"
                      step="0.05"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={propertyTax}
                      onChange={(e) => setPropertyTax(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-ins" className="mobile-house-label">Ins (%)</label>
                    <input
                      id="mobile-house-ins"
                      type="number"
                      step="0.05"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={insurance}
                      onChange={(e) => setInsurance(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="mobile-house-form-group">
                    <label htmlFor="mobile-house-hoa" className="mobile-house-label">HOA ($/mo)</label>
                    <input
                      id="mobile-house-hoa"
                      type="number"
                      className="mobile-house-input"
                      style={{ height: '38px', padding: '0 0.5rem', fontSize: '0.9rem' }}
                      value={hoa}
                      onChange={(e) => setHoa(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Actions Footer */}
            <div className="mobile-house-sticky-footer">
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    padding: '0 0.75rem 0 0',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              )}
              <button 
                type="button" 
                className="mobile-house-btn-secondary" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="mobile-house-btn-primary" 
                onClick={handleStep1Continue}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* Step 2b: Unaffordable Options / Let's make it fit your plan */}
        {step === 'options' && (
          <>
            <div className="mobile-house-scroll-content">
              {/* Header */}
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏡</div>
                <h2 className="mobile-house-title-navy">Let’s make it fit your plan</h2>
                <p className="mobile-house-subtitle">
                  You don’t currently have enough cash available for the down payment.
                </p>
              </div>

              {/* Affordability calculations card */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid #cbd5e1',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Suggested price based on cash available:</span>
                  <strong style={{ color: '#1e293b' }}>{formatCurrency(cashAffordablePrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Monthly payment limit:</span>
                  <strong style={{ color: '#1e293b' }}>
                    {oldHousingCost === 0 ? 'Unknown' : formatCurrency(monthlyAffordablePrice)}
                  </strong>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#16a34a' }}>Best affordable match:</span>
                  <strong style={{ fontSize: '1.2rem', fontWeight: '800', color: '#16a34a' }}>
                    {formatCurrency(affordableHomePrice)}
                  </strong>
                </div>
              </div>

              {/* Options selection list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Option 1: Buy affordable home */}
                <div 
                  className={`mobile-house-option-card ${selectedOption === 'A' ? 'selected' : ''}`}
                  onClick={() => setSelectedOption('A')}
                >
                  <div className={`mobile-house-radio ${selectedOption === 'A' ? 'selected' : ''}`}>
                    {selectedOption === 'A' && <div className="mobile-house-radio-inner" />}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                      🏠 Buy a {formatCurrency(affordableHomePrice)} Home
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Affordable with your finances</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Similar monthly cost to renting</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Keeps your plan on track</span>
                  </div>
                </div>

                {/* Option 2: Keep requested original price */}
                <div 
                  className={`mobile-house-option-card ${selectedOption === 'B' ? 'selected' : ''}`}
                  onClick={() => setSelectedOption('B')}
                >
                  <div className={`mobile-house-radio ${selectedOption === 'B' ? 'selected' : ''}`}>
                    {selectedOption === 'B' && <div className="mobile-house-radio-inner" />}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                      🚀 Keep the {formatCurrency(homePrice)} Home
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Add a down payment windfall</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Maintain comfortable cash flow</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', margin: '0.15rem 0' }}>✓ Add promotion only if monthly costs rise</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="mobile-house-sticky-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
                onClick={() => setStep('details')}
              >
                Back
              </button>
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="mobile-house-btn-secondary" 
                  onClick={onClose}
                  style={{ maxWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="mobile-house-btn-primary" 
                  onClick={handleStep2Continue}
                  style={{ maxWidth: '120px' }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2a: Affordable Result / Great News Summary */}
        {step === 'confirmation' && (
          <>
            <div className="mobile-house-scroll-content">
              {/* Great News Hero */}
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⭐</div>
                <h2 className="mobile-house-title-green">Great News!</h2>
                <p className="mobile-house-subtitle">Your plan still works.</p>
              </div>

              {/* Summary card */}
              <div className="mobile-house-summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: '600', fontSize: '0.85rem' }}>You Chose:</span>
                  <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.85rem' }}>
                    {selectedOption === 'A' && hasShortfall 
                      ? `Buy a ${formatCurrency(affordableHomePrice)} Home` 
                      : `Keep the ${formatCurrency(homePrice)} Home`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Work Optional Age</span>
                  <strong style={{ color: '#1f2937' }}>{formatAgeCompare()}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Home Purchase Price</span>
                  <strong style={{ color: '#1f2937' }}>
                    {formatCurrency(selectedOption === 'A' && hasShortfall ? affordableHomePrice : homePrice)}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Promotion</span>
                  <strong style={{ color: '#1f2937' }}>
                    {selectedOption === 'B' && hasShortfall && needRaise 
                      ? `+$${raiseAmount.toLocaleString()}/year` 
                      : 'None Needed'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Down Payment Windfall</span>
                  <strong style={{ color: '#1f2937' }}>
                    {selectedOption === 'B' && hasShortfall && needWindfall 
                      ? formatCurrency(shortfallAmount) 
                      : 'None Needed'}
                  </strong>
                </div>
              </div>

              {/* Confidence card */}
              <div className="mobile-house-info-card-green" style={{ border: '1px solid #10b981' }}>
                <span style={{ fontSize: '1.4rem' }}>😊</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>Comfortable</strong>
                  <span style={{ color: '#4b5563', fontSize: '0.8rem' }}>You’re on track with confidence.</span>
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="mobile-house-sticky-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
                onClick={() => setStep(hasShortfall ? 'options' : 'details')}
              >
                Back
              </button>
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="mobile-house-btn-secondary" 
                  onClick={onClose}
                  style={{ maxWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="mobile-house-btn-primary" 
                  onClick={onSave}
                  style={{ background: '#10b981', maxWidth: '100px' }}
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
