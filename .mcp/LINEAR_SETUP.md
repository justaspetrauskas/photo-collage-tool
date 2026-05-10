# Linear MCP Setup

This project is configured to use the Linear MCP (Model Context Protocol) server to connect with your Linear workspace for project documentation.

## Prerequisites

- Linear account with workspace access
- Linear API key

## Setup Steps

### 1. Get Your Linear API Key

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Click "Create new" to generate a new API key
3. Copy the API key (you'll only see it once)

### 2. Set Environment Variable

Add your Linear API key to your `.env.local` file:

```bash
LINEAR_API_KEY=your_api_key_here
```

### 3. Verify MCP Connection

The MCP server will automatically connect when you interact with Linear through this workspace. You can:

- **Create issues** from documentation or tasks
- **Link issues** to project milestones
- **Query issues** to auto-generate status reports
- **Sync project metadata** with Linear workspace

## Available MCP Commands

Once connected, you can use Linear commands via MCP:

- **Create issue**: Generate Linear issues from feature requests or bugs
- **Search issues**: Query existing issues by title, label, or status
- **Update issues**: Modify issue status, assignee, or properties
- **Create documentation**: Auto-generate docs from Linear issues
- **Project sync**: Keep project state synchronized with Linear

## Example Usage

You can now ask Copilot to:
- "Create a Linear issue for the smart image sizing feature"
- "Generate documentation from the photo-collage-tool project in Linear"
- "List all open bugs and create a status report"
- "Sync this feature with Linear milestone"

## Troubleshooting

### "Linear MCP not connecting"
- Verify your API key is correct and not expired
- Check that `.env.local` has `LINEAR_API_KEY` set
- Ensure Linear workspace is accessible with your account

### "Permission denied"
- Verify your Linear API key has appropriate scopes
- Check that your user has access to the workspace

### "MCP server not found"
- Run: `npm install @modelcontextprotocol/server-linear`
- Or ensure npx can access the MCP server registry

## Configuration File

The MCP configuration is located in `.mcp/linear-config.json` and references:
- **linear-config.json**: Server configuration with API key reference

## References

- [Linear API Documentation](https://linear.app/docs/graphql)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Linear GraphQL API](https://linear.app/docs/graphql)
