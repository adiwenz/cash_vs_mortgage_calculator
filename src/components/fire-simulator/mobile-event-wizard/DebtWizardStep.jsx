import MobileCurrencyField from './fields/MobileCurrencyField';
import MobilePercentSlider from './fields/MobilePercentSlider';
import MobileToggleRow from './fields/MobileToggleRow';
import { InterestTrapWarning } from '../EventModalForm/EventValidationMessages';

export default function DebtWizardStep({
  draftEvent,
  updateDraft
}) {
  const isCreditCard = draftEvent.borrowingType === 'creditCard';

  return (
    <>
      <div className="form-group-item">
        <label className="form-group-label">Loan Name</label>
        <input 
          type="text" 
          value={draftEvent.name || ''} 
          onChange={(e) => updateDraft('name', e.target.value)} 
          className="mobile-wizard-input-text"
          placeholder="e.g. Student Loan"
        />
      </div>

      <MobileCurrencyField
        label="Starting Balance / Amount ($)"
        value={draftEvent.balance || 0}
        onChange={(val) => updateDraft('balance', val)}
        placeholder="e.g. 20000"
      />

      <MobilePercentSlider
        label="Interest Rate (APR %)"
        value={draftEvent.interestRate !== undefined ? draftEvent.interestRate : 5}
        onChange={(val) => updateDraft('interestRate', val)}
        min={0}
        max={30}
        step={0.1}
        displayValue={`${draftEvent.interestRate !== undefined ? draftEvent.interestRate : 5}%`}
      />

      <MobileCurrencyField
        label="Minimum Monthly Payment ($)"
        value={draftEvent.minPayment || 0}
        onChange={(val) => updateDraft('minPayment', val)}
        placeholder="e.g. 200"
      />

      {isCreditCard && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
          <InterestTrapWarning editingEvent={draftEvent} />
          <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '12px', borderLeft: '4px solid var(--theme-color)', border: '1px solid var(--border-color)', borderLeftWidth: '4px', fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
            💳 Credit card rates are higher. <em>Small changes can move the payoff date.</em> Pay more than the minimum to avoid paying massive interest.
          </div>
        </div>
      )}

      <MobileToggleRow
        label="Create a payoff plan too"
        description="Auto-deducts until balance reaches $0"
        checked={!!draftEvent.payoffPlanEnabled}
        onChange={(checked) => updateDraft('payoffPlanEnabled', checked)}
      />
    </>
  );
}
