#!/usr/bin/env node
import { Command } from "commander";
import { sendTelegramMessage } from "@joshlee01127/sendkit-core";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
const program = new Command();

const configPath = join(homedir(), ".config", "sendkit", "config.json");
const cliConfigSchema = z.object({
  telegramBotToken: z.string().min(1).optional(),
});

function writeTelegramBotToken(token: string) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    `${JSON.stringify({ telegramBotToken: token }, null, 2)}\n`,
    {
      mode: 0o600,
    }
  );
}

function getTelegramBotToken() {
  if (!existsSync(configPath)) {
    throw new Error(`Telegram bot token is required. Run 'sendkit init'.`);
  }
  const config = cliConfigSchema.parse(
    JSON.parse(readFileSync(configPath, "utf8"))
  );
  const token = config.telegramBotToken;
  if (!token) {
    throw new Error(`Telegram bot token is required. Run 'sendkit init'.`);
  }
  return token;
}

program.name("sendkit").description("Sendkit CLI backed by sendkit-core");
program
  .command("init")
  .description("Configure sendkit cli local settings")
  .requiredOption("--telegram-bot-token <botToken>", "Telegram bot token")
  .action(async (option: { telegramBotToken: string }) => {
    writeTelegramBotToken(option.telegramBotToken);
    console.log(`Saved Sendkit CLI config to ${configPath}`);
  });
program
  .command("telegram")
  .description("Send a telegram message")
  .argument("<chatId>", "Telegram chat ID")
  .argument("<message>", "Message text to send")
  .action(async (chatId: string, message: string) => {
    const result = await sendTelegramMessage({
      botToken: getTelegramBotToken(),
      chatId,
      message,
    });

    console.log(JSON.stringify(result));
  });

await program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
});
