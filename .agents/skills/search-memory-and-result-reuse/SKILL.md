---
name: search-memory-and-result-reuse
description: Reduce unnecessary codebase searches by treating previous search results as cached knowledge. The agent should reuse information it has already discovered instead of repeatedly searching for the same identifiers, files, or locations throughout a coding task.
---
# Search Memory & Result Reuse

## Goal

Reduce unnecessary codebase searches by treating previous search results as cached knowledge. The agent should reuse information it has already discovered instead of repeatedly searching for the same identifiers, files, or locations throughout a coding task.

## Core Principle

Searching the codebase has a cost.

Every search should either:

* discover new information, or
* confirm something that cannot be inferred.

Do not repeat searches for information that has already been found during the current task.

## Rules

### 1. Treat search results as cached knowledge

Whenever a search returns:

* a file
* a symbol
* a function
* a class
* a line number
* a test
* an import

assume that information is available for the remainder of the task.

Do not search for the same identifier again unless the file has materially changed.

### 2. Reuse discovered locations

Instead of:

```text
Search for debtList
Search for debtList again
Search for debtList in another file
Open the file
```

Prefer:

```text
Search for debtList
Open the discovered locations
Read surrounding context
Continue editing
```

Navigation should reuse previous search results whenever possible.

### 3. Search broadly before searching narrowly

When looking for an implementation:

1. Search the project once.
2. Collect all relevant results.
3. Visit those locations.
4. Only perform additional searches if new questions arise.

Avoid drilling down through multiple nearly identical searches.

### 4. Avoid duplicate searches

Never issue consecutive searches for:

* the same symbol
* the same filename
* the same function
* the same property
* the same test

unless there is a clear reason that should be explained.

### 5. Prefer reading over searching

Once the correct file has been located:

* read the surrounding implementation
* inspect neighboring helpers
* understand the local structure

instead of repeatedly searching within that file for nearby symbols.

Searching is primarily for **finding files**, not for navigating every few lines.

### 6. Cache related discoveries

When reading a file, remember nearby information that is likely to be useful later, including:

* helper functions
* constants
* related selectors
* exports
* neighboring event handlers
* associated tests

Avoid re-searching for these later if they were already encountered.

### 7. Batch related investigations

If several questions concern the same subsystem:

For example:

* borrowing
* debtList
* mortgage
* debt normalization

perform one investigation of that subsystem instead of treating each question independently.

### 8. Explain repeated searches

If another search for the same identifier is genuinely necessary, briefly explain why, such as:

* the file changed substantially
* multiple implementations exist
* the first search was ambiguous
* verifying generated code

Otherwise, reuse existing knowledge.

### 9. End-of-task report

Include:

* searches performed
* searches avoided by reusing previous results
* duplicate searches (if any) and why they were necessary
* whether search reuse was successfully applied
