import React from 'react';

export default function EventTypeHeader({ type, editingEvent }) {
  if (type === 'careerChange') {
    return (
      <div style={{ textAlign: 'center', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
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
        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
          Income Change
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', fontWeight: '500', lineHeight: '1.4' }}>
          Model how a change in earnings affects your long-term plan.
        </p>
        <div style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', width: '100%' }} />
      </div>
    );
  }

  return (
    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
      {type === 'buyHouse' && '🏠 Buy a House'}
      {type === 'sellHouse' && '🏠 Sell a House'}
      {type === 'haveChild' && '👶 Have a Child'}
      {type === 'careerChange' && '💼 Income Change'}
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
  );
}
