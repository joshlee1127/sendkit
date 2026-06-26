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

SendKit sends Telegram messages through two interfaces: the **MCP tool** (preferred when available) and the **CLI** (fallback when MCP is not configured).

## Quick decision: MCP or CLI?

| Situation                                               | Use                      |
| ------------------------------------------------------- | ------------------------ |
| `mcp__sendkit__telegram` is in the available tools list | MCP tool                 |
| Running in a shell / no MCP configured                  | CLI (`sendkit telegram`) |
| User wants to verify SendKit manually                   | CLI                      |

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
| `sendkit: command not found`         | Package not installed | `npm install -g sendkit` or use `bunx sendkit`     |
