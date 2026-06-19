import { getEventFriendlyTitle, getEventIcon } from './mobileWizardUtils';

export default function WizardStepHeader({
  draftEvent,
  startAgeVal,
  hasEndAge,
  endAgeVal
}) {
  const icon = getEventIcon(draftEvent.type, draftEvent.borrowingType);
  const nameDisplay = getEventFriendlyTitle(
    draftEvent.type,
    draftEvent.borrowingType,
    draftEvent.name,
    draftEvent.childName
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
      <span style={{ fontSize: '1.75rem' }}>{icon}</span>
      <div>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>{nameDisplay}</h4>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          Active Age {startAgeVal}{hasEndAge && `–${endAgeVal}`}
        </span>
      </div>
    </div>
  );
}
