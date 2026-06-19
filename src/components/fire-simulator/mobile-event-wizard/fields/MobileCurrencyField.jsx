
export default function MobileCurrencyField({ label, value, onChange, placeholder }) {
  return (
    <div className="form-group-item">
      <label className="form-group-label">{label}</label>
      <input 
        type="number" 
        value={value !== undefined && value !== null ? value : ''} 
        onChange={(e) => onChange(Number(e.target.value) || 0)} 
        className="mobile-wizard-input-text"
        placeholder={placeholder}
      />
    </div>
  );
}
