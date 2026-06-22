import React from 'react';
import { formatCurrency } from '../helpers';

export default function IncomeChangeImpactPreview({ inputs, editingEvent }) {
  const currentIncome = Number(inputs?.simpleIncome) || 0;
  
  let projectedIncome = 0;
  if (editingEvent?.incomeChangeType === 'increaseByAmount') {
    const changeAmt = Number(editingEvent.salaryIncrease !== undefined ? editingEvent.salaryIncrease : editingEvent.amount) || 0;
    projectedIncome = currentIncome + changeAmt;
  } else {
    projectedIncome = Number(editingEvent?.amount) || 0;
  }

  return (
    <div style={{
      gridColumn: 'span 2',
      background: 'rgba(255, 255, 255, 0.01)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: '12px',
      padding: '0.75rem 1rem',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: '1rem',
      gap: '1rem',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>
          Current Income
        </span>
        <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          {formatCurrency(currentIncome)}/yr
        </strong>
      </div>
      <div style={{
        height: '24px',
        width: '1px',
        background: 'var(--border-color, #e5e7eb)'
      }} />
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>
          Projected Income
        </span>
        <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          {formatCurrency(projectedIncome)}/yr
        </strong>
      </div>
    </div>
  );
}
