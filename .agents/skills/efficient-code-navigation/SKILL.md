---
name: efficient-code-navigation
description: Navigate code semantically by searching for symbols, opening complete logical units, and avoiding repeated small sequential file reads.
---

# Efficient Code Navigation

## Purpose
Make code investigation faster by finding the relevant symbol/function/module first, then reading complete logical units instead of paging through files line-by-line.

## Behavior

1. Search Before Reading
- Search for the relevant symbol, function, class, component, test name, error text, or identifier before opening files.
- Do not begin by paging through a file unless no useful search target exists.

2. Read Logical Units
- Prefer opening the complete function, component, class, hook, helper, or test block.
- Avoid arbitrary 40–80 line chunks when the relevant logical unit can be identified.
- If the file viewer cannot open a full logical unit directly, open one larger contiguous range that covers the whole likely unit.

3. Avoid Sequential Paging
- Do not repeatedly view adjacent ranges like:
  - lines 220–270
  - lines 270–320
  - lines 320–370
- This is only allowed when:
  - function boundaries are unknown,
  - the file viewer cannot show a larger range,
  - or the explicit goal is to review the whole file.
- If more than two adjacent line ranges have been opened, stop and reassess the navigation strategy.

4. Build a Small Context Map
Before editing, identify:
- the entry point being changed,
- directly related helpers,
- important data structures,
- the closest related tests.

Do not inspect unrelated helpers or neighboring code just because it is nearby.

5. Escalate Intentionally
Use this order:
- Search for the symbol or failing behavior.
- Open the relevant logical unit.
- Open only the helpers it directly calls or the tests that directly cover it.
- Edit the smallest safe area.
- Run targeted or related tests.

6. Known File Rule
If the relevant file and function name are already known, do not browse the file sequentially. Open the function or the largest useful contiguous block around it immediately.

## Default Instruction
Navigate by meaning, not by line number. Search first, read complete logical units, and avoid repeated small adjacent file reads.
