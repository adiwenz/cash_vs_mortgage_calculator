import { test, expect } from '@playwright/test';

test.describe('FIRE & Life Simulator End-to-End Tests', () => {
  // Increase timeout for all tests to 60 seconds to prevent timeouts in slower browsers
  test.describe.configure({ timeout: 60000 });

  test('1. Default baseline flow', async ({ page }) => {
    // Navigate to the simulator
    await page.goto('/?tool=fire');

    // Verify default inputs are present in Step 1
    await expect(page.locator('div.input-wrapper:has-text("Current Age") input')).toHaveValue('35');
    await expect(page.locator('div.input-wrapper:has-text("Life Expectancy") input')).toHaveValue('85');
    await expect(page.locator('div.input-wrapper:has-text("Annual Income ($)") input')).toHaveValue('50000');
    await expect(page.locator('div.input-wrapper:has-text("Current Savings ($)") input')).toHaveValue('5000');

    // Click Build My Life Plan to run the simulation
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Verify Step 2 outcome text and retirement age
    await expect(page.getByRole('heading', { name: 'Retirement Plan Summary' })).toBeVisible();
    await expect(page.getByText('🟢 Comfortable')).toBeVisible();
    await expect(page.getByText('Your projected assets remain positive through your life expectancy plus 10 years safety buffer (Age 95).')).toBeVisible();
  });

  test('2. Budget allocation flow', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Open the Budget Builder Modal
    await page.getByRole('button', { name: '📊 Calculate from budget' }).click();

    // Verify modal is open
    await expect(page.getByText('Set Monthly Budget')).toBeVisible();

    // Verify default budget allocation values are present
    await expect(page.locator('.budget-input-row:has-text("401(k) (Pre-Tax)") input')).toHaveValue('200');
    await expect(page.locator('.budget-input-row:has-text("Roth IRA") input')).toHaveValue('100');
    await expect(page.locator('.budget-input-row:has-text("HSA") input')).toHaveValue('50');
    await expect(page.locator('.budget-input-row:has-text("Checking Account") input')).toHaveValue('100');
    await expect(page.locator('.budget-input-row:has-text("High-Yield Savings") input')).toHaveValue('100');
    await expect(page.locator('.budget-input-row:has-text("Emergency Fund") input')).toHaveValue('75');

    // Verify default expense allocation values are present
    await expect(page.locator('.budget-input-row:has-text("Housing (Rent/Mortgage)") input')).toHaveValue('1500');
    await expect(page.locator('.budget-input-row:has-text("Food & Dining Out") input')).toHaveValue('600');
    await expect(page.locator('.budget-input-row:has-text("Utilities & Subscriptions") input')).toHaveValue('300');

    // Verify that the allocations total correctly and show perfectly balanced, with no warning/deficit
    await expect(page.getByText('Perfectly balanced! $0 leftover')).toBeVisible();
    await expect(page.locator('.budget-reconciliation-panel').getByText('Balanced', { exact: true })).toBeVisible();
    await expect(page.getByText('Deficit')).not.toBeVisible();

    // Cancel modal
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('3. Child event flow', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Navigate to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Add child event
    await page.locator('select.add-event-dropdown').selectOption('haveChild');

    // Wait for event configuration modal and fill in child details
    await page.getByPlaceholder('e.g. Liam').fill('Liam');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // Child Impact Modal should pop up
    await expect(page.getByRole('heading', { name: 'Welcome, Liam!' })).toBeVisible();

    // Click Adjust Plan to open Retirement Improvement Plan
    await page.getByRole('button', { name: 'Adjust Plan', exact: true }).click();

    // Verify Improvement Plan modal is open and apply the "Earn More" scenario
    const earnMoreCard = page.locator('.improvement-plan-card:has-text("Earn More")');
    await earnMoreCard.getByRole('button', { name: 'Apply Scenario' }).click();

    // Verify Budget Builder modal opens and childcare phase toggle is visible
    const childcarePhaseBtn = page.getByRole('button', { name: '👶 1 Child' });
    await expect(childcarePhaseBtn).toBeVisible();

    // Switch to childcare phase
    await childcarePhaseBtn.click();

    // Verify Childcare & Support row is visible
    await expect(page.getByText('👶 Childcare & Support (Temporary)')).toBeVisible();


    // Save budget
    await page.getByRole('button', { name: 'Save Budget' }).click();

    // Verify outcome updates without showing N/A or broken states
    await expect(page.getByRole('heading', { name: 'Retirement Plan Summary' })).toBeVisible();
    await expect(page.getByText('🟢 Comfortable')).toBeVisible();
    await expect(page.getByText('NaN', { exact: true })).not.toBeVisible();
    await expect(page.getByText('N/A', { exact: true })).not.toBeVisible();
  });

  test('4. Debt flow', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Add debt payoff event
    await page.locator('select.add-event-dropdown').selectOption('debtPayoff');

    // Fill in debt payoff details to force net worth below $0 (e.g. $2M payoff at age 40)
    await page.locator('div.input-wrapper:has-text("Payoff Age") input').fill('40');
    await page.locator('div.input-wrapper:has-text("Payoff Amount ($)") input').fill('2000000');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // Verify that outcome details update to show a retirement gap and assets running out at age 40
    await expect(page.getByText('Your projected assets are projected to run out at Age 40 (before life expectancy).')).toBeVisible();
    await expect(page.getByText('Additional savings, later retirement, or reduced spending may be needed.')).toBeVisible();

    // Verify no broken/N/A or NaN state appears
    await expect(page.getByText('NaN', { exact: true })).not.toBeVisible();
    await expect(page.getByText('N/A', { exact: true })).not.toBeVisible();
  });

  test('5. Recommendation flow', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Click the Retirement event on the desktop timeline to open details panel
    const timelineNode = page.locator('.timeline-node:has-text("Target Retirement")');
    await timelineNode.click();

    // Click Edit Event in the details panel
    await page.getByRole('button', { name: '✏️ Edit Event' }).click();

    await page.locator('div.input-wrapper:has-text("Retirement Age") input').fill('55');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // The modal auto-pops when transitioning to shortfall. Close it first to test the banner manual trigger.
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // Verify Action Plan is available and click View Action Plan to reopen it
    await expect(page.getByText('💡 Action Plan Available:')).toBeVisible();
    await page.getByRole('button', { name: 'View Action Plan' }).click();

    // Verify only the intended recommendation cards (specifically Retire at 65) appear
    await expect(page.locator('.improvement-plan-card:has-text("Retire at Age 65")')).toBeVisible();
    await expect(page.locator('.improvement-plan-card:has-text("Save More")')).toBeVisible();
    await expect(page.locator('.improvement-plan-card:has-text("Earn More")')).toBeVisible();

    // Close the Action Plan modal
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  });

  test('6. Real vs nominal display flow', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Verify default view is nominal / future dollars
    await expect(page.getByText('$81,920 / yr')).toBeVisible();
    await expect(page.getByText('$996,380', { exact: true })).toBeVisible();

    // Toggle to "Today's Dollars" (real dollars)
    await page.getByRole('button', { name: 'Today’s Dollars' }).click();

    // Verify chart/result labels adjust to Today's Dollars
    await expect(page.getByText('$33,750 / yr')).toBeVisible();
    await expect(page.getByText('$410,495', { exact: true })).toBeVisible();

    // Toggle back to "Future Dollars"
    await page.getByRole('button', { name: 'Future Dollars' }).click();

    // Verify it changes back to Future Dollars
    await expect(page.getByText('$81,920 / yr')).toBeVisible();
    await expect(page.getByText('$996,380', { exact: true })).toBeVisible();
  });

  test('7. Multi-child scenario with compounding adjustments and baseline matching', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // Verify initial default baseline values
    await expect(page.getByText('$81,920 / yr')).toBeVisible();
    await expect(page.getByText('$996,380', { exact: true })).toBeVisible();

    // 1. Add first child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Liam');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // Assert Child Welcome modal appears
    await expect(page.getByRole('heading', { name: 'Welcome, Liam!' })).toBeVisible();

    // Click Adjust Plan
    await page.getByRole('button', { name: 'Adjust Plan', exact: true }).click();

    // Assert Recommendations modal is open
    await expect(page.getByRole('heading', { name: '💡 Retirement Improvement Plan' })).toBeVisible();

    // Click Apply Scenario on Earn More
    await page.locator('.improvement-plan-card:has-text("Earn More")').getByRole('button', { name: 'Apply Scenario' }).click();

    // Switch to Childcare Phase
    await page.getByRole('button', { name: '👶 1 Child' }).click();

    // Verify that the take-home income is boosted by 1250 over the baseline (4167 + 1250 = 5417)
    await expect(page.getByText('+$1,250/mo child boost')).toBeVisible();
    await expect(page.locator('div.input-wrapper:has-text("Monthly Take-home Income ($)") input')).toHaveValue('5417');

    // Save Budget
    await page.getByRole('button', { name: 'Save Budget' }).click();

    // Verify resulting NW graph matches default case (same portfolio/income numbers) within rounding tolerance
    await expect(page.getByText(/^\$81,9[23]\d \/ yr$/)).toBeVisible();
    await expect(page.getByText(/^\$996,3\d\d$/)).toBeVisible();

    // 2. Add second child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Emma');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // Assert Child Welcome modal appears
    await expect(page.getByRole('heading', { name: 'Welcome, Emma!' })).toBeVisible();

    // Click Adjust Plan
    await page.getByRole('button', { name: 'Adjust Plan', exact: true }).click();

    // Assert Recommendations modal is open again
    await expect(page.getByRole('heading', { name: '💡 Retirement Improvement Plan' })).toBeVisible();

    // Click Apply Scenario on Earn More again
    await page.locator('.improvement-plan-card:has-text("Earn More")').getByRole('button', { name: 'Apply Scenario' }).click();

    // Switch to Childcare Phase
    await page.getByRole('button', { name: '👶 2 Kids' }).click();

    // Verify that the take-home income is boosted by 2500 over the baseline (4167 + 2500 = 6667)
    await expect(page.getByText('+$2,500/mo child boost')).toBeVisible();
    await expect(page.locator('div.input-wrapper:has-text("Monthly Take-home Income ($)") input')).toHaveValue('6667');

    // Save Budget
    await page.getByRole('button', { name: 'Save Budget' }).click();

    // Verify resulting NW graph matches default case again within rounding tolerance
    await expect(page.getByText(/^\$81,9[23]\d \/ yr$/)).toBeVisible();
    await expect(page.getByText(/^\$996,3\d\d$/)).toBeVisible();

    // 3. Add third child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Sophia');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // Assert Child Welcome modal appears
    await expect(page.getByRole('heading', { name: 'Welcome, Sophia!' })).toBeVisible();

    // Click Adjust Plan
    await page.getByRole('button', { name: 'Adjust Plan', exact: true }).click();

    // Assert Recommendations modal is open again
    await expect(page.getByRole('heading', { name: '💡 Retirement Improvement Plan' })).toBeVisible();

    // Click Apply Scenario on Earn More again
    await page.locator('.improvement-plan-card:has-text("Earn More")').getByRole('button', { name: 'Apply Scenario' }).click();

    // Switch to Childcare Phase
    await page.getByRole('button', { name: '👶 3 Kids' }).click();

    // Verify that the take-home income is boosted by 3750 over the baseline (4167 + 3750 = 7917)
    await expect(page.getByText('+$3,750/mo child boost')).toBeVisible();
    await expect(page.locator('div.input-wrapper:has-text("Monthly Take-home Income ($)") input')).toHaveValue('7917');

    // Save Budget
    await page.getByRole('button', { name: 'Save Budget' }).click();

    // Verify resulting NW graph matches default case again within rounding tolerance
    await expect(page.getByText(/^\$81,9[23]\d \/ yr$/)).toBeVisible();
    await expect(page.getByText(/^\$996,3\d\d$/)).toBeVisible();
  });

  test('8. Staggered children timeline with dynamic budget phases', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // 1. Add first child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Liam');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 2. Add second child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Emma');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 3. Add third child
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Sophia');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 4. Slide/Edit third child (Sophia) birth age to parent age 53
    const sophiaNode = page.locator('.timeline-node:has-text("Have Child: Sophia")');
    await sophiaNode.click();
    await page.getByRole('button', { name: '✏️ Edit Event' }).click();
    await page.locator('div.input-wrapper:has-text("Parent\'s Age when Born") input').fill('53');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 5. Open Budget Builder Modal
    await page.getByRole('button', { name: 'Set Budget', exact: true }).click();

    // 6. Verify modal is open
    await expect(page.getByText('Set Monthly Budget')).toBeVisible();

    // 7. Verify occurring child count tabs are present (👶 1 Child, 👶 2 Kids)
    // 👶 3 Kids should NOT be present because the childcare phases do not overlap to 3 (first two exit at age 50, Sophia born at 53)
    await expect(page.getByRole('button', { name: '👶 1 Child' })).toBeVisible();
    await expect(page.getByRole('button', { name: '👶 2 Kids' })).toBeVisible();
    await expect(page.getByRole('button', { name: '👶 3 Kids' })).not.toBeVisible();

    // Cancel modal
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // 8. Verify retirement net worth is correct (no artificial compound surplus cash)
    await expect(page.getByText('NaN', { exact: true })).not.toBeVisible();
    await expect(page.getByText('N/A', { exact: true })).not.toBeVisible();
  });

  test('9. Staggered kids chronological intervals budget default values and scaling', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // 1. Add first child (Liam, born at age 35)
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Liam');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 2. Add second child (Emma, born at age 40)
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Emma');
    await page.locator('div.input-wrapper:has-text("Parent\'s Age when Born") input').fill('40');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 3. Open Budget Builder Modal
    await page.getByRole('button', { name: 'Set Budget', exact: true }).click();

    // 4. Verify there are four segmented control tabs
    const tabs = page.locator('.budget-modal-card .segmented-control-btn');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('1 Child');
    await expect(tabs.nth(1)).toContainText('2 Kids');
    await expect(tabs.nth(2)).toContainText('1 Child');
    await expect(tabs.nth(3)).toContainText('Standard Work Phase');

    // 5. Check first 1 Child tab (Interval 0: 35-40)
    await tabs.nth(0).click();
    await expect(page.getByText('+$1,250/mo child boost')).toBeVisible();
    await expect(page.locator('div.budget-input-row:has-text("Roadmap child event cost") input[type="text"]')).toHaveValue('1250');

    // 6. Check 2 Kids tab (Interval 1: 40-53)
    await tabs.nth(1).click();
    await expect(page.getByText('+$2,500/mo child boost')).toBeVisible();
    await expect(page.locator('div.budget-input-row:has-text("Roadmap child event cost") input[type="text"]')).toHaveValue('2500');

    // 7. Check second 1 Child tab (Interval 2: 53-58)
    await tabs.nth(2).click();
    await expect(page.getByText('+$1,250/mo child boost')).toBeVisible();
    await expect(page.locator('div.budget-input-row:has-text("Roadmap child event cost") input[type="text"]')).toHaveValue('1250');

    // 8. Check Standard Work Phase tab (Interval 3: 58+)
    await tabs.nth(3).click();
    await expect(page.getByText('child boost')).not.toBeVisible();
    await expect(page.locator('div:has-text("Roadmap child event cost")')).not.toBeVisible();

    // Cancel modal
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('10. Edit child to include college and verify modal triggers', async ({ page }) => {
    await page.goto('/?tool=fire');

    // Go to Step 2
    await page.getByRole('button', { name: 'Build My Life Plan →' }).click();

    // 1. Add first child (Liam, born at age 35) without college
    await page.locator('select.add-event-dropdown').selectOption('haveChild');
    await page.getByPlaceholder('e.g. Liam').fill('Liam');
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // Close child welcome modal

    // 2. Click on the child node to edit
    const liamNode = page.locator('.timeline-node:has-text("Have Child: Liam")');
    await liamNode.click();
    await page.getByRole('button', { name: '✏️ Edit Event' }).click();

    // 3. Verify college cost text is visible under the checkbox
    await expect(page.getByText('Adds an additional $15,000/yr per child')).toBeVisible();

    // 4. Check the Include College checkbox
    await page.locator('input#include-college').check();

    // 5. Save the event
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();

    // 6. Verify that the Child Welcome/Impact modal is displayed (since the edit impacted the ready age/shortfall)
    await expect(page.getByRole('heading', { name: 'Welcome, Liam!' })).toBeVisible();
    await expect(page.getByText('Estimated Child Costs:')).toBeVisible();

    // Close the welcome modal
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  });

});

