/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity */
import { useState, useMemo, useEffect } from 'react';
import { formatCurrency } from './helpers';
import { runFireSimulation } from '../../fireCalculations';
import { NumberInput } from '../ui/PlainInputs';
import {
  calculateTotalCashRequired,
  calculateLiquidAssetsAtPurchaseAge,
  getHousingCostForPrice,
  grossUpIncome,
  calculateMaxAffordableHomePrice
} from '../../domain/housing/houseAffordability';
import { getOldRentBeforePurchase } from '../../domain/housing/houseRecommendationSolver';


export default function HousePlanningModal({
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

  const isMobile = uiState?.isMobile || false;

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
  const [purchaseAge, setPurchaseAge] = useState(editingEvent?.purchaseAge !== undefined ? editingEvent.purchaseAge : Math.min(85, (inputs.currentAge || 35) + 5));
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

  // Wizard Step (1, 2, or 3)
  const [step, setStep] = useState(1);
  
  // Option choice in Step 2: 'A' (Affordable Home) or 'B' (Keep target home)
  const [selectedOption, setSelectedOption] = useState('A');

  // Synchronize on load/edit
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

  // Auto-update home price when purchase age or other parameters change, until user touches/edits the price
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

  // Handle Home Price formatting
  const handlePriceChange = (e) => {
    setIsPriceTouched(true);
    const cleanStr = e.target.value.replace(/[^0-9]/g, '');
    if (cleanStr === '') {
      setHomePrice(0);
      setPriceInput('');
    } else {
      const num = parseInt(cleanStr) || 0;
      setHomePrice(num);
      setPriceInput(num.toLocaleString());
    }
  };

  // Calculations
  const liquidAssets = useMemo(() => {
    return calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, simulation);
  }, [inputs, purchaseAge, simulation]);

  // Create temporary event object for calculations
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

  // Affordable Home Price Calculation
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

  // Shortfall & Raise Option B variables
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

  // Option B supports
  const needWindfall = shortfallAmount > 0;
  const needRaise = raiseAmount > 0;

  // Simulate outcome based on selections for Step 3
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
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const handleStep2Continue = () => {
    setStep(3);
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

  const decorations = [
    { char: '✨', style: { left: '8%', top: '15%', fontSize: '1.25rem', '--child-dec-rot': '-15deg', opacity: 0.7 } },
    { char: '⭐', style: { left: '20%', top: '35%', fontSize: '1.4rem', '--child-dec-rot': '10deg', opacity: 0.9 } },
    { char: '💜', style: { left: '12%', top: '65%', fontSize: '1.2rem', '--child-dec-rot': '-10deg', opacity: 0.75 } },
    { char: '🎉', style: { right: '10%', top: '20%', fontSize: '1.3rem', '--child-dec-rot': '15deg', opacity: 0.9 } },
    { char: '🌱', style: { right: '15%', top: '68%', fontSize: '1.2rem', '--child-dec-rot': '5deg', opacity: 0.8 } }
  ];

  const formatAgeCompare = () => {
    if (beforeReadyAge === afterReadyAge) {
      return `${beforeReadyAge} → ${afterReadyAge} No Change`;
    }
    const diff = afterReadyAge - beforeReadyAge;
    if (diff > 0) {
      return `${beforeReadyAge} → ${afterReadyAge} +${diff} year${diff > 1 ? 's' : ''}`;
    } else {
      return `${beforeReadyAge} → ${afterReadyAge} ${Math.abs(diff)} year${Math.abs(diff) > 1 ? 's' : ''} earlier`;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="event-form-overlay-card modal-content animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '90%',
          padding: '2rem',
          margin: isMobile ? 'auto 1rem' : 'auto',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Visually Hidden Title for Accessibility */}
        <h3 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
          {isNew ? 'Add Home' : 'Edit Home Details'}
        </h3>

        {step === 1 && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Step 1 Hero Section */}
            <div style={{ position: 'relative', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏡</div>
              <h4 style={{
                fontSize: '2rem',
                fontWeight: '800',
                margin: '0 0 0.25rem 0',
                color: 'var(--text-primary)',
                backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block'
              }}>
                Congrats! 🎉
              </h4>
              <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>
                You’re planning your new home.
              </p>

              {decorations.map((dec, i) => (
                <span
                  key={i}
                  className="child-dec-item"
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

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Home Price</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0 1rem',
                  height: '42px'
                }}>
                  <span style={{ color: 'var(--text-tertiary)', marginRight: '0.5rem', fontSize: '0.95rem', fontWeight: '500' }}>$</span>
                  <input
                    type="text"
                    value={priceInput}
                    onChange={handlePriceChange}
                    style={{
                      border: 'none',
                      background: 'none',
                      width: '100%',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      padding: 0,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
              {oldHousingCost === 0 && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  lineHeight: '1.4',
                  marginTop: '-0.5rem'
                }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <div style={{ textAlign: 'left' }}>
                    Rent is not set, so this estimate is based on available cash only. Add rent for a stronger monthly payment estimate.
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                  <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Purchase Age</span>
                  <input
                    type="number"
                    style={{
                      height: '42px',
                      borderRadius: '12px',
                      padding: '0 1rem',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                    value={purchaseAge}
                    onChange={(e) => setPurchaseAge(Math.max(18, Math.min(85, parseInt(e.target.value) || 35)))}
                    min={18}
                    max={85}
                  />
                </div>

                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                  <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Down Payment</span>
                  <select
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(parseInt(e.target.value) || 20)}
                    style={{
                      height: '42px',
                      borderRadius: '12px',
                      padding: '0 1rem',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      outline: 'none'
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

              {/* Advanced Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    userSelect: 'none',
                    marginTop: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '0.7rem', transform: isAdvancedOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block' }}>▶</span>
                  <span>Advanced Options</span>
                </div>

                {isAdvancedOpen && (
                  <div className="animate-slide-down" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.25rem',
                    marginTop: '0.5rem',
                    padding: '1.25rem',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Rate (%)</span>
                      <input
                        type="number"
                        step="0.1"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={mortgageRate}
                        onChange={(e) => setMortgageRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Term (Yrs)</span>
                      <input
                        type="number"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={loanTerm}
                        onChange={(e) => setLoanTerm(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Closing (%)</span>
                      <input
                        type="number"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={closingCosts}
                        onChange={(e) => setClosingCosts(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Tax (%)</span>
                      <input
                        type="number"
                        step="0.05"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={propertyTax}
                        onChange={(e) => setPropertyTax(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Ins (%)</span>
                      <input
                        type="number"
                        step="0.05"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={insurance}
                        onChange={(e) => setInsurance(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                      <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>HOA ($/mo)</span>
                      <input
                        type="number"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          padding: '0 0.75rem',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--text-primary)'
                        }}
                        value={hoa}
                        onChange={(e) => setHoa(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '1rem',
              width: '100%' 
            }}>
              <div>
                {!isNew ? (
                  <button 
                    type="button" 
                    onClick={handleDelete}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ef4444', 
                      cursor: 'pointer', 
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      padding: '0 0.5rem 0 0'
                    }}
                  >
                    Delete Home
                  </button>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={onClose}
                  style={{ 
                    padding: '0.6rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleStep1Continue}
                  style={{ 
                    padding: '0.6rem 1.5rem', 
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '600',
                    background: 'var(--primary, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && hasShortfall && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏡</div>
              <h4 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                Let’s make it fit your plan
              </h4>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.75rem 0', lineHeight: '1.4', fontWeight: '500' }}>
                You don’t currently have enough cash available for the down payment.
              </p>
              <div style={{
                background: 'rgba(248, 247, 244, 0.5)',
                borderRadius: '16px',
                padding: '1rem',
                border: '1px solid #cbd5e1',
                marginTop: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Suggested price based on cash available:</span>
                  <strong style={{ color: '#1e293b' }}>{formatCurrency(cashAffordablePrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Monthly payment limit:</span>
                  <strong style={{ color: '#1e293b' }}>
                    {oldHousingCost === 0 ? 'Unknown' : formatCurrency(monthlyAffordablePrice)}
                  </strong>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid #cbd5e1', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#16a34a' }}>Best affordable match:</span>
                  <strong style={{ fontSize: '1.25rem', fontWeight: '850', color: '#16a34a' }}>
                    {formatCurrency(affordableHomePrice)}
                  </strong>
                </div>
                {oldHousingCost === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#b45309', display: 'block', marginTop: '0.15rem', lineHeight: '1.3', textAlign: 'left' }}>
                    ⚠️ Rent is not set, so this estimate is based on available cash only. Add rent for a stronger monthly payment estimate.
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Option A */}
              <div
                onClick={() => setSelectedOption('A')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: selectedOption === 'A' ? '2px solid var(--primary, #8b5cf6)' : '1px solid var(--border-color)',
                  background: selectedOption === 'A' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: selectedOption === 'A' ? '6px solid var(--primary, #8b5cf6)' : '2px solid var(--text-tertiary, #cbd5e1)',
                  marginRight: '10px',
                  marginTop: '2px',
                  flexShrink: 0
                }} />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    🏠 Buy a {formatCurrency(affordableHomePrice)} Home
                  </strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>✓ Affordable with your finances</span>
                  <span style={{ display: 'block', color: 'var(--text-secondary)' }}>✓ Similar monthly cost to renting</span>
                  <span style={{ display: 'block', color: 'var(--text-secondary)' }}>✓ Keeps your plan on track</span>
                </div>
              </div>

              {/* Option B */}
              <div
                onClick={() => setSelectedOption('B')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: selectedOption === 'B' ? '2px solid var(--primary, #8b5cf6)' : '1px solid var(--border-color)',
                  background: selectedOption === 'B' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: selectedOption === 'B' ? '6px solid var(--primary, #8b5cf6)' : '2px solid var(--text-tertiary, #cbd5e1)',
                  marginRight: '10px',
                  marginTop: '2px',
                  flexShrink: 0
                }} />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    🚀 Keep the {formatCurrency(homePrice)} Home
                  </strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>✓ Add a down payment windfall</span>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>✓ Maintain comfortable cash flow</span>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>✓ Add promotion only if monthly costs rise</span>
                </div>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', width: '100%' }}>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary, #94a3b8)', 
                  cursor: 'pointer', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  padding: '0 0.5rem 0 0'
                }}
              >
                Back
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={onClose}
                  style={{ 
                    padding: '0.6rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleStep2Continue}
                  style={{
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '600',
                    background: 'var(--primary, #8b5cf6)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⭐</div>
              <h4 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0', color: 'var(--primary)' }}>
                Great News!
              </h4>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontWeight: '500' }}>
                Your plan still works.
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>You Chose:</span>
                <strong style={{ color: 'var(--primary)' }}>
                  {selectedOption === 'A' && hasShortfall 
                    ? `Buy a ${formatCurrency(affordableHomePrice)} Home` 
                    : `Keep the ${formatCurrency(homePrice)} Home`}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Work Optional Age</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatAgeCompare()}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Home Purchase Price</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(selectedOption === 'A' && hasShortfall ? affordableHomePrice : homePrice)}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Promotion</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {selectedOption === 'B' && hasShortfall && needRaise 
                    ? `+$${raiseAmount.toLocaleString()}/year` 
                    : 'None Needed'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Down Payment Windfall</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {selectedOption === 'B' && hasShortfall && needWindfall 
                    ? formatCurrency(shortfallAmount) 
                    : 'None Needed'}
                </strong>
              </div>
            </div>

            {/* Green comfortable banner */}
            <div style={{
              background: 'rgba(22, 163, 74, 0.04)',
              border: '1px solid var(--primary)',
              borderRadius: '16px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginTop: '0.5rem'
            }}>
              <span style={{ fontSize: '1.4rem' }}>😊</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Comfortable</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>You’re on track with confidence.</span>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', width: '100%' }}>
              <button 
                type="button" 
                onClick={() => setStep(hasShortfall ? 2 : 1)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary, #94a3b8)', 
                  cursor: 'pointer', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  padding: '0 0.5rem 0 0'
                }}
              >
                Back
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={onClose}
                  style={{ 
                    padding: '0.6rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onSave}
                  style={{
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '12px',
                    fontWeight: '700',
                    background: '#10b981', // Confirm button green
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
