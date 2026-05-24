# MCP Quick Start

This folder contains the optional Linear MCP setup used for project tracking and workspace-driven documentation.

## What MCP Does

Model Context Protocol lets Copilot interact with external services in a controlled way. In this workspace it is used for Linear updates, issue tracking, and project status workflows.

## Current Files

- `linear-config.json` - Linear MCP server configuration
- `LINEAR_SETUP.md` - Setup steps for Linear access
- `ENV_SETUP.md` - Environment variable reference
- `SETUP_COMPLETE.md` - Setup summary

## Typical Uses

- Create or update Linear issues
- Generate status updates from current work
- Link documentation to project tracking
- Sync progress for the photo-collage-tool project

## Getting Started

1. Create a Linear API key in Linear settings.
2. Add `LINEAR_API_KEY` to `.env.local`.
3. Restart VS Code so MCP picks up the configuration.
4. Use Copilot to query or update Linear from this workspace.

## Notes

- This setup is separate from the app runtime.
- The collage editor does not depend on Linear to run.
- Keep secrets in `.env.local`, not in source control.
