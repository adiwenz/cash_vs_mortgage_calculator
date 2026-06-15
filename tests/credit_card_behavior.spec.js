import { test, expect } from '@playwright/test';
// Verification comment for playwright only-changed

test.describe('Credit Card Behavior Simulator End-to-End Tests', () => {
  // Set a generous timeout
  test.describe.configure({ timeout: 60000 });

  test('1. Default inputs and behavior cards verification', async ({ page }) => {
    // Navigate to the credit card tool
    await page.goto('/?tool=creditcard');

    // Verify header is visible
    await expect(page.locator('.brand-title h1')).toHaveText('Credit Card Behavior');

    // Verify default input values (Carry Balance defaults)
    await expect(page.locator('#cc-input-balance')).toHaveValue('10000');
    await expect(page.locator('#cc-input-apr')).toHaveValue('24');
    await expect(page.locator('#cc-input-payment')).toHaveValue('200');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('0');

    // Verify Behavior Cards are present
    await expect(page.locator('#cc-scenario-card-payInFull')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-paydown')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-slowPaydown')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-carryBalance')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-interestTrap')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-budgetGap')).toBeVisible();

    // Verify metric cards exist
    await expect(page.locator('.cc-metric-card:has-text("Annual Credit Card Drag")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Lifetime Credit Card Drag")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Debt-Free Date")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Interest Saved")')).toBeVisible();

    // Verify educational explanation block exists
    await expect(page.locator('#cc-behavior-explanation-card')).toBeVisible();
    await expect(page.locator('#cc-behavior-explanation-card .explanation-title')).toHaveText('Carry Balance Explanation');
  });

  test('2. Behavior card switching and default sync', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Default active card is Carry Balance
    await expect(page.locator('#cc-scenario-card-carryBalance')).toHaveClass(/active/);

    // Click Payoff in Full card
    await page.locator('#cc-scenario-card-payInFull').click();
    await expect(page.locator('#cc-scenario-card-payInFull')).toHaveClass(/active/);
    await expect(page.locator('#cc-input-payment')).toHaveValue('10000');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('0');
    await expect(page.locator('#cc-behavior-explanation-card .explanation-title')).toHaveText('Payoff in Full Explanation');

    // Click Paydown card
    await page.locator('#cc-scenario-card-paydown').click();
    await expect(page.locator('#cc-scenario-card-paydown')).toHaveClass(/active/);
    await expect(page.locator('#cc-scenario-card-carryBalance')).not.toHaveClass(/active/);

    // Verify payment syncs to default (interest 200 + 300 = 500)
    await expect(page.locator('#cc-input-payment')).toHaveValue('500');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('0');
    await expect(page.locator('#cc-behavior-explanation-card .explanation-title')).toHaveText('Paydown Explanation');

    // Click Budget Gap card
    await page.locator('#cc-scenario-card-budgetGap').click();
    await expect(page.locator('#cc-scenario-card-budgetGap')).toHaveClass(/active/);
    await expect(page.locator('#cc-input-payment')).toHaveValue('200');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('300');
  });

  test('3. Reset button functionality and APR capping', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Modify the balance input
    const balanceInput = page.locator('#cc-input-balance');
    await balanceInput.fill('25000');
    await expect(balanceInput).toHaveValue('25000');

    // Try to set APR to 45, which should be capped at 36
    const aprInput = page.locator('#cc-input-apr');
    await aprInput.fill('45');
    await aprInput.blur();
    await expect(aprInput).toHaveValue('36');

    // Click Reset All
    await page.locator('.reset-btn').click();

    // Verify inputs are restored to defaults
    await expect(balanceInput).toHaveValue('10000');
    await expect(aprInput).toHaveValue('24');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('0');
    await expect(page.locator('#cc-scenario-card-carryBalance')).toHaveClass(/active/);
  });

  test('4. Tabbed chart toggling and visibility', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Tab switcher should be visible
    await expect(page.locator('#cc-chart-tabs-nav')).toBeVisible();

    // Default active tab should be 'drag' (Credit Card Drag Over Time)
    await expect(page.locator('#cc-tab-btn-drag')).toHaveClass(/active/);
    await expect(page.locator('#cc-drag-chart-card')).toBeVisible();
    await expect(page.locator('#cc-balance-chart-card')).not.toBeVisible();
    await expect(page.locator('#cc-payoff-scenarios-card')).not.toBeVisible();

    // Toggle to 'balance' tab
    await page.locator('#cc-tab-btn-balance').click();
    await expect(page.locator('#cc-tab-btn-balance')).toHaveClass(/active/);
    await expect(page.locator('#cc-balance-chart-card')).toBeVisible();
    await expect(page.locator('#cc-drag-chart-card')).not.toBeVisible();
    await expect(page.locator('#cc-payoff-scenarios-card')).not.toBeVisible();

    // Toggle to 'payoff' tab
    await page.locator('#cc-tab-btn-payoff').click();
    await expect(page.locator('#cc-tab-btn-payoff')).toHaveClass(/active/);
    await expect(page.locator('#cc-payoff-scenarios-card')).toBeVisible();
    await expect(page.locator('#cc-drag-chart-card')).not.toBeVisible();
    await expect(page.locator('#cc-balance-chart-card')).not.toBeVisible();
  });

  test('5. Alternate payoff scenarios bar chart values adjust to balance changes', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Switch to payoff tab
    await page.locator('#cc-tab-btn-payoff').click();

    // Check initial payment for 12 months (for $10,000 balance and 24% APR, it is ~$946)
    await expect(page.locator('#cc-payoff-scenarios-card')).toContainText('$946');

    // Modify the balance input to $5,000
    const balanceInput = page.locator('#cc-input-balance');
    await balanceInput.fill('5000');
    await balanceInput.blur();

    // For $5,000 balance and 24% APR, the 12 months payment should be ~$473
    await expect(page.locator('#cc-payoff-scenarios-card')).toContainText('$473');
  });

  test('6. Bidirectional slider sync when not overridden', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Verify initial payment is 200 (for 10000 balance and 24% APR, Carry Balance mode)
    await expect(page.locator('#cc-input-payment')).toHaveValue('200');

    // Move balance slider to 20000
    const balanceSlider = page.locator('#cc-slider-balance');
    await balanceSlider.fill('20000');

    // Since we are not in manual override mode, payment should automatically sync (interest = 20000 * 0.24 / 12 = 400)
    await expect(page.locator('#cc-input-payment')).toHaveValue('400');
  });

  test('7. Manual input overrides and reclassification warning', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Modify new spending to 300 (which puts us in Budget Gap)
    const newDebtInput = page.locator('#cc-input-newdebt');
    await newDebtInput.fill('300');
    await newDebtInput.blur();

    // Verify active card changed to Budget Gap
    await expect(page.locator('#cc-scenario-card-budgetGap')).toHaveClass(/active/);

    // Verify override note is visible
    const overrideNote = page.locator('#cc-manual-override-note');
    await expect(overrideNote).toBeVisible();
    await expect(overrideNote).toContainText('Your inputs now match Budget Gap');

    // Adjust balance to 30000
    const balanceSlider = page.locator('#cc-slider-balance');
    await balanceSlider.fill('30000');

    // In override mode, payment should NOT auto-sync to interest (which would be 600). It should stay 200.
    await expect(page.locator('#cc-input-payment')).toHaveValue('200');
  });

  test('8. Compare Mode toggle functionality', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Check compare mode toggle exists
    const compareToggle = page.locator('#cc-compare-toggle-drag input[type="checkbox"]');
    await expect(compareToggle).toBeVisible();

    // Default: compareMode is false
    await expect(compareToggle).not.toBeChecked();

    // Toggle Compare Mode on
    await compareToggle.check();
    await expect(compareToggle).toBeChecked();
  });
});
