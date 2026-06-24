import { NumberInput, CurrencyInput } from '../../ui/PlainInputs';

export default function HousingTab({
  isMobile,
  localProfile,
  updateHomeField,
  localBuyHouseEnabled,
  setLocalBuyHouseEnabled,
  localBuyHouseAge,
  setLocalBuyHouseAge,
  localBuyHousePrice,
  setLocalBuyHousePrice,
  showAdvancedHome,
  setShowAdvancedHome,
  triggerSave
}) {
  const home = localProfile.home;

  if (isMobile) {
    return (
      <div className="life-profile-mobile-screen">
        <div className="life-profile-mobile-form-card">
          <div className="mobile-form-group">
            <label>Housing Status</label>
            <select
              className="mobile-select-field"
              value={home.status}
              onChange={(e) => updateHomeField('status', e.target.value)}
            >
              <option value="rent">Renting</option>
              <option value="own">Own Home</option>
            </select>
          </div>

          {home.status === 'rent' ? (
            <div className="mobile-form-group">
              <label>Monthly Rent</label>
              <CurrencyInput
                className="mobile-input-field"
                value={home.monthlyRent}
                onChange={(e) => {
                  const val = e.target.value;
                  updateHomeField('monthlyRent', val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
          ) : (
            <>
              <div className="mobile-form-group">
                <label>Home Value</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.homeValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('homeValue', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Mortgage Balance</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.mortgageBalance}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('mortgageBalance', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Monthly Mortgage Payment</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.monthlyPayment}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('monthlyPayment', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              
              <div className="mobile-form-group">
                <label>Property Taxes ($/yr)</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.propertyTaxes}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('propertyTaxes', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>Insurance ($/yr)</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.insurance}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('insurance', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
              <div className="mobile-form-group">
                <label>HOA Fees ($/mo)</label>
                <CurrencyInput
                  className="mobile-input-field"
                  value={home.hoa}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateHomeField('hoa', val === '' ? 0 : parseFloat(val));
                  }}
                  onBlur={() => triggerSave()}
                />
              </div>
            </>
          )}
        </div>

        {/* Plan to buy home */}
        <div className="life-profile-mobile-section-header-row">
          <span>Plan to Buy a Home?</span>
          <label className="mobile-switch-container">
            <input
              type="checkbox"
              checked={localBuyHouseEnabled}
              onChange={(e) => {
                const nextVal = e.target.checked;
                setLocalBuyHouseEnabled(nextVal);
                triggerSave({ bhEnabled: nextVal });
              }}
            />
            <span className="mobile-switch-slider"></span>
          </label>
        </div>

        {localBuyHouseEnabled && (
          <div className="life-profile-mobile-form-card">
            <div className="mobile-form-group">
              <label>Target Purchase Age</label>
              <NumberInput
                className="mobile-input-field"
                value={localBuyHouseAge === null ? '' : localBuyHouseAge}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalBuyHouseAge(val === '' ? '' : parseInt(val, 10));
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  const finalAge = val === '' ? 40 : parseInt(val, 10);
                  setLocalBuyHouseAge(finalAge);
                  triggerSave({ bhAge: finalAge });
                }}
              />
            </div>
            <div className="mobile-form-group">
              <label>Home Price</label>
              <CurrencyInput
                className="mobile-input-field"
                value={localBuyHousePrice}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalBuyHousePrice(val === '' ? 0 : parseFloat(val));
                }}
                onBlur={() => triggerSave()}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="life-profile-form-group">
        <label className="life-profile-label-bold">Housing Status</label>
        <select
          className="life-profile-select-field"
          value={home.status}
          onChange={(e) => updateHomeField('status', e.target.value)}
        >
          <option value="rent">Renting</option>
          <option value="own">Own Home</option>
        </select>
      </div>

      {home.status === 'rent' ? (
        <div className="life-profile-form-group">
          <label className="life-profile-label-bold">Monthly Rent ($/mo)</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={home.monthlyRent}
            onChange={(e) => updateHomeField('monthlyRent', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="life-profile-row-two-col">
            <div className="life-profile-form-group">
              <label className="life-profile-label-bold">Current Home Value ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={home.homeValue}
                onChange={(e) => updateHomeField('homeValue', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
            <div className="life-profile-form-group">
              <label className="life-profile-label-bold">Outstanding Mortgage Balance ($)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={home.mortgageBalance}
                onChange={(e) => updateHomeField('mortgageBalance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="life-profile-row-two-col">
            <div className="life-profile-form-group">
              <label className="life-profile-label-bold">Monthly Mortgage Payment ($/mo)</label>
              <CurrencyInput
                className="life-profile-input-field"
                value={home.monthlyPayment}
                onChange={(e) => updateHomeField('monthlyPayment', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAdvancedHome(!showAdvancedHome)}
                style={{ width: '100%', fontSize: '0.8rem', padding: '0.45rem 1rem' }}
              >
                {showAdvancedHome ? 'Hide Advanced Options' : 'Show Advanced (Taxes, HOA, etc)'}
              </button>
            </div>
          </div>

          {showAdvancedHome && (
            <div className="life-profile-sub-section" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <h4 className="life-profile-sub-section-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Annual Taxes, HOA, & Insurance</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Property Tax ($/yr)</label>
                  <CurrencyInput
                    className="life-profile-input-field"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                    value={home.propertyTaxes}
                    onChange={(e) => updateHomeField('propertyTaxes', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Insurance ($/yr)</label>
                  <CurrencyInput
                    className="life-profile-input-field"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                    value={home.insurance}
                    onChange={(e) => updateHomeField('insurance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>HOA ($/mo)</label>
                  <CurrencyInput
                    className="life-profile-input-field"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                    value={home.hoa}
                    onChange={(e) => updateHomeField('hoa', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <label className="checkbox-label" style={{ fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={localBuyHouseEnabled}
                onChange={(e) => setLocalBuyHouseEnabled(e.target.checked)}
              />
              <span>Plan future home purchase event instead of owning today?</span>
            </label>
            {localBuyHouseEnabled && (
              <div className="life-profile-sub-section" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', marginTop: '0.5rem' }}>
                <h4 className="life-profile-sub-section-title" style={{ color: '#7c3aed' }}>Future Home Purchase Decision</h4>
                <div className="life-profile-row-two-col">
                  <div className="life-profile-form-group">
                    <label className="life-profile-label-small">Purchase Age</label>
                    <NumberInput
                      className="life-profile-input-field"
                      value={localBuyHouseAge}
                      onChange={(e) => setLocalBuyHouseAge(e.target.value === '' ? 40 : parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="life-profile-form-group">
                    <label className="life-profile-label-small">Target Price ($)</label>
                    <CurrencyInput
                      className="life-profile-input-field"
                      value={localBuyHousePrice}
                      onChange={(e) => setLocalBuyHousePrice(e.target.value === '' ? 300000 : parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
