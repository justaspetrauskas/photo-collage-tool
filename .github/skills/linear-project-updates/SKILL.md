---
name: linear-project-updates
description: 'Create Linear project updates from commit history. Use when user asks to publish status/progress updates to Linear based on git history.'
argument-hint: 'Project name (default: Collag-io), commit range or timeframe, and desired tone'
user-invocable: true
---

# Linear Project Updates From Git History

## When To Use
- User asks to write a Linear project update
- User asks to summarize recent progress in Linear
- User asks to publish milestones based on commits
- User asks to track release notes in a Linear project

## Inputs
- `projectName`: default `Collag-io`
- `since`: optional date (e.g. `2026-05-01`) or git revision (e.g. `HEAD~10`)
- `until`: optional git revision (default `HEAD`)
- `health`: optional `onTrack | atRisk | offTrack`
- `includeCommits`: optional boolean to include commit list in body

## Procedure
1. Validate required credentials:
   - `LINEAR_API_KEY` must be present in `.env.local` or environment.
2. Resolve Linear project id by name:
   - Query Linear projects and find exact name match (case-insensitive fallback).
3. Gather git history context:
   - Use `git log --oneline` for the selected window.
   - Group by themes (feature, fix, refactor, design, docs).
4. Draft update body in markdown:
   - `Summary`
   - `Delivered`
   - `Milestones`
   - `Risks / Follow-ups`
   - `Next`
5. Publish update via Linear GraphQL mutation `projectUpdateCreate`:
   - Use `projectId`, `body`, and optional `health`.
6. Verify publication:
   - Query latest project update and confirm body prefix/title.
7. Report result:
   - Project name/id, update id, health, and covered commit range.

## Suggested Body Template
```md
## Weekly Update - Collag-io

### Summary
One-paragraph overview of outcomes and impact.

### Delivered
- Itemized list of completed work grouped by capability.

### Milestones
- Milestone names with what changed.

### Risks / Follow-ups
- Outstanding gaps, regressions, or watch items.

### Next
- Concrete next actions for the next cycle.
```

## Guardrails
- Never include secrets or API keys in the update body.
- Do not fabricate changes that are not present in git history.
- Keep update factual, concise, and milestone-oriented.
- If project is not found, stop and report available project names.
