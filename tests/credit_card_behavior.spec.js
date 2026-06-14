import { test, expect } from '@playwright/test';

test.describe('Credit Card Behavior Simulator End-to-End Tests', () => {
  // Set a generous timeout
  test.describe.configure({ timeout: 60000 });

  test('1. Default inputs and metric cards verification', async ({ page }) => {
    // Navigate to the credit card tool
    await page.goto('/?tool=creditcard');

    // Verify header is visible
    await expect(page.locator('.brand-title h1')).toHaveText('Credit Card Behavior');

    // Verify default input values
    await expect(page.locator('#cc-input-balance')).toHaveValue('10000');
    await expect(page.locator('#cc-input-apr')).toHaveValue('24');
    await expect(page.locator('#cc-input-payment')).toHaveValue('200');
    await expect(page.locator('#cc-input-newdebt')).toHaveValue('300');

    // Verify default metrics
    // Starting with default values: Balance $10,000, APR 24%, min payment $200.
    // Active scenario is aggressive paydown (since it's the default/first one, wait, let's verify what the default active scenario is).
    // Let's verify that the scenario cards are present.
    await expect(page.locator('#cc-scenario-card-aggressive')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-slow')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-neutral')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-trap')).toBeVisible();
    await expect(page.locator('#cc-scenario-card-budgetGap')).toBeVisible();

    // Verify metric cards exist
    await expect(page.locator('.cc-metric-card:has-text("Annual Credit Card Drag")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Lifetime Credit Card Drag")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Debt-Free Date")')).toBeVisible();
    await expect(page.locator('.cc-metric-card:has-text("Interest Saved")')).toBeVisible();
  });

  test('2. Scenario switching and extra payment impact', async ({ page }) => {
    await page.goto('/?tool=creditcard');

    // Default active scenario card should be "Interest Neutral" (neutral)
    await expect(page.locator('#cc-scenario-card-neutral')).toHaveClass(/active/);

    // Click on Aggressive Paydown scenario
    await page.locator('#cc-scenario-card-aggressive').click();
    await expect(page.locator('#cc-scenario-card-aggressive')).toHaveClass(/active/);
    await expect(page.locator('#cc-scenario-card-neutral')).not.toHaveClass(/active/);

    // Switch back to Interest Neutral to perform extra payment tests
    await page.locator('#cc-scenario-card-neutral').click();
    await expect(page.locator('#cc-scenario-card-neutral')).toHaveClass(/active/);

    // In Interest Neutral, verify the status is "Stuck Forever" or "Never" payoff
    await expect(page.locator('#cc-scenario-card-neutral .status-badge')).toHaveText('Stuck Forever');
    
    // Check baseline Interest Saved (should be $0 initially since extra payment is 0)
    const savedCard = page.locator('.cc-metric-card:has-text("Interest Saved") .cc-metric-value');
    await expect(savedCard).toHaveText('$0');

    // Now, increase the Extra Payment to $300/mo using the slider
    const extraSlider = page.locator('#cc-slider-extrapayment');
    await extraSlider.fill('300');

    // Once extra payment is added, the Interest Neutral scenario should show a payoff date instead of "Never"
    // and Interest Saved should be greater than $0
    await expect(page.locator('#cc-scenario-card-neutral')).toHaveClass(/active/);
    await expect(savedCard).not.toHaveText('$0');

    // Verify that the status badge changes to "Decreasing" or similar once extra payment is added
    await expect(page.locator('#cc-scenario-card-neutral .status-badge')).toHaveText('Decreasing');
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

    // Verify inputs are restored to default
    await expect(balanceInput).toHaveValue('10000');
    await expect(aprInput).toHaveValue('24');
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

    // Verify the educational callout at the bottom
    await expect(page.locator('.cc-callout-title')).toHaveText('What is Credit Card Drag?');
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
});
