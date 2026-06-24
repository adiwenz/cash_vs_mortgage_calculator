import React, { useEffect } from 'react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  emoji,
  children,
  footer,
  className,
  containerClassName
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
      className={`mobile-bottom-sheet-backdrop ${className || ''}`}
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
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        className={`mobile-bottom-sheet-container ${containerClassName || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '1.5rem',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          maxHeight: '92vh',
          overflowY: 'auto',
          color: '#1e293b'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="mobile-bottom-sheet-drag-handle"
          style={{
            width: '36px',
            height: '4px',
            backgroundColor: '#cbd5e1',
            borderRadius: '2px',
            margin: '-0.5rem auto 1rem auto'
          }}
        />

        {/* Header / Hero */}
        {(title || emoji || description) && (
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            {emoji && (
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.1)', // Pale green background
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem auto'
              }}>
                <span style={{ fontSize: '2rem' }}>{emoji}</span>
              </div>
            )}
            {title && (
              <h3 id="bottom-sheet-title" style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: '#0f172a' }}>
                {title}
              </h3>
            )}
            {description && (
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0', fontWeight: '500', lineHeight: '1.4' }}>
                {description}
              </p>
            )}
            <div style={{ borderBottom: '1px solid #e5e7eb', width: '100%' }} />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: footer ? '1.5rem' : 0 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: 'auto' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
