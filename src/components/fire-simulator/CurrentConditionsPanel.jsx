import { formatCurrency, getDefaultValuesForType } from './helpers';

export default function CurrentConditionsPanel({
  inputs,
  setEditingCondition,
  handleRemoveCurrentCondition
}) {
  const list = inputs.currentConditions || [];
  if (list.length === 0) {
    return (
      <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
        No current conditions added yet. Start by adding items that are already true today.
      </div>
    );
  }

  const getTypeIcon = (c) => {
    if (c.type === 'debt') {
      if (c.subtype === 'studentLoan') return '🎓';
      if (c.subtype === 'creditCard') return '💳';
      if (c.subtype === 'carLoan') return '🚗';
      return '💳';
    }
    switch (c.type) {
      case 'checkingSavings': return '💰';
      case 'brokerage': return '📈';
      case 'retirement': return '🛡️';
      case 'asset': return '💎';
      case 'house': return '🏠';
      case 'child': return '👶';
      case 'obligation': return '📄';
      default: return '❓';
    }
  };

  const getTypeLabel = (c) => {
    if (c.type === 'debt') {
      if (c.subtype === 'studentLoan') return 'Student Loan';
      if (c.subtype === 'creditCard') return 'Credit Card';
      if (c.subtype === 'carLoan') return 'Car Loan';
      return 'Debt';
    }
    if (c.type === 'checkingSavings') return 'Cash';
    if (c.type === 'brokerage') return 'Investment Account';
    const labels = {
      house: 'House',
      child: 'Child',
      obligation: 'Obligation',
      retirement: 'Retirement Account',
      asset: 'Asset'
    };
    return labels[c.type] || c.type;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
      {list.map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem' }}>{getTypeIcon(c)}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.name || getTypeLabel(c)}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{getTypeLabel(c)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
              {c.type !== 'child' && c.type !== 'obligation' && (
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(c.value)}
                </strong>
              )}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {c.monthlyAmount > 0 ? (
                  ['checkingSavings', 'brokerage', 'retirement', 'asset'].includes(c.type) ? (
                    <span style={{ color: 'var(--primary-light)' }}>+{formatCurrency(c.monthlyAmount)}/mo</span>
                  ) : (
                    <span style={{ color: 'var(--accent-rose)' }}>-{formatCurrency(c.monthlyAmount)}/mo</span>
                  )
                ) : null}
                {c.rate > 0 && ` (${c.rate}% ${c.type === 'debt' ? 'interest' : c.type === 'house' ? 'appr.' : 'growth'})`}
              </span>
              {c.endAge && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                  Ends at age {c.endAge}
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                className="list-builder-edit-btn"
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                onClick={() => setEditingCondition(c)}
              >
                ✏️
              </button>
              <button
                type="button"
                className="list-builder-edit-btn"
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--accent-rose)' }}
                onClick={() => handleRemoveCurrentCondition(c.id)}
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CurrentConditionModal({
  editingCondition,
  inputs,
  setEditingCondition,
  handleSaveCurrentCondition
}) {
  if (!editingCondition) return null;
  const type = editingCondition.type;
  
  // Choose labels and descriptions based on type
  let valueLabel = "Current Balance / Value ($)";
  let amountLabel = "Monthly Contribution ($/mo)";
  let amountDesc = "How much you save/invest into this account each month.";
  let rateLabel = "Annual Growth Rate (%)";
  let rateDesc = "Expected annual growth rate (before inflation).";

  if (type === 'checkingSavings') {
    amountLabel = "Monthly Savings ($/mo)";
    amountDesc = "Additional monthly savings added to this account.";
    rateLabel = "Interest Rate (%)";
    rateDesc = "Annual interest rate earned.";
  } else if (type === 'retirement') {
    amountLabel = "Monthly Contribution ($/mo)";
    amountDesc = "Pre-tax or post-tax contribution to this account.";
  } else if (type === 'debt') {
    valueLabel = "Current Outstanding Balance ($)";
    amountLabel = "Monthly Payment ($/mo)";
    amountDesc = "Minimum or standard monthly payment.";
    rateLabel = "Interest Rate (%)";
    rateDesc = "Annual interest rate on the debt.";
  } else if (type === 'house') {
    valueLabel = "Current Home Value ($)";
    amountLabel = "Monthly Cost ($/mo)";
    amountDesc = "Mortgage, taxes, maintenance, and insurance monthly total.";
    rateLabel = "Annual Appreciation Rate (%)";
    rateDesc = "Expected annual appreciation rate.";
  } else if (type === 'child') {
    valueLabel = "Not Applicable";
    amountLabel = "Monthly Cost ($/mo)";
    amountDesc = "Childcare, schooling, and general monthly expenses.";
    rateLabel = "Annual Cost Inflation (%)";
    rateDesc = "Optional: custom inflation rate for child costs.";
  } else if (type === 'obligation') {
    valueLabel = "Not Applicable";
    amountLabel = "Monthly Cost ($/mo)";
    amountDesc = "Monthly cost for this obligation.";
    rateLabel = "Annual Cost Inflation (%)";
    rateDesc = "Optional: custom inflation rate for this obligation.";
  }

  return (
    <div className="modal-backdrop" onClick={() => setEditingCondition(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
            {editingCondition.id ? '✏️ Edit Current Condition' : '📋 Add Current Condition'}
          </h3>
          <button 
            type="button" 
            onClick={() => setEditingCondition(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.15rem' }}
          >
            ✖
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Category Type Selector */}
          <div className="input-wrapper">
            <span className="input-name">Category Type</span>
            <select
              className="input-number-box"
              style={{ width: '100%', padding: '0.35rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              value={(() => {
                if (editingCondition.type === 'debt') {
                  if (editingCondition.subtype) return editingCondition.subtype;
                  const nameLower = (editingCondition.name || '').toLowerCase();
                  if (nameLower.includes('student')) return 'studentLoan';
                  if (nameLower.includes('credit')) return 'creditCard';
                  if (nameLower.includes('car')) return 'carLoan';
                  return 'studentLoan';
                }
                return editingCondition.type;
              })()}
              onChange={(e) => {
                const val = e.target.value;
                let type = val;
                let subtype = '';
                if (['studentLoan', 'creditCard', 'carLoan'].includes(val)) {
                  type = 'debt';
                  subtype = val;
                }
                const currentAge = inputs.currentAge || 35;
                const defaults = getDefaultValuesForType(val, currentAge);
                setEditingCondition({
                  ...editingCondition,
                  type,
                  subtype,
                  name: defaults.name,
                  value: defaults.value,
                  monthlyAmount: defaults.monthlyAmount,
                  rate: defaults.rate,
                  notes: defaults.notes,
                  startAge: defaults.startAge,
                  endAge: defaults.endAge
                });
              }}
            >
              <option value="house">🏠 House</option>
              <option value="child">👶 Child</option>
              <option value="studentLoan">🎓 Student Loan</option>
              <option value="creditCard">💳 Credit Card</option>
              <option value="carLoan">🚗 Car Loan</option>
            </select>
          </div>

          {/* Name */}
          <div className="input-wrapper">
            <span className="input-name">Name</span>
            <input
              type="text"
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left' }}
              placeholder="e.g. Chase HYSA, Car Payment, Leo, etc."
              value={editingCondition.name}
              onChange={(e) => setEditingCondition({ ...editingCondition, name: e.target.value })}
            />
          </div>

          {/* Value/Balance (if applicable) */}
          {type !== 'child' && type !== 'obligation' && (
            <div className="input-wrapper">
              <span className="input-name">{valueLabel}</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={editingCondition.value || 0}
                onChange={(e) => setEditingCondition({ ...editingCondition, value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {/* Monthly Cost/Contribution */}
          <div className="input-wrapper">
            <span className="input-name">{amountLabel}</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingCondition.monthlyAmount || 0}
              onChange={(e) => setEditingCondition({ ...editingCondition, monthlyAmount: parseFloat(e.target.value) || 0 })}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{amountDesc}</span>
          </div>

          {/* Growth Rate / Interest Rate */}
          <div className="input-wrapper">
            <span className="input-name">{rateLabel}</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingCondition.rate || 0}
              onChange={(e) => setEditingCondition({ ...editingCondition, rate: parseFloat(e.target.value) || 0 })}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{rateDesc}</span>
          </div>

          {/* Start Age (Readonly) */}
          <div className="input-wrapper">
            <span className="input-name">Starts at Age (Current Age)</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-tertiary)' }}
              value={inputs.currentAge || 35}
              disabled
            />
          </div>

          {/* End Age (Optional) */}
          <div className="input-wrapper">
            <span className="input-name">End Age (Optional)</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              placeholder="e.g. 50 (lasts until age 50, empty if lifetime)"
              value={editingCondition.endAge || ''}
              onChange={(e) => setEditingCondition({ ...editingCondition, endAge: e.target.value ? parseInt(e.target.value) || null : '' })}
            />
          </div>

          {/* Notes/Assumptions */}
          <div className="input-wrapper">
            <span className="input-name">Notes / Assumptions</span>
            <textarea
              className="input-number-box"
              style={{ width: '100%', minHeight: '60px', textAlign: 'left', padding: '0.45rem' }}
              placeholder="Any special notes or assumptions for this condition."
              value={editingCondition.notes || ''}
              onChange={(e) => setEditingCondition({ ...editingCondition, notes: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="list-builder-edit-btn"
            style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            onClick={() => setEditingCondition(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveCurrentCondition}
          >
            Save Condition
          </button>
        </div>
      </div>
    </div>
  );
}
