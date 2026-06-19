import MobileCurrencyField from './fields/MobileCurrencyField';
import MobilePercentSlider from './fields/MobilePercentSlider';

export default function MarriageWizardStep({
  draftEvent,
  updateDraft
}) {
  return (
    <>
      <MobileCurrencyField
        label="Spouse Annual Income"
        value={draftEvent.spouseIncome || 0}
        onChange={(val) => updateDraft('spouseIncome', val)}
        placeholder="e.g. 80000"
      />

      <MobilePercentSlider
        label="Spouse Pre-tax Savings Rate (%)"
        value={draftEvent.savingsRate !== undefined ? draftEvent.savingsRate : 15}
        onChange={(val) => updateDraft('savingsRate', val)}
        min={0}
        max={50}
        step={1}
        displayValue={`${draftEvent.savingsRate !== undefined ? draftEvent.savingsRate : 15}%`}
      />
    </>
  );
}
