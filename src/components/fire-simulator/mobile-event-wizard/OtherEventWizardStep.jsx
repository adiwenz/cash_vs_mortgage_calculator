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
      {/* 2. CAREER CHANGE / INCOME CHANGE */}
      {t === 'careerChange' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">Job Title / Name</label>
            <input 
              type="text" 
              value={draftEvent.name || ''} 
              onChange={(e) => updateDraft('name', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Senior Software Engineer"
            />
          </div>

          <MobilePercentSlider
            label="New Annual Income"
            value={draftEvent.amount || 150000}
            onChange={(val) => updateDraft('amount', val)}
            min={30000}
            max={300000}
            step={5000}
            displayValue={`${formatCurrency(draftEvent.amount || 150000)}/yr`}
          />

          <MobilePercentSlider
            label="Raise / Growth Rate (%)"
            value={draftEvent.growthRate !== undefined ? draftEvent.growthRate : 3.5}
            onChange={(val) => updateDraft('growthRate', val)}
            min={0}
            max={10}
            step={0.5}
            displayValue={`${draftEvent.growthRate !== undefined ? draftEvent.growthRate : 3.5}%`}
          />
        </>
      )}

      {/* 5. RETIREMENT / WORK OPTIONAL */}
      {t === 'retire' && (
        <>
          <div className="form-group-item">
            <label className="form-group-label">Can Stop Working Age</label>
            <div className="picker-slider-row" style={{ justifyContent: 'center', gap: '1.5rem', margin: '0.5rem 0' }}>
              <button 
                type="button" 
                className="slider-adjust-btn"
                onClick={() => updateDraft('age', Math.max(18, Number(draftEvent.age || 55) - 1))}
              >
                <Minus size={14} />
              </button>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--theme-color)' }}>{draftEvent.age || 55}</span>
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
            label="Spending Replacement Rate (%)"
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
            label="Monthly Amount ($)"
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
            <label className="form-group-label">Where? (Location Name)</label>
            <input 
              type="text" 
              value={draftEvent.location || ''} 
              onChange={(e) => updateDraft('location', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Austin, TX"
            />
          </div>

          <MobileCurrencyField
            label="New Annual Spending ($)"
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
            <label className="form-group-label">Event Name</label>
            <input 
              type="text" 
              value={draftEvent.name || ''} 
              onChange={(e) => updateDraft('name', e.target.value)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. Buy a Yacht"
            />
          </div>

          <MobileCurrencyField
            label="Cash Flow ($: negative for cost)"
            value={draftEvent.amount || 0}
            onChange={(val) => updateDraft('amount', val)}
            placeholder="e.g. -50000"
          />
        </>
      )}

      {/* COLLEGE */}
      {t === 'college' && (
        <>
          <MobileCurrencyField
            label="Annual Tuition Cost ($)"
            value={draftEvent.tuitionCost || 30000}
            onChange={(val) => updateDraft('tuitionCost', val)}
            placeholder="e.g. 30000"
          />

          <div className="form-group-item">
            <label className="form-group-label">Duration (years)</label>
            <input 
              type="number" 
              value={draftEvent.duration || 4} 
              onChange={(e) => updateDraft('duration', parseInt(e.target.value) || 4)} 
              className="mobile-wizard-input-text"
              placeholder="e.g. 4"
            />
          </div>
        </>
      )}

      {/* WINDFALL */}
      {t === 'windfall' && (
        <>
          <MobileCurrencyField
            label="Windfall Amount ($)"
            value={draftEvent.amount || 100000}
            onChange={(val) => updateDraft('amount', val)}
            placeholder="e.g. 100000"
          />

          <MobilePercentSlider
            label="Tax Rate (%)"
            value={draftEvent.taxRate !== undefined ? draftEvent.taxRate : 15}
            onChange={(val) => updateDraft('taxRate', val)}
            min={0}
            max={50}
            step={1}
            displayValue={`${draftEvent.taxRate !== undefined ? draftEvent.taxRate : 15}%`}
          />
        </>
      )}

      {/* DEBT PAYOFF */}
      {t === 'debtPayoff' && (
        <MobileCurrencyField
          label="Payoff Amount ($)"
          value={draftEvent.amount || 5000}
          onChange={(val) => updateDraft('amount', val)}
          placeholder="e.g. 5000"
        />
      )}

      {/* SELL HOUSE */}
      {t === 'sellHouse' && (
        <>
          <MobilePercentSlider
            label="Selling Cost (%)"
            value={draftEvent.sellingCost !== undefined ? draftEvent.sellingCost : 6}
            onChange={(val) => updateDraft('sellingCost', val)}
            min={0}
            max={15}
            step={0.5}
            displayValue={`${draftEvent.sellingCost !== undefined ? draftEvent.sellingCost : 6}%`}
          />
          <div className="form-group-item">
            <label className="form-group-label">Proceeds Destination</label>
            <select
              className="mobile-wizard-select"
              value={draftEvent.proceedsDestination || 'investments'}
              onChange={(e) => updateDraft('proceedsDestination', e.target.value)}
            >
              <option value="investments">Investments</option>
              <option value="cash">Cash / Liquid Assets</option>
            </select>
          </div>
        </>
      )}

      {/* FALLBACK FOR OTHER TYPES */}
      {!['careerChange', 'retire', 'socialSecurity', 'move', 'sabbatical', 'custom', 'college', 'windfall', 'debtPayoff', 'sellHouse'].includes(t) && (
        <>
          {draftEvent.amount !== undefined && (
            <MobileCurrencyField
              label="Amount / Value ($)"
              value={draftEvent.amount}
              onChange={(val) => updateDraft('amount', val)}
              placeholder="e.g. 10000"
            />
          )}
          {draftEvent.monthlyBenefit !== undefined && (
            <MobileCurrencyField
              label="Monthly Amount ($)"
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
