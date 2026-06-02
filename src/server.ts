import express from "express";
import type { Request, Response } from "express";
import { FEISHU_VERIFICATION_TOKEN, PORT } from "./config.js";
import { runDailyTask } from "./index.js";
import { sendCardsToChat } from "./feishu-api.js";
import { fetchAllNews } from "./fetcher.js";
import { processNews } from "./processor.js";
import { buildFeishuCards } from "./formatter.js";

const app = express();
app.use(express.json());

// URL 验证（飞书配置事件订阅地址时触发）
app.post("/feishu/event", async (req: Request, res: Response) => {
  const body = req.body;

  // URL 验证
  if (body.type === "url_verification") {
    console.log("[INFO] 收到 URL 验证请求");
    res.json({ challenge: body.challenge });
    return;
  }

  // 验证 token
  const token = body.header?.token || body.token || "";
  if (FEISHU_VERIFICATION_TOKEN && token !== FEISHU_VERIFICATION_TOKEN) {
    console.warn("[WARN] Token 验证失败");
    res.status(401).json({ error: "invalid token" });
    return;
  }

  // 立即返回 200，避免飞书超时重试
  res.json({ code: 0 });

  // 异步处理事件
  try {
    await handleEvent(body);
  } catch (err) {
    console.error("[ERROR] 事件处理失败:", (err as Error).message);
  }
});

async function handleEvent(body: any): Promise<void> {
  const eventType = body.header?.event_type || "";

  // 消息接收事件（菜单点击发送的消息）
  if (eventType === "im.message.receive_v1") {
    const event = body.event;
    const message = event?.message;
    const chatId = message?.chat_id;

    if (!chatId) {
      console.warn("[WARN] 消息事件缺少 chat_id");
      return;
    }

    // 解析消息内容
    let msgText = "";
    try {
      const content = JSON.parse(message.content || "{}");
      msgText = content.text || "";
    } catch {
      msgText = "";
    }

    console.log(`[INFO] 收到消息: "${msgText}" from chat: ${chatId}`);

    // 匹配触发关键词
    const triggers = ["今日新闻", "新闻早报", "每日新闻", "早报", "news", "新闻"];
    const matched = triggers.some((t) => msgText.includes(t));

    if (!matched) {
      console.log("[INFO] 消息不匹配触发关键词，忽略");
      return;
    }

    console.log("[INFO] 触发新闻推送...");
    await pushNewsToChat(chatId);
  }
}

async function pushNewsToChat(chatId: string): Promise<void> {
  const rawNews = await fetchAllNews();
  if (rawNews.length === 0) {
    console.warn("[WARN] 未拉取到任何新闻");
    return;
  }

  const { headlines, categorized } = processNews(rawNews);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const cards = buildFeishuCards(headlines, categorized, today);
  await sendCardsToChat(chatId, cards);
}

// 健康检查
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(`[INFO] HTTP 服务已启动 → http://0.0.0.0:${PORT}`);
    console.log(`[INFO] 飞书事件回调地址: http://<你的域名>:${PORT}/feishu/event`);
  });
}
