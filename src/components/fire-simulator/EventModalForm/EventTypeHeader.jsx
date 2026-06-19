import React from 'react';

export default function EventTypeHeader({ type, editingEvent }) {
  return (
    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
      {type === 'buyHouse' && '🏠 Buy a House'}
      {type === 'sellHouse' && '🏠 Sell a House'}
      {type === 'haveChild' && '👶 Have a Child'}
      {type === 'careerChange' && '💼 Career Change'}
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
