import { Minus, Plus } from 'lucide-react';
import { formatCurrency } from '../helpers';
import MobilePercentSlider from './fields/MobilePercentSlider';
import MobileToggleRow from './fields/MobileToggleRow';

export default function ChildWizardStep({
  draftEvent,
  setDraftEvent,
  updateDraft
}) {
  const childCount = Number(draftEvent.childCount || 1);
  const cost = Number(draftEvent.customAges0to4 || 15000);

  const handleCostSliderChange = (val) => {
    setDraftEvent(prev => ({
      ...prev,
      customAges0to4: val,
      customAges5to12: Math.round(val * 0.6),
      customAges13to18: Math.round(val * 0.8),
      customAges19to22: Math.round(val * 1.33)
    }));
  };

  return (
    <>
      <div className="form-group-item">
        <label className="form-group-label">Child Name</label>
        <input 
          type="text" 
          value={draftEvent.childName || ''} 
          onChange={(e) => updateDraft('childName', e.target.value)} 
          className="mobile-wizard-input-text"
          placeholder="Child name"
        />
      </div>

      <div className="form-group-item">
        <label className="form-group-label">How many children?</label>
        <div className="counter-row">
          <button 
            type="button" 
            className="counter-btn"
            disabled={childCount <= 1}
            onClick={() => updateDraft('childCount', Math.max(1, childCount - 1))}
          >
            <Minus size={14} />
          </button>
          <span className="counter-val">{childCount}</span>
          <button 
            type="button" 
            className="counter-btn"
            onClick={() => updateDraft('childCount', childCount + 1)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <MobilePercentSlider
        label="Annual cost per child"
        value={cost}
        onChange={handleCostSliderChange}
        min={0}
        max={50000}
        step={1000}
        displayValue={`${formatCurrency(cost)}/yr`}
      />

      <MobileToggleRow
        label="Include college tuition?"
        description="Adds expenses from ages 19–22"
        checked={!!draftEvent.includeCollege}
        onChange={(checked) => updateDraft('includeCollege', checked)}
      />
    </>
  );
}
