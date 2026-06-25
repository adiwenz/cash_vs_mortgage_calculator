import React from 'react';

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

export default function SettingsPanel({ settings, onChange, onReset, onClose }) {
  // Normalize settings with default fallbacks
  const s = {
    expectedReturn: 7.0,
    postRetirementReturn: 5.0,
    inflationRate: 3.0,
    salaryGrowthRate: 3.0,
    cashReturnRate: 2.0,
    lifestyleUpgrades: 0.0,
    swr: 4.0,
    lifeExpectancy: 85,
    socialSecurityEnabled: true,
    socialSecurityClaimingAge: 67,
    taxMode: false,
    taxState: 'CA',
    filingStatus: 'single',
    timestep: 'yearly',
    cashFlowTiming: 'endOfYear',
    ...settings
  };

  const updateField = (key, val) => {
    onChange(key, val);
  };

  const renderNumberInput = (label, key, suffix = '', tooltip = null, step = '0.1') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
          {label}
          {tooltip && <span style={{ marginLeft: '4px', cursor: 'help', color: '#9ca3af' }} title={tooltip}>ⓘ</span>}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number"
          step={step}
          className="life-profile-input-field"
          style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', border: '1px solid #ccc', borderRadius: '4px' }}
          value={s[key] !== undefined && s[key] !== null ? s[key] : ''}
          onChange={(e) => updateField(key, e.target.value === '' ? '' : Number(e.target.value))}
        />
        {suffix && <span style={{ fontSize: '0.8rem', color: '#6b7280', width: '20px' }}>{suffix}</span>}
      </div>
    </div>
  );

  const renderCheckbox = (label, key, tooltip = null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
        {label}
        {tooltip && <span style={{ marginLeft: '4px', cursor: 'help', color: '#9ca3af' }} title={tooltip}>ⓘ</span>}
      </span>
      <input
        type="checkbox"
        checked={!!s[key]}
        onChange={(e) => updateField(key, e.target.checked)}
        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
      />
    </div>
  );

  const renderSelect = (label, key, options, tooltip = null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
        {label}
        {tooltip && <span style={{ marginLeft: '4px', cursor: 'help', color: '#9ca3af' }} title={tooltip}>ⓘ</span>}
      </span>
      <select
        className="life-profile-select-field"
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', width: '120px', border: '1px solid #ccc', borderRadius: '4px' }}
        value={s[key] || ''}
        onChange={(e) => updateField(key, e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', borderRadius: '12px', padding: '1rem', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111827', margin: 0 }}>⚙️ Simulation Settings</h3>
        <button
          type="button"
          onClick={onReset}
          style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', fontSize: '0.8rem', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* Economic Defaults */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary, #2563eb)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Economic Defaults</h4>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {renderNumberInput('Inflation Rate', 'inflationRate', '%', 'Annual rate of inflation to project future purchasing power.')}
          {renderNumberInput('Default Return (Pre-Retirement)', 'expectedReturn', '%', 'Default return rate for investment accounts pre-retirement.')}
          {renderNumberInput('Default Return (Post-Retirement)', 'postRetirementReturn', '%', 'Default return rate for investment accounts post-retirement.')}
        </div>
      </div>

      {/* Retirement */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary, #2563eb)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👵 Retirement Settings</h4>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {renderNumberInput('Safe Withdrawal Rate (SWR)', 'swr', '%', 'Annual percentage withdrawn from assets during retirement.')}
          {renderCheckbox('Social Security Enabled', 'socialSecurityEnabled', 'Include Social Security benefit projections in retirement.')}
          {s.socialSecurityEnabled && renderNumberInput('Default Claiming Age', 'socialSecurityClaimingAge', 'yrs', 'Default age at which you plan to claim Social Security benefits.', '1')}
        </div>
      </div>

      {/* Taxes */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary, #2563eb)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚖️ Tax Settings</h4>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {renderCheckbox('Enable Tax Model', 'taxMode', 'Calculate income taxes, capital gains, and tax bracket changes.')}
          {s.taxMode && renderSelect('Filing Status Override', 'filingStatus', [
            { value: 'single', label: 'Single' },
            { value: 'married', label: 'Married Joint' }
          ])}
          {s.taxMode && renderSelect('State of Residence', 'taxState', US_STATES.map(st => ({ value: st.code, label: st.name })))}
        </div>
      </div>

      {/* Advanced */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary, #2563eb)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔧 Advanced Engine Defaults</h4>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {renderSelect('Simulation Timestep', 'timestep', [
            { value: 'yearly', label: 'Yearly' },
            { value: 'monthly', label: 'Monthly (Detailed)' }
          ])}
          {renderSelect('Cash Flow Timing', 'cashFlowTiming', [
            { value: 'endOfYear', label: 'End of Year' },
            { value: 'beginningOfYear', label: 'Beginning of Year' }
          ])}
        </div>
      </div>
    </div>
  );
}
