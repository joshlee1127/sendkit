# 發布到 npm

說明如何把 SendKit 的三個可發布套件上傳到 npm。`apps/remote-mcp` 是部署為服務的應用程式，**不發布到 npm**。

| 套件 | npm 名稱 | 說明 |
| ---- | -------- | ---- |
| `packages/core` | `@joshlee01127/sendkit-core` | 核心實作，其他兩個套件都依賴它 |
| `packages/cli` | `@joshlee01127/sendkit` | CLI（bin: `sendkit`） |
| `packages/local-mcp` | `@joshlee01127/sendkit-mcp` | 本地 MCP server（bin: `sendkit-mcp`） |

三個套件都已設定 `"publishConfig": { "access": "public" }`，所以 scoped 套件不需要額外加 `--access public`。

## 重要觀念

**1. 發布順序：先 `core`，再 `cli` 與 `local-mcp`。**
`cli` 和 `local-mcp` 依賴 `@joshlee01127/sendkit-core`。如果 core 的對應版本還沒在 npm 上，另外兩個套件發布後會無法安裝。

**2. 請用 `bun publish`，不要用 `npm publish`。**
`cli` 與 `local-mcp` 的 `package.json` 以 `"@joshlee01127/sendkit-core": "workspace:*"` 依賴 core。`bun publish`（與 `bun pm pack`）會在打包時把 `workspace:*` 換成 core 的實際版本號；`npm publish` 不會，發布出去的套件會帶著無法解析的 `workspace:*`。

**3. 版本一旦發布就不能覆蓋。**
同一個版本號無法重複發布，也無法在發布後修改內容。發布前務必先 dry-run 確認，有問題就遞增版本號重新發布。

**4. `dist/` 不會進 git，但會進 npm。**
`dist/` 在 `.gitignore` 中，但各套件的 `files: ["dist"]` 決定了 npm 包裝內容。所以每次發布前都必須先建置，否則會發布空的套件。

## 事前準備

1. 擁有 npm 帳號，且有權限在 `@joshlee01127` scope 下發布。
2. 登入 npm：

   ```bash
   npm login
   npm whoami        # 確認登入身分
   ```

3. 若帳號開啟了 2FA（建議），發布時需要提供一次性驗證碼（見下方「發布」）。
4. 專案根目錄的 `.npmrc` 已被 gitignore，可能含有驗證 token，**請勿提交到 git，也不要貼到對話或 log 中**。

## 發布流程

### 1. 檢查程式碼

```bash
bun install
bun run typecheck
bun run lint
bun run format:check
```

### 2. 更新版本號

直接編輯要發布之套件的 `package.json` 的 `version` 欄位（遵循 [semver](https://semver.org/lang/zh-TW/)）。

- 改了 `packages/core` 並且要讓其他套件使用新行為時，core 要升版，並確認 `apps/remote-mcp/package.json` 中釘住的 core 版本（目前為 `"@joshlee01127/sendkit-core": "0.0.1"`）一併更新，否則它可能改去 npm 抓舊版而不是使用 workspace 內的 core。
- 目前版本：`core` 0.0.1、`cli` 0.0.1、`local-mcp` 0.0.6。

### 3. 建置並 dry-run

```bash
bun run build:core
bun run release:pack:core
```

dry-run 會列出將被打包的檔案，確認：

- 只包含 `dist/` 與 `package.json`，沒有 `src/`、`.env`、`.npmrc` 等不該出現的檔案。
- 有 `dist/index.js` 與 `dist/index.d.ts`。

其他套件同理：

```bash
bun run release:pack:cli
bun run release:pack:local-mcp
```

### 4. 發布

依序發布，**每個套件都在自己的目錄下執行**：

```bash
# 1) core（先發布）
cd packages/core
bun publish

# 2) cli
cd ../cli
bun publish

# 3) local-mcp
cd ../local-mcp
bun publish
```

若帳號有開 2FA，加上驗證碼：

```bash
bun publish --otp <6 位數驗證碼>
```

各套件已設定 `prepublishOnly: "bun run build"`，發布時會重新建置。

### 5. 驗證

```bash
npm view @joshlee01127/sendkit-core version
npm view @joshlee01127/sendkit version
npm view @joshlee01127/sendkit-mcp version

# 確認 workspace:* 已被換成實際版本號
npm view @joshlee01127/sendkit dependencies
npm view @joshlee01127/sendkit-mcp dependencies
```

並在乾淨的環境實際執行一次：

```bash
bunx @joshlee01127/sendkit --help
bunx -y @joshlee01127/sendkit-mcp   # 無 TELEGRAM_BOT_TOKEN 時工具呼叫會報錯，屬預期行為
```

### 6. 記錄版本

```bash
git add packages/*/package.json
git commit -m "chore: release core@x.y.z cli@x.y.z local-mcp@x.y.z"
git tag v<版本號>
git push --follow-tags
```

## 常見問題

| 症狀 | 可能原因 | 處理方式 |
| ---- | -------- | -------- |
| `403 Forbidden`：You cannot publish over the previously published versions | 該版本號已發布過 | 遞增 `version` 後重新發布 |
| `403`／`404` 且訊息提到 scope 或權限 | 未登入，或帳號無 `@joshlee01127` scope 權限 | `npm whoami` 確認身分；確認 scope 擁有者 |
| `EOTP` / 需要 one-time password | 帳號啟用 2FA | 加上 `--otp <驗證碼>` |
| 使用者安裝 `cli` 或 `local-mcp` 時出現 `workspace:*` 無法解析 | 誤用 `npm publish` | 遞增版本，改用 `bun publish` 重新發布 |
| 安裝後執行 `sendkit` 找不到 `dist/index.js` | 發布前沒有建置 | 先 `bun run build:*`，遞增版本後重新發布 |
| 安裝 `cli`／`local-mcp` 時找不到 `@joshlee01127/sendkit-core@x.y.z` | core 尚未發布，或發布順序錯誤 | 先發布 core |

## 撤回已發布的版本

- 發布後 72 小時內，可用 `npm unpublish @joshlee01127/<name>@<version>`，但該版本號之後**永遠不能再使用**。
- 超過期限或其他套件已依賴該版本時，建議改用 deprecate 並發布修正版：

  ```bash
  npm deprecate @joshlee01127/<name>@<version> "請改用 x.y.z"
  ```
