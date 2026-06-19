
export default function MobileToggleRow({ 
  label, 
  description, 
  checked, 
  onChange, 
  className = "mobile-switch" 
}) {
  return (
    <div className="form-group-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
      <div style={{ paddingRight: '0.5rem' }}>
        <label className="form-group-label" style={{ marginBottom: 0 }}>{label}</label>
        {description && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '0.15rem' }}>
            {description}
          </span>
        )}
      </div>
      <div>
        <label className={className}>
          <input 
            type="checkbox" 
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="slider-round"></span>
        </label>
      </div>
    </div>
  );
}
