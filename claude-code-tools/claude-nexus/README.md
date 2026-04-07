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
└─────────┼────────┘     └─────────┼────────┘     └─────────┼────────┘
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

---

## Usage Mode A: Local Only (Same Machine)

> All Claude Code sessions run on the same machine, communicating through a shared SQLite database. No server deployment needed.

### Step 1: Clone and install

```bash
git clone <this-repo-url>
cd claude-nexus
npm install
```

### Step 2: Add to Claude Code MCP config

Add the following to your **project's `.mcp.json`** file. Replace `/path/to/claude-nexus` with the actual absolute path where you cloned the repo, and set `NEXUS_DATA_DIR` to a project-specific path.

```json
{
  "mcpServers": {
    "claude-nexus": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/claude-nexus/src/index.ts"],
      "env": {
        "NEXUS_DATA_DIR": "~/.claude-nexus/my-project"
      }
    }
  }
}
```

**`NEXUS_DATA_DIR` is required.** Each project must have its own data directory to prevent cross-project message leakage. The server will refuse to start without it.

For example, if you cloned to `/home/alice/tools/claude-nexus` and your project is called `my-app`:
```json
{
  "mcpServers": {
    "claude-nexus": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/home/alice/tools/claude-nexus/src/index.ts"],
      "env": {
        "NEXUS_DATA_DIR": "~/.claude-nexus/my-app"
      }
    }
  }
}
```

### Step 3: Restart Claude Code

After saving the config, **restart Claude Code** (or start a new session). Claude Code loads MCP servers on startup — editing the config while a session is running won't take effect until restart.

### Step 4: Use it

Now in any Claude Code session, you can use the nexus tools. Here's a concrete example with 3 terminal windows:

**Terminal 1 — open Claude Code and register as CTO:**
```
> Call nexus_register with role="cto", display_name="Tech Lead"
> Call nexus_broadcast with content="Sprint goal: implement user auth"
```

**Terminal 2 — open another Claude Code session and register as Frontend:**
```
> Call nexus_register with role="frontend", display_name="FE Dev"
> Call nexus_read
  → You'll see the CTO's broadcast message here
> Call nexus_send with to_role="backend", content="What's the auth API format?"
```

**Terminal 3 — open yet another Claude Code session and register as Backend:**
```
> Call nexus_register with role="backend", display_name="BE Dev"
> Call nexus_read
  → You'll see both the CTO's broadcast AND Frontend's question
> Call nexus_send with to_role="frontend", content="POST /api/auth/login {email, password}"
```

That's it for local usage. No server to deploy. All messages go through a shared SQLite file at `~/.claude-nexus/nexus.db`.

---

## Usage Mode B: Remote (Across Machines / Users)

> Sessions on different machines communicate through a relay server. Messages are end-to-end encrypted — the relay server cannot read them.

This requires two things:
1. **Deploy the relay server** somewhere accessible to all participants
2. **Connect each Claude Code session** to that relay server

### Part 1: Deploy the Relay Server

#### Option A: Deploy on a cloud server (VPS, EC2, etc.)

**Step 1: SSH into your server and clone the repo:**
```bash
ssh your-server
git clone <this-repo-url>
cd claude-nexus
npm install
```

**Step 2: Start the relay server:**
```bash
# Default port 3001
npm run relay

# Or specify a custom port
RELAY_PORT=8080 npm run relay
```

The relay server is now running on port 3001 (or whatever you set). It's a WebSocket server — no HTTP routes, no web UI, just WebSocket.

**Step 3: Make sure the port is open.**

If you're on AWS, add an inbound rule to your security group for port 3001 (TCP). If you're using a firewall (ufw, iptables), open the port:
```bash
# Example with ufw
sudo ufw allow 3001/tcp
```

**Step 4: (Recommended) Run it as a background service:**

Use `pm2`, `systemd`, or `screen`/`tmux` so it doesn't die when you close SSH:

```bash
# With pm2
npx pm2 start "npm run relay" --name claude-nexus-relay

# With tmux
tmux new -s relay
npm run relay
# Then Ctrl+B, D to detach
```

**Step 5: Note down the URL.** Your relay URL will be:
```
ws://YOUR_SERVER_IP:3001
```
If you set up TLS (nginx reverse proxy, etc.), it'll be:
```
wss://your-domain.com/path
```

#### Option B: Run relay locally (for testing)

If you just want to test remote mode on your local machine:
```bash
npm run relay
# Relay is now at ws://localhost:3001
```

### Part 2: Connect Claude Code Sessions to the Relay

**Each participant** does the following:

**Step 1: Make sure claude-nexus MCP is configured** (same as Local mode Step 2 above).

**Step 2: In your Claude Code session, connect to the relay:**
```
> Call nexus_remote_connect with relay_url="ws://YOUR_SERVER_IP:3001"
```

This will output two values — **save them both**:
- `peer_id` — your unique ID on the relay
- `box_public_key` — your encryption public key

**Step 3: Share your `peer_id` and `box_public_key` with other participants** (via Slack, email, whatever).

**Step 4: Send a message to a remote peer:**
```
> Call nexus_remote_send with to_peer_id="THEIR_PEER_ID", to_peer_public_key="THEIR_PUBLIC_KEY", content="Hello from the other machine!"
```

**Step 5: Read incoming messages:**
```
> Call nexus_remote_read
```

That's it. Messages are encrypted before leaving your machine. The relay server only sees encrypted blobs.

---

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `nexus_register` | Register this session with a role. Reports any orphan messages from previous sessions. |
| `nexus_list_sessions` | List all currently active sessions |
| `nexus_send` | Send a message to a specific session (by ID) or all sessions with a role |
| `nexus_read` | Read all unread messages for this session |
| `nexus_broadcast` | Send a message to all sessions, or all sessions with a specific role |
| `nexus_status` | Show database status: session count, message counts, DB size, oldest message |
| `nexus_cleanup` | Delete orphan messages left by expired sessions |
| `nexus_remote_connect` | Connect to a relay server for cross-machine communication |
| `nexus_remote_send` | Send an E2E encrypted message to a remote peer |
| `nexus_remote_read` | Read messages received from remote peers |

## Configuration

### MCP Server (Client-side)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXUS_DATA_DIR` | **Yes** | _(none)_ | Directory for SQLite DB, identity keys, and notifications. Must be unique per project to ensure data isolation. |
| `NEXUS_HEARTBEAT_INTERVAL` | No | `30000` | How often sessions send a heartbeat ping, in milliseconds. |
| `NEXUS_STALE_TIMEOUT` | No | `120000` | Time without heartbeat before a session is considered dead and pruned, in milliseconds. |
| `NEXUS_NOTIFY_DEBOUNCE` | No | `100` | Debounce interval for file-based notifications, in milliseconds. |
| `NEXUS_LOG_LEVEL` | No | `info` | Logging verbosity. One of: `debug`, `info`, `warn`, `error`. |
| `NEXUS_RELAY_URL` | No | _(none)_ | Auto-connect to this WebSocket relay server on startup. |

### Relay Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RELAY_PORT` | No | `3001` | TCP port the relay server listens on. |
| `RELAY_MESSAGE_TTL` | No | `86400000` | How long queued messages for offline peers are retained, in milliseconds (default 24h). |
| `RELAY_RATE_LIMIT` | No | `100` | Maximum messages per minute per peer. |
| `RELAY_MAX_PENDING_AUTH` | No | `200` | Maximum number of unauthenticated connections waiting to complete the auth handshake. |
| `RELAY_MAX_PAYLOAD` | No | `65536` | Maximum WebSocket message payload size in bytes (64 KB). |

## Development

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run dev           # Run MCP server (stdio)
npm run relay         # Run relay server
npm run build         # Build TypeScript
```

## Data Storage and Cleanup

### Where data is stored

Each project stores its data in the directory specified by `NEXUS_DATA_DIR`:

```
~/.claude-nexus/my-project/
├── nexus.db              # SQLite database (sessions + messages)
├── nexus.db-wal          # Write-ahead log (SQLite WAL mode)
├── nexus.db-shm          # WAL shared memory
├── identity/
│   └── keypair.json      # Ed25519 keypair for remote mode (0600 permissions)
└── notify/
    └── {session-id}      # File-based notification sentinels
```

### Automatic cleanup (sessions only)

| What | When | Trigger |
|------|------|---------|
| **Stale sessions** | No heartbeat within timeout (default 2 min) | Every heartbeat cycle while any session is active |
| **Dead PID sessions** | Process no longer running | On startup when any nexus MCP server starts |

### Message cleanup (user-controlled)

Messages are **never automatically deleted**. When you start a new session, `nexus_register` will report any orphan messages (unread messages from sessions that no longer exist):

```
⚠ Found 12 unread message(s) from 2 expired session(s).
Use nexus_read to review them, or nexus_cleanup to delete them.
```

You can then:
- **`nexus_read`** — review the messages to see if they contain useful context
- **`nexus_cleanup`** — delete all orphan messages

### Manual cleanup

To completely reset a project's nexus state:

```bash
rm -rf ~/.claude-nexus/my-project/    # Remove entire project data directory
```

## Security

- **Local:** SQLite with WAL mode, file system permissions protect the DB
- **Remote:** Ed25519 authentication + NaCl box E2E encryption
- Identity keys auto-generated at `~/.claude-nexus/identity/` with `0600` permissions
- Relay server never sees plaintext — only encrypted blobs
- Rate limiting: 100 messages/min per peer on relay
