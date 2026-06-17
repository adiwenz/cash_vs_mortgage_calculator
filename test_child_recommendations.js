import { getChildCostOffsetRecommendations } from './src/recommendations.js';
import { runFireSimulation, getNormalizedPhases } from './src/fireCalculations.js';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs.js';

console.log('--- Running test_child_recommendations ---');

// helper assertion function
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

try {
  // Setup standard base inputs
  const baseInputs = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
  baseInputs.currentAge = 35;
  baseInputs.targetRetirementAge = 65;
  baseInputs.lifeExpectancy = 85;
  baseInputs.simpleIncome = 100000;
  baseInputs.simpleExpenses = 60000;

  // Create a child event
  const childEvent = {
    id: 'child-1',
    type: 'haveChild',
    enabled: true,
    name: 'Have a Child',
    childName: 'Emma',
    birthAge: 35,
    childStartAge: 0,
    costMethod: 'custom',
    customAges0to4: 15000,
    customAges5to12: 15000,
    customAges13to18: 15000,
    customAges19to22: 15000,
    includeCollege: false
  };
  baseInputs.lifeEvents = [childEvent];

  // 1. Childcare recommendation creates a Career Change event.
  const recs = getChildCostOffsetRecommendations(baseInputs);
  assert(recs.length === 1, 'Should return exactly 1 recommendation');
  const rec = recs[0];
  const promo = {
    id: `promo-${rec.childEventId}`,
    type: 'careerChange',
    name: rec.childName ? `Promotion (${rec.childName})` : 'Get a Promotion',
    startAge: rec.parentStartAge,
    endAge: baseInputs.targetRetirementAge,
    growthRate: 0.03,
    isTaxable: true,
    amount: rec.peakCost,
    salaryIncrease: rec.peakCost,
    incomeChangeType: 'increaseByAmount',
    permanent: true,
    parentEventId: rec.childEventId
  };
  assert(promo !== undefined, 'Recommendation should contain a promoEvent');
  assert(promo.type === 'careerChange', `Promo type should be careerChange, got ${promo.type}`);
  console.log('✅ Test 1 Passed: Recommendation creates a Career Change event.');

  // 2. The Career Change event starts at the child's start age.
  assert(promo.startAge === 35, `Promo start age should be 35, got ${promo.startAge}`);
  console.log('✅ Test 2 Passed: Career Change event starts at child birth/start age.');

  // 3. The salary increase equals the childcare annual cost.
  assert(promo.salaryIncrease === 15000, `Expected salaryIncrease of 15000, got ${promo.salaryIncrease}`);
  console.log('✅ Test 3 Passed: Salary increase equals childcare cost.');

  // 4. The income increase remains active after childcare ends.
  const inputsWithPromo = JSON.parse(JSON.stringify(baseInputs));
  inputsWithPromo.incomeList = [...(inputsWithPromo.incomeList || []), promo];
  const phases = getNormalizedPhases(inputsWithPromo);
  // Childcare spans 35-53 (18 years). After 53, standard working phase is 53-65.
  const postChildcarePhase = phases.find(p => p.startAge === 53 && p.endAge === 65);
  assert(postChildcarePhase !== undefined, 'Should have a post-childcare working phase 53-65');
  // Monthly base income without promo is 100,000 / 12 = 8333.
  // With promo of 15,000/yr (1250/mo), the post-childcare phase should have income = 8333 + 1250 = 9583.
  assert(postChildcarePhase.income >= 9583, `Post-childcare phase income should be >= 9583, got ${postChildcarePhase.income}`);
  console.log('✅ Test 4 Passed: Income increase remains active after childcare ends.');

  // 5. The linked child/promotion relationship is created correctly.
  // When applying, child event gets linkedEventId, promo event gets parentEventId.
  const appliedInputs = JSON.parse(JSON.stringify(baseInputs));
  const appliedPromo = { ...promo };
  appliedInputs.incomeList = [...(appliedInputs.incomeList || []), appliedPromo];
  appliedInputs.lifeEvents = appliedInputs.lifeEvents.map(ev => {
    if (ev.id === appliedPromo.parentEventId) {
      return { ...ev, linkedEventId: appliedPromo.id };
    }
    return ev;
  });
  const linkedChild = appliedInputs.lifeEvents.find(ev => ev.id === 'child-1');
  assert(linkedChild.linkedEventId === appliedPromo.id, `Child should be linked to promo ID ${appliedPromo.id}`);
  assert(appliedPromo.parentEventId === 'child-1', 'Promo should have parentEventId child-1');
  console.log('✅ Test 5 Passed: Child/promotion linked relationship created correctly.');

  // 6. Deleting the child event removes the auto-generated promotion event.
  let remainingIncomes = (appliedInputs.incomeList || []).filter(i => i.id !== linkedChild.linkedEventId && i.parentEventId !== linkedChild.id);
  assert(remainingIncomes.length === baseInputs.incomeList.length, 'Deleting child event should remove linked promotion event from incomeList');
  assert(!remainingIncomes.some(i => i.id === linkedChild.linkedEventId || i.parentEventId === linkedChild.id), 'Linked promotion event should not be in remainingIncomes');
  console.log('✅ Test 6 Passed: Deleting child event removes linked promotion.');

  // 7. Editing childcare costs updates future recommendation calculations.
  const updatedChild = {
    ...linkedChild,
    customAges0to4: 20000,
    customAges5to12: 20000,
    customAges13to18: 20000
  };
  const birthAgeVal = Number(updatedChild.birthAge) || 30;
  const childStartAgeVal = Number(updatedChild.childStartAge) || 0;
  const includeCollegeVal = !!updatedChild.includeCollege;
  const maxAgeVal = includeCollegeVal ? 22 : 18;
  
  const ages0to4Val = updatedChild.costMethod === 'custom' ? Number(updatedChild.customAges0to4) : 15000;
  const ages5to12Val = updatedChild.costMethod === 'custom' ? Number(updatedChild.customAges5to12) : 15000;
  const ages13to18Val = updatedChild.costMethod === 'custom' ? Number(updatedChild.customAges13to18) : 15000;
  
  const costsVal = [];
  if (childStartAgeVal <= 4) costsVal.push(ages0to4Val);
  if (childStartAgeVal <= 12 && maxAgeVal >= 5) costsVal.push(ages5to12Val);
  if (childStartAgeVal <= 18 && maxAgeVal >= 13) costsVal.push(ages13to18Val);
  
  const peakCostVal = Math.max(...costsVal, 0);
  const newPromoStartAgeVal = birthAgeVal + childStartAgeVal;

  const syncedIncomes = appliedInputs.incomeList.map(inc => {
    if (inc.id === updatedChild.linkedEventId || inc.parentEventId === updatedChild.id) {
      return {
        ...inc,
        startAge: newPromoStartAgeVal,
        salaryIncrease: peakCostVal,
        name: updatedChild.childName ? `Promotion (${updatedChild.childName})` : 'Get a Promotion'
      };
    }
    return inc;
  });
  const updatedPromo = syncedIncomes.find(inc => inc.id === promo.id);
  assert(updatedPromo.salaryIncrease === 20000, `Synced salaryIncrease should be 20000, got ${updatedPromo.salaryIncrease}`);
  console.log('✅ Test 7 Passed: Editing childcare costs updates linked promotion salaryIncrease.');

  // 8. Retirement readiness improves after applying the promotion recommendation.
  const baselineResults = runFireSimulation(baseInputs);
  const promoResults = runFireSimulation(inputsWithPromo);
  assert(promoResults.retirementReadyAge !== null, 'Promo scenario should have valid retirementReadyAge');
  if (baselineResults.retirementReadyAge !== null) {
    assert(promoResults.retirementReadyAge <= baselineResults.retirementReadyAge, 
      `Promo retirement ready age (${promoResults.retirementReadyAge}) should be <= baseline (${baselineResults.retirementReadyAge})`);
  }
  console.log('✅ Test 8 Passed: Retirement readiness improves/preserves after applying promotion.');

  console.log('--- ALL test_child_recommendations PASSED ---');
  process.exit(0);
} catch (err) {
  console.error('❌ test_child_recommendations failed with error:', err);
  process.exit(1);
}
