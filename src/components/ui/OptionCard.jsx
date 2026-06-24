import React from 'react';

export default function OptionCard({
  selected,
  onClick,
  label,
  description,
  icon,
  disabled = false,
  style,
  ...props
}) {
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (onClick) onClick();
    }
  };

  const activeBg = 'var(--primary-light, rgba(22, 163, 74, 0.08))';
  const activeBorder = 'var(--primary, #16a34a)';
  const inactiveBg = '#ffffff';
  const inactiveBorder = 'var(--border, #e5e7eb)';

  return (
    <div
      role="button"
      aria-pressed={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: 'var(--radius-md, 14px)',
        border: `2px solid ${selected ? activeBorder : inactiveBorder}`,
        backgroundColor: selected ? activeBg : inactiveBg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        outline: 'none',
        transition: 'all var(--transition-fast, 0.15s ease)',
        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
        textAlign: 'left',
        ...style
      }}
      {...props}
    >
      {icon && (
        <div style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary, #1f2937)' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #6b7280)', marginTop: '0.15rem' }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
