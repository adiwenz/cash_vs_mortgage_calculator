import React from 'react';
import { NumberInput } from '../../ui/PlainInputs';

export default function ChildrenTab({
  localProfile,
  addChild,
  updateChild,
  removeChild
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 className="life-profile-label-bold" style={{ margin: 0 }}>Children Configuration</h4>
        <button type="button" className="btn-secondary" onClick={addChild} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
          + Add Child
        </button>
      </div>

      {(localProfile.children || []).length === 0 ? (
        <div style={{ padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No children configured. Add children to model child support costs and college goals.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(localProfile.children || []).map((child, index) => (
            <div key={child.id} className="life-profile-list-item" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 2, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>#{index + 1}</span>
                <input
                  type="text"
                  className="life-profile-text-input"
                  style={{ flex: 1 }}
                  value={child.name || ''}
                  placeholder="Child's Name"
                  onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                />
              </div>
              <div style={{ width: '80px' }}>
                <NumberInput
                  className="life-profile-input-field"
                  value={child.age === null || child.age === '' ? '' : child.age}
                  placeholder="Age"
                  onChange={(e) => updateChild(child.id, 'age', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!child.includeCollege}
                    onChange={(e) => updateChild(child.id, 'includeCollege', e.target.checked)}
                  />
                  <span>Plan College Tuition</span>
                </label>
              </div>
              <button type="button" className="btn-icon-delete" onClick={() => removeChild(child.id)} style={{ padding: '0.35rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                🗑️ Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
