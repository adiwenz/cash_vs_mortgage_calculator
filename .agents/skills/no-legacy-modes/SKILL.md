---
name: no-legacy-modes
description: Ensure all future implementation plans and code changes assume a single canonical implementation by avoiding feature flags, legacy code paths, compatibility wrappers, or phased rollouts.
---
# No Legacy Modes

## Core Principle

When implementing new functionality:

* There should be one canonical implementation.
* Replace old behavior instead of introducing parallel implementations.
* Prefer deletion over preservation.
* Avoid temporary compatibility layers that become permanent technical debt.

## Rules

### 1. Do not introduce feature flags

Do **not** create new flags such as:

* `useLifeProfile`
* `enableNewSimulation`
* `useNewTimeline`
* `experimentalMode`
* `advancedMode`
* `legacyMode`

or any boolean/configuration whose only purpose is selecting between old and new implementations.

Unless explicitly requested, there should be exactly one implementation.

---

### 2. Remove obsolete implementations

When replacing a subsystem:

* Remove the old implementation.
* Remove dead helper functions.
* Remove unused selectors.
* Remove obsolete utilities.
* Remove unreachable code.
* Remove obsolete tests.
* Remove unused imports.

Do not leave dormant code behind "just in case."

---

### 3. Do not preserve backwards compatibility unnecessarily

Assume:

* there are no production users
* there are no persisted customer configurations
* there are no external API consumers

Unless explicitly stated otherwise:

* update all call sites
* update tests
* update documentation
* remove the old interface

instead of supporting both.

---

### 4. Avoid compatibility wrappers

Do not introduce helpers like:

* `deriveLegacyInputs`
* `normalizeLegacyData`
* `convertOldModel`
* `buildLegacyInputs`
* `legacyFallback`

unless the task explicitly requires migration support.

Replace the old model entirely.

---

### 5. Prefer simplifying the architecture

When a new architecture replaces an old one:

Prefer:

```
Old System
↓

New System
```

Instead of:

```
Old System
↓
Compatibility Layer
↓
Flag
↓
Wrapper
↓
New System
```

Every implementation should reduce architectural complexity rather than increase it.

---

### 6. Challenge unnecessary compatibility

If an implementation plan introduces:

* a feature flag
* a migration layer
* duplicate implementations
* compatibility wrappers
* temporary adapters

the agent should first ask:

> "Is this compatibility actually required, or can the old implementation simply be removed?"

Because the default assumption is that compatibility is **not** required.

---

### 7. Final implementation summary

At the end of every implementation plan, include:

* legacy code removed
* obsolete files deleted
* compatibility layers eliminated
* feature flags removed
* resulting canonical architecture
