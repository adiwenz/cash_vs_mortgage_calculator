
export default function MobileSelectField({ label, value, onChange, options }) {
  return (
    <div className="form-group-item">
      <label className="form-group-label">{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="mobile-wizard-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
