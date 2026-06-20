import React from 'react';
import { formatCurrency } from '../helpers';
import { NumberInput } from '../../ui/PlainInputs';

export default function ChildFields({
  editingEvent,
  setEditingEvent,
  inputs
}) {
  return (
    <>
      <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
        <span className="input-name">Child's Name (Optional)</span>
        <input
          type="text"
          className="input-number-box"
          style={{ width: '100%', textAlign: 'left' }}
          value={editingEvent.childName || ''}
          onChange={(e) => setEditingEvent({ ...editingEvent, childName: e.target.value })}
          placeholder="e.g. Liam"
        />
      </div>
      <div className="input-wrapper">
        <span className="input-name">Child's Current Age</span>
        <input
          type="number"
          className="input-number-box"
          style={{ width: '100%' }}
          value={editingEvent.childStartAge !== undefined ? editingEvent.childStartAge : 0}
          onChange={(e) => {
            const startAge = Math.max(0, Math.min(22, parseInt(e.target.value) || 0));
            const birthAge = Math.max(0, (inputs.currentAge || 35) - startAge);
            setEditingEvent({
              ...editingEvent,
              childStartAge: startAge,
              birthAge: birthAge
            });
          }}
        />
      </div>
      <div className="input-wrapper">
        <span className="input-name">Parent's Age when Born</span>
        <input
          type="number"
          className="input-number-box"
          style={{ width: '100%' }}
          value={editingEvent.birthAge !== undefined ? editingEvent.birthAge : inputs.currentAge}
          onChange={(e) => {
            const birthAge = Math.max(0, parseInt(e.target.value) || 0);
            const startAge = Math.max(0, (inputs.currentAge || 35) - birthAge);
            setEditingEvent({
              ...editingEvent,
              birthAge: birthAge,
              childStartAge: startAge
            });
          }}
        />
      </div>
      <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
        <span className="input-name">Cost Estimate Method</span>
        <select
          className="input-number-box"
          style={{ width: '100%', textAlign: 'left', padding: '0 0.5rem' }}
          value={editingEvent.costMethod || 'default'}
          onChange={(e) => setEditingEvent({ ...editingEvent, costMethod: e.target.value })}
        >
          <option value="default">Use default estimate</option>
          <option value="custom">Enter my own estimate</option>
          <option value="budget">Refine in Budget Builder</option>
        </select>
      </div>

      {(editingEvent.costMethod === 'default' || !editingEvent.costMethod) && (
        <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Default Estimate:</div>
          <ul style={{ paddingLeft: '1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <li>Child-Rearing Years (Ages 0–18): {formatCurrency(15000)}/yr</li>
            {editingEvent.includeCollege && (
              <li>College / Young Adult Support (Ages 19–22): {formatCurrency(15000)}/yr</li>
            )}
          </ul>
        </div>
      )}

      {editingEvent.costMethod === 'custom' && (
        <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
          <span className="input-name">Custom Annual Child Cost ($)</span>
          <NumberInput
            className="input-number-box"
            style={{ width: '100%' }}
            value={editingEvent.customAges0to4 !== undefined ? editingEvent.customAges0to4 : 15000}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setEditingEvent({
                ...editingEvent,
                customAges0to4: val,
                customAges5to12: val,
                customAges13to18: val,
                customAges19to22: val
              });
            }}
          />
        </div>
      )}

      {editingEvent.costMethod === 'budget' && (
        <div style={{ gridColumn: 'span 2', background: 'rgba(124, 58, 237, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124, 58, 237, 0.15)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          ℹ️ This will save the child event with default estimates. You can then click <strong>Refine Child Costs</strong> or use the <strong>Set Budget</strong> button on your Life Plan dashboard to distribute child costs across specific categories (housing, food, childcare, etc.).
        </div>
      )}

      <div className="input-wrapper" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="include-college"
            checked={!!editingEvent.includeCollege}
            onChange={(e) => setEditingEvent({ ...editingEvent, includeCollege: e.target.checked })}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
          />
          <label htmlFor="include-college" className="input-name" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
            Include College / Young Adult Support (Ages 19–22)
          </label>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '1.55rem', display: 'block' }}>
          Adds an additional <strong>{formatCurrency(editingEvent.costMethod === 'custom' ? (editingEvent.customAges19to22 !== undefined ? Number(editingEvent.customAges19to22) : 15000) : 15000)}/yr</strong> per child from age 19 to 22.
        </span>
      </div>
    </>
  );
}
