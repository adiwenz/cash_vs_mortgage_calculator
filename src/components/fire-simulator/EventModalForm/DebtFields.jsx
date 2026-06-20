import React from 'react';
import { formatCurrency } from '../helpers';
import { CurrencyInput, PercentInput } from '../../ui/PlainInputs';
import { 
  BorrowingAgeWarning, 
  InterestTrapWarning, 
  BorrowingNotFoundWarning 
} from './EventValidationMessages';

export default function DebtFields({
  type,
  editingEvent,
  setEditingEvent,
  inputs
}) {
  const borrowing = type === 'payoffPlan'
    ? (inputs.lifeEvents || []).find(b => b.id === editingEvent.borrowingId)
    : null;

  const handleCarPriceChange = (price) => {
    const dp = Number(editingEvent.downPayment) || 0;
    const bal = Math.max(0, price - dp);
    setEditingEvent({
      ...editingEvent,
      purchasePrice: price,
      balance: bal
    });
  };

  const handleDownPaymentChange = (dp) => {
    const price = Number(editingEvent.purchasePrice) || 0;
    const bal = Math.max(0, price - dp);
    setEditingEvent({
      ...editingEvent,
      downPayment: dp,
      balance: bal
    });
  };

  return (
    <>
      {/* BORROWING FIELDS */}
      {type === 'borrowing' && (
        <>
          {/* When does this start? */}
          <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
            <span className="input-name">When does this start?</span>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="timing"
                  checked={editingEvent.timing === 'current'}
                  onChange={() => setEditingEvent({
                    ...editingEvent,
                    timing: 'current',
                    startAge: inputs.currentAge
                  })}
                  style={{ marginRight: '0.5rem' }}
                />
                Happening now
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="timing"
                  checked={editingEvent.timing === 'future'}
                  onChange={() => setEditingEvent({
                    ...editingEvent,
                    timing: 'future',
                    startAge: editingEvent.startAge <= inputs.currentAge ? inputs.currentAge + 1 : editingEvent.startAge
                  })}
                  style={{ marginRight: '0.5rem' }}
                />
                Future age
              </label>
            </div>
          </div>

          {/* Start Age */}
          <div className="input-wrapper">
            <span className="input-name">
              Start Age
            </span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.startAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || inputs.currentAge })}
              disabled={editingEvent.timing === 'current'}
            />
          </div>

          {/* Name */}
          <div className="input-wrapper">
            <span className="input-name">Friendly Name</span>
            <input
              type="text"
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left' }}
              value={editingEvent.name}
              onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
            />
          </div>

          <BorrowingAgeWarning editingEvent={editingEvent} inputs={inputs} />

          {/* Car loan type specific pricing framing */}
          {editingEvent.borrowingType === 'carLoan' ? (
            <>
              <div className="input-wrapper">
                <span className="input-name">Car Price ($)</span>
                <CurrencyInput
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.purchasePrice !== undefined ? editingEvent.purchasePrice : ''}
                  onChange={(e) => handleCarPriceChange(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-wrapper">
                <span className="input-name">Down Payment ($)</span>
                <CurrencyInput
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.downPayment !== undefined ? editingEvent.downPayment : ''}
                  onChange={(e) => handleDownPaymentChange(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                <span className="input-name">Loan Amount / Starting Balance ($)</span>
                <CurrencyInput
                  className="input-number-box"
                  style={{ width: '100%' }}
                  value={editingEvent.balance}
                  onChange={(e) => setEditingEvent({ ...editingEvent, balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </>
          ) : (
            <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
              <span className="input-name">Starting Balance / Amount ($)</span>
              <CurrencyInput
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingEvent.balance}
                placeholder="Add a balance"
                onChange={(e) => setEditingEvent({ ...editingEvent, balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {/* Interest Rate */}
          <div className="input-wrapper">
            <span className="input-name">Interest Rate (APR %)</span>
            <PercentInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.interestRate}
              onChange={(e) => setEditingEvent({ ...editingEvent, interestRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Minimum Monthly Payment ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.minPayment}
              onChange={(e) => setEditingEvent({ ...editingEvent, minPayment: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Type-Specific Estimators and Warnings */}
          <div style={{ gridColumn: 'span 2', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {editingEvent.borrowingType === 'studentLoan' && (() => {
              const balance = Number(editingEvent.balance) || 0;
              const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
              let estPayment = 0;
              if (balance > 0) {
                if (r === 0) estPayment = balance / 120;
                else estPayment = (balance * r) / (1 - Math.pow(1 + r, -120));
              }
              return (
                <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                  💡 <em>You're not stuck with this number.</em> Typical student loans use a 10-year term. Est. standard payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                </div>
              );
            })()}

            {editingEvent.borrowingType === 'carLoan' && (() => {
              const balance = Number(editingEvent.balance) || 0;
              const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
              let estPayment = 0;
              if (balance > 0) {
                if (r === 0) estPayment = balance / 60;
                else estPayment = (balance * r) / (1 - Math.pow(1 + r, -60));
              }
              return (
                <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                  🚗 Fixed 5-year auto loan term. Est. car payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                </div>
              );
            })()}

            {editingEvent.borrowingType === 'personalLoan' && (() => {
              const balance = Number(editingEvent.balance) || 0;
              const r = (Number(editingEvent.interestRate) || 0) / 100 / 12;
              let estPayment = 0;
              if (balance > 0) {
                if (r === 0) estPayment = balance / 36;
                else estPayment = (balance * r) / (1 - Math.pow(1 + r, -36));
              }
              return (
                <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                  💸 Medium term 3-year personal loan. Est. fixed payment: <strong>{formatCurrency(estPayment)}/mo</strong>.
                </div>
              );
            })()}

            {editingEvent.borrowingType === 'creditCard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <InterestTrapWarning editingEvent={editingEvent} />
                <div className="info-box" style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                  💳 Credit card rates are higher. <em>Small changes can move the payoff date.</em> Pay more than the minimum to avoid paying massive interest.
                </div>
              </div>
            )}
          </div>

          {/* Payoff Plan Toggle */}
          <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={editingEvent.payoffPlanEnabled}
                onChange={(e) => setEditingEvent({ ...editingEvent, payoffPlanEnabled: e.target.checked })}
                style={{ marginRight: '0.6rem', width: '16px', height: '16px' }}
              />
              Create a payoff plan too
            </label>
          </div>

          {/* Notes */}
          <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
            <span className="input-name">Notes (Optional)</span>
            <textarea
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left', minHeight: '60px', padding: '0.4rem 0.6rem' }}
              value={editingEvent.notes || ''}
              onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
            />
          </div>
        </>
      )}

      {/* DEBT PAYOFF FIELDS */}
      {type === 'debtPayoff' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Payoff Age</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.payoffAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, payoffAge: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Payoff Amount ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.amount}
              onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </>
      )}

      {/* PAYOFF PLAN FIELDS */}
      {type === 'payoffPlan' && (
        <>
          {/* Linked Borrowing Event Info */}
          {borrowing ? (
            <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Linked Borrowing: {borrowing.name}</div>
              <div>Starting Balance: <strong>{formatCurrency(borrowing.balance)}</strong></div>
              <div>Interest Rate: <strong>{borrowing.interestRate}% APR</strong></div>
              <div>Minimum Payment: <strong>{formatCurrency(borrowing.minPayment)}/mo</strong></div>
            </div>
          ) : (
            <BorrowingNotFoundWarning />
          )}

          {/* Link toggle */}
          <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={editingEvent.linked !== false}
                onChange={(e) => {
                  const isLinked = e.target.checked;
                  const nextEvent = { ...editingEvent, linked: isLinked };
                  if (isLinked && borrowing) {
                    nextEvent.startAge = borrowing.startAge;
                  }
                  setEditingEvent(nextEvent);
                }}
                style={{ marginRight: '0.6rem', width: '16px', height: '16px' }}
              />
              Link start age to borrowing start age
            </label>
          </div>

          {/* Start Age (if not linked) */}
          <div className="input-wrapper">
            <span className="input-name">Start Age</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.startAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || inputs.currentAge })}
              disabled={editingEvent.linked !== false}
            />
          </div>

          {/* Extra Payment */}
          <div className="input-wrapper">
            <span className="input-name">Extra Monthly Payoff Allocation ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.extraPayment}
              onChange={(e) => setEditingEvent({ ...editingEvent, extraPayment: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Projected Payoff Result Box */}
          {borrowing && (() => {
            const balance = Number(borrowing.balance) || 0;
            const apr = Number(borrowing.interestRate) || 0;
            const minPayment = Number(borrowing.minPayment) || 0;
            const extraPayment = Number(editingEvent.extraPayment) || 0;
            const startAge = Number(editingEvent.startAge) || inputs.currentAge;
            
            const calculatePayoffAgeInline = (b, rate, minPay, extraPay, start) => {
              const r = (rate / 100) / 12;
              const pmt = minPay + extraPay;
              if (b <= 0) return start;
              if (pmt <= 0) return Infinity;
              if (pmt <= b * r) return Infinity;
              if (r === 0) {
                return start + (b / pmt) / 12;
              }
              const months = Math.log(pmt / (pmt - r * b)) / Math.log(1 + r);
              return start + months / 12;
            };

            const projectedAge = calculatePayoffAgeInline(balance, apr, minPayment, extraPayment, startAge);
            const formatPayoffAge = (ageVal) => {
              if (!isFinite(ageVal)) return 'Never (payment too low to cover interest)';
              return `Age ${Math.round(ageVal * 10) / 10}`;
            };

            return (
              <div style={{ gridColumn: 'span 2', fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>Total Monthly Payment: <strong>{formatCurrency(minPayment + extraPayment)}</strong></div>
                  <div>Projected Payoff Age: <strong style={{ color: isFinite(projectedAge) ? 'var(--primary)' : 'var(--accent-rose)' }}>{formatPayoffAge(projectedAge)}</strong></div>
                  <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    💡 <em>Small changes can move the payoff date.</em> Increase the extra payoff allocation to pay it off faster!
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Notes */}
          <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
            <span className="input-name">Notes (Optional)</span>
            <textarea
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left', minHeight: '60px', padding: '0.4rem 0.6rem' }}
              value={editingEvent.notes || ''}
              onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  );
}
