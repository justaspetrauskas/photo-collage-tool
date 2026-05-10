# MCP (Model Context Protocol) - Quick Start

This directory contains configurations for connecting the photo-collage-tool to external services via MCP servers.

## What is MCP?

Model Context Protocol allows AI assistants (like GitHub Copilot) to safely interact with external services and tools. This enables:
- Querying project data from Linear
- Creating and updating issues
- Generating documentation from issue metadata
- Syncing project status

## Currently Configured

### Linear Integration

Connect your Linear workspace to automatically:
- Create issues from feature requests
- Generate documentation from Linear issues
- Query project status and metrics
- Link code changes to Linear issues

## File Guide

- **linear-config.json** - MCP server configuration for Linear
- **LINEAR_SETUP.md** - Detailed Linear setup instructions
- **ENV_SETUP.md** - Environment variable documentation
- **README.md** - This file

## Getting Started

### Step 1: Generate Linear API Key

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Click "Create new" and copy your API key

### Step 2: Configure Environment

Add to `.env.local`:
```
LINEAR_API_KEY=your_key_here
```

### Step 3: Use in Copilot

Once configured, you can ask Copilot:

```
Create a Linear issue for smart image sizing on drop
```

```
Generate project documentation from Linear workspace
```

```
List all photo-collage-tool bugs and create a status report
```

```
Link this feature to the Photography Tools project in Linear
```

## MCP Server Details

### Linear MCP Server

**Package:** `@modelcontextprotocol/server-linear`

**Capabilities:**
- Create/read/update/delete issues
- Search and filter issues
- Query issue relationships
- Access team and project data
- Manage issue state transitions

**Authentication:** Bearer token via API key

## Troubleshooting

**Issue:** MCP server not connecting
- Verify API key in `.env.local`
- Check key hasn't expired (Linear settings)
- Ensure workspace is accessible

**Issue:** Permission denied errors
- Check Linear account permissions
- Verify API key scope
- Ensure user has team access

**Issue:** Commands not recognized
- Verify `.mcp/linear-config.json` is present
- Check environment variable is set
- Restart VS Code

## Advanced Configuration

To modify MCP settings:

1. Edit `linear-config.json`
2. Update the `command` or `args` if needed
3. Add additional environment variables as needed
4. Restart VS Code

### Custom MCP Servers

To add more MCP servers:

1. Create new config file in `.mcp/`
2. Add server configuration with name and command
3. Set up environment variables in `.env.local`
4. Reference in project documentation

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Linear API Docs](https://linear.app/docs/graphql)
- [Copilot MCP Guide](https://github.com/features/copilot)

---

For more information, see:
- [LINEAR_SETUP.md](./LINEAR_SETUP.md) - Detailed setup guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables
- [../docs/PROJECT.md](../docs/PROJECT.md) - Project documentation
