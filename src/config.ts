import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FeedsConfig } from "./types.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || "";
export const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "";
export const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";
export const FEISHU_VERIFICATION_TOKEN =
  process.env.FEISHU_VERIFICATION_TOKEN || "";
export const PORT = parseInt(process.env.PORT || "3000", 10);
export const CRON_EXPRESSIONS = (
  process.env.CRON_EXPRESSIONS ||
  "30 9 * * *,0 13 * * *,0 20 * * *"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const feedsPath = path.join(__dirname, "feeds.json");
const feedsRaw = fs.readFileSync(feedsPath, "utf-8");
export const feedsConfig: FeedsConfig = JSON.parse(feedsRaw);
