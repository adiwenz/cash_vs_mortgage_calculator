import { getProfileFromInputs, getEventsFromInputs } from '../normalizeInputs.js';

export function applyEventsStage(normalizedInputs, timelineDetails) {
  const events = getEventsFromInputs(normalizedInputs);
  const profile = getProfileFromInputs(normalizedInputs);

  profile.socialSecurityDetails = timelineDetails.socialSecurityDetails;
  profile.spouseSocialSecurityDetails = timelineDetails.spouseSocialSecurityDetails;
  profile.year0Taxes = timelineDetails.year0Taxes;
  profile.spendingPhases = normalizedInputs.spendingPhases;
  profile.incomeList = normalizedInputs.incomeList;

  return {
    profile,
    events
  };
}
