import { NumberInput, CurrencyInput } from '../../ui/PlainInputs';
import { clampAgeValue } from '../helpers';
import { Plus, Trash2, ChevronRight } from 'lucide-react';

export default function HouseholdTab({
  isMobile,
  currentScreen,
  localAge,
  setLocalAge,
  localLifeExpectancy,
  setLocalLifeExpectancy,
  localProfile,
  setLocalProfile,
  updateHouseholdField,
  updateChild,
  addChild,
  removeChild,
  triggerSave,
  pushScreen,
  popScreen
}) {
  if (isMobile) {
    if (currentScreen.name === 'child_details') {
      const childId = currentScreen.childId;
      const child = (localProfile.children || []).find(c => c.id === childId);
      if (!child) {
        return <div className="mobile-empty-state-card">Child not found.</div>;
      }
      return (
        <div className="life-profile-mobile-screen">
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Name (optional)</label>
              <input
                type="text"
                className="mobile-input-field text-input"
                value={child.name}
                placeholder="Child"
                onChange={(e) => updateChild(childId, 'name', e.target.value)}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group">
              <label>Current Age</label>
              <NumberInput
                className="mobile-input-field"
                value={child.age === null || child.age === '' ? '' : child.age}
                placeholder="0"
                onChange={(e) => {
                  const val = e.target.value;
                  updateChild(childId, 'age', val === '' ? 0 : parseInt(val, 10));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group checkbox-group">
              <label>Plan for Education?</label>
              <label className="mobile-switch-container">
                <input
                  type="checkbox"
                  checked={!!child.includeCollege}
                  onChange={(e) => updateChild(childId, 'includeCollege', e.target.checked)}
                />
                <span className="mobile-switch-slider"></span>
              </label>
            </div>
          </div>

          <button 
            type="button" 
            className="mobile-delete-btn-full"
            onClick={() => {
              removeChild(childId);
              popScreen();
            }}
          >
            <Trash2 size={16} />
            <span>Delete Child</span>
          </button>
        </div>
      );
    }

    const hasPartner = localProfile.household.status !== 'single';
    return (
      <div className="life-profile-mobile-screen">
        {/* You section */}
        <div className="life-profile-mobile-section-header">You</div>
        <div className="life-profile-mobile-form-card">
          <div className="mobile-form-group">
            <label id="label-age">Age</label>
            <NumberInput
              aria-labelledby="label-age"
              className="mobile-input-field"
              value={localAge === null ? '' : localAge}
              onChange={(e) => {
                const val = e.target.value;
                setLocalAge(val === '' ? '' : parseInt(val, 10));
              }}
              onBlur={(e) => {
                const clamped = clampAgeValue(e.target.value);
                const finalAge = clamped !== null ? clamped : 35;
                setLocalAge(finalAge);
                triggerSave({ age: finalAge });
              }}
            />
          </div>
          <div className="mobile-form-group">
            <label id="label-life-expectancy">Life Expectancy</label>
            <NumberInput
              aria-labelledby="label-life-expectancy"
              className="mobile-input-field"
              value={localLifeExpectancy === null ? '' : localLifeExpectancy}
              onChange={(e) => {
                const val = e.target.value;
                setLocalLifeExpectancy(val === '' ? '' : parseInt(val, 10));
              }}
              onBlur={(e) => {
                const val = e.target.value;
                const finalLifeExp = val === '' ? 85 : parseInt(val, 10);
                setLocalLifeExpectancy(finalLifeExp);
                triggerSave({ lifeExp: finalLifeExp });
              }}
            />
          </div>
        </div>

        {/* Partner section */}
        <div className="life-profile-mobile-section-header-row">
          <span>Partner (Optional)</span>
          <label className="mobile-switch-container">
            <input
              type="checkbox"
              checked={hasPartner}
              onChange={(e) => {
                const nextStatus = e.target.checked ? 'married' : 'single';
                const nextProfile = {
                  ...localProfile,
                  household: {
                    ...localProfile.household,
                    status: nextStatus
                  }
                };
                setLocalProfile(nextProfile);
                triggerSave({ profile: nextProfile });
              }}
            />
            <span className="mobile-switch-slider"></span>
          </label>
        </div>
        
        {hasPartner && (
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Partner Age</label>
              <NumberInput
                className="mobile-input-field"
                value={localProfile.household.partnerAge === undefined ? '' : localProfile.household.partnerAge}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHouseholdField('partnerAge', val === '' ? 35 : parseInt(val, 10));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group">
              <label>Annual Income</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localProfile.household.partnerIncome}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHouseholdField('partnerIncome', val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group">
              <label>Cash & Savings</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localProfile.household.partnerSavings}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHouseholdField('partnerSavings', val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group">
              <label>Retirement Accounts</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localProfile.household.partnerRetirement}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHouseholdField('partnerRetirement', val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
            <div className="mobile-form-group">
              <label>Other Debts</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localProfile.household.partnerDebts}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHouseholdField('partnerDebts', val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
          </div>
        )}

        {/* Children section */}
        <div className="life-profile-mobile-section-header">Children</div>
        <div className="life-profile-mobile-children-list">
          {(localProfile.children || []).length === 0 ? (
            <div className="mobile-empty-state-card">
              No children configured. Add one if you have dependent children today.
            </div>
          ) : (
            <div className="mobile-items-grid">
              {(localProfile.children || []).map((child, idx) => (
                <div 
                  key={child.id} 
                  className="mobile-item-nav-row"
                  onClick={() => pushScreen('child_details', { childId: child.id })}
                >
                  <div className="item-row-info">
                    <span className="item-row-title">{child.name || `Child ${idx + 1}`}</span>
                    <span className="item-row-subtitle">Age {child.age || 0} {child.includeCollege ? '• Tuition' : ''}</span>
                  </div>
                  <ChevronRight size={16} className="chevron-icon" />
                </div>
              ))}
            </div>
          )}

          <button 
            type="button" 
            className="mobile-add-btn-full" 
            onClick={() => {
              const newId = addChild();
              pushScreen('child_details', { childId: newId });
            }}
          >
            <Plus size={16} /> Add Child
          </button>
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Your Age</label>
          <NumberInput
            className="life-profile-input-field"
            value={localAge === null ? '' : localAge}
            onChange={(e) => {
              const val = e.target.value;
              setLocalAge(val === '' ? '' : parseInt(val, 10));
            }}
            onBlur={(e) => {
              const clamped = clampAgeValue(e.target.value);
              setLocalAge(clamped !== null ? clamped : 35);
            }}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Relationship Status</label>
          <select
            className="life-profile-select-field"
            value={localProfile.household.status}
            onChange={(e) => updateHouseholdField('status', e.target.value)}
          >
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="partnered">Partnered</option>
          </select>
        </div>
      </div>

      {(localProfile.household.status === 'married' || localProfile.household.status === 'partnered') && (
        <div className="life-profile-sub-section">
          <h4 className="life-profile-sub-section-title" style={{ color: '#7c3aed' }}>Spouse / Partner Financials</h4>
          <div className="life-profile-row-two-col">
            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Annual Income ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={localProfile.household.partnerIncome}
                onChange={(e) => updateHouseholdField('partnerIncome', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Cash & Invested Savings ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={localProfile.household.partnerSavings}
                onChange={(e) => updateHouseholdField('partnerSavings', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
          </div>
          <div className="life-profile-row-two-col">
            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Retirement Accounts ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={localProfile.household.partnerRetirement}
                onChange={(e) => updateHouseholdField('partnerRetirement', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Other Debts ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={localProfile.household.partnerDebts}
                onChange={(e) => updateHouseholdField('partnerDebts', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>
      )}

      <div className="life-profile-sub-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 className="life-profile-sub-section-title" style={{ margin: 0 }}>Children & Dependents</h4>
          <button type="button" className="btn-secondary" onClick={addChild} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
            + Add Child
          </button>
        </div>

        {(localProfile.children || []).length === 0 ? (
          <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            No children configured. Add dependent children in this section.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(localProfile.children || []).map((child, index) => (
              <div key={child.id} className="life-profile-list-item">
                <div style={{ flex: 2, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>#{index + 1}</span>
                  <input
                    type="text"
                    className="life-profile-text-input"
                    style={{ flex: 1, padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                    value={child.name}
                    placeholder="Name (optional)"
                    onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                  />
                </div>
                <div style={{ width: '70px' }}>
                  <NumberInput
                    className="life-profile-input-field"
                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                    value={child.age === null || child.age === '' ? '' : child.age}
                    placeholder="Age"
                    onChange={(e) => updateChild(child.id, 'age', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={!!child.includeCollege}
                    onChange={(e) => updateChild(child.id, 'includeCollege', e.target.checked)}
                  />
                  <span>Plan College</span>
                </div>
                <button type="button" className="btn-icon-delete" onClick={() => removeChild(child.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
