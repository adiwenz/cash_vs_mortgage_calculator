export function calculateChildCostDuration(event) {
  if (!event) return 0;
  const childStartAge = Number(event.childStartAge !== undefined ? event.childStartAge : 0);
  const includeCollege = event.includeCollege !== undefined ? event.includeCollege : false;
  const maxAge = includeCollege ? 22 : 18;
  return Math.max(0, maxAge - childStartAge);
}

export function calculateChildcareCostPhaseImpact(event, inputs) {
  if (!event) return { peakCost: 0, parentStartAge: 0, parentEndAge: 0, duration: 0 };
  const birthAge = Number(event.birthAge !== undefined ? event.birthAge : event.parentAgeAtBirth) || 30;
  const childStartAge = Number(event.childStartAge !== undefined ? event.childStartAge : 0);
  const includeCollege = event.includeCollege !== undefined ? event.includeCollege : false;
  const maxAge = includeCollege ? 22 : 18;
  
  const childCosts = inputs?.childCosts || {};
  const ages0to4 = event.costMethod === 'custom' ? (event.customAges0to4 !== undefined ? Number(event.customAges0to4) : 15000) : (childCosts.ages0to4 !== undefined ? Number(childCosts.ages0to4) : 15000);
  const ages5to12 = event.costMethod === 'custom' ? (event.customAges5to12 !== undefined ? Number(event.customAges5to12) : 15000) : (childCosts.ages5to12 !== undefined ? Number(childCosts.ages5to12) : 15000);
  const ages13to18 = event.costMethod === 'custom' ? (event.customAges13to18 !== undefined ? Number(event.customAges13to18) : 15000) : (childCosts.ages13to18 !== undefined ? Number(childCosts.ages13to18) : 15000);
  const ages19to22 = event.costMethod === 'custom' ? (event.customAges19to22 !== undefined ? Number(event.customAges19to22) : 15000) : (childCosts.ages19to22 !== undefined ? Number(childCosts.ages19to22) : 15000);
  
  const peakCost = Math.max(
    ages0to4,
    ages5to12,
    ages13to18,
    includeCollege ? ages19to22 : 0
  );
  
  const parentStartAge = birthAge + childStartAge;
  const parentEndAge = birthAge + maxAge;
  const duration = maxAge - childStartAge;

  return {
    peakCost,
    parentStartAge,
    parentEndAge,
    duration
  };
}
