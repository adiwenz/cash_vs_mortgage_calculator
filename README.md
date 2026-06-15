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

## Project Structure

* **[src/calculations.js](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/src/calculations.js)**: Amortization logic, stock compounding, tax calculations, and the `validateInputs()` utility.
* **[src/App.jsx](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/src/App.jsx)**: Main entry coordinating inputs, theme (dark/light), active views, and warning sections.
* **[src/components/AssumptionsPanel.jsx](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/src/components/AssumptionsPanel.jsx)**: Handles string states for precise input boxes, clamps percent ranges, and displays tooltip helpers.
* **[src/components/ComparisonChart.jsx](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/src/components/ComparisonChart.jsx)**: High-performance Recharts line chart with zoom boundaries and error lock sheets.
* **[src/components/ComparisonTable.jsx](file:///Users/adriannawenz/code/cash_vs_mortgage_calculator/src/components/ComparisonTable.jsx)**: Tabular year-by-year logs supporting exports to CSV.

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

The project uses **Vitest** for unit testing of calculations and simulation logic, and **Playwright** for end-to-end user flow tests.

### 1. Unit Testing (Vitest)

To minimize feedback loops during development, run Vitest targeting only the changed files:
```bash
npx vitest --changed
```
*(or `npm run test:changed`)*

*   **Persistent Watch Mode**: To run Vitest continuously in watch mode:
    ```bash
    npm run test:watch
    ```
*   **One-time Related Run**: To run Vitest targeting only the modified files:
    ```bash
    npx vitest related <changed files>
    ```
    (or `npm run test:unit:related <changed files>`).
*   **One-time Full Run**: To run all unit tests once:
    ```bash
    npm run test:unit
    ```

### 2. End-to-End Testing (Playwright)

To save execution time, E2E validation defaults to running only tests impacted by changes relative to the `main` branch:
```bash
npm run test:e2e:changed
```
*(Runs: `npx playwright test --only-changed=main`)*

*   **Full Suite Run**: Before merging into `main` or when doing a release build validation, run the full E2E suite:
    ```bash
    npm run test:e2e:full
    ```
*   **E2E UI Runner**:
    ```bash
    npm run test:e2e:ui
    ```
