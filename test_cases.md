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
