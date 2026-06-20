import { formatCurrency } from '../helpers';
import { 
  calculateTotalCashRequired, 
  calculateLiquidAssetsAtPurchaseAge, 
  calculateCashShortfall 
} from '../houseAffordabilityUtils';
import MobileCurrencyField from './fields/MobileCurrencyField';
import MobilePercentSlider from './fields/MobilePercentSlider';
import MobileToggleRow from './fields/MobileToggleRow';
import MobileSelectField from './fields/MobileSelectField';

export default function HouseWizardStep({
  draftEvent,
  setDraftEvent,
  updateDraft,
  inputs,
  baselineResults,
  setShowImprovementModal,
  onClose
}) {
  const purchaseAge = draftEvent.purchaseAge !== undefined ? draftEvent.purchaseAge : (draftEvent.age || 35);
  const liquidAssets = calculateLiquidAssetsAtPurchaseAge(inputs, purchaseAge, baselineResults);
  const totalCashRequired = calculateTotalCashRequired(draftEvent);
  const isShortfall = totalCashRequired > liquidAssets;
  const shortfall = isShortfall ? calculateCashShortfall(totalCashRequired, liquidAssets) : 0;

  let projectionsAvailable = false;
  if (baselineResults && (baselineResults.nominalData || baselineResults.data)) {
    const logs = baselineResults.nominalData || baselineResults.data;
    const logBefore = logs.find(l => l.age === purchaseAge - 1);
    if (logBefore) {
      projectionsAvailable = true;
    }
  }

  const handleHomePriceChange = (price) => {
    const pct = draftEvent.homePrice > 0 ? (draftEvent.downPayment / draftEvent.homePrice) : 0.20;
    setDraftEvent(prev => ({
      ...prev,
      homePrice: price,
      downPayment: Math.round(price * pct)
    }));
  };

  const handleDownPaymentPctChange = (pctVal) => {
    const price = draftEvent.homePrice || 0;
    updateDraft('downPayment', Math.round(price * (pctVal / 100)));
  };

  const currentDownPaymentPct = draftEvent.homePrice > 0 
    ? Math.round(((draftEvent.downPayment || 0) / draftEvent.homePrice) * 100) 
    : 20;

  return (
    <>
      <MobileCurrencyField
        label="Home Price"
        value={draftEvent.homePrice}
        onChange={handleHomePriceChange}
        placeholder="e.g. 500000"
      />

      <MobilePercentSlider
        label="Down Payment (%)"
        value={currentDownPaymentPct}
        onChange={handleDownPaymentPctChange}
        min={0}
        max={100}
        step={1}
        displayValue={`${currentDownPaymentPct}% (${formatCurrency(draftEvent.downPayment || 0)})`}
      />

      {isShortfall && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          color: '#f59e0b',
          padding: '0.85rem',
          borderRadius: '6px',
          borderLeft: '4px solid #f59e0b',
          fontSize: '0.85rem',
          lineHeight: '1.45',
          marginTop: '0.25rem',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>⚠️</span> Not Enough Liquid Assets
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
              <span>Total cash required:</span>
              <strong>{formatCurrency(totalCashRequired)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
              <span>Projected liquid assets at age {purchaseAge}:</span>
              <strong>{formatCurrency(liquidAssets)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0', borderTop: '1px dashed rgba(245, 158, 11, 0.2)', paddingTop: '0.25rem' }}>
              <span>Additional cash needed:</span>
              <strong>{formatCurrency(shortfall)}</strong>
            </div>
          </div>
          {!projectionsAvailable && (
            <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.85 }}>
              Using current liquid assets.
            </div>
          )}
          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.2rem' }}>
            Liquid assets include cash and taxable brokerage accounts. Retirement accounts are excluded to avoid taxes and withdrawal penalties.
          </div>
          {setShowImprovementModal && (
            <button
              type="button"
              onClick={() => {
                setShowImprovementModal(true);
                onClose();
                setTimeout(() => {
                  const housingTypes = [
                    'reduceHomePrice', 'increaseDownPayment', 'delayHomePurchase', 'increaseHomeIncome',
                    'redirectSavingsDownPayment', 'pauseNonRetirementSavings', 'redirectBrokerageHouseFund',
                    'increaseDownPaymentIncome', 'delayHomePurchaseDownPayment', 'purchaseWithPartner',
                    'purchaseWithRoommate'
                  ];
                  for (const type of housingTypes) {
                    const el = document.getElementById(`rec-card-${type}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.style.outline = '2px solid var(--primary)';
                      setTimeout(() => {
                        el.style.outline = 'none';
                      }, 2000);
                      break;
                    }
                  }
                }, 150);
              }}
              style={{
                alignSelf: 'stretch',
                marginTop: '0.35rem',
                background: 'none',
                border: 'none',
                color: 'var(--primary, #16a34a)',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '0.5rem 0',
                fontSize: '0.85rem',
                textDecoration: 'underline',
                textAlign: 'center'
              }}
            >
              View Affordability Recommendations
            </button>
          )}
        </div>
      )}

      <MobilePercentSlider
        label="Mortgage Rate (Interest)"
        value={draftEvent.mortgageRate || 6.5}
        onChange={(val) => updateDraft('mortgageRate', val)}
        min={1}
        max={15}
        step={0.1}
        displayValue={`${draftEvent.mortgageRate || 6.5}%`}
      />

      <MobileSelectField
        label="Loan Term (Years)"
        value={draftEvent.loanTerm || 30}
        onChange={(val) => updateDraft('loanTerm', Number(val))}
        options={[
          { label: '30 Years Fixed', value: 30 },
          { label: '15 Years Fixed', value: 15 },
          { label: '10 Years Fixed', value: 10 }
        ]}
      />

      <MobileToggleRow
        label="Keep rent after purchase"
        description="Do not replace rent with mortgage"
        checked={!!draftEvent.keepRent}
        onChange={(checked) => updateDraft('keepRent', checked)}
        className="switch"
      />
    </>
  );
}
