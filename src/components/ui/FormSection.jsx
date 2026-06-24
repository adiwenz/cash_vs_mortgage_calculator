import React from 'react';

export default function FormSection({ title, description, children, style, ...props }) {
  return (
    <div
      className="form-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        ...style
      }}
      {...props}
    >
      {(title || description) && (
        <div className="form-section-header" style={{ marginBottom: '0.25rem' }}>
          {title && (
            <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary, #1e293b)', margin: '0 0 0.25rem 0' }}>
              {title}
            </h4>
          )}
          {description && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div className="form-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {children}
      </div>
    </div>
  );
}
