import React from 'react';
import { CurrencyInput } from '../../ui/PlainInputs';

export default function AssetsTab({
  isMobile,
  localProfile,
  updateAssetField,
  triggerSave
}) {
  if (isMobile) {
    return (
      <div className="life-profile-mobile-screen">
        <div className="life-profile-mobile-section-header">Liquid Assets</div>
        <div className="life-profile-mobile-form-card">
          <div className="mobile-form-group">
            <label>Cash (Checking / HYSA)</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.cash}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('cash', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Taxable Brokerage</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.brokerage}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('brokerage', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Traditional 401(k)</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.trad401k}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('trad401k', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Traditional IRA</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.tradIra}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('tradIra', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Roth IRA</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.rothIra}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('rothIra', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>HSA Balance</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.hsa}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('hsa', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Crypto Balance</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.crypto}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('crypto', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
          <div className="mobile-form-group">
            <label>Business Equity</label>
            <CurrencyInput
              className="mobile-input-field"
              value={localProfile.assets.businessEquity}
              onChange={(e) => {
                const val = e.target.value;
                updateAssetField('businessEquity', val === '' ? 0 : parseFloat(val));
              }}
              onBlur={() => triggerSave()}
            />
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h4 className="life-profile-label-bold">Liquid Cash & Invested Accounts</h4>
      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">💵 Cash (Checking / HYSA)</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.cash}
            onChange={(e) => updateAssetField('cash', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">📈 Taxable Brokerage</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.brokerage}
            onChange={(e) => updateAssetField('brokerage', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">💼 Traditional 401(k)</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.trad401k}
            onChange={(e) => updateAssetField('trad401k', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">💼 Traditional IRA</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.tradIra}
            onChange={(e) => updateAssetField('tradIra', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">💼 Roth IRA</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.rothIra}
            onChange={(e) => updateAssetField('rothIra', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">🏥 HSA Balance</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.hsa}
            onChange={(e) => updateAssetField('hsa', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="life-profile-row-two-col">
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">🪙 Crypto Balance</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.crypto}
            onChange={(e) => updateAssetField('crypto', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
        <div className="life-profile-form-group">
          <label className="life-profile-label-small">🏢 Business Equity</label>
          <CurrencyInput
            className="life-profile-input-field"
            value={localProfile.assets.businessEquity}
            onChange={(e) => updateAssetField('businessEquity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
