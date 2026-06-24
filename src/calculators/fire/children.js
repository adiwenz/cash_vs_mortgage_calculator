import { getChildEventBirthAge } from '../../utils/childEventHelpers.js';

export function calculateYearlyChildCosts(age, enabledEvents, profile, currentAge, customChildren, nominalFactor) {
  let yearChildCostsToday = 0;
  enabledEvents.forEach(ev => {
    if (ev.type === 'haveChild') {
      const birthAge = getChildEventBirthAge(ev) || 30;
      const childStartAge = Number(ev.childStartAge !== undefined ? ev.childStartAge : 0);
      const childAge = age - birthAge;

      if (childAge >= childStartAge) {
        const includeCollege = ev.includeCollege !== undefined ? ev.includeCollege : false;
        const maxAge = includeCollege ? 22 : 18;

        if (childAge < maxAge) {
          const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (profile.childCosts?.ages0to4 !== undefined ? Number(profile.childCosts.ages0to4) : 15000);
          const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (profile.childCosts?.ages5to12 !== undefined ? Number(profile.childCosts.ages5to12) : 15000);
          const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (profile.childCosts?.ages13to18 !== undefined ? Number(profile.childCosts.ages13to18) : 15000);
          const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (profile.childCosts?.ages19to22 !== undefined ? Number(profile.childCosts.ages19to22) : 15000);

          let annualCost = 0;
          if (childAge >= 0 && childAge <= 4) {
            annualCost = ages0to4;
          } else if (childAge >= 5 && childAge <= 12) {
            annualCost = ages5to12;
          } else if (childAge >= 13 && childAge <= 18) {
            annualCost = ages13to18;
          } else if (childAge >= 19 && childAge <= 22) {
            annualCost = ages19to22;
          }
          yearChildCostsToday += annualCost;
        }
      }
    }
  });
  let yearChildCosts = yearChildCostsToday * nominalFactor;
  customChildren.forEach(c => {
    if (age >= currentAge && (c.endAge === null || age < c.endAge)) {
      const yearsElapsed = age - currentAge;
      const costForYear = (c.monthlyCost * 12) * Math.pow(1 + c.growthRate, yearsElapsed);
      yearChildCosts += costForYear;
    }
  });
  return yearChildCosts;
}
