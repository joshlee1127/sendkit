# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SendKit is a small Bun workspace monorepo that sends Telegram messages from agents/automations through three interchangeable interfaces that all share one core implementation:

- **`packages/core`** (`@joshlee01127/sendkit-core`) — the only place that talks to the Telegram API. Exports `sendTelegramMessage()` and Zod schemas (`schemas.ts`) for input/output validation. Every other package depends on this instead of duplicating HTTP logic.
- **`packages/cli`** (`@joshlee01127/sendkit`, bin: `sendkit`) — Commander-based CLI. `sendkit init --telegram-bot-token <token>` writes the token to `~/.config/sendkit/config.json` (mode `0o600`); `sendkit telegram <chatId> <message>` sends.
- **`packages/local-mcp`** (`@joshlee01127/sendkit-mcp`, bin: `sendkit-mcp`) — stdio MCP server exposing a `telegram` tool. Reads `TELEGRAM_BOT_TOKEN` from the environment (set via the MCP client config, e.g. `.mcp.json`).
- **`apps/remote-mcp`** — Hono-based HTTP MCP server (not published; deployed as a service). The bot token is passed in the URL path (`/:botToken/mcp`), and requests are authenticated via Clerk OAuth (`CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` required env vars).

When adding a new "send X" capability, add the operation + schema to `packages/core` first, then wire it into the CLI, local MCP, and remote MCP tool registrations — the pattern for a new operation should mirror how `telegram` is implemented in each of the three surfaces.

`skills/sendkit/SKILL.md` is the agent-facing usage doc (when to use the MCP tool vs. the CLI, troubleshooting). Update it if the tool's interface or setup steps change.

## Commands

Package manager is **Bun** (`bun.lock` is the source of truth). Workspaces are `apps/*` and `packages/*`.

```bash
bun install                # install workspace deps

bun run typecheck          # tsc --noEmit across the workspace
bun run lint               # oxlint . --deny-warnings
bun run lint:fix           # oxlint . --fix
bun run format             # oxfmt . --write
bun run format:check       # oxfmt . --check

bun run dev:cli            # run the CLI from source (packages/cli/src/index.ts)
bun run dev:local-mcp      # run the local MCP server from source
bun run dev:remote-mcp     # run the remote MCP HTTP server from source (apps/remote-mcp)

bun run build:core         # tsdown build for packages/core
bun run build:cli          # tsdown build for packages/cli
bun run build:local-mcp    # tsdown build for packages/local-mcp

bun run release:pack:core      # build + `bun pm --dry-run` for core
bun run release:pack:cli       # build + `bun pm pack --dry-run` for cli
bun run release:pack:local-mcp # build + `bun pm --dry-run` for local-mcp
```

There is no test suite in this repo currently — verify changes via `bun run typecheck`, `bun run lint`, and by exercising the CLI/MCP server manually (e.g. `bun run dev:cli telegram <chatId> "test"`).

**Build `core` before running other packages from source.** `packages/core/package.json` points `main`/`exports` at `dist/`, so `dev:cli`, `dev:local-mcp` and `dev:remote-mcp` all resolve `@joshlee01127/sendkit-core` to the built output, not `src/`. After editing anything in `packages/core/src`, run `bun run build:core` or the other packages will keep using stale code (and fail outright on a fresh clone).

Each publishable package (`core`, `cli`, `local-mcp`) builds with **tsdown** (`tsdown.config.ts`) to ESM + `.d.ts` in `dist/`, targeting Node 20. `zod` is never bundled (`deps.neverBundle`). `apps/remote-mcp` is unpublished and runs directly from `src/` via Bun — no build step.

## Environment / secrets

- `TELEGRAM_BOT_TOKEN` — required by the local MCP server and by `opencode.json`'s local MCP config.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — required by `apps/remote-mcp`; it throws at import time if either is missing. `PORT` (default `3000`) is optional.
- Local config files that carry real secrets (`.env`, `.mcp.json`, `opencode.json`, `.npmrc`) are gitignored — don't assume their committed contents are safe to reference or reuse across environments. `.env.example` currently only lists `TELEGRAM_BOT_TOKEN`; the Clerk vars above are not in it.

## Behaviors worth knowing before changing things

- **CLI exit code is always 0.** `packages/cli/src/index.ts` catches every error at the top level, prints the message, and does not set `process.exitCode`. Scripts calling `sendkit` can't detect failure from the exit status; keep this in mind (or fix it) when touching error handling.
- **Remote MCP auth is not tied to the bot token.** `apps/remote-mcp` only checks that the caller has a valid Clerk OAuth token (`acceptsToken: "oauth_token"`); any authenticated user can use any `:botToken` in the URL. The OAuth protected-resource metadata endpoint (`/.well-known/oauth-protected-resource/:botToken/mcp`) is per-token for the same reason. Each request builds a fresh stateless `McpServer` + transport (`sessionIdGenerator: undefined`, JSON responses).
- **Reverse-proxy headers are rewritten.** The exported `fetch` in `apps/remote-mcp` overrides the request URL's protocol/host from `x-forwarded-proto`/`x-forwarded-host` so the OAuth metadata URLs are correct behind Railway's proxy.
- **Tool schema is shared.** Both MCP servers register the `telegram` tool using `telegramMessageInputSchema.shape` from core and each duplicates the same handler/response formatting — a change to the tool's output shape must be applied in both `packages/local-mcp/src/index.ts` and `apps/remote-mcp/src/index.ts`.
- `ARCHITECTURE.md` has Mermaid diagrams of the three surfaces and the skill's interface-selection flow (written in Traditional Chinese).
