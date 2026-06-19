import { 
  Trash2, 
  Copy, 
  Edit,
  Info
} from 'lucide-react';
import { formatCurrency } from '../helpers';
import { getEventFriendlyTitle, getEventIcon } from './mobileWizardUtils';

export default function ReviewStep({
  step, // 6 (Confirm) or 8 (Manage)
  draftEvent,
  hasEndAge,
  startAgeVal,
  endAgeVal,
  primaryCta,
  onConfirm,
  onEdit,
  onDuplicate,
  onDelete,
  onClose
}) {
  const eventNameDisplay = getEventFriendlyTitle(
    draftEvent.type,
    draftEvent.borrowingType,
    draftEvent.name,
    draftEvent.childName
  );
  const icon = getEventIcon(draftEvent.type, draftEvent.borrowingType);

  // STEP 6: Confirm Event
  if (step === 6) {
    return (
      <div className="mobile-wizard-step-content animate-slide-up">
        <h3 className="mobile-wizard-title">Review Event</h3>

        <div className="confirm-summary-card">
          <div className="confirm-header">
            <span className="confirm-icon">{icon}</span>
            <div className="confirm-title-col">
              <span className="confirm-name">{eventNameDisplay}</span>
              <span className="confirm-age">Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}</span>
            </div>
          </div>

          <div className="confirm-grid">
            <div className="confirm-item">
              <span className="confirm-lbl">Starts</span>
              <strong className="confirm-val">Age {startAgeVal}</strong>
            </div>
            {hasEndAge && (
              <div className="confirm-item">
                <span className="confirm-lbl">Ends</span>
                <strong className="confirm-val">Age {endAgeVal}</strong>
              </div>
            )}

            {draftEvent.type === 'haveChild' && (
              <>
                <div className="confirm-item">
                  <span className="confirm-lbl">Children</span>
                  <strong className="confirm-val">{draftEvent.childCount || 1}</strong>
                </div>
                <div className="confirm-item">
                  <span className="confirm-lbl">Annual Cost</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.customAges0to4 || 15000)}</strong>
                </div>
              </>
            )}

            {draftEvent.type === 'careerChange' && (
              <>
                <div className="confirm-item">
                  <span className="confirm-lbl">Salary</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.amount || 150000)}</strong>
                </div>
                <div className="confirm-item">
                  <span className="confirm-lbl">Annual raise</span>
                  <strong className="confirm-val">{(draftEvent.growthRate || 3.5)}%</strong>
                </div>
              </>
            )}

            {draftEvent.type === 'borrowing' && (
              <>
                <div className="confirm-item">
                  <span className="confirm-lbl">Balance</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.balance || 0)}</strong>
                </div>
                <div className="confirm-item">
                  <span className="confirm-lbl">Interest</span>
                  <strong className="confirm-val">{(draftEvent.interestRate || 5)}%</strong>
                </div>
                <div className="confirm-item">
                  <span className="confirm-lbl">Min. Payment</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.minPayment || 0)}/mo</strong>
                </div>
              </>
            )}

            {draftEvent.type === 'buyHouse' && (
              <>
                <div className="confirm-item">
                  <span className="confirm-lbl">Home Price</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.homePrice || 500000)}</strong>
                </div>
                <div className="confirm-item">
                  <span className="confirm-lbl">Down Payment</span>
                  <strong className="confirm-val">{formatCurrency(draftEvent.downPayment || 100000)}</strong>
                </div>
              </>
            )}

            {draftEvent.notes && (
              <div className="confirm-item" style={{ gridColumn: 'span 2' }}>
                <span className="confirm-lbl">Notes</span>
                <p className="confirm-notes">{draftEvent.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Buttons */}
        <div className="mobile-wizard-footer">
          <button 
            type="button" 
            className="mobile-wizard-btn-primary"
            onClick={onConfirm}
          >
            {primaryCta}
          </button>
          <button 
            type="button" 
            className="mobile-wizard-btn-link"
            onClick={onEdit}
          >
            Edit Details
          </button>
        </div>
      </div>
    );
  }

  // STEP 8: EDIT / MANAGE Details Screen
  if (step === 8) {
    return (
      <div className="mobile-wizard-step-content animate-slide-up">
        
        {/* Event Badge Summary */}
        <div className="manage-event-badge">
          <span className="manage-event-icon">{icon}</span>
          <div className="manage-event-header-col">
            <h3 className="manage-event-name">{eventNameDisplay}</h3>
            <span className="manage-event-age">Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}</span>
          </div>
        </div>

        {/* Actions Stack */}
        <div className="manage-actions-list">
          <button 
            type="button" 
            className="manage-action-row"
            onClick={onEdit}
          >
            <div className="action-left">
              <Edit size={18} className="action-icon purple" />
              <span>Edit Event Details</span>
            </div>
            <span className="action-arrow">→</span>
          </button>

          <button 
            type="button" 
            className="manage-action-row"
            onClick={onDuplicate}
          >
            <div className="action-left">
              <Copy size={18} className="action-icon blue" />
              <span>Duplicate Event</span>
            </div>
            <span className="action-arrow">→</span>
          </button>

          {draftEvent?.type !== 'retire' && draftEvent?.type !== 'socialSecurity' && (
            <button 
              type="button" 
              className="manage-action-row delete"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this event? This will immediately remove it from your roadmap and recalculate your projection.")) {
                  onDelete();
                }
              }}
            >
              <div className="action-left">
                <Trash2 size={18} className="action-icon red" />
                <span>Delete Event</span>
              </div>
              <span className="action-arrow">→</span>
            </button>
          )}
        </div>

        {/* Event Timeline */}
        <h4 className="mobile-wizard-section-lbl" style={{ marginTop: '1.5rem' }}>Event Timeline</h4>
        <div className="manage-event-timeline">
          <div className="timeline-event-item">
            <div className="timeline-node" />
            <div className="timeline-text-col">
              <span className="timeline-age-lbl">Age {startAgeVal}</span>
              <span className="timeline-desc-lbl">{eventNameDisplay} Begins</span>
            </div>
          </div>
          {hasEndAge && (
            <div className="timeline-event-item">
              <div className="timeline-node" />
              <div className="timeline-text-col">
                <span className="timeline-age-lbl">Age {endAgeVal}</span>
                <span className="timeline-desc-lbl">{eventNameDisplay} Ends</span>
              </div>
            </div>
          )}
        </div>

        {/* About This Event details */}
        <h4 className="mobile-wizard-section-lbl" style={{ marginTop: '1.5rem' }}>About This Event</h4>
        <div className="manage-about-card">
          <Info size={16} className="about-info-icon" />
          <p className="about-text">
            {draftEvent.description || `This event affects your plan starting at Age ${startAgeVal}. Adjusting it recalculates your savings allocation rate and retirement sustainability age.`}
          </p>
        </div>

        {/* Footer Done Button */}
        <div className="mobile-wizard-footer">
          <button 
            type="button" 
            className="mobile-wizard-btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>

      </div>
    );
  }

  return null;
}
