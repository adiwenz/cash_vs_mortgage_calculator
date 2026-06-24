import React, { useState, useMemo, useEffect } from 'react';
import { Info, Sprout, TrendingUp, Scale, ChevronRight, AlertCircle } from 'lucide-react';
import { formatCurrency } from './helpers';
import { getChildEventBirthAge, setChildEventBirthAge } from '../../utils/childEventHelpers';

export default function MobileChildPlanningModal({
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

  // Local Wizard State
  const [step, setStep] = useState('details'); // 'details' | 'strategy' | 'confirmation'
  const [childName, setChildName] = useState(editingEvent?.childName || '');
  
  const currentAge = inputs.currentAge !== undefined ? Number(inputs.currentAge) : 35;
  const lifeExpectancy = inputs.lifeExpectancy !== undefined ? Number(inputs.lifeExpectancy) : 85;

  const [birthAge, setBirthAge] = useState(
    editingEvent ? getChildEventBirthAge(editingEvent) : currentAge
  );
  const [childStartAge, setChildStartAge] = useState(
    editingEvent?.childStartAge !== undefined ? editingEvent.childStartAge : 0
  );
  const [includeCollege, setIncludeCollege] = useState(!!editingEvent?.includeCollege);

  const [childcareCostAnnual, setChildcareCostAnnual] = useState(
    editingEvent?.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000
  );
  const [costInput, setCostInput] = useState(
    (editingEvent?.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000).toLocaleString()
  );
  
  const [strategy, setStrategy] = useState(editingEvent?.adjustmentStrategy || 'promotion');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Cost change handler with comma formatting
  const handleCostChange = (e) => {
    const cleanStr = e.target.value.replace(/[^0-9]/g, '');
    if (cleanStr === '') {
      setChildcareCostAnnual(0);
      setCostInput('');
    } else {
      const num = parseInt(cleanStr, 10) || 0;
      setChildcareCostAnnual(num);
      setCostInput(num.toLocaleString());
    }
  };

  const handleChildStartAgeChange = (e) => {
    const val = e.target.value;
    const startAge = Math.max(0, Math.min(22, parseInt(val, 10) || 0));
    setChildStartAge(startAge);
    setBirthAge(Math.max(18, Math.min(85, currentAge - startAge)));
  };

  const handleBirthAgeChange = (e) => {
    const val = e.target.value;
    const bAge = Math.max(18, Math.min(85, parseInt(val, 10) || currentAge));
    setBirthAge(bAge);
    setChildStartAge(Math.max(0, Math.min(22, currentAge - bAge)));
  };

  const childcareCostMonthly = childcareCostAnnual / 12;

  // Step 1 Validation & Navigation
  const handleContinue = () => {
    const ageNum = Number(birthAge);
    const costNum = Number(childcareCostAnnual);

    if (isNaN(ageNum) || ageNum < currentAge) {
      setValidationError(`Age must be at least your current age (${currentAge}).`);
      return;
    }
    if (ageNum > lifeExpectancy) {
      setValidationError(`Age must be less than or equal to your life expectancy (${lifeExpectancy}).`);
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setValidationError("Childcare cost must be greater than or equal to 0.");
      return;
    }

    setValidationError('');
    setStep('strategy');
  };

  // Perform Save Action on Step 2 Confirm
  const handleConfirm = () => {
    try {
      setError(null);
      let updatedEvent = setChildEventBirthAge(
        {
          ...editingEvent,
          childName,
          childStartAge: Number(childStartAge),
          costMethod: 'custom',
          customAges0to4: childcareCostAnnual,
          customAges5to12: childcareCostAnnual,
          customAges13to18: childcareCostAnnual,
          customAges19to22: childcareCostAnnual,
          includeCollege: includeCollege,
          adjustmentStrategy: strategy
        },
        Number(birthAge)
      );

      handleSaveEvent(updatedEvent);
      setStep('confirmation');
    } catch (err) {
      console.error(err);
      setError("An error occurred while saving. Please try again.");
    }
  };

  // Emoji decoration layout
  const decorations = [
    { char: '✨', style: { left: '8%', top: '15%', fontSize: '1.25rem', '--child-dec-rot': '-15deg', opacity: 0.7 } },
    { char: '⭐', style: { left: '20%', top: '35%', fontSize: '1.4rem', '--child-dec-rot': '10deg', opacity: 0.9 } },
    { char: '💜', style: { left: '12%', top: '65%', fontSize: '1.25rem', '--child-dec-rot': '-10deg', opacity: 0.75 } },
    { char: '🎉', style: { right: '10%', top: '20%', fontSize: '1.3rem', '--child-dec-rot': '15deg', opacity: 0.9 } },
    { char: '🎵', style: { right: '24%', top: '42%', fontSize: '1.1rem', '--child-dec-rot': '-5deg', opacity: 0.7 } },
    { char: '🌱', style: { right: '15%', top: '68%', fontSize: '1.2rem', '--child-dec-rot': '5deg', opacity: 0.8 } }
  ];

  return (
    <div className="mobile-child-modal-backdrop" onClick={onClose}>
      <div 
        className="mobile-child-card-content" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step 1: Details */}
        {step === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            
            {/* Celebratory emoji header */}
            <div style={{ position: 'relative', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👶</div>
              <h2 className="mobile-child-title-purple">Congrats! 🎉</h2>
              <p className="mobile-child-subtitle">You're planning for a new adventure.</p>
              
              {decorations.map((dec, idx) => (
                <span
                  key={idx}
                  className="mobile-child-dec-item"
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

            {/* Validation error */}
            {validationError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#b91c1c',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                textAlign: 'left'
              }}>
                <AlertCircle size={16} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Child's Name */}
            <div className="mobile-child-form-group">
              <label className="mobile-child-label">Child's Name (Optional)</label>
              <input
                type="text"
                className="mobile-child-input"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Liam"
              />
            </div>

            {/* Arrival Age and Cost */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
              <div className="mobile-child-form-group">
                <label className="mobile-child-label">Age Child Arrives</label>
                <input
                  type="number"
                  className="mobile-child-input"
                  value={birthAge}
                  onChange={handleBirthAgeChange}
                  min={18}
                  max={85}
                />
              </div>

              <div className="mobile-child-form-group">
                <label className="mobile-child-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Annual Childcare Cost
                  <Info size={14} style={{ color: '#9ca3af', cursor: 'pointer' }} title="Average estimate is $15,000/year. You can adjust this anytime." />
                </label>
                <div className="mobile-child-input-cost-wrapper">
                  <span className="mobile-child-input-cost-prefix">$</span>
                  <input
                    type="text"
                    className="mobile-child-input-cost"
                    value={costInput}
                    onChange={handleCostChange}
                  />
                  <span className="mobile-child-input-cost-suffix">/year</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1.25rem', textAlign: 'left' }}>
              Default estimate is $15,000/year. You can adjust this anytime.
            </div>

            {/* Advanced Options collapsible */}
            <div className="mobile-child-advanced-toggle" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
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
              <div className="mobile-child-advanced-panel">
                <div className="mobile-child-form-group">
                  <label className="mobile-child-label">Child's Current Age</label>
                  <input
                    type="number"
                    className="mobile-child-input"
                    value={childStartAge}
                    onChange={handleChildStartAgeChange}
                    min={0}
                    max={22}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="mobile-include-college"
                    checked={includeCollege}
                    onChange={(e) => setIncludeCollege(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981', marginTop: '2px' }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <label htmlFor="mobile-include-college" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', cursor: 'pointer' }}>
                      Include College / Young Adult Support (Ages 19–22)
                    </label>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      Adds childcare costs for an additional 4 years.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1 Footer */}
            <div className="mobile-child-footer-row">
              <button 
                type="button" 
                className="mobile-child-btn-secondary" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="mobile-child-btn-primary" 
                onClick={handleContinue}
              >
                Continue
              </button>
            </div>

          </div>
        )}

        {/* Step 2: Adjust Strategy */}
        {step === 'strategy' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👶</div>
              <h2 className="mobile-child-title-purple">{childName || "New Child"}</h2>
              <p className="mobile-child-subtitle">Age {birthAge}</p>
            </div>

            {/* Cost card */}
            <div className="mobile-child-cost-summary-card">
              <span className="mobile-child-label" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👶 Cost
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1f2937' }}>
                  {formatCurrency(childcareCostMonthly)}/mo
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.15rem' }}>
                  {formatCurrency(childcareCostAnnual)}/yr
                </div>
              </div>
            </div>

            {/* Inline Error */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#b91c1c',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                textAlign: 'left'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Strategy Selectors */}
            <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.75rem' }}>
                How do you want to adjust?
              </h3>

              {/* Option A: Keep Current Lifestyle */}
              <div 
                className={`mobile-child-strategy-card ${strategy === 'promotion' ? 'selected' : ''}`}
                onClick={() => setStrategy('promotion')}
              >
                <div className={`mobile-child-radio ${strategy === 'promotion' ? 'selected' : ''}`}>
                  {strategy === 'promotion' && <div className="mobile-child-radio-inner" />}
                </div>
                <TrendingUp size={22} style={{ color: '#8b5cf6', marginRight: '12px' }} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1f2937' }}>
                    Keep Current Lifestyle
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                    Get a raise to cover the cost
                  </div>
                </div>
              </div>

              {/* Option B: Rebalance Budget */}
              <div 
                className={`mobile-child-strategy-card ${strategy === 'rebalance' ? 'selected' : ''}`}
                onClick={() => setStrategy('rebalance')}
              >
                <div className={`mobile-child-radio ${strategy === 'rebalance' ? 'selected' : ''}`}>
                  {strategy === 'rebalance' && <div className="mobile-child-radio-inner" />}
                </div>
                <Scale size={22} style={{ color: '#6b7280', marginRight: '12px' }} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1f2937' }}>
                    Rebalance Budget
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                    Use Wants first, raise if needed
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Footer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="mobile-child-btn-confirm" 
                onClick={handleConfirm}
              >
                Confirm
              </button>
              
              <button 
                type="button" 
                onClick={() => setStep('details')}
                style={{ 
                  background: 'none', 
                  border: 'none',
                  color: '#6b7280',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '0.5rem 0'
                }}
              >
                Back
              </button>
            </div>

          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirmation' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
            
            {/* Celebratory Header */}
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🎉</div>
              <h2 className="mobile-child-title-purple">All set! 🎉</h2>
              <p className="mobile-child-subtitle">Your new child has been added.</p>
            </div>

            {/* Summary card */}
            <div 
              style={{
                width: '100%',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '1.25rem',
                textAlign: 'center',
                boxSizing: 'border-box',
                marginBottom: '1rem'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>👶</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1f2937' }}>
                {childName || "New Child"}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.15rem 0 0.5rem 0' }}>
                Age {birthAge}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
                {formatCurrency(childcareCostMonthly)}/mo
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                {formatCurrency(childcareCostAnnual)}/yr
              </div>
            </div>

            {/* Green info alert card */}
            <div className="mobile-child-info-card-green">
              <Sprout size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span className="mobile-child-info-card-text">
                We've updated your plan and projections to include your new adventure.
              </span>
            </div>

            {/* View My Plan action */}
            <button 
              type="button" 
              className="mobile-child-btn-confirm" 
              onClick={onClose}
            >
              View My Plan
            </button>

          </div>
        )}
      </div>
    </div>
  );
}
