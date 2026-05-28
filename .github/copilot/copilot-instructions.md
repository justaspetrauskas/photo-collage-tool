This repository uses BEADS-style structured review workflow.

Principles:

- Always separate concerns: layout, UI, persistence, performance
- Avoid overengineering
- Prefer simple deterministic solutions
- Optimize for responsiveness and image-heavy workloads
- Canvas performance is critical

When reviewing code:
- identify root causes, not symptoms
- group findings by system domain
- propose dependency-ordered fixes
- never suggest unrelated refactors

When implementing:
- keep modules isolated
- avoid duplicated state sources
- minimize re-renders and canvas redraws