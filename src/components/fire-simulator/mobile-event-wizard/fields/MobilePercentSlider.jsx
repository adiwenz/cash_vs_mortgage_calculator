
export default function MobilePercentSlider({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  displayValue 
}) {
  return (
    <div className="form-group-item">
      <label className="form-group-label">{label}</label>
      <div className="slider-input-group">
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mobile-wizard-slider"
        />
        <div className="slider-val-box">
          {displayValue || `${value}%`}
        </div>
      </div>
    </div>
  );
}
