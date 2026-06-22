import React, { useState, useEffect } from 'react';
import { CurrencyInput, PercentInput } from '../ui/PlainInputs';
import IncomeChangeImpactPreview from './EventModalForm/IncomeChangeImpactPreview';

export default function MobileIncomeChangeModal({
  scenario,
  eventController,
  onClose
}) {
  const inputs = scenario?.inputs || {};
  const editingEvent = eventController?.editingEvent || {};
  const handleSaveEvent = eventController?.handleSaveEvent;
  const handleDeleteEvent = eventController?.handleDeleteEvent;

  const currentAge = inputs.currentAge !== undefined ? Number(inputs.currentAge) : 35;

  const [name, setName] = useState(editingEvent.name || 'Senior Manager');
  const [startAge, setStartAge] = useState(editingEvent.startAge !== undefined ? editingEvent.startAge : 40);
  const [incomeChangeType, setIncomeChangeType] = useState(editingEvent.incomeChangeType || 'newIncomeLevel');
  const [amount, setAmount] = useState(editingEvent.amount !== undefined ? editingEvent.amount : 150000);
  const [salaryIncrease, setSalaryIncrease] = useState(editingEvent.salaryIncrease !== undefined ? editingEvent.salaryIncrease : (editingEvent.amount || 0));
  const [growthRate, setGrowthRate] = useState(editingEvent.growthRate !== undefined ? editingEvent.growthRate : 3.5);
  const [permanent, setPermanent] = useState(editingEvent.permanent !== false);

  // Synchronize on load/edit
  useEffect(() => {
    if (editingEvent) {
      setName(editingEvent.name || 'Senior Manager');
      setStartAge(editingEvent.startAge !== undefined ? editingEvent.startAge : 40);
      setIncomeChangeType(editingEvent.incomeChangeType || 'newIncomeLevel');
      setAmount(editingEvent.amount !== undefined ? editingEvent.amount : 150000);
      setSalaryIncrease(editingEvent.salaryIncrease !== undefined ? editingEvent.salaryIncrease : (editingEvent.amount || 0));
      setGrowthRate(editingEvent.growthRate !== undefined ? editingEvent.growthRate : 3.5);
      setPermanent(editingEvent.permanent !== false);
    }
  }, [editingEvent]);

  const handleSave = () => {
    const updatedEvent = {
      ...editingEvent,
      type: 'careerChange',
      name: name || 'New Job / Name',
      startAge: Number(startAge),
      incomeChangeType,
      amount: incomeChangeType === 'increaseByAmount' ? Number(salaryIncrease) : Number(amount),
      salaryIncrease: incomeChangeType === 'increaseByAmount' ? Number(salaryIncrease) : undefined,
      growthRate: Number(growthRate),
      permanent: permanent !== false
    };
    handleSaveEvent(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    handleDeleteEvent(editingEvent);
    onClose();
  };

  return (
    <div 
      className="mobile-income-change-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div 
        className="mobile-income-change-sheet"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '1.5rem',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          maxHeight: '92vh',
          overflowY: 'auto',
          color: '#1e293b'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div 
          className="mobile-income-change-drag-handle"
          style={{
            width: '36px',
            height: '4px',
            backgroundColor: '#cbd5e1',
            borderRadius: '2px',
            margin: '-0.5rem auto 1rem auto'
          }}
        />

        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(34, 197, 94, 0.1)', // Pale green background
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem auto'
          }}>
            <span style={{ fontSize: '2rem' }}>💼</span>
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: '#0f172a' }}>
            Income Change
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0', fontWeight: '500', lineHeight: '1.4' }}>
            Model how a change in earnings affects your long-term plan.
          </p>
          <div style={{ borderBottom: '1px solid #e5e7eb', width: '100%' }} />
        </div>

        {/* Impact Preview */}
        <IncomeChangeImpactPreview 
          inputs={inputs} 
          editingEvent={{ incomeChangeType, amount, salaryIncrease }} 
        />

        {/* Form Fields: Single Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="mobile-marriage-label" htmlFor="mobile-job-title" style={{ textAlign: 'left' }}>Job Title / Name</label>
            <input
              id="mobile-job-title"
              type="text"
              className="mobile-marriage-input"
              style={{ textAlign: 'left' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="mobile-marriage-label" htmlFor="mobile-change-age" style={{ textAlign: 'left' }}>Change Age</label>
            <input
              id="mobile-change-age"
              type="number"
              className="mobile-marriage-input"
              value={startAge}
              onChange={(e) => setStartAge(parseInt(e.target.value) || '')}
            />
          </div>

          <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="mobile-marriage-label" htmlFor="mobile-change-type" style={{ textAlign: 'left' }}>Income Change Type</label>
            <select
              id="mobile-change-type"
              className="mobile-marriage-input"
              style={{ textAlign: 'left', appearance: 'auto', paddingRight: '2rem' }}
              value={incomeChangeType}
              onChange={(e) => setIncomeChangeType(e.target.value)}
            >
              <option value="newIncomeLevel">New Income Level</option>
              <option value="increaseByAmount">Increase By Amount</option>
            </select>
          </div>

          {incomeChangeType === 'increaseByAmount' ? (
            <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="mobile-marriage-label" htmlFor="mobile-salary-increase" style={{ textAlign: 'left' }}>Salary Increase Amount ($/yr)</label>
              <CurrencyInput
                id="mobile-salary-increase"
                className="mobile-marriage-input"
                value={salaryIncrease}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setSalaryIncrease(val);
                  setAmount(val);
                }}
              />
            </div>
          ) : (
            <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="mobile-marriage-label" htmlFor="mobile-annual-income" style={{ textAlign: 'left' }}>New Annual Income ($/yr)</label>
              <CurrencyInput
                id="mobile-annual-income"
                className="mobile-marriage-input"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="mobile-marriage-label" htmlFor="mobile-growth-rate" style={{ textAlign: 'left' }}>Raise / Growth Rate (%)</label>
            <PercentInput
              id="mobile-growth-rate"
              className="mobile-marriage-input"
              value={growthRate}
              onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="mobile-marriage-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="mobile-permanent"
                checked={permanent !== false}
                onChange={(e) => setPermanent(e.target.checked)}
                style={{ width: '1.15rem', height: '1.15rem', cursor: 'pointer' }}
              />
              <label htmlFor="mobile-permanent" className="mobile-marriage-label" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                Permanent Change
              </label>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', paddingLeft: '1.65rem', display: 'block', lineHeight: '1.3', textAlign: 'left' }}>
              If checked, this change continues after child rearing or specific phases end, becoming available for additional savings.
            </span>
          </div>
        </div>

        {/* Buttons Pinned Area */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: 'auto' }}>
          <button
            type="button"
            className="mobile-child-btn-secondary"
            onClick={onClose}
            style={{
              flex: 1,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              height: '48px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="mobile-child-btn-primary"
            onClick={handleSave}
            style={{
              flex: 1,
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              height: '48px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: '700'
            }}
          >
            Save Event
          </button>
        </div>

        {/* Delete Event text button (only for editing existing event) */}
        {editingEvent.id && !editingEvent.isNew && (
          <button
            type="button"
            onClick={handleDelete}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#f43f5e',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'center',
              marginTop: '1rem',
              padding: '0.5rem 0'
            }}
          >
            Delete Event
          </button>
        )}
      </div>
    </div>
  );
}
