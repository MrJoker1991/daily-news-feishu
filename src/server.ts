import express from "express";
import type { Request, Response } from "express";
import { FEISHU_VERIFICATION_TOKEN, PORT } from "./config.js";
import { sendCardsToChat, sendCardsToUser } from "./feishu-api.js";
import { fetchAllNews } from "./fetcher.js";
import { processNews } from "./processor.js";
import { buildFeishuCards } from "./formatter.js";

const DEBUG = process.env.DEBUG === "1";

function log(label: string, data?: any): void {
  const ts = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  if (data !== undefined) {
    console.log(`[${ts}] [${label}]`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${ts}] [${label}]`);
  }
}

const app = express();
app.use(express.json());

app.use((req: Request, _res: Response, next) => {
  if (DEBUG) {
    log("REQ", { method: req.method, path: req.path, body: req.body });
  }
  next();
});

app.post("/feishu/event", async (req: Request, res: Response) => {
  const body = req.body;
  log("收到请求", DEBUG ? body : body.type || body.header?.event_type || "未知类型");

  // URL 验证
  if (body.type === "url_verification") {
    log("URL_VERIFY", { challenge: body.challenge });
    res.json({ challenge: body.challenge });
    return;
  }

  log("EVENT_BODY", body);

  // 验证 token
  const token = body.header?.token || body.token || "";
  if (FEISHU_VERIFICATION_TOKEN && token && token !== FEISHU_VERIFICATION_TOKEN) {
    log("TOKEN_MISMATCH", { expected: FEISHU_VERIFICATION_TOKEN, received: token });
    res.status(401).json({ error: "invalid token" });
    return;
  }

  res.json({ code: 0 });

  try {
    await handleEvent(body);
  } catch (err) {
    log("EVENT_ERROR", (err as Error).message);
    console.error((err as Error).stack);
  }
});

async function handleEvent(body: any): Promise<void> {
  const eventType =
    body.header?.event_type ||
    body.event_type ||
    body.event?.type ||
    "";

  log("EVENT_TYPE", eventType);

  // 用户发送消息（包含群聊）
  if (eventType === "im.message.receive_v1") {
    await handleMessageEvent(body);
    return;
  }

  // 机器人菜单点击
  if (eventType === "application.bot.menu_v6") {
    await handleMenuEvent(body);
    return;
  }

  if (eventType) {
    log("UNHANDLED_EVENT", eventType);
  }
}

async function handleMessageEvent(body: any): Promise<void> {
  const event = body.event || body;
  const message = event?.message;
  if (!message?.chat_id) {
    log("NO_CHAT_ID", message);
    return;
  }
  const chatId = message.chat_id;
  const msgText = extractText(message);

  log("MSG_TEXT", { text: msgText, chatId });

  const triggers = ["今日新闻", "新闻早报", "每日新闻", "早报", "news", "新闻"];
  if (triggers.some((t) => msgText.includes(t))) {
    log("START_FETCH", "消息触发新闻拉取...");
    await pushNewsToChat(chatId);
  }
}

async function handleMenuEvent(body: any): Promise<void> {
  const event = body.event || {};
  const openId = event.operator?.operator_id?.open_id;

  if (!openId) {
    log("NO_OPEN_ID", event);
    return;
  }

  log("MENU_CLICK", {
    eventKey: event.event_key,
    openId,
    timestamp: event.timestamp,
  });

  log("START_FETCH", "菜单触发新闻拉取...");
  await pushNewsToUser(openId);
}

function extractText(message: any): string {
  try {
    if (typeof message.content === "string") {
      const parsed = JSON.parse(message.content);
      return parsed.text || "";
    }
    return message.content?.text || "";
  } catch {
    return typeof message.content === "string" ? message.content : "";
  }
}

async function pushNewsToChat(chatId: string): Promise<void> {
  const cards = await fetchAndBuildCards();
  if (!cards) return;
  await sendCardsToChat(chatId, cards);
}

async function pushNewsToUser(openId: string): Promise<void> {
  const cards = await fetchAndBuildCards();
  if (!cards) return;
  await sendCardsToUser(openId, cards);
}

async function fetchAndBuildCards(): Promise<ReturnType<typeof buildFeishuCards> | null> {
  log("FETCHING", "开始拉取 RSS...");
  const rawNews = await fetchAllNews();

  if (rawNews.length === 0) {
    log("FETCH_EMPTY", "未拉取到任何新闻");
    return null;
  }

  log("PROCESSING", { count: rawNews.length });
  const { headlines, categorized } = processNews(rawNews);

  const catCount = Object.values(categorized).flat().length;
  log("PROCESSED", { headlines: headlines.length, categorized: catCount });

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const cards = buildFeishuCards(headlines, categorized, today);
  log("CARDS_BUILT", { cards: cards.length });
  return cards;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/debug/send", async (req: Request, res: Response) => {
  const chatId = req.body.chat_id;
  if (!chatId) {
    res.status(400).json({ error: "缺少 chat_id" });
    return;
  }
  res.json({ status: "processing" });
  await pushNewsToChat(chatId);
});

export function startServer(): void {
  app.listen(PORT, () => {
    log("SERVER_START", `端口 ${PORT}`);
    console.log(`[INFO] 健康检查: http://<你的IP>:${PORT}/health`);
    console.log(`[INFO] 事件回调: http://<你的IP>:${PORT}/feishu/event`);
    console.log(`[INFO] 开启调试: 启动时加上 DEBUG=1`);
  });
}
