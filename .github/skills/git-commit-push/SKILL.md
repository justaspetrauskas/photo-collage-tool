---
name: git-commit-push
description: 'Generate a high-quality commit message and push changes. Use when the user asks to commit, generate commit message, publish changes, or push updates.'
argument-hint: 'Describe what changed and whether to push now'
user-invocable: true
---

# Git Commit And Push

## When To Use
- User asks to generate a commit message
- User asks to commit changes
- User asks to push repository updates
- User asks to publish recent work

## Procedure
1. Check working tree status and identify changed files.
2. If possible, run relevant validation before committing.
3. Generate a concise, imperative commit message that reflects the actual diff.
4. Stage required files.
5. Create the commit.
6. Push to the current branch remote.
7. Report commit hash, message, and branch pushed.

## Guardrails
- Do not amend existing commits unless explicitly requested.
- Do not rewrite history unless explicitly requested.
- Do not use destructive git commands.
- If there are no changes, report that and stop.
