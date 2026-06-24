import React, { useEffect } from 'react';

export default function AppModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '500px'
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="app-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        style={{
          width: '100%',
          maxWidth,
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg, 20px)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '1.5rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: 'var(--text-primary, #1e293b)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          {title && (
            <h3 id="app-modal-title" style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              lineHeight: '1',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, marginBottom: footer ? '1.5rem' : 0 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'end', gap: '0.75rem', marginTop: 'auto' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
