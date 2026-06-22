import { ArrowLeft, X } from 'lucide-react';
import logoImg from '../../../assets/logo.png';

export default function WizardShell({
  step,
  onBack,
  onClose,
  title,
  children
}) {
  const isPicker = step === 2;
  
  return (
    <div className={`mobile-wizard-backdrop ${isPicker ? 'light-theme event-picker-theme' : ''}`}>
      <div className="mobile-wizard-container">
        
        {/* HEADER */}
        {isPicker ? (
          <header className="mobile-wizard-header light-theme">
            <div className="brand-section">
              <img src={logoImg} alt="Finley" className="brand-logo-img" style={{ height: '36px', objectFit: 'contain' }} />
            </div>
            
            <button type="button" className="mobile-wizard-header-btn light-theme" onClick={onClose} aria-label="Close">
              <X size={22} />
            </button>
          </header>
        ) : (
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
        )}

        {/* BODY */}
        <main className="mobile-wizard-body">
          {children}
        </main>
      </div>
    </div>
  );
}
