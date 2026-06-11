# Calculator Test Cases

Use this list of test cases to verify the mathematical and validation behavior of the **Cash vs. Mortgage Calculator**.

---

### Test Case 1: Valid Baseline Check
* **Inputs**:
  * Home Price: `$300,000`
  * Down Payment %: `20%`
  * Mortgage Term: `30 Years`
  * Mortgage Rate: `6.5%`
  * Stock Market Return: `8%`
  * Home Appreciation: `3%`
  * Property Tax Rate: `1.2%`
  * Insurance Rate: `0.5%`
  * Investment Portfolio Value: `$500,000`
  * Investment Cost Basis: `$350,000`
  * Capital Gains Tax Rate: `20%`
  * Savings Account Rate: `4%`
* **Expected Output**:
  * No errors or warnings displayed.
  * Tab navigation and Visual Chart fully enabled.
  * Summary widgets:
    * Cash Buyer Tax Paid: `$15,957` (6% effective tax rate on $250,000 cash purchase)
    * Mortgage Buyer Tax Paid: `$3,830` (6% effective tax rate on $60,000 down payment)
    * Mortgage Buyer Starting Stock: `$436,170` ($500,000 - $63,830 gross liquidated)
  * Year 0 Net Worths:
    * Cash Buyer: `$480,851`
    * Mortgage Buyer: `$496,170`

---

### Test Case 2: Unrealized Loss (Cost Basis > Portfolio Value)
* **Inputs**:
  * Investment Portfolio Value: `$500,000`
  * Investment Cost Basis: `$600,000`
* **Expected Output**:
  * Calculations proceed normally (no crash).
  * **Warning shown** in the collapsible "Check Your Assumptions" accordion:
    * *"Your cost basis is higher than your portfolio value, which means this investment has an unrealized loss. Capital gains tax will be treated as $0."*
  * Capital Gains Tax Paid for both Cash and Mortgage Buyer goes to `$0`.
  * Year 0 Net Worths:
    * Cash Buyer: `$550,000` ($300,000 home + $250,000 remaining stock)
    * Mortgage Buyer: `$500,000` ($300,000 home + $440,000 remaining stock - $240,000 mortgage)

---

### Test Case 3: Portfolio Value is Zero or Negative
* **Inputs**:
  * Investment Portfolio Value: `$0` or `-$10,000`
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"Enter a portfolio value greater than $0."*
  * Visual Chart is disabled (grayed out with lock overlay).

---

### Test Case 4: Cost Basis is Negative
* **Inputs**:
  * Investment Cost Basis: `-$5,000`
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"Cost basis cannot be negative."*
  * Visual Chart is disabled.

---

### Test Case 5: Portfolio Value cannot cover Cash Purchase
* **Inputs**:
  * Home Price: `$300,000`
  * Cash Purchase Discount: `$0`
  * Investment Portfolio Value: `$250,000`
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"Your portfolio is not large enough to buy this home in cash."*
  * Visual Chart is disabled.

---

### Test Case 6: Portfolio Value cannot cover Cash Purchase + Tax
* **Inputs**:
  * Home Price: `$300,000`
  * Cash Purchase Discount: `$50,000` (price = $250,000)
  * Investment Portfolio Value: `$260,000`
  * Investment Cost Basis: `$0` (effective tax rate = 20%)
  * *Calculation Note*: Sells $312,500 gross to net $250,000 after 20% tax.
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"After estimated capital gains tax, your portfolio is not large enough to complete a cash purchase."*
  * Visual Chart is disabled.

---

### Test Case 7: Down Payment Percent Negative or > 100%
* **Inputs**:
  * Down Payment %: `-5%` or `105%`
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"Down payment cannot be negative."* or *"Down payment cannot be more than 100% of the home price."*
  * Visual Chart is disabled.

---

### Test Case 8: Portfolio Value cannot cover Down Payment
* **Inputs**:
  * Home Price: `$300,000`
  * Down Payment %: `20%` (amount = $60,000)
  * Investment Portfolio Value: `$50,000`
* **Expected Output**:
  * **Error shown** under "Fix Your Assumptions":
    * *"Your portfolio is not large enough to fund this down payment."*
  * Visual Chart is disabled.

---

### Test Case 9: Portfolio Value cannot cover Down Payment + Tax
* **Inputs**:
  * Home Price: `$300,000`
  * Down Payment %: `20%` ($60,000 down payment)
  * Investment Portfolio Value: `$70,000`
  * Investment Cost Basis: `$0` (effective tax rate = 20%)
  * *Calculation Note*: Sells $75,000 gross to net $60,000 after 20% tax.
* **Expected Output**:
  * **Error displayed** under "Fix Your Assumptions":
    * *"After estimated capital gains tax, your portfolio is not large enough to fund this down payment."*
  * Visual Chart is disabled.

---

### Test Case 10: Home Price or Term Zero/Negative
* **Inputs**:
  * Home Price: `$0` or `-$50,000`
  * Mortgage Term: `0`
* **Expected Output**:
  * **Errors shown** under "Fix Your Assumptions":
    * *"Enter a home price greater than $0."*
    * *"Mortgage term must be greater than 0 years."*
  * Visual Chart is disabled.

---

### Test Case 11: Mortgage Rate Negative or Out of Bounds
* **Inputs**:
  * Mortgage Rate: `-1%` or `18%`
* **Expected Output**:
  * If `-1%`: **Error shown**: *"Mortgage rate cannot be negative."* and Chart is disabled.
  * If `18%`: **Warning shown** (Chart remains active): *"This mortgage rate is unusually high. Double-check that you entered the rate correctly."*

---

### Test Case 12: Capital Gains Tax Rate Negative or > 100%
* **Inputs**:
  * Capital Gains Tax Rate: `-5%` or `105%`
* **Expected Output**:
  * **Error shown**: *"Capital gains tax rate cannot be negative."* or *"Capital gains tax rate cannot be more than 100%."*
  * Chart is disabled.

---

### Test Case 13: High Stock Return or Negative Stock Return
* **Inputs**:
  * Stock Market Return: `-2%` or `15%`
* **Expected Output**:
  * If `-2%`: **Warning shown**: *"You entered a negative stock return. This is allowed, but the investment account will shrink over time."*
  * If `15%`: **Warning shown**: *"This stock return is very high. Long-term projections may look overly optimistic."*
  * Chart remains active.

---

### Test Case 14: Savings Rate > Stock Return
* **Inputs**:
  * Stock Market Return: `5%`
  * Savings Account Rate: `6%`
* **Expected Output**:
  * **Warning shown**: *"Your savings account return is higher than your stock market return. This may be possible short-term, but it is unusual over long periods."*
  * Chart remains active.

---

### Test Case 15: High Property Tax Rate or Insurance Rate
* **Inputs**:
  * Property Tax Rate: `3.5%`
  * Insurance Rate: `2.5%`
* **Expected Output**:
  * **Warnings shown**:
    * *"This property tax rate is high and may significantly affect affordability."*
    * *"This insurance rate is high and may significantly affect affordability."*
  * Chart remains active.

---

### Test Case 16: Mortgage Scenario Comparer Valid Default Baseline
* **Navigation**: Click "Compare Options" switcher in the header.
* **Expected Output**:
  * Displays three default scenario cards:
    * Scenario A: Low Down Payment (Indigo line)
    * Scenario B: Standard Down Payment (Emerald line)
    * Scenario C: Shorter Loan (Amber line)
  * Chart Visualizer renders lines showing Net Worth growth over 30 years for all three scenarios.
  * Collapsed scenario cards display summary chips:
    * Scenario A: Monthly P&I `$3,002`, Down Payment `$25,000`, Loan `$475,000`, Total Interest `$605,836`, NW Year 10 `$522,170`, NW Year 30 `$2,300,982`
    * Scenario B: Monthly P&I `$2,528`, Down Payment `$100,000`, Loan `$400,000`, Total Interest `$510,178`, NW Year 10 `$513,674`, NW Year 30 `$2,305,622`
    * Scenario C: Monthly P&I `$3,375`, Down Payment `$100,000`, Loan `$400,000`, Total Interest `$207,568`, NW Year 10 `$504,506`, NW Year 30 `$2,437,344`

---

### Test Case 17: Cash Allocation Limit Error
* **Inputs (Scenario A)**:
  * Click "Edit" on Scenario A.
  * Change "Investments" (outside the home) to `$140,000`.
  * *Calculation Note*: Down Payment ($25,000) + Investments ($140,000) + Savings ($25,000) = $190,000. This exceeds "Cash Today" ($150,000).
* **Expected Output**:
  * An error banner is shown inline in the Scenario A card:
    * *"Cash allocated to down payment, investments, and savings cannot exceed total cash available."*
  * Scenario A is immediately excluded from the comparison chart and tables.
  * Re-adjusting Investments to `$100,000` clears the error and restores the scenario to comparison.

---

### Test Case 18: Mortgage Scenario Invalid Parameters
* **Inputs (Scenario B)**:
  * Click "Edit" on Scenario B.
  * Set "Home Price" to `$0`.
  * Set "Mortgage Rate" to `-1%`.
  * Set "Term (Years)" to `0`.
* **Expected Output**:
  * Error banners display inside the Scenario B card:
    * *"Home price must be greater than $0."*
    * *"Mortgage rate cannot be negative."*
    * *"Mortgage term must be greater than 0."*
  * Scenario B is excluded from comparison charts and tables.

---

### Test Case 19: Scenario Management Actions
* **Actions**:
  * Click "Add Scenario" button in the "Mortgage Scenarios" header.
    * *Result*: A new card "Scenario D" is created with default parameters and Indigo/Rose border.
  * Click "Dup" button on Scenario B.
    * *Result*: A copy "Scenario B (Copy)" is created with identical parameters.
  * Uncheck the checkbox next to Scenario C.
    * *Result*: Scenario C is hidden from the comparison chart and table.
  * Click "Del" button on Scenario C.
    * *Result*: Scenario C is removed from the scenario list.

---

### Test Case 20: Simple Calculator Default Baseline Check
* **Navigation**: Load the web app. The default view should be **Cash vs Mortgage (Simple)**.
* **Inputs**:
  * Home Price: `$500,000`
  * Home Appreciation: `3.0%`
  * Down Payment: `20.0%`
  * Mortgage Rate: `6.5%`
  * Mortgage Term: `30 Years`
  * Stock Market Return: `8.0%`
  * Savings Account Rate: `4.0%`
* **Expected Output**:
  * Visual Line Chart displays Net Worth Over Time for Cash Buyer and Mortgage Buyer.
  * Year 30 summary cards display:
    * Cash Buyer: Net Worth `$4,650,561`, Home Value `$1,213,631`, Investment Account `$3,436,929`
    * Mortgage Buyer: Net Worth `$5,238,694`, Home Equity `$1,213,631`, Investment Account `$4,025,063`, Mortgage Balance `$0`
  * Dragging the "Show Year" slider to Year 10 updates the cards to show:
    * Cash Buyer: Net Worth `$1,111,470`, Home Value `$671,958`, Investment Account `$439,512`
    * Mortgage Buyer: Net Worth `$1,196,424`, Home Equity `$332,854`, Investment Account `$863,570`, Mortgage Balance `$339,105`

---

### Test Case 21: Simple Calculator Option Toggles
* **Inputs**:
  * Set Cash Buyer avoided mortgage payments to: **Keep in savings** (Savings).
  * Set Mortgage Buyer remaining cash to: **Keep in savings** (Savings).
* **Expected Output**:
  * Compounding rates adjust instantly.
  * Year 30 Net Worth values drop since savings yield is lower:
    * Cash Buyer Net Worth drops to `$3,086,189` (with Investment Account of `$1,872,558`)
    * Mortgage Buyer Net Worth drops to `$2,511,040` (with Investment Account of `$1,297,409`)

---

### Test Case 22: Simple Calculator Validation Errors
* **Inputs**:
  * Set Home Price to `$0`.
  * Set Down Payment % to `-5.0%`.
  * Set Mortgage Rate to `-2.0%`.
  * Set Term (Years) to `0`.
  * Set Stock Market Return to `-105%`.
* **Expected Output**:
  * Red validation error banner blocks calculations:
    * *"Home price must be greater than 0."*
    * *"Down payment must be between 0% and 100%."*
    * *"Mortgage rate cannot be negative."*
    * *"Mortgage term must be greater than 0."*
    * *"Stock market return cannot be less than -100%."*


