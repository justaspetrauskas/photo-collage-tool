# Environment Variables

This file documents the environment variables used by the photo collage tool.

## MCP / Linear Integration

### LINEAR_API_KEY

**Purpose:** Authenticate with Linear API for project documentation sync  
**Required:** Yes (if using Linear features)  
**Value Type:** String (API key from Linear settings)

**Setup:**
```bash
LINEAR_API_KEY=lin_pat_xxxxxxxxxxxxxxxxxxxx
```

Get your key from: https://linear.app/settings/api

## Copy to .env.local

Create a `.env.local` file in the project root:

```bash
# Linear API Integration
LINEAR_API_KEY=your_linear_api_key_here
```

**⚠️ Important:** Never commit `.env.local` to git. It's already in `.gitignore`.

## Optional Features

### Canvas Export Directory

If you want to set a default export directory (future feature):

```bash
EXPORT_DIR=/path/to/exports
```

### Development Debug

For development logging:

```bash
DEBUG=collage:*
```

## Verification

To verify your Linear API key is set correctly:

1. Check `.env.local` exists and has `LINEAR_API_KEY`
2. Run the application
3. Try to create a Linear issue or query workspace data

If connection fails, check:
- API key is not expired
- Linear account has workspace access
- Key has correct permissions
