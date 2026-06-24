import React, { useState, useEffect } from 'react';
import { BottomSheet, FormRow, CurrencyField, PercentField, AgeField } from '../ui';
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
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      title="Income Change"
      description="Model how a change in earnings affects your long-term plan."
      emoji="💼"
      className="mobile-income-change-backdrop"
      containerClassName="mobile-income-change-sheet"
      footer={
        <>
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
        </>
      }
    >
      {/* Impact Preview */}
      <IncomeChangeImpactPreview 
        inputs={inputs} 
        editingEvent={{ incomeChangeType, amount, salaryIncrease }} 
      />

      {/* Form Fields: Single Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
        <FormRow
          label="Job Title / Name"
          htmlFor="mobile-job-title"
          containerClassName="mobile-marriage-input-group"
        >
          <input
            id="mobile-job-title"
            type="text"
            className="mobile-marriage-input"
            style={{ textAlign: 'left' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>

        <AgeField
          label="Change Age"
          htmlFor="mobile-change-age"
          className="mobile-marriage-input"
          containerClassName="mobile-marriage-input-group"
          value={startAge}
          min={currentAge}
          max={100}
          onChange={(e) => setStartAge(e.target.value)}
        />

        <FormRow
          label="Income Change Type"
          htmlFor="mobile-change-type"
          containerClassName="mobile-marriage-input-group"
        >
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
        </FormRow>

        {incomeChangeType === 'increaseByAmount' ? (
          <CurrencyField
            label="Salary Increase Amount ($/yr)"
            htmlFor="mobile-salary-increase"
            className="mobile-marriage-input"
            containerClassName="mobile-marriage-input-group"
            value={salaryIncrease}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setSalaryIncrease(val);
              setAmount(val);
            }}
          />
        ) : (
          <CurrencyField
            label="New Annual Income ($/yr)"
            htmlFor="mobile-annual-income"
            className="mobile-marriage-input"
            containerClassName="mobile-marriage-input-group"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
        )}

        <PercentField
          label="Raise / Growth Rate (%)"
          htmlFor="mobile-growth-rate"
          className="mobile-marriage-input"
          containerClassName="mobile-marriage-input-group"
          value={growthRate}
          onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
        />

        <FormRow
          containerClassName="mobile-marriage-input-group"
          style={{ marginTop: '0.25rem' }}
        >
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
        </FormRow>
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
    </BottomSheet>
  );
}
