import { useState } from 'react';

export default function AdvancedSettingsModal({ scenario, onClose }) {
  const inputs = scenario?.inputs || {};

  // Initialize local states from scenario inputs
  const [expectedReturn, setExpectedReturn] = useState(
    inputs.expectedReturn !== undefined ? inputs.expectedReturn : 7.0
  );
  const [postRetirementReturn, setPostRetirementReturn] = useState(
    inputs.postRetirementReturn !== undefined ? inputs.postRetirementReturn : (inputs.expectedReturn !== undefined ? inputs.expectedReturn : 7.0)
  );
  const [cashReturnRate, setCashReturnRate] = useState(
    inputs.cashReturnRate !== undefined ? inputs.cashReturnRate : 2.0
  );
  const [inflationRate, setInflationRate] = useState(
    inputs.inflationRate !== undefined ? inputs.inflationRate : 2.5
  );
  const [lifestyleUpgrades, setLifestyleUpgrades] = useState(
    inputs.lifestyleUpgrades !== undefined ? inputs.lifestyleUpgrades : 0.0
  );
  const [swr, setSwr] = useState(
    inputs.swr !== undefined ? inputs.swr : 4.0
  );
  const [includeTaxes, setIncludeTaxes] = useState(
    !!inputs.includeTaxes
  );
  const [filingStatus, setFilingStatus] = useState(
    inputs.filingStatus || 'single'
  );
  const [enableHealthcareModel, setEnableHealthcareModel] = useState(
    inputs.enableHealthcareModel !== false
  );
  const [preMedicarePremium, setPreMedicarePremium] = useState(
    inputs.preMedicarePremium !== undefined ? inputs.preMedicarePremium : 10000
  );
  const [medicarePremium, setMedicarePremium] = useState(
    inputs.medicarePremium !== undefined ? inputs.medicarePremium : 4000
  );

  const handleSave = () => {
    scenario.setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id === scenario.currentScenarioId) {
          return {
            ...scen,
            inputs: {
              ...scen.inputs,
              expectedReturn: Math.min(25, Math.max(0, parseFloat(expectedReturn) || 0)),
              postRetirementReturn: Math.min(15, Math.max(0, parseFloat(postRetirementReturn) || 0)),
              cashReturnRate: parseFloat(cashReturnRate) || 0,
              inflationRate: Math.min(20, Math.max(0, parseFloat(inflationRate) || 0)),
              lifestyleUpgrades: parseFloat(lifestyleUpgrades) || 0,
              swr: parseFloat(swr) || 0,
              includeTaxes: !!includeTaxes,
              filingStatus: filingStatus,
              enableHealthcareModel: !!enableHealthcareModel,
              preMedicarePremium: parseFloat(preMedicarePremium) || 0,
              medicarePremium: parseFloat(medicarePremium) || 0,
            },
          };
        }
        return scen;
      })
    );
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="event-form-overlay-card modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px', width: '95%', padding: '1.25rem' }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0.5rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              ⚙️ Projection Assumptions
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
              These settings control how your future projections are calculated.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0.2rem',
            }}
          >
            ✖
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="input-wrapper">
              <span className="input-name">Pre-Retire Return (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={expectedReturn}
                step="0.1"
                onChange={(e) => {
                  const valStr = e.target.value;
                  const val = parseFloat(valStr);
                  if (!isNaN(val) && val > 25) {
                    setExpectedReturn(25);
                  } else {
                    setExpectedReturn(valStr);
                  }
                }}
                onBlur={() => {
                  let val = parseFloat(expectedReturn);
                  if (isNaN(val) || val < 0) {
                    setExpectedReturn(0);
                  } else if (val > 25) {
                    setExpectedReturn(25);
                  }
                }}
              />
              {parseFloat(expectedReturn) >= 25 && (
                <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', lineHeight: '1.25' }}>
                  Return rates above 25% create unrealistic projections. We capped this at 25%.
                </div>
              )}
            </div>
            <div className="input-wrapper">
              <span className="input-name">Post-Retire Return (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={postRetirementReturn}
                step="0.1"
                onChange={(e) => {
                  const valStr = e.target.value;
                  const val = parseFloat(valStr);
                  if (!isNaN(val) && val > 15) {
                    setPostRetirementReturn(15);
                  } else {
                    setPostRetirementReturn(valStr);
                  }
                }}
                onBlur={() => {
                  let val = parseFloat(postRetirementReturn);
                  if (isNaN(val) || val < 0) {
                    setPostRetirementReturn(0);
                  } else if (val > 15) {
                    setPostRetirementReturn(15);
                  }
                }}
              />
              {parseFloat(postRetirementReturn) >= 15 && (
                <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', lineHeight: '1.25' }}>
                  Return rates above 15% create unrealistic projections. We capped this at 15%.
                </div>
              )}
            </div>
            <div className="input-wrapper">
              <span className="input-name">Cash Return Rate (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={cashReturnRate}
                step="0.1"
                onChange={(e) => setCashReturnRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="input-wrapper">
              <span className="input-name">Inflation Rate (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={inflationRate}
                step="0.1"
                onChange={(e) => {
                  const valStr = e.target.value;
                  const val = parseFloat(valStr);
                  if (!isNaN(val) && val > 20) {
                    setInflationRate(20);
                  } else {
                    setInflationRate(valStr);
                  }
                }}
                onBlur={() => {
                  let val = parseFloat(inflationRate);
                  if (isNaN(val) || val < 0) {
                    setInflationRate(0);
                  } else if (val > 20) {
                    setInflationRate(20);
                  }
                }}
              />
              {parseFloat(inflationRate) >= 20 && (
                <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', lineHeight: '1.25' }}>
                  Inflation rates above 20% create unrealistic projections. We capped this at 20%.
                </div>
              )}
            </div>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="input-name">Lifestyle Upgrades (%)</span>
                <span className="tooltip-icon">?</span>
                <span className="tooltip-text">
                  At 0%, your spending only increases with inflation. Increase this if you plan to upgrade your lifestyle over time (spending grows faster than inflation).
                </span>
              </div>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%', marginTop: '0.15rem' }}
                value={lifestyleUpgrades}
                step="0.1"
                min="0"
                max="100"
                onChange={(e) => setLifestyleUpgrades(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="input-wrapper">
              <span className="input-name">SWR (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={swr}
                step="0.1"
                onChange={(e) => setSwr(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Bottom Assumptional Models (Taxes & Healthcare) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '0.75rem'
          }}>
            {/* Taxes Model */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={includeTaxes}
                  onChange={(e) => setIncludeTaxes(e.target.checked)}
                />
                Include Taxes (U.S. Federal Progressive)
              </label>
              {includeTaxes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div className="input-wrapper" style={{ maxWidth: '100%' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Filing Status</span>
                    <select
                      className="input-number-box"
                      style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem', textAlign: 'left' }}
                      value={filingStatus}
                      onChange={(e) => setFilingStatus(e.target.value)}
                    >
                      <option value="single">Single Filer</option>
                      <option value="married">Married Filing Jointly</option>
                    </select>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                    ℹ️ Taxes use progressive brackets (10% to 37%) and standard deductions ($16.1k Single / $32.2k Married for 2026), inflated annually.
                  </p>
                </div>
              )}
            </div>

            {/* Healthcare & Medicare Bridge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={enableHealthcareModel}
                  onChange={(e) => setEnableHealthcareModel(e.target.checked)}
                />
                🏥 Enable Healthcare & Medicare Bridge
              </label>
              {enableHealthcareModel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div className="input-wrapper">
                      <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="input-name" style={{ fontSize: '0.7rem' }}>Pre-Medicare ($/yr)</span>
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-text">
                          Estimated annual cost of private health insurance (ACA/COBRA) if you retire before age 65.
                        </span>
                      </div>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%', marginTop: '0.15rem' }}
                        value={preMedicarePremium}
                        step="500"
                        onChange={(e) => setPreMedicarePremium(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="input-wrapper">
                      <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="input-name" style={{ fontSize: '0.7rem' }}>Medicare ($/yr)</span>
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-text">
                          Estimated annual cost of Medicare premiums and out-of-pocket costs after age 65.
                        </span>
                      </div>
                      <input
                        type="number"
                        className="input-number-box"
                        style={{ width: '100%', marginTop: '0.15rem' }}
                        value={medicarePremium}
                        step="200"
                        onChange={(e) => setMedicarePremium(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.15rem 0 0 0', lineHeight: '1.3' }}>
                    ℹ️ Pre-Medicare costs apply until age 65, then Medicare starts. Both are inflated.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            className="list-builder-edit-btn"
            style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
