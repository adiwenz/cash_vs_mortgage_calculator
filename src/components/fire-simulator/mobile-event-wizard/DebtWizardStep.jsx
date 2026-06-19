import MobileCurrencyField from './fields/MobileCurrencyField';
import MobilePercentSlider from './fields/MobilePercentSlider';
import MobileToggleRow from './fields/MobileToggleRow';

export default function DebtWizardStep({
  draftEvent,
  updateDraft
}) {
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
        label="Loan Balance"
        value={draftEvent.balance || 0}
        onChange={(val) => updateDraft('balance', val)}
        placeholder="e.g. 20000"
      />

      <MobilePercentSlider
        label="Interest Rate"
        value={draftEvent.interestRate !== undefined ? draftEvent.interestRate : 5}
        onChange={(val) => updateDraft('interestRate', val)}
        min={0}
        max={30}
        step={0.1}
        displayValue={`${draftEvent.interestRate !== undefined ? draftEvent.interestRate : 5}%`}
      />

      <MobileCurrencyField
        label="Monthly Minimum Payment"
        value={draftEvent.minPayment || 0}
        onChange={(val) => updateDraft('minPayment', val)}
        placeholder="e.g. 200"
      />

      <MobileToggleRow
        label="Set up payoff plan?"
        description="Auto-deducts until balance reaches $0"
        checked={!!draftEvent.payoffPlanEnabled}
        onChange={(checked) => updateDraft('payoffPlanEnabled', checked)}
      />
    </>
  );
}
