import React from 'react';
import { formatCurrency } from '../helpers';
import { CurrencyInput, PercentInput, NumberInput } from '../../ui/PlainInputs';

export default function RetirementFields({
  type,
  editingEvent,
  setEditingEvent,
  inputs,
  tempSocialSecurityDetails
}) {
  return (
    <>
      {/* RETIRE FIELDS */}
      {type === 'retire' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Can Stop Working Age</span>
            <NumberInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.age}
              onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Spending Replacement Rate (%)</span>
            <PercentInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.spendingPercent !== undefined ? editingEvent.spendingPercent : 70}
              onChange={(e) => setEditingEvent({ ...editingEvent, spendingPercent: parseInt(e.target.value) || 0 })}
            />
          </div>
        </>
      )}

      {/* SOCIAL SECURITY / INCOME FIELDS */}
      {['socialSecurity', 'pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type) && (
        <>
          <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
            <span className="input-name">Income Name</span>
            <input
              type="text"
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left' }}
              value={editingEvent.name || ''}
              onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">
              {type === 'socialSecurity' ? 'Claiming Age' : 'Start Age'}
            </span>
            <NumberInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65)}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                let nextVal = val;
                if (type === 'socialSecurity') {
                  if (val > 70) {
                    nextVal = 70;
                  } else if (val >= 10 && val < 62) {
                    nextVal = 62;
                  }
                }
                setEditingEvent({
                  ...editingEvent,
                  claimingAge: nextVal,
                  startAge: nextVal,
                  age: nextVal
                });
              }}
              onBlur={(e) => {
                if (type === 'socialSecurity') {
                  const val = parseInt(e.target.value) || 67;
                  const clamped = Math.max(62, Math.min(70, val));
                  setEditingEvent({
                    ...editingEvent,
                    claimingAge: clamped,
                    startAge: clamped,
                    age: clamped
                  });
                }
              }}
            />
          </div>
          {type === 'socialSecurity' && (() => {
            const claimAge = editingEvent.claimingAge !== undefined ? editingEvent.claimingAge : (editingEvent.startAge !== undefined ? editingEvent.startAge : 65);
            if (claimAge < 62 || claimAge > 70) {
              return (
                <div className="warning-box" style={{ gridColumn: 'span 2', background: 'rgba(244, 63, 94, 0.08)', color: 'var(--accent-rose, #f43f5e)', padding: '0.65rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose, #f43f5e)', fontWeight: '500', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  ⚠️ <strong>Validation Error:</strong> Social Security can only be taken between 62-70.
                </div>
              );
            }
            return null;
          })()}
          {type === 'socialSecurity' && editingEvent.useEarnings === true && (
            <div className="input-wrapper">
              <span className="input-name">Age Started Working</span>
              <NumberInput
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingEvent.ageStartedWorking !== undefined ? editingEvent.ageStartedWorking : 22}
                onChange={(e) => setEditingEvent({ ...editingEvent, ageStartedWorking: parseInt(e.target.value) || 22 })}
              />
            </div>
          )}
          {(!editingEvent.useEarnings || type !== 'socialSecurity') ? (
            <div className="input-wrapper">
              <span className="input-name">Monthly Amount ($)</span>
              <CurrencyInput
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingEvent.monthlyBenefit !== undefined ? editingEvent.monthlyBenefit : 1000}
                onChange={(e) => setEditingEvent({ ...editingEvent, monthlyBenefit: parseFloat(e.target.value) || 0 })}
              />
            </div>
          ) : (
            <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
              <span className="input-name">Estimated Monthly Amount ($)</span>
              <div style={{ 
                height: '2.5rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '0 0.75rem', 
                background: 'var(--bg-primary, #111827)', 
                borderRadius: 'var(--radius-sm, 6px)', 
                border: '1px solid var(--border-color, #374151)', 
                fontSize: '0.85rem', 
                fontWeight: 'bold', 
                color: tempSocialSecurityDetails?.isEligible ? 'var(--text-primary)' : 'var(--accent-rose, #f43f5e)'
              }}>
                <span>
                  {tempSocialSecurityDetails?.isEligible 
                    ? formatCurrency(tempSocialSecurityDetails.annualBenefit / 12) 
                    : '$0 (Not Eligible)'}
                </span>
                {tempSocialSecurityDetails?.isEligible && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                    ({formatCurrency((tempSocialSecurityDetails.annualBenefit / 12) * Math.pow(1 + (Number(inputs.inflationRate || 3) / 100), tempSocialSecurityDetails.claimAge - (Number(inputs.currentAge) || 35)))}/mo in future nominal dollars at age {tempSocialSecurityDetails.claimAge})
                  </span>
                )}
              </div>
            </div>
          )}
          {type === 'socialSecurity' && (
            <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <label htmlFor="ret-use-earnings" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                Calculate from earning years
              </label>
              <input
                type="checkbox"
                id="ret-use-earnings"
                checked={editingEvent.useEarnings === true}
                onChange={(e) => setEditingEvent({ ...editingEvent, useEarnings: e.target.checked })}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
            </div>
          )}
          {type !== 'socialSecurity' && (
            <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <label htmlFor="ret-inflation-adj" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                Inflation Adjusted (increases with cost of living)
              </label>
              <input
                type="checkbox"
                id="ret-inflation-adj"
                checked={editingEvent.inflationAdjusted !== false}
                onChange={(e) => setEditingEvent({ ...editingEvent, inflationAdjusted: e.target.checked })}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
            </div>
          )}
          {type === 'socialSecurity' && (
            <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
              💡 Calculated in Today's Dollars (purchasing power). In future dollars (nominal mode), the benefit is adjusted for inflation (currently {Number(inputs.inflationRate || 3)}% yearly) starting from your current age.
            </div>
          )}
        </>
      )}
    </>
  );
}
