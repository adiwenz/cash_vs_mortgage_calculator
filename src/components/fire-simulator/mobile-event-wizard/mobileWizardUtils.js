export function getEventIcon(type, borrowingType) {
  if (type === 'borrowing') {
    if (borrowingType === 'studentLoan') return '🎓';
    if (borrowingType === 'carLoan') return '🚗';
    if (borrowingType === 'personalLoan') return '💸';
    return '💳';
  }
  const icons = {
    haveChild: '👶',
    marriage: '💍',
    careerChange: '💼',
    sabbatical: '🌴',
    buyHouse: '🏠',
    sellHouse: '🏠',
    move: '📍',
    studentLoan: '🎓',
    creditCard: '💳',
    carLoan: '🚗',
    personalLoan: '💸',
    debtPayoff: '💸',
    college: '🎓',
    windfall: '💰',
    custom: '🎯',
    retire: '🏖️',
    socialSecurity: '💰',
    pension: '📜',
    rentalIncome: '🏢'
  };
  return icons[type] || '🎯';
}

export function getEventFriendlyTitle(type, borrowingType, name, childName) {
  if (!type) return 'Life Event';
  if (type === 'haveChild' && childName) {
    return `Child: ${childName}`;
  }
  if (name) return name;
  const labels = {
    haveChild: 'Child / Adoption',
    marriage: 'Marriage / Partner',
    careerChange: 'Career Change',
    sabbatical: 'Sabbatical',
    buyHouse: 'Home Purchase',
    sellHouse: 'Sell House',
    move: 'Move / Relocate',
    studentLoan: 'Student Loan',
    creditCard: 'Credit Card',
    carLoan: 'Auto Loan',
    personalLoan: 'Personal Loan',
    debtPayoff: 'Debt Payoff',
    college: 'College Tuition',
    windfall: 'Windfall / Inflow',
    custom: 'Custom Goal',
    retire: 'Stop Working',
    socialSecurity: 'Social Security',
    pension: 'Pension Inflow',
    rentalIncome: 'Rental Income'
  };
  const key = type === 'borrowing' ? borrowingType : type;
  return labels[key] || 'Life Event';
}

export function getWizardStepTitle(step, isNew) {
  if (step === 8) return 'Event Details';
  return isNew ? 'Add Life Event' : 'Edit Event';
}

export function getStartAge(evt, currentAge = 35) {
  if (!evt) return currentAge;
  const val = evt.purchaseAge !== undefined ? evt.purchaseAge :
              evt.birthAge !== undefined ? evt.birthAge :
              evt.startAge !== undefined ? evt.startAge :
              evt.claimingAge !== undefined ? evt.claimingAge :
              evt.ageReceived !== undefined ? evt.ageReceived :
              evt.moveAge !== undefined ? evt.moveAge :
              evt.age !== undefined ? evt.age :
              currentAge;
  return Number(val);
}

export function getEndAge(evt, currentAge = 35, lifeEvents = []) {
  if (!evt) return null;
  if (evt.type === 'haveChild') {
    const maxAge = evt.includeCollege ? 22 : 18;
    const birth = evt.birthAge !== undefined ? evt.birthAge : currentAge;
    return birth + maxAge;
  }
  if (evt.type === 'borrowing') {
    const payoff = lifeEvents?.find(e => e.type === 'payoffPlan' && e.borrowingId === evt.id);
    if (payoff) return Math.round(Number(payoff.payoffAge));
    return null;
  }
  return evt.endAge !== undefined ? Number(evt.endAge) : null;
}

export function setStartAge(evt, age) {
  const updated = { ...evt };
  const numAge = Number(age);
  if (evt.purchaseAge !== undefined) updated.purchaseAge = numAge;
  else if (evt.birthAge !== undefined) updated.birthAge = numAge;
  else if (evt.startAge !== undefined) updated.startAge = numAge;
  else if (evt.claimingAge !== undefined) updated.claimingAge = numAge;
  else if (evt.ageReceived !== undefined) updated.ageReceived = numAge;
  else if (evt.moveAge !== undefined) updated.moveAge = numAge;
  else if (evt.age !== undefined) updated.age = numAge;
  else {
    updated.age = numAge;
  }
  return updated;
}

export function setEndAge(evt, age, currentAge = 35) {
  const updated = { ...evt };
  const numAge = Number(age);
  if (evt.type === 'haveChild') {
    const start = getStartAge(evt, currentAge);
    const diff = numAge - start;
    updated.includeCollege = diff >= 20;
  } else {
    updated.endAge = numAge;
  }
  return updated;
}

export function getAgeRangeLabel(startAge, endAge, hasEndAge) {
  return hasEndAge && endAge ? `Age ${startAge}–${endAge}` : `Age ${startAge}`;
}

export function shouldShowRecommendationStep(draftEvent, shortfall, rankedPlan) {
  const isChildFlow = draftEvent?.type === 'haveChild';
  const isHouseFlow = draftEvent?.type === 'buyHouse';
  if (isChildFlow && shortfall && rankedPlan?.length > 0) return true;
  if (isHouseFlow) return true;
  return false;
}

export function getNextStep(currentStep) {
  if (currentStep === 2) return 3;
  if (currentStep === 3) return 4;
  if (currentStep === 4) return 5;
  if (currentStep === 5) return 6;
  return currentStep;
}

export function getPreviousStep(currentStep, isNew) {
  if (currentStep === 8) return 8;
  if (currentStep === 3 && isNew) return 2;
  if (currentStep === 3 && !isNew) return 8;
  return currentStep - 1;
}

export function buildDraftEventPatch(draftEvent, key, val) {
  return { ...draftEvent, [key]: val };
}

export function normalizeMobileDraftEvent(draftEvent) {
  return draftEvent;
}
