import { derivePhasesFromEvents } from '../phases.js';

export function deriveBudgetPhasesStage(profile, events, rawPhases) {
  return derivePhasesFromEvents(profile, events, rawPhases || []);
}
