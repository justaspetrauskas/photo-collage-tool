# Environment Variables

This file documents the environment variables used for the optional Linear MCP integration.

## Linear MCP Integration

### `LINEAR_API_KEY`

**Purpose:** Authenticate with Linear when using MCP tools in this workspace.

**Required:** Yes, if you want Linear project updates or issue management.

**Example:**

```bash
LINEAR_API_KEY=lin_pat_xxxxxxxxxxxxxxxxxxxx
```

## `.env.local`

Create a `.env.local` file in the project root:

```bash
LINEAR_API_KEY=your_linear_api_key_here
```

## Notes

- Do not commit `.env.local`.
- The app itself runs without Linear configuration.
- Add additional environment variables here only if the workspace starts using them.
