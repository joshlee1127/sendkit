# SendKit

讓 Agent 與自動化流程發送 Telegram 訊息。SendKit 提供三種可互換的介面，全部共用同一份核心實作：

| 介面           | 套件／位置                                          | 適用情境                                                          |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| **CLI**        | `@joshlee01127/sendkit`（bin: `sendkit`）           | Shell 腳本、手動測試、沒有 MCP 的環境                             |
| **本地 MCP**   | `@joshlee01127/sendkit-mcp`（bin: `sendkit-mcp`）   | 能啟動 stdio server 的 MCP client（Claude Code 等）               |
| **遠端 MCP**   | `apps/remote-mcp`（部署為服務，未發布到 npm）       | 支援遠端 connector 與 OAuth 的 client（Claude.ai 等）             |

三者都呼叫 `@joshlee01127/sendkit-core` 的 `sendTelegramMessage()`，這是唯一與 Telegram Bot API 溝通的套件。

## 事前準備

1. 向 [@BotFather](https://t.me/BotFather) 建立 bot，並複製它的 token。
2. 取得要發送訊息的 chat ID：先傳訊息給 bot（或把 bot 加入群組並發一則訊息），再開啟 `https://api.telegram.org/bot<TOKEN>/getUpdates`，讀取 `chat.id`。私訊的 ID 是正數，群組的 ID 是負數。

## 使用方式

### CLI

```bash
npm install -g @joshlee01127/sendkit   # 或使用：bunx @joshlee01127/sendkit

sendkit init --telegram-bot-token <botToken>   # 只需執行一次；寫入 ~/.config/sendkit/config.json（權限 0600）
sendkit telegram <chatId> "Build finished successfully"
```

成功時會輸出 `{"ok":true,"chatId":"...","messageId":42}`。

> 注意：目前 CLI 即使發送失敗，結束碼（exit code）仍然是 `0`，請以輸出內容而非結束狀態判斷結果。

### 本地 MCP server

在 MCP client 的設定檔（例如 `.mcp.json`）加入：

```json
{
  "mcpServers": {
    "sendkit": {
      "type": "stdio",
      "command": "bunx",
      "args": ["-y", "@joshlee01127/sendkit-mcp"],
      "env": { "TELEGRAM_BOT_TOKEN": "<your-token>" }
    }
  }
}
```

會提供一個 `telegram` 工具，參數為 `{ chatId: string, message: string }`。

### 遠端 MCP connector

若 client 支援帶 OAuth 的遠端 MCP connector，新增一個指向下列網址的 connector：

```
https://<remote-mcp-host>/<botToken>/mcp
```

Client 會導向 Clerk OAuth 登入頁面並只需授權一次，不需要在本機安裝任何東西，也不需要設定環境變數。每個網址只對應一個 bot token，有多個 bot 就要建立多個 connector。正式環境的網域尚未公開。

### Agent skill

`skills/sendkit/SKILL.md` 是現成的 skill，用來教 Agent 何時該用 MCP 工具、何時該用 CLI，如何設定各介面，以及如何排除常見錯誤。

## 開發

需要 [Bun](https://bun.sh)。本專案是 Bun workspace monorepo（`apps/*`、`packages/*`）。

```bash
bun install

bun run typecheck
bun run lint
bun run format:check

bun run build:core        # 從原始碼執行其他套件之前必須先建置
bun run dev:cli telegram <chatId> "test"
bun run dev:local-mcp
bun run dev:remote-mcp
```

`packages/core` 解析到的是建置後的 `dist/`，因此修改 `packages/core/src` 後要重新執行 `bun run build:core`。目前沒有測試套件。

### 環境變數

| 變數                                        | 使用者                           |
| ------------------------------------------- | -------------------------------- |
| `TELEGRAM_BOT_TOKEN`                        | 本地 MCP server                  |
| `CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | 遠端 MCP server（兩者皆必填）    |
| `PORT`（預設 `3000`）                       | 遠端 MCP server（選填）          |

真正的機密放在被 gitignore 的檔案中（`.env`、`.mcp.json`、`opencode.json`、`.npmrc`），請勿提交。

### 發布

```bash
bun run release:pack:core
bun run release:pack:cli
bun run release:pack:local-mcp
```

每個指令都會建置該套件並執行 dry-run 打包。可發布的套件使用 [tsdown](https://tsdown.dev) 建置成 ESM 與 `.d.ts`，目標為 Node 20。實際上傳到 npm 的步驟請見 [PUBLISHING.md](./PUBLISHING.md)。

### 新增「發送 X」功能

1. 在 `packages/core` 新增操作與對應的 Zod schema。
2. 依照 `telegram` 的實作方式，分別串接到 CLI、本地 MCP 與遠端 MCP。
3. 若工具介面或設定步驟有變動，同步更新 `skills/sendkit/SKILL.md`。

各元件如何協作請見 [ARCHITECTURE.md](./ARCHITECTURE.md)，給 coding agent 的說明請見 [CLAUDE.md](./CLAUDE.md)。
