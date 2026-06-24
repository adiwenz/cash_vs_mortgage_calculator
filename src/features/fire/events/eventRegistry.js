/**
 * Event registry definitions and metadata accessor helpers.
 */

export const REGISTRY = [
  {
    type: 'retire',
    aliases: ['retirement', 'retire'],
    label: 'Retirement',
    shortLabel: 'Stop Working',
    emoji: '🏖️',
    category: 'retirement',
    timelineCategory: 'majorEvent',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'socialSecurity',
    aliases: ['socialSecurity'],
    label: 'Social Security',
    shortLabel: 'Social Sec.',
    emoji: '🎂',
    category: 'income',
    timelineCategory: 'income',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'marriage',
    aliases: ['marriage', 'wedding'],
    label: 'Marriage',
    shortLabel: 'Marriage',
    emoji: '💍',
    category: 'household',
    timelineCategory: 'relationship',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'divorce',
    aliases: ['divorce'],
    label: 'Divorce',
    shortLabel: 'Divorce',
    emoji: '💔',
    category: 'household',
    timelineCategory: 'relationship',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'haveChild',
    aliases: ['haveChild', 'child', 'createChild'],
    label: 'Child',
    shortLabel: 'Have Child',
    emoji: '👶',
    category: 'child',
    timelineCategory: 'children',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'buyHouse',
    aliases: ['buyHouse', 'housePurchase', 'housing'],
    label: 'Home Purchase',
    shortLabel: 'Buy Home',
    emoji: '🏠',
    category: 'housing',
    timelineCategory: 'housing',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'careerChange',
    aliases: ['careerChange', 'career'],
    label: 'Career Change',
    shortLabel: 'Career',
    emoji: '💼',
    category: 'career',
    timelineCategory: 'income',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'move',
    aliases: ['move'],
    label: 'Move',
    shortLabel: 'Move',
    emoji: '📍',
    category: 'housing',
    timelineCategory: 'housing',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'debtPayoff',
    aliases: ['debtPayoff', 'payoff'],
    label: 'Debt Payoff',
    shortLabel: 'Payoff',
    emoji: '💸',
    category: 'debt',
    timelineCategory: 'debt',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'windfall',
    aliases: ['windfall', 'inheritance', 'windfall_change'],
    label: 'Windfall',
    shortLabel: 'Windfall',
    emoji: '💰',
    category: 'windfall',
    timelineCategory: 'majorEvent',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'promotion',
    aliases: ['promotion'],
    label: 'Promotion',
    shortLabel: 'Promotion',
    emoji: '📈',
    category: 'career',
    timelineCategory: 'income',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  },
  {
    type: 'expenseChange',
    aliases: ['expenseChange', 'lifestyle', 'spendingChange'],
    label: 'Expense Change',
    shortLabel: 'Lifestyle',
    emoji: '📉',
    category: 'lifestyle',
    timelineCategory: 'majorEvent',
    mobileFlow: null,
    desktopModal: null,
    isEditable: true,
    isDraggable: true,
    defaultAgeOffset: 0,
    createDefaultEvent: null
  }
];

// Fallback definition for unknown event types
const FALLBACK_DEFINITION = {
  aliases: [],
  label: '',
  shortLabel: '',
  emoji: '❓',
  category: 'other',
  timelineCategory: 'events',
  mobileFlow: null,
  desktopModal: null,
  isEditable: true,
  isDraggable: true,
  defaultAgeOffset: undefined,
  createDefaultEvent: null
};

/**
 * Returns the canonical event type, resolving aliases.
 * @param {string} type 
 * @returns {string}
 */
export function getCanonicalEventType(type) {
  if (!type) return '';
  const match = REGISTRY.find(item => item.type === type || item.aliases.includes(type));
  return match ? match.type : type;
}

/**
 * Returns the event definition from the registry (or a safe fallback).
 * @param {string} type 
 * @returns {object}
 */
export function getEventDefinition(type) {
  const canonical = getCanonicalEventType(type);
  const match = REGISTRY.find(item => item.type === canonical);
  if (match) return match;
  return {
    ...FALLBACK_DEFINITION,
    type: canonical || type
  };
}

/**
 * Returns the descriptive label for an event.
 * @param {object} event 
 * @returns {string}
 */
export function getEventLabel(event) {
  if (!event) return '';
  if (event.name) return event.name;
  if (event.title) return event.title;
  if (event.label) return event.label;

  const canonical = getCanonicalEventType(event.type);
  const def = getEventDefinition(canonical);
  return def.label || event.type || '';
}

/**
 * Returns the short label for rendering on timeline / mobile picker.
 * @param {object} event 
 * @returns {string}
 */
export function getEventShortLabel(event) {
  if (!event) return '';
  if (event.shortLabel) return event.shortLabel;

  const canonical = getCanonicalEventType(event.type);
  if (canonical === 'haveChild') {
    const label = getEventLabel(event);
    return label.replace('Have Child:', '').trim() || 'Have Child';
  }

  // Handle specific non-registry items that might have safe display in UI
  if (event.type === 'medicareEligibility') return 'Medicare';
  if (event.type === 'childSupportEnds') return 'Support Ends';
  if (event.type === 'sellHouse') return 'Sell Home';
  if (event.type === 'mortgageOff') return 'Mortgage Ends';
  if (event.type === 'college') return 'College';
  if (event.type === 'sabbatical') return 'Sabbatical';
  if (event.type === 'assetTransfer') return 'Transfer';
  if (event.type === 'borrowing') return 'Borrowing';
  if (event.type === 'payoffPlanEnd') return 'Loan Off';
  if (event.type === 'coastFire') return 'Coast FIRE';
  if (event.type && event.type.startsWith('retirementReady')) return 'Can Stop Working';

  const def = getEventDefinition(canonical);
  if (def.shortLabel) return def.shortLabel;

  let cleanLabel = getEventLabel(event);
  if (cleanLabel.includes(':')) {
    cleanLabel = cleanLabel.split(':')[0];
  }
  return cleanLabel;
}

/**
 * Returns the emoji or icon for an event.
 * @param {object} event 
 * @returns {string}
 */
export function getEventEmoji(event) {
  if (!event) return '';
  if (event.emoji) return event.emoji;
  if (event.icon) return event.icon;

  if (event.type === 'today' || event.type === 'lifeExpectancy') {
    return '';
  }
  if (event.type && event.type.startsWith('retirementReady')) {
    return '✓';
  }
  // Keep compatibility with legacy promotion icon check
  if (event.isPromotion || event.type === 'promotion') {
    return '📈';
  }
  // Keep compatibility with legacy retirement icon checks
  if (event.type === 'retirement') {
    return '🏖';
  }

  const canonical = getCanonicalEventType(event.type);
  const def = getEventDefinition(canonical);
  return def.emoji || '';
}

/**
 * Returns the timeline category for an event.
 * @param {object} event 
 * @returns {string}
 */
export function getEventTimelineCategory(event) {
  if (!event) return 'events';
  const canonical = getCanonicalEventType(event.type);
  const def = getEventDefinition(canonical);
  return def.timelineCategory || 'events';
}

/**
 * Returns whether the event can be dragged.
 * @param {object} event 
 * @returns {boolean}
 */
export function isEventDraggable(event) {
  if (!event) return false;
  const canonical = getCanonicalEventType(event.type);
  const def = getEventDefinition(canonical);
  return def.isDraggable !== undefined ? def.isDraggable : true;
}

/**
 * Returns whether the event is editable.
 * @param {object} event 
 * @returns {boolean}
 */
export function isEventEditable(event) {
  if (!event) return false;
  const canonical = getCanonicalEventType(event.type);
  const def = getEventDefinition(canonical);
  return def.isEditable !== undefined ? def.isEditable : true;
}
