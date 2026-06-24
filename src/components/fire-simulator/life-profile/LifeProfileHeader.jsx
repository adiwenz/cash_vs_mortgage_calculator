import { ChevronLeft, X } from 'lucide-react';

export default function LifeProfileHeader({
  isMobile,
  activeTab,
  navStack,
  popScreenAndSave,
  onClose,
  mobileScreenTitle
}) {
  if (isMobile) {
    return (
      <div className="life-profile-mobile-header">
        {navStack.length > 1 && activeTab !== 'timeline' ? (
          <button type="button" className="life-profile-mobile-back-btn" onClick={popScreenAndSave}>
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        ) : (
          <div style={{ width: 60 }} />
        )}
        
        <span className="life-profile-mobile-title">
          {activeTab === 'timeline' ? 'Timeline' : mobileScreenTitle}
        </span>
        
        <button type="button" className="life-profile-mobile-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="life-profile-modal-header">
      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
        💼 Life Planner
      </h3>
      <button type="button" className="life-profile-modal-close-btn" onClick={onClose}>
        &times;
      </button>
    </div>
  );
}
