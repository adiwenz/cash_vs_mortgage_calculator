# Cash vs. Mortgage Calculator

A premium, interactive web application comparing long-term net worth trajectories between purchasing a home with cash versus using a mortgage. Built with **React**, **Vite**, **Recharts**, and styled using modern, glassmorphic **Vanilla CSS**.

---

## Key Features

1. **Precision Compounding Engine**:
   * Simulates mortgage payments and outstanding balances using double-precision amortizations that match spreadsheet PV calculations.
   * Compounds investment portfolios monthly with Nominal Annual Rates to exactly mirror bank schedules.
   
2. **Realistic Tax Liquidation**:
   * Uses Investment Portfolio Value and Cost Basis to compute exact capital gains taxes incurred on home/down payment funding, rather than applying arbitrary yearly tax multipliers.

3. **Interactive Decisions**:
   * Radio selectors let users choose where leftover mortgage cash and cash buyer monthly savings flow (Stocks, Savings Account, or cash).
   * High-contrast Line Charts scale Y-axes to high-growth invest baselines to highlight true opportunity cost.

4. **Multi-Tier Validation System**:
   * **Errors**: Flags impossible parameters (insufficient assets, negative cost basis, etc.), overlays warning locks on the visual chart, and disables invalid calculations.
   * **Warnings**: Flags high-risk assumptions (unrealized investment losses, high interest rates, negative growth) inside a collapsible accordion panel.

---

## Design Philosophy

Finley uses a single, thoughtfully-designed light theme. Research and industry patterns show that users generally perceive financial planning tools as more trustworthy, readable, and approachable when presented in a clean light interface. This aligns our design direction with leading products in the space, such as Vanguard, Fidelity Investments, Empower, and Monarch Money.

---

## Project Structure

This project follows a strict boundary-driven structure separating pure mathematical simulation pipelines, domain hooks, decoupled handlers, and presentational UI components.

For a detailed walkthrough of the pipeline stages, domain boundaries, state handler hooks, and extension guides, please refer to the **[Architecture Documentation (ARCHITECTURE.md)](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/ARCHITECTURE.md)**.


---

## Validation & Test Scenarios

To verify input conditions, see the comprehensive [Test Cases Checklist](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/test_cases.md). Whenever validation metrics or rules change, update that checklist.

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## Testing Policy & Commands

The project uses **Vitest** as the primary test runner for unit and component testing, and **Playwright** for end-to-end (E2E) testing.

### Recommended Workflow

To maintain a fast and high-confidence test suite, follow this development workflow:

#### 1. During Development
Run only tests affected by changes relative to the `main` branch:
```bash
npm run test:changed
```

#### 2. Before Commit
Verify that your changes pass linting, all unit tests, and affected E2E tests:
```bash
npm run verify
```

#### 3. Before Merge
Run the complete verification suite including all linting, unit, and E2E tests:
```bash
npm run verify:full
```

---

### Command Reference

#### Unit & Component Tests (Vitest)
*   **Run Changed Tests**: `npm run test:changed` (runs `vitest run --changed=main`)
*   **Run All Tests**: `npm run test` or `npm run test:unit` (runs `vitest run`)
*   **Watch Mode**: `npm run test:watch` (runs `vitest`)

#### End-to-End Tests (Playwright)
*   **Run Changed E2E**: `npm run test:e2e:changed` (runs `playwright test --only-changed=main`)
*   **Run All E2E**: `npm run test:e2e` (runs `playwright test`)
*   **Run Headed E2E**: `npm run test:e2e:headed` (runs `playwright test --headed`)
*   **Run UI E2E**: `npm run test:e2e:ui` (runs `playwright test --ui`)

