import { Minus, Plus } from 'lucide-react';
import { formatCurrency } from '../helpers';
import MobileCurrencyField from './fields/MobileCurrencyField';
import MobilePercentSlider from './fields/MobilePercentSlider';

export default function OtherEventWizardStep({
  draftEvent,
  setDraftEvent,
  updateDraft
}) {
  const t = draftEvent.type;

  return (
    <>
      {/* 2. CAREER CHANGE */}
      {t === 'careerChange' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">New Title / Job Name</label>
            <input 
              type="text" 
              value={draftEvent.name || ''} 
              onChange={(e) => updateDraft('name', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Senior Software Engineer"
            />
          </div>

          <MobilePercentSlider
            label="New Annual Salary"
            value={draftEvent.amount || 150000}
            onChange={(val) => updateDraft('amount', val)}
            min={30000}
            max={300000}
            step={5000}
            displayValue={`${formatCurrency(draftEvent.amount || 150000)}/yr`}
          />

          <MobilePercentSlider
            label="Salary Growth Rate (Raises)"
            value={draftEvent.growthRate !== undefined ? draftEvent.growthRate : 3.5}
            onChange={(val) => updateDraft('growthRate', val)}
            min={0}
            max={10}
            step={0.5}
            displayValue={`${draftEvent.growthRate !== undefined ? draftEvent.growthRate : 3.5}%`}
          />
        </>
      )}

      {/* 5. RETIREMENT */}
      {t === 'retire' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">Desired Stop Working Age</label>
            <div className="picker-slider-row">
              <button 
                type="button" 
                className="slider-adjust-btn"
                onClick={() => updateDraft('age', Math.max(18, Number(draftEvent.age || 55) - 1))}
              >
                <Minus size={14} />
              </button>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{draftEvent.age || 55}</span>
              <button 
                type="button" 
                className="slider-adjust-btn"
                onClick={() => updateDraft('age', Math.min(85, Number(draftEvent.age || 55) + 1))}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <MobilePercentSlider
            label="Stop Working Spending Need (% of pre-stop working lifestyle)"
            value={draftEvent.spendingPercent || 70}
            onChange={(val) => updateDraft('spendingPercent', val)}
            min={20}
            max={150}
            step={5}
            displayValue={`${draftEvent.spendingPercent || 70}%`}
          />
        </>
      )}

      {/* 6. SOCIAL SECURITY */}
      {t === 'socialSecurity' && (
        <>
          <MobilePercentSlider
            label="Claiming Age"
            value={draftEvent.claimingAge || 67}
            onChange={(age) => {
              setDraftEvent(prev => ({
                ...prev,
                claimingAge: age,
                age: age,
                startAge: age
              }));
            }}
            min={62}
            max={70}
            step={1}
            displayValue={`Age ${draftEvent.claimingAge || 67}`}
          />

          <MobileCurrencyField
            label="Estimated Monthly Benefit (at age 67)"
            value={draftEvent.monthlyBenefit || 2000}
            onChange={(val) => updateDraft('monthlyBenefit', val)}
            placeholder="e.g. 2000"
          />
        </>
      )}

      {/* 8. MOVE */}
      {t === 'move' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">New Location</label>
            <input 
              type="text" 
              value={draftEvent.location || ''} 
              onChange={(e) => updateDraft('location', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Austin, TX"
            />
          </div>

          <MobileCurrencyField
            label="Expected Annual Core Spending"
            value={draftEvent.newSpending || 0}
            onChange={(val) => updateDraft('newSpending', val)}
            placeholder="e.g. 60000"
          />

          <MobileCurrencyField
            label="One-time Moving Cost ($)"
            value={draftEvent.movingCost !== undefined ? draftEvent.movingCost : 0}
            onChange={(val) => updateDraft('movingCost', val)}
            placeholder="e.g. 5000"
          />
        </>
      )}

      {/* 9. SABBATICAL */}
      {t === 'sabbatical' && (
        <MobilePercentSlider
          label="Income Reduction (%)"
          value={draftEvent.incomeReduction || 100}
          onChange={(val) => updateDraft('incomeReduction', val)}
          min={10}
          max={100}
          step={10}
          displayValue={`${draftEvent.incomeReduction || 100}%`}
        />
      )}

      {/* 10. CUSTOM */}
      {t === 'custom' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">Goal Name</label>
            <input 
              type="text" 
              value={draftEvent.name || ''} 
              onChange={(e) => updateDraft('name', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Buy a Yacht"
            />
          </div>

          <MobileCurrencyField
            label="Amount (Negative for cost, positive for inflow)"
            value={draftEvent.amount || 0}
            onChange={(val) => updateDraft('amount', val)}
            placeholder="e.g. -50000"
          />
        </>
      )}

      {/* FALLBACK FOR OTHER TYPES */}
      {!['careerChange', 'retire', 'socialSecurity', 'move', 'sabbatical', 'custom'].includes(t) && (
        <>
          {draftEvent.amount !== undefined && (
            <MobileCurrencyField
              label="Amount / Value"
              value={draftEvent.amount}
              onChange={(val) => updateDraft('amount', val)}
              placeholder="e.g. 10000"
            />
          )}
          {draftEvent.monthlyBenefit !== undefined && (
            <MobileCurrencyField
              label="Monthly Benefit"
              value={draftEvent.monthlyBenefit}
              onChange={(val) => updateDraft('monthlyBenefit', val)}
              placeholder="e.g. 1000"
            />
          )}
        </>
      )}
    </>
  );
}
