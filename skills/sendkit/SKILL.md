---
name: sendkit
description: >
  Use SendKit to send Telegram messages from agents. Invoke this skill whenever
  the user asks to send a Telegram message, use SendKit, interact with the
  SendKit toolset, verify SendKit is working, or choose between the SendKit MCP
  tool and the CLI workflow. Also use it when the user wants to notify
  themselves or a chat via Telegram from within an agent or automation.
---

# SendKit — Telegram Messaging.

SendKit sends Telegram messages through three interfaces: the **MCP tool** (local, preferred when available), the **Remote MCP Connector** (no local setup, for clients that support remote MCP + OAuth), and the **CLI** (fallback when no MCP is configured).

## Quick decision: MCP, Remote MCP, or CLI?

| Situation                                                     | Use                        |
| -------------------------------------------------------------- | -------------------------- |
| `mcp__sendkit__telegram` is already in the available tools list | Local MCP tool              |
| Client supports remote MCP connectors but has no local env access (e.g. Claude.ai, Claude Desktop) | Remote MCP Connector       |
| Running in a shell / no MCP configured                        | CLI (`sendkit telegram`)   |
| User wants to verify SendKit manually                         | CLI                        |

---

## MCP Tool

**Tool name:** `mcp__sendkit__telegram`

**Parameters:**

- `chatId` — Telegram chat ID (string, required). Starts with `-` for group chats, positive integer for DMs.
- `message` — Text to send (string, required).

**Example:**

```
mcp__sendkit__telegram({ chatId: "123456789", message: "Hello from your agent!" })
```

**Response:**

```json
{ "ok": true, "chatId": "123456789", "messageId": 42 }
```

If `ok` is `false`, the call failed — surface the full response to the user.

**Setup requirement:** The MCP server reads `TELEGRAM_BOT_TOKEN` from the environment. If the tool errors with an auth or token message, ask the user to set that env var in `.mcp.json`:

```json
{
  "mcpServers": {
    "sendkit": {
      "type": "stdio",
      "command": "bunx",
      "args": ["-y", "@joshlee01127/sendkit-mcp"],
      "env": { "TELEGRAM_BOT_TOKEN": "<their-token>" }
    }
  }
}
```

---

## Remote MCP Connector

Use this when the user's MCP client supports **remote MCP connectors with OAuth** (e.g. Claude.ai, Claude Desktop) and they don't want to run anything locally or manage an env var. No install, no local config file — the bot token lives in the connector URL and the client handles login.

**Connector URL pattern:**

```
https://<remote-mcp-host>/<botToken>/mcp
```

`<remote-mcp-host>` is the deployed `apps/remote-mcp` service (planned to be hosted on Railway — https://railway.com/ — final domain TBD, get it from the user or the project's deployment info).

**Setup steps (tell the user):**

1. Get a Telegram bot token from `@BotFather` if they don't have one.
2. In their MCP client, add a new remote connector using the URL above, substituting their bot token into the path.
3. The client will redirect to a Clerk OAuth login/consent screen — the user authorizes it once.
4. After authorization, the client exposes a `telegram` tool (namespaced by whatever name the client gives the connector, e.g. `mcp__sendkit__telegram`) with the same parameters as the local MCP tool (`chatId`, `message`).

**Notes:**

- Every connector URL is scoped to one bot token — a user with multiple bots needs one connector per bot.
- If the client returns `401 Unauthorized` or repeatedly asks to re-auth, the Clerk session likely expired — have the user remove and re-add the connector.
- This path requires no `TELEGRAM_BOT_TOKEN` env var and no `sendkit init` — the token is already embedded in the connector URL.

---

## CLI

Use the CLI when MCP is unavailable or when the user wants to run SendKit directly from a terminal.

**One-time setup:**

```bash
sendkit init --telegram-bot-token <botToken>
```

Saves the token to `~/.config/sendkit/config.json` (mode 0o600). Only needed once.

**Send a message:**

```bash
sendkit telegram <chatId> <message>
```

**Example:**

```bash
sendkit telegram 123456789 "Build finished successfully"
```

Returns JSON: `{ "ok": true, "chatId": "...", "messageId": ... }`

**Check existing config:**

```bash
cat ~/.config/sendkit/config.json
```

---

## Finding a chat ID

If the user doesn't know their chat ID:

- **DM:** Message the bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` — the `chat.id` field in the first result is the DM chat ID.
- **Group:** Add the bot to the group, send a message, and check the same `getUpdates` endpoint — group IDs are negative numbers.

---

## Troubleshooting

| Symptom                              | Likely cause          | Fix                                                |
| ------------------------------------ | --------------------- | -------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` missing / empty | Env var not set       | Add token to `.mcp.json` env or run `sendkit init` |
| `chat not found`                     | Wrong chat ID         | Re-fetch via `getUpdates`                          |
| `bot was blocked by the user`        | Bot blocked           | User must unblock the bot in Telegram              |
| `sendkit: command not found`         | Package not installed | `npm install -g @joshlee01127/sendkit` or use `bunx @joshlee01127/sendkit` |
| `401 Unauthorized` on Remote MCP connector | Clerk session expired or wrong bot token in URL | Remove and re-add the connector with the correct `<botToken>` in the URL |
