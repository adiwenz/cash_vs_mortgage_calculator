import React from 'react';
import { CurrencyInput, PercentInput } from '../../ui/PlainInputs';

export default function CareerFields({
  editingEvent,
  setEditingEvent
}) {
  return (
    <>
      <div className="input-wrapper">
        <span className="input-name">Job Title / Name</span>
        <input
          type="text"
          className="input-number-box"
          style={{ width: '100%', textAlign: 'left' }}
          value={editingEvent.name || ''}
          onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
        />
      </div>
      <div className="input-wrapper">
        <span className="input-name">Change Age</span>
        <input
          type="number"
          className="input-number-box"
          style={{ width: '100%' }}
          value={editingEvent.startAge}
          onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
        />
      </div>
      <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
        <span className="input-name">Income Change Type</span>
        <select
          className="input-number-box"
          style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
          value={editingEvent.incomeChangeType || 'newIncomeLevel'}
          onChange={(e) => setEditingEvent({ ...editingEvent, incomeChangeType: e.target.value })}
        >
          <option value="newIncomeLevel">New Income Level</option>
          <option value="increaseByAmount">Increase By Amount</option>
        </select>
      </div>

      {(editingEvent.incomeChangeType === 'increaseByAmount') ? (
        <div className="input-wrapper">
          <span className="input-name">Salary Increase Amount ($/yr)</span>
          <CurrencyInput
            className="input-number-box"
            style={{ width: '100%' }}
            value={editingEvent.salaryIncrease !== undefined ? editingEvent.salaryIncrease : editingEvent.amount}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setEditingEvent({ ...editingEvent, salaryIncrease: val, amount: val });
            }}
          />
        </div>
      ) : (
        <div className="input-wrapper">
          <span className="input-name">New Annual Income ($/yr)</span>
          <CurrencyInput
            className="input-number-box"
            style={{ width: '100%' }}
            value={editingEvent.amount}
            onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      <div className="input-wrapper">
        <span className="input-name">Raise / Growth Rate (%)</span>
        <PercentInput
          className="input-number-box"
          style={{ width: '100%' }}
          value={editingEvent.growthRate}
          onChange={(e) => {
            const valStr = e.target.value;
            const val = parseFloat(valStr);
            if (!isNaN(val) && val > 25) {
              setEditingEvent({ ...editingEvent, growthRate: 25 });
            } else {
              setEditingEvent({ ...editingEvent, growthRate: valStr });
            }
          }}
          onBlur={() => {
            let val = parseFloat(editingEvent.growthRate);
            if (isNaN(val) || val < 0) {
              setEditingEvent({ ...editingEvent, growthRate: 0 });
            } else if (val > 25) {
              setEditingEvent({ ...editingEvent, growthRate: 25 });
            }
          }}
        />
        {parseFloat(editingEvent.growthRate) >= 25 && (
          <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', lineHeight: '1.25' }}>
            Return rates above 25% create unrealistic projections. We capped this at 25%.
          </div>
        )}
      </div>

      <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="permanent-change"
            checked={editingEvent.permanent !== false}
            onChange={(e) => setEditingEvent({ ...editingEvent, permanent: e.target.checked })}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
          />
          <label htmlFor="permanent-change" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
            Permanent Change
          </label>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
          If checked, this change continues after child rearing or specific phases end, becoming available for additional savings.
        </span>
      </div>
    </>
  );
}
