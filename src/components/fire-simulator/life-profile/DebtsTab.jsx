import React from 'react';
import { CurrencyInput, PercentInput } from '../../ui/PlainInputs';
import { Plus, Trash2 } from 'lucide-react';

export default function DebtsTab({
  isMobile,
  localProfile,
  updateDebt,
  removeDebt,
  addDebt,
  triggerSave,
  updateHomeField
}) {
  if (isMobile) {
    return (
      <div className="life-profile-mobile-screen">
        {localProfile.home.status === 'own' && (
          <>
            <div className="life-profile-mobile-section-header">Primary Mortgage</div>
            <div className="life-profile-mobile-form-card">
              <div className="mobile-form-group">
                <label>Mortgage Balance</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={localProfile.home.mortgageBalance}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('mortgageBalance', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
            </div>
          </>
        )}


        <div className="life-profile-mobile-section-header">Other Debts & Loans</div>
        <div className="life-profile-mobile-list">
          {(localProfile.debts || []).length === 0 ? (
            <div className="mobile-empty-state-card">
              No debts configured. Add loans like car payments, student loans, or credit cards here.
            </div>
          ) : (
            <div className="mobile-items-list-container">
              {(localProfile.debts || []).map((debt) => (
                <div key={debt.id} className="mobile-list-item-card">
                  <div className="mobile-list-item-header">
                    <input
                      type="text"
                      className="mobile-item-title-input"
                      value={debt.name || ''}
                      placeholder="e.g. Student Loan"
                      onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                      onBlur={() => triggerSave()}
                    />
                    <button type="button" className="mobile-item-delete-btn" onClick={() => removeDebt(debt.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mobile-list-item-fields">
                    <div className="mobile-form-group-third">
                      <label>Balance ($)</label>
                      <CurrencyInput
                        className="mobile-input-field-small"
                        value={debt.balance}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDebt(debt.id, 'balance', val === '' ? 0 : parseFloat(val));
                        }}
                        onBlur={() => triggerSave()}
                      />
                    </div>
                    <div className="mobile-form-group-third">
                      <label>Rate (%)</label>
                      <PercentInput
                        className="mobile-input-field-small"
                        value={debt.interestRate}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDebt(debt.id, 'interestRate', val === '' ? 0 : parseFloat(val));
                        }}
                        onBlur={() => triggerSave()}
                      />
                    </div>
                    <div className="mobile-form-group-third">
                      <label>Payment ($/mo)</label>
                      <CurrencyInput
                        className="mobile-input-field-small"
                        value={debt.monthlyPayment}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDebt(debt.id, 'monthlyPayment', val === '' ? 0 : parseFloat(val));
                        }}
                        onBlur={() => triggerSave()}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="mobile-add-btn-full" onClick={addDebt}>
            <Plus size={16} /> Add Debt
          </button>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 className="life-profile-label-bold" style={{ margin: 0 }}>Debts & Liabilities</h4>
        <button type="button" className="btn-secondary" onClick={addDebt} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}>
          + Add Debt
        </button>
      </div>

      {(localProfile.debts || []).length === 0 ? (
        <div style={{ padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No personal debts configured. Add auto loans, student loans, or credit cards.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(localProfile.debts || []).map((debt, index) => (
            <div key={debt.id} className="life-profile-list-item" style={{ flexWrap: 'wrap', gap: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem' }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>#{index + 1}</span>
                  <input
                    type="text"
                    className="life-profile-text-input"
                    style={{ flex: 1, padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                    value={debt.name || ''}
                    placeholder="e.g. Car Loan"
                    onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                  />
                </div>
                <button type="button" className="btn-icon-delete" onClick={() => removeDebt(debt.id)} style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  🗑️
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                <div style={{ flex: 1.5 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Balance ($)</label>
                  <CurrencyInput
                    className="life-profile-input-field"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                    value={debt.balance}
                    onChange={(e) => updateDebt(debt.id, 'balance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Interest Rate (%)</label>
                  <PercentInput
                    className="life-profile-input-field"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                    value={debt.interestRate}
                    onChange={(e) => updateDebt(debt.id, 'interestRate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1.5 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Min Payment ($/mo)</label>
                  <CurrencyInput
                    className="life-profile-input-field"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.82rem' }}
                    value={debt.monthlyPayment}
                    onChange={(e) => updateDebt(debt.id, 'monthlyPayment', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
