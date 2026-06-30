---
name: use-ripgrep-first
description: Teach the agent to use grep_search (ripgrep) as the default tool for searching a repository instead of repeatedly opening or scanning files.
---

# Use Ripgrep First Skill

This skill defines the guidelines for using ripgrep (`grep_search` tool) as the default method for searching the codebase.

## Purpose
Optimize codebase navigation and reduce file-reading overhead by preferring targeted search queries over manual folder navigation or sequential file scanning.

## Search Guidelines

### Default to `grep_search` (ripgrep) when searching for:
- Function and class definitions
- Exported symbols, variable names, and constant strings
- Code annotations like `TODO`, `FIXME`, or `NOTE`
- Import statements and file references
- Configuration keys and API routes
- Component and test names

### Prefer `grep_search` before:
- Recursively listing directories or files
- Opening many files individually just to check their contents
- Guessing where specific logic or variables live

### Refinement & Options
When searching, refine the search query and restrict scope using tool arguments equivalent to:
- Specific search queries: `grep_search` with literal or regex queries
- Case sensitivity/insensitivity flags (`CaseInsensitive`)
- Restricting search paths (`SearchPath`)
- Filtering by file type or patterns (e.g., using `Includes` patterns like `*.test.js` or `*.jsx` to filter findings)

### Inspection Workflow
1. **Find Matches**: Run `grep_search` first to identify exact files and line numbers.
2. **Targeted Reading**: Only open and view the specific, relevant files/lines matching the query using `view_file`.
3. **Audit/Comprehensive Lists**: If performing an audit, list all matched files from the search results before inspecting their contents.

---

## When NOT to use `grep_search`:
- The exact file and target lines are already known and only a few lines need to be read.
- Semantic understanding of the implementation is required (open and read the file).
- Symbol references require language-aware navigation (prefer IDE-specific LSP tools if available).
- Searching generated directories, dependencies (`node_modules`), or build output unless explicitly requested.

> [!IMPORTANT]
> Never modify code based solely on search matches without opening and reviewing the implementation context around the target changes first.
