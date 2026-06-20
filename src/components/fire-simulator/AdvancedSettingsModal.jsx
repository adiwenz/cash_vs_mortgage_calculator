import React, { useState } from 'react';

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
              expectedReturn: parseFloat(expectedReturn) || 0,
              postRetirementReturn: parseFloat(postRetirementReturn) || 0,
              cashReturnRate: parseFloat(cashReturnRate) || 0,
              inflationRate: parseFloat(inflationRate) || 0,
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
        style={{ maxWidth: '600px', width: '90%' }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--primary)' }}>
              ⚙️ Projection Assumptions
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <div className="input-wrapper">
              <span className="input-name">Pre-Retire Return (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={expectedReturn}
                step="0.1"
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="input-wrapper">
              <span className="input-name">Post-Retire Return (%)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '100%' }}
                value={postRetirementReturn}
                step="0.1"
                onChange={(e) => setPostRetirementReturn(parseFloat(e.target.value) || 0)}
              />
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
                onChange={(e) => setInflationRate(parseFloat(e.target.value) || 0)}
              />
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

          {/* Taxes Model */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={includeTaxes}
                onChange={(e) => setIncludeTaxes(e.target.checked)}
              />
              Include Taxes (U.S. Federal Progressive)
            </label>
            {includeTaxes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <div className="input-wrapper" style={{ maxWidth: '300px' }}>
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
                  ℹ️ Taxes are calculated using progressive brackets (10% to 37%) and standard deductions ($16,100 Single / $32,200 Married for 2026), inflated annually.
                </p>
              </div>
            )}
          </div>

          {/* Healthcare & Medicare Bridge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={enableHealthcareModel}
                onChange={(e) => setEnableHealthcareModel(e.target.checked)}
              />
              🏥 Enable Healthcare & Medicare Bridge
            </label>
            {enableHealthcareModel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                  <div className="input-wrapper">
                    <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span className="input-name">Pre-Medicare Cost ($/yr)</span>
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
                      <span className="input-name">Medicare Cost ($/yr)</span>
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
                  ℹ️ Pre-Medicare costs apply from retirement age until age 65. Medicare eligibility starts at age 65. Both are adjusted for inflation.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
