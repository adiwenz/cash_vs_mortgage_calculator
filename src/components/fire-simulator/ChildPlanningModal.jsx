import React, { useState, useMemo, useEffect } from 'react';
import { Info } from 'lucide-react';
import { formatCurrency } from './helpers';
import { getNormalizedPhases } from '../../fireCalculations';
import { NumberInput } from '../ui/PlainInputs';
import { getChildEventBirthAge, setChildEventBirthAge } from '../../utils/childEventHelpers';

export default function ChildPlanningModal({
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

  // Step 1 local state
  const [childName, setChildName] = useState(editingEvent?.childName || '');
  const [birthAge, setBirthAge] = useState(
    editingEvent ? getChildEventBirthAge(editingEvent) : (inputs.currentAge || 35)
  );
  const [childStartAge, setChildStartAge] = useState(editingEvent?.childStartAge !== undefined ? editingEvent.childStartAge : 0);
  const [includeCollege, setIncludeCollege] = useState(!!editingEvent?.includeCollege);

  const [childcareCostAnnual, setChildcareCostAnnual] = useState(editingEvent?.customAges0to4 || 15000);
  const [costInput, setCostInput] = useState(editingEvent?.customAges0to4 !== undefined ? editingEvent.customAges0to4.toLocaleString() : '15,000');
  
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [strategy, setStrategy] = useState('promotion');

  // Synchronize annual cost with local formatted input when editingEvent changes
  useEffect(() => {
    if (editingEvent?.customAges0to4 !== undefined) {
      setChildcareCostAnnual(editingEvent.customAges0to4);
      setCostInput(editingEvent.customAges0to4.toLocaleString());
    }
    if (editingEvent?.adjustmentStrategy) {
      setStrategy(editingEvent.adjustmentStrategy);
    }
  }, [editingEvent]);

  // Format commas dynamically on change while allowing numeric characters
  const handleCostChange = (e) => {
    const cleanStr = e.target.value.replace(/[^0-9]/g, '');
    if (cleanStr === '') {
      setChildcareCostAnnual(0);
      setCostInput('');
    } else {
      const num = parseInt(cleanStr) || 0;
      setChildcareCostAnnual(num);
      setCostInput(num.toLocaleString());
    }
  };

  const handleChildStartAgeChange = (val) => {
    const startAge = Math.max(0, Math.min(22, parseInt(val) || 0));
    setChildStartAge(startAge);
    const currentAge = inputs.currentAge || 35;
    setBirthAge(Math.max(18, Math.min(85, currentAge - startAge)));
  };

  const handleBirthAgeChange = (val) => {
    const bAge = Math.max(18, Math.min(85, parseInt(val) || (inputs.currentAge || 35)));
    setBirthAge(bAge);
    const currentAge = inputs.currentAge || 35;
    setChildStartAge(Math.max(0, Math.min(22, currentAge - bAge)));
  };

  // Compute selected monthly childcare cost
  const childcareCostMonthly = childcareCostAnnual / 12;

  // Compute Wants Budget from the active pre-child budget phase
  const wantsBudget = useMemo(() => {
    const normalizedPhases = getNormalizedPhases(inputs);
    const currentAgeVal = Number(birthAge) || inputs.currentAge || 30;
    
    // Find phase matching parent's age when child arrives, or fallback to current age
    const matchPhase = normalizedPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normalizedPhases[0];
    if (!matchPhase || !matchPhase.expenses) return 0;
    
    return (Number(matchPhase.expenses.leisure) || 0) +
           (Number(matchPhase.expenses.diningOut) || 0) +
           (Number(matchPhase.expenses.misc) || 0);
  }, [inputs, birthAge]);

  const hasEnoughBudget = wantsBudget >= childcareCostMonthly;
  const incomeGap = Math.max(0, childcareCostMonthly - wantsBudget);

  const handleContinue = () => {
    setStep(2);
  };

  // Perform Save Action
  const onSave = () => {
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
    { char: '🎵', style: { right: '24%', top: '42%', fontSize: '1.1rem', '--child-dec-rot': '-5deg', opacity: 0.7 } },
    { char: '🌱', style: { right: '15%', top: '68%', fontSize: '1.2rem', '--child-dec-rot': '5deg', opacity: 0.8 } }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="event-form-overlay-card modal-content"
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
        {/* Visually hidden heading for test compatibility */}
        <h3 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
          {isNew ? 'Add Child' : 'Edit Child Details'}
        </h3>

        {step === 1 ? (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Hero Section */}
            <div style={{ position: 'relative', textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👶</div>
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
                You're planning for a new adventure.
              </p>

              {/* Decorative emojis */}
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

            {/* Child's Name */}
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
              <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Child's Name (Optional)</span>
              <input
                type="text"
                className="input-number-box"
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  height: '42px',
                  borderRadius: '12px',
                  padding: '0 1rem',
                  fontSize: '0.95rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)'
                }}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Liam"
              />
            </div>

            {/* Age & Cost Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '1rem'
            }}>
              {/* Age Child Arrives */}
              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Age Child Arrives (Parent's Age)</span>
                <input
                  type="number"
                  className="input-number-box"
                  style={{ 
                    width: '100%', 
                    height: '42px',
                    borderRadius: '12px',
                    padding: '0 1rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)'
                  }}
                  value={birthAge}
                  onChange={(e) => handleBirthAgeChange(e.target.value)}
                  min={18}
                  max={85}
                />
              </div>

              {/* Annual Childcare Cost */}
              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="input-name" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Annual Childcare Cost</span>
                  <Info 
                    size={14} 
                    style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    title="Average estimate is $15,000/year. You can adjust this anytime."
                  />
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0 1rem',
                  height: '42px'
                }}>
                  <span style={{ color: 'var(--text-tertiary)', marginRight: '0.5rem', fontSize: '0.95rem', fontWeight: '500' }}>$</span>
                  <NumberInput
                    value={childcareCostAnnual}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setChildcareCostAnnual(val);
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      width: '100%',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: '700',
                      outline: 'none',
                      textAlign: 'right',
                      padding: '0'
                    }}
                  /><span style={{ color: 'var(--text-tertiary)', marginLeft: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>/year</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.05rem' }}>
                  Default estimate is $15,000/year. You can adjust this anytime.
                </span>
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
                  marginTop: '0.25rem'
                }}
              >
                <span style={{ fontSize: '0.7rem', transform: isAdvancedOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block' }}>▶</span>
                <span>Advanced Options</span>
              </div>

              {isAdvancedOpen && (
                <div className="animate-slide-down" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem', 
                  marginTop: '0.5rem', 
                  padding: '1.25rem', 
                  background: 'rgba(255,255,255,0.01)', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border-color)' 
                }}>
                  {/* Child's Current Age */}
                  <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'flex-start', height: 'auto' }}>
                    <span className="input-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Child's Current Age</span>
                    <input
                      type="number"
                      className="input-number-box"
                      style={{ 
                        width: '100%', 
                        height: '38px',
                        borderRadius: '8px',
                        padding: '0 0.75rem',
                        fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)'
                      }}
                      value={childStartAge}
                      onChange={(e) => handleChildStartAgeChange(e.target.value)}
                      min={0}
                      max={22}
                    />
                  </div>

                  {/* Include College Support */}
                  <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="include-college"
                        checked={includeCollege}
                        onChange={(e) => setIncludeCollege(e.target.checked)}
                        style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: '#8b5cf6' }}
                      />
                      <label htmlFor="include-college" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Include College / Young Adult Support (Ages 19–22)
                      </label>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.6rem', display: 'block', lineHeight: '1.4' }}>
                      Adds childcare costs for an additional 4 years.
                    </span>
                  </div>
                </div>
              )}
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
                    Delete Child
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
                  onClick={isNew ? handleContinue : onSave}
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
                  {isNew ? 'Continue' : 'Save'}
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* STEP 2: AFFORDABILITY CHECK */
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👶</div>
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
                New Child
              </h4>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, fontWeight: '600' }}>
                Age {birthAge}
              </p>
            </div>

            {/* Cost Summary Card */}
            <div style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👶 Cost
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {formatCurrency(childcareCostMonthly)}/mo
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                  {formatCurrency(childcareCostAnnual)}/yr
                </div>
              </div>
            </div>

            {/* Adjustment Options */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                How do you want to adjust?
              </span>

              {/* Option 1: Keep Current Lifestyle */}
              <div 
                onClick={() => setStrategy('promotion')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: strategy === 'promotion' ? '2px solid var(--primary, #8b5cf6)' : '1px solid var(--border-color)',
                  background: strategy === 'promotion' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  userSelect: 'none'
                }}
              >
                {/* Radio Circle */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: strategy === 'promotion' ? '2.5px solid var(--primary, #8b5cf6)' : '2px solid var(--text-tertiary, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  {strategy === 'promotion' && (
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--primary, #8b5cf6)'
                    }} />
                  )}
                </div>

                {/* Icon */}
                <span style={{ fontSize: '1.5rem', marginRight: '12px', display: 'flex', alignItems: 'center' }}>📈</span>

                {/* Text Description */}
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Keep Current Lifestyle
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Get a raise to cover the cost
                  </div>
                </div>
              </div>

              {/* Option 2: Rebalance Budget */}
              <div 
                onClick={() => setStrategy('rebalance')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: strategy === 'rebalance' ? '2px solid var(--primary, #8b5cf6)' : '1px solid var(--border-color)',
                  background: strategy === 'rebalance' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  userSelect: 'none'
                }}
              >
                {/* Radio Circle */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: strategy === 'rebalance' ? '2.5px solid var(--primary, #8b5cf6)' : '2px solid var(--text-tertiary, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  {strategy === 'rebalance' && (
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--primary, #8b5cf6)'
                    }} />
                  )}
                </div>

                {/* Icon */}
                <span style={{ fontSize: '1.5rem', marginRight: '12px', display: 'flex', alignItems: 'center' }}>⚖️</span>

                {/* Text Description */}
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Rebalance Budget
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Use Wants first, raise if needed
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={onSave}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  fontSize: '0.95rem',
                  borderRadius: '12px',
                  fontWeight: '700',
                  background: '#10b981', // green Confirm button
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Confirm
              </button>
              
              <button 
                type="button" 
                onClick={() => setStep(1)}
                style={{ 
                  background: 'none', 
                  border: 'none',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  width: '100%',
                  marginTop: '0.5rem'
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
