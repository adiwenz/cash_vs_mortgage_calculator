import React from 'react';
import { CurrencyInput, PercentInput, NumberInput } from '../../ui/PlainInputs';
import { Plus, Trash2 } from 'lucide-react';

export default function IncomeTab({
  isMobile,
  currentScreen,
  localSimpleIncome,
  setLocalSimpleIncome,
  localTargetRetirementAge,
  setLocalTargetRetirementAge,
  localSSClaimingAge,
  setLocalSSClaimingAge,
  localProfile,
  updateHouseholdField,
  updateIncomeSource,
  removeIncomeSource,
  addIncomeSource,
  triggerSave
}) {
  if (isMobile) {
    if (currentScreen?.name === 'finance_income') {
      return (
        <div className="life-profile-mobile-screen">
          <div className="life-profile-mobile-section-header">Primary Annual Income</div>
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Salary</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localSimpleIncome}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalSimpleIncome(val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
          </div>

          <div className="life-profile-mobile-section-header">Additional Incomes</div>
          <div className="life-profile-mobile-list">
            {(localProfile.incomeSources || []).length === 0 ? (
              <div className="mobile-empty-state-card">
                No additional income configured. Add rental incomes, pension commitments, side hustles, etc.
              </div>
            ) : (
              <div className="mobile-items-list-container">
                {(localProfile.incomeSources || []).map((inc) => (
                  <div key={inc.id} className="mobile-list-item-card">
                    <div className="mobile-list-item-header">
                      <input
                        type="text"
                        className="mobile-item-title-input"
                        value={inc.name || ''}
                        placeholder="Rental Income"
                        onChange={(e) => updateIncomeSource(inc.id, 'name', e.target.value)}
                        onBlur={() => triggerSave()}
                      />
                      <button type="button" className="mobile-item-delete-btn" onClick={() => removeIncomeSource(inc.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mobile-list-item-fields">
                      <div className="mobile-form-group-half">
                        <label>Amount ($/yr)</label>
                        <CurrencyInput
                          className="mobile-input-field-small"
                          value={inc.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateIncomeSource(inc.id, 'amount', val === '' ? 0 : parseFloat(val));
                          }}
                          onBlur={() => triggerSave()}
                        />
                      </div>
                      <div className="mobile-form-group-quarter">
                        <label>Growth (%)</label>
                        <PercentInput
                          className="mobile-input-field-small"
                          value={inc.growthRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateIncomeSource(inc.id, 'growthRate', val === '' ? 0 : parseFloat(val));
                          }}
                          onBlur={() => triggerSave()}
                        />
                      </div>
                      <div className="mobile-form-group-eighth">
                        <label>Start</label>
                        <NumberInput
                          className="mobile-input-field-small"
                          value={inc.startAge === null || inc.startAge === '' ? '' : inc.startAge}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateIncomeSource(inc.id, 'startAge', val === '' ? 0 : parseInt(val, 10));
                          }}
                          onBlur={() => triggerSave()}
                        />
                      </div>
                      <div className="mobile-form-group-eighth">
                        <label>End</label>
                        <NumberInput
                          className="mobile-input-field-small"
                          value={inc.endAge === null || inc.endAge === '' ? '' : inc.endAge}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateIncomeSource(inc.id, 'endAge', val === '' ? 0 : parseInt(val, 10));
                          }}
                          onBlur={() => triggerSave()}
                        />
                      </div>
                    </div>
                    <div className="mobile-list-item-footer">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!inc.isTaxable}
                          onChange={(e) => updateIncomeSource(inc.id, 'isTaxable', e.target.checked)}
                        />
                        <span>Taxable income</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="mobile-add-btn-full" onClick={addIncomeSource}>
              <Plus size={16} /> Add Income
            </button>
          </div>
        </div>
      );
    }

    if (currentScreen?.name === 'work_retirement') {
      return (
        <div className="life-profile-mobile-screen">
          <div className="life-profile-mobile-section-header">Employment</div>
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Employment Status</label>
              <select
                className="mobile-select-field"
                value={localProfile.household.employmentStatus || 'Employed'}
                onChange={(e) => updateHouseholdField('employmentStatus', e.target.value)}
              >
                <option value="Employed">Employed</option>
                <option value="Self-Employed">Self-Employed</option>
                <option value="Retired">Retired</option>
                <option value="Not Employed">Not Employed</option>
              </select>
            </div>
            <div className="mobile-form-group">
              <label>Annual Salary</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localSimpleIncome}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalSimpleIncome(val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
          </div>

          <div className="life-profile-mobile-section-header">Retirement Goal</div>
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Target Retirement Age</label>
              <NumberInput
                className="mobile-input-field"
                value={localTargetRetirementAge === null || localTargetRetirementAge === '' ? '' : localTargetRetirementAge}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalTargetRetirementAge(val === '' ? '' : parseInt(val, 10));
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  const finalRetAge = val === '' ? 65 : parseInt(val, 10);
                  setLocalTargetRetirementAge(finalRetAge);
                  triggerSave({ retireAge: finalRetAge });
                }}
              />
            </div>
            <div className="mobile-form-group">
              <label>Social Security Claim Age</label>
              <NumberInput
                className="mobile-input-field"
                value={localSSClaimingAge === null || localSSClaimingAge === '' ? '' : localSSClaimingAge}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalSSClaimingAge(val === '' ? '' : parseInt(val, 10));
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  const finalSSAge = val === '' ? 67 : parseInt(val, 10);
                  setLocalSSClaimingAge(finalSSAge);
                  triggerSave({ ssAge: finalSSAge });
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  // Desktop layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Primary Annual Income ($/yr)</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localSimpleIncome}
            onChange={(e) => {
              const val = e.target.value;
              setLocalSimpleIncome(val === '' ? 0 : parseFloat(val));
            }}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Target Retirement Age</label>
          <NumberInput
            className="life-profile-input-field"
            value={localTargetRetirementAge === null || localTargetRetirementAge === '' ? '' : localTargetRetirementAge}
            onChange={(e) => {
              const val = e.target.value;
              setLocalTargetRetirementAge(val === '' ? '' : parseInt(val, 10));
            }}
            onBlur={(e) => {
              const val = e.target.value;
              setLocalTargetRetirementAge(val === '' ? 65 : parseInt(val, 10));
            }}
          />
        </div>
      </div>

      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Social Security Claiming Age</label>
          <NumberInput
            className="life-profile-input-field"
            value={localSSClaimingAge}
            onChange={(e) => {
              const val = e.target.value;
              setLocalSSClaimingAge(val === '' ? 67 : parseInt(val, 10));
            }}
            onBlur={(e) => {
              const val = e.target.value;
              const finalSSAge = val === '' ? 67 : parseInt(val, 10);
              setLocalSSClaimingAge(finalSSAge);
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', paddingBottom: '0.5rem', lineHeight: '1.25' }}>
            💡 You can claim retirement benefits as early as 62 and delay up to age 70.
          </span>
        </div>
      </div>

      <div className="life-profile-sub-section" style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 className="life-profile-sub-section-title" style={{ margin: 0 }}>Additional Incomes & Pensions</h4>
          <button type="button" className="btn-secondary" onClick={addIncomeSource} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
            + Add Income
          </button>
        </div>

        {(localProfile.incomeSources || []).length === 0 ? (
          <div style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            No additional income configured. Add rental incomes, pension commitments, side hustles, etc.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {(localProfile.incomeSources || []).map((inc) => (
              <div key={inc.id} className="life-profile-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="life-profile-text-input"
                    style={{ flex: 1, padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                    value={inc.name || ''}
                    placeholder="e.g. Rental Income"
                    onChange={(e) => updateIncomeSource(inc.id, 'name', e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={!!inc.isTaxable}
                      onChange={(e) => updateIncomeSource(inc.id, 'isTaxable', e.target.checked)}
                    />
                    <span>Taxable</span>
                  </div>
                  <button type="button" className="btn-icon-delete" onClick={() => removeIncomeSource(inc.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                    🗑️
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Amount ($/yr)</label>
                    <CurrencyInput
                      className="life-profile-input-field"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                      value={inc.amount}
                      onChange={(e) => updateIncomeSource(inc.id, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    />
                  </div>
                  <div style={{ width: '55px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Growth (%)</label>
                    <PercentInput
                      className="life-profile-input-field"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                      value={inc.growthRate}
                      onChange={(e) => updateIncomeSource(inc.id, 'growthRate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Start Age</label>
                    <NumberInput
                      className="life-profile-input-field"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                      value={inc.startAge === null || inc.startAge === '' ? '' : inc.startAge}
                      onChange={(e) => updateIncomeSource(inc.id, 'startAge', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>End Age</label>
                    <NumberInput
                      className="life-profile-input-field"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                      value={inc.endAge === null || inc.endAge === '' ? '' : inc.endAge}
                      onChange={(e) => updateIncomeSource(inc.id, 'endAge', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
