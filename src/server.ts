import express from "express";
import type { Request, Response } from "express";
import { FEISHU_VERIFICATION_TOKEN, PORT } from "./config.js";
import { sendCardsToChat } from "./feishu-api.js";
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

// 调试：打印所有请求
app.use((req: Request, _res: Response, next) => {
  if (DEBUG) {
    log("REQ", { method: req.method, path: req.path, body: req.body });
  }
  next();
});

// URL 验证 / 事件接收
app.post("/feishu/event", async (req: Request, res: Response) => {
  const body = req.body;
  log("收到请求", DEBUG ? body : body.type || body.header?.event_type || "未知类型");

  // URL 验证
  if (body.type === "url_verification") {
    log("URL_VERIFY", { challenge: body.challenge });
    res.json({ challenge: body.challenge });
    return;
  }

  // 打印完整事件结构（关键：确认飞书实际发来的格式）
  log("EVENT_BODY", body);

  // 验证 token
  const token = body.header?.token || body.token || "";
  if (FEISHU_VERIFICATION_TOKEN && token && token !== FEISHU_VERIFICATION_TOKEN) {
    log("TOKEN_MISMATCH", { expected: FEISHU_VERIFICATION_TOKEN, received: token });
    res.status(401).json({ error: "invalid token" });
    return;
  }

  // 立即返回 200
  res.json({ code: 0 });

  // 异步处理
  try {
    await handleEvent(body);
  } catch (err) {
    log("EVENT_ERROR", (err as Error).message);
    console.error((err as Error).stack);
  }
});

async function handleEvent(body: any): Promise<void> {
  // 尝试多种可能的事件类型字段位置
  const eventType =
    body.header?.event_type ||
    body.event_type ||
    body.event?.type ||
    "";

  log("EVENT_TYPE", eventType);

  // 消息事件
  if (eventType === "im.message.receive_v1") {
    const event = body.event || body;
    const message = event?.message;

    log("MESSAGE", message);

    if (!message) {
      log("NO_MESSAGE", event);
      return;
    }

    const chatId = message.chat_id;
    if (!chatId) {
      log("NO_CHAT_ID", message);
      return;
    }

    // 解析消息内容（飞书消息 content 是 JSON 字符串）
    let msgText = "";
    try {
      const content = typeof message.content === "string"
        ? JSON.parse(message.content)
        : message.content || {};
      msgText = content.text || content.title || "";

      // 如果 content 本身就是文本（非 JSON），直接使用
      if (typeof message.content === "string" && !msgText) {
        try {
          // 尝试解析为 JSON
          const parsed = JSON.parse(message.content);
          msgText = parsed.text || parsed.title || "";
        } catch {
          // 纯文本内容
          msgText = message.content;
        }
      }
    } catch {
      msgText = "";
    }

    log("MSG_TEXT", { text: msgText, chatId });

    // 匹配触发关键词
    const triggers = ["今日新闻", "新闻早报", "每日新闻", "早报", "news", "新闻"];
    const matched = triggers.some((t) => msgText.includes(t));

    if (!matched) {
      log("NO_MATCH", "消息不匹配触发关键词，忽略");
      return;
    }

    log("START_FETCH", "触发新闻拉取...");
    await pushNewsToChat(chatId);
  } else if (eventType) {
    log("UNHANDLED_EVENT", eventType);
  }
}

async function pushNewsToChat(chatId: string): Promise<void> {
  log("FETCHING", "开始拉取 RSS...");
  const rawNews = await fetchAllNews();

  if (rawNews.length === 0) {
    log("FETCH_EMPTY", "未拉取到任何新闻");
    return;
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
  log("SENDING", { cards: cards.length, chatId });
  await sendCardsToChat(chatId, cards);
  log("DONE", "推送完成");
}

// 健康检查
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 调试端点：手动触发推送（带 chat_id 参数）
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
