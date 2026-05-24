# Linear MCP Setup

This workspace includes an optional Linear MCP setup for project tracking and documentation workflows.

## Requirements

- A Linear account with workspace access
- A Linear API key

## Setup

### 1. Create a Linear API key

1. Open Linear settings.
2. Go to the API section.
3. Create a new key and copy it.

### 2. Add it to `.env.local`

```bash
LINEAR_API_KEY=your_api_key_here
```

### 3. Restart VS Code

Restart the editor so the MCP configuration is reloaded.

## What You Can Do

- Create issues from feature requests
- Query project status
- Generate documentation from workspace context
- Publish progress updates for the photo-collage-tool project

## Troubleshooting

- Verify the API key is present in `.env.local`
- Check that the Linear workspace is accessible
- Restart VS Code if MCP tools do not appear

## Notes

- Linear is optional and separate from the app runtime.
- Keep the API key out of source control.
