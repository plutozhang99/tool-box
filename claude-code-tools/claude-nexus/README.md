# Claude Nexus

MCP server enabling inter-session communication between Claude Code instances — locally on the same machine and remotely across different machines/users.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code     │     │  Claude Code     │     │  Claude Code     │
│  (CTO)           │     │  (Frontend)      │     │  (Backend)       │
│                  │     │                  │     │                  │
│  ┌─────────────┐ │     │  ┌─────────────┐ │     │  ┌─────────────┐ │
│  │claude-nexus │ │     │  │claude-nexus │ │     │  │claude-nexus │ │
│  │  MCP Server │ │     │  │  MCP Server │ │     │  │  MCP Server │ │
│  └──────┬──────┘ │     │  └──────┬──────┘ │     │  └──────┬──────┘ │
└─────────┼────────┘     └─────────┼────────┘     └──────��──┼────────┘
          │                        │                        │
          └────────────┬───────────┴────────────────────────┘
                       │
              ┌────────┴────────┐
              │  Shared SQLite  │  (Local communication)
              │  ~/.claude-nexus│
              │    /nexus.db    │
              └─────────────────┘

              ┌─────────────────┐
              │  Relay Server   │  (Remote communication)
              │  (WebSocket)    │  (E2E encrypted)
              └─────────────────┘
```

## Features

### Local Multi-Session Communication
- Multiple Claude Code sessions on the same machine share a SQLite message bus
- Sessions register with roles: `cto`, `frontend`, `backend`, or any custom role
- Send messages by session ID (direct) or by role (all matching sessions)
- Request/response threading for Q&A between sessions
- CTO can broadcast announcements to the entire team
- Stale session cleanup via heartbeat + PID liveness checks

### Remote Cross-User Communication
- Connect to a WebSocket relay server for cross-machine messaging
- Ed25519 identity keypair auto-generated on first use
- End-to-end NaCl box encryption (relay cannot read messages)
- Offline message queuing with 24h TTL
- Auto-reconnect with exponential backoff

## Quick Start

### 1. Install dependencies

```bash
cd claude-nexus
npm install
```

### 2. Add to Claude Code MCP config

Add to `~/.claude/settings.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "claude-nexus": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/claude-nexus/src/index.ts"]
    }
  }
}
```

### 3. Use in Claude Code sessions

**Session 1 (CTO):**
```
Call nexus_register with role="cto", display_name="Tech Lead"
Call nexus_broadcast with content="Sprint goal: implement user auth"
```

**Session 2 (Frontend):**
```
Call nexus_register with role="frontend", display_name="FE Dev"
Call nexus_read  → receives CTO's broadcast
Call nexus_send with to_role="backend", content="What's the auth API format?"
```

**Session 3 (Backend):**
```
Call nexus_register with role="backend", display_name="BE Dev"
Call nexus_read  → receives question from Frontend
Call nexus_send with to_role="frontend", content="POST /api/auth/login {email, password}"
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `nexus_register` | Register session with a role |
| `nexus_list_sessions` | Discover active sessions |
| `nexus_send` | Send message to session or role |
| `nexus_read` | Read unread messages |
| `nexus_broadcast` | Broadcast to all/role |
| `nexus_remote_connect` | Connect to relay server |
| `nexus_remote_send` | Send E2E encrypted message |
| `nexus_remote_read` | Read remote messages |

## Remote Communication

### Start the relay server

```bash
npm run relay
# or with custom port:
RELAY_PORT=3001 npm run relay
```

### Connect from Claude Code

```
Call nexus_remote_connect with relay_url="ws://localhost:3001"
→ Returns your peer_id and box_public_key

Share these with remote peers, then:
Call nexus_remote_send with to_peer_id="...", to_peer_public_key="...", content="Hello!"
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_DATA_DIR` | `~/.claude-nexus` | Data directory |
| `NEXUS_HEARTBEAT_INTERVAL` | `30000` | Heartbeat interval (ms) |
| `NEXUS_MESSAGE_TTL` | `86400000` | Message expiry (ms, 24h) |
| `NEXUS_STALE_TIMEOUT` | `120000` | Stale session timeout (ms) |
| `NEXUS_RELAY_URL` | none | Default relay server URL |
| `RELAY_PORT` | `3001` | Relay server port |

## Development

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run dev           # Run MCP server (stdio)
npm run relay         # Run relay server
npm run build         # Build TypeScript
```

## Security

- Local: SQLite with WAL mode, file system permissions
- Remote: Ed25519 authentication, NaCl box E2E encryption
- Identity keys stored at `~/.claude-nexus/identity/` with 0600 permissions
- Relay server sees only encrypted blobs
- Rate limiting on relay (100 msg/min per peer)
