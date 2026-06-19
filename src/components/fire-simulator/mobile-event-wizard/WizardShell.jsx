import { ArrowLeft, X } from 'lucide-react';

export default function WizardShell({
  step,
  onBack,
  onClose,
  title,
  children
}) {
  return (
    <div className="mobile-wizard-backdrop">
      <div className="mobile-wizard-container">
        
        {/* HEADER */}
        <header className="mobile-wizard-header">
          {step > 2 && step !== 7 ? (
            <button type="button" className="mobile-wizard-header-btn" onClick={onBack}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <button type="button" className="mobile-wizard-header-btn" onClick={onClose}>
              <X size={22} />
            </button>
          )}
          
          <h2 className="mobile-wizard-header-title">
            {title}
          </h2>
          
          <div style={{ width: '40px' }} /> {/* Spacer */}
        </header>

        {/* BODY */}
        <main className="mobile-wizard-body">
          {children}
        </main>
      </div>
    </div>
  );
}
