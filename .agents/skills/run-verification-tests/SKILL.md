---
name: run-verification-tests
description: Automatically run all verification tests after making any code changes to prevent regressions.
---
# Run Verification Tests on Change

This skill ensures that whenever you modify, create, or delete any source code, component, calculation module, or test in this repository, you must execute the verification test suite before ending your turn or presenting results to the user.

## Instructions

1. **When to run**:
   - Immediately after making any code edit using `replace_file_content`, `multi_replace_file_content`, or `write_to_file`.
   - Before completing a task or submitting an implementation plan walkthrough.

2. **Command to run**:
   - Run the npm test command from the repository root:
     ```bash
     npm test
     ```
   - This executes the standard test suite:
     `node test_defaults.js && node test_child_costs.js && node test_recommendations.js && ... && node test_display_mode_does_not_change_results.js`
   
3. **If tests fail**:
   - Do not end your turn or present broken results.
   - Inspect the console/table output, diagnose the failure, fix the underlying code, and re-run the tests.
