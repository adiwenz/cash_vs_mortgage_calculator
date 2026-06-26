---
name: single-pass-file-editing
description: Reduce slow coding behavior caused by repeated symbol-by-symbol searches inside the same file. The agent should read relevant files once, collect all needed edit locations, and apply related changes in one edit pass whenever practical.
---
# Single-Pass File Editing

## Purpose
Reduce slow coding behavior caused by repeated symbol-by-symbol searches inside the same file. The agent should read relevant files once, collect all needed edit locations, and apply related changes in one edit pass whenever practical.

## Rules

### 1. Read files once before editing
- Before modifying a file, read the full relevant file once.
- Build a working map of imports, constants, helpers, main logic, exports, and tests.
- Identify all required edit locations during that initial read.

### 2. Batch related lookups
- Avoid repeated searches like:
  - search for buyHouseEvents
  - search for marriageEvents
  - search for haveChildEvents
  - search for ssClaimAge
  - search for userIncomeEvents
- Prefer reading the file once and locating all related event arrays or symbols together.

### 3. Edit in one pass
- Apply all related edits to a file in one patch when possible.
- Avoid writing the same file repeatedly for small adjacent changes.
- Do not re-open or re-search the same file after every small edit unless the first edit changed the surrounding structure.

### 4. Search only when useful
- Use search for discovering which files are relevant.
- Use search for very large files when reading the whole file is impractical.
- Do not use search as a substitute for understanding the file.

### 5. Stop inefficient loops
- If more than five searches are being made inside the same file for nearby symbols, stop and read the file instead.
- If the agent cannot confidently identify all edit points after reading once, summarize the uncertainty before continuing.

### 6. End-of-task report
At the end, include:
- files read
- files changed
- whether edits were applied in a single pass
- any repeated searches that were necessary and why
