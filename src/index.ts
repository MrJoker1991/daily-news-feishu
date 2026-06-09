import { fetchAllNews, fetchWeather, fetchStockIndex } from "./fetcher.js";
import { processNews } from "./processor.js";
import { buildSummaryCard } from "./formatter.js";
import { pushToFeishuWebhook } from "./pusher.js";
import { startScheduler } from "./scheduler.js";
import { startServer } from "./server.js";
import { loadPushedLinks, savePushedLinks, getNewItems } from "./push-log.js";
import { WEATHER_CITY } from "./config.js";

async function fetchExtras(): Promise<{ weather?: string; stock?: string }> {
  const [weather, stock] = await Promise.all([
    fetchWeather(WEATHER_CITY),
    fetchStockIndex(),
  ]);

  const parts: string[] = [];
  if (weather) parts.push(`${weather.text} ${weather.temp}`);
  if (stock) {
    const arrow = parseFloat(stock.change) >= 0 ? "↑" : "↓";
    parts.push(`上证 ${stock.price} ${arrow}${stock.changePct}%`);
  }

  return { weather: parts.join("  ·  ") || undefined };
}

export async function runDailyTask(): Promise<void> {
  console.log("[INFO] 开始拉取新闻...");
  const rawNews = await fetchAllNews();

  if (rawNews.length === 0) {
    console.warn("[WARN] 未拉取到任何新闻，跳过推送");
    return;
  }

  console.log("[INFO] 处理新闻（去重 + 评分 + 分类）...");
  const { headlines, categorized } = processNews(rawNews);

  // 过滤已推送过的内容（午间/晚间避免重复）
  const allProcessed = Object.values(categorized).flat();
  const pushed = loadPushedLinks();
  const { fresh } = getNewItems(allProcessed, pushed);

  console.log(
    `[INFO] 处理后: 头条 ${headlines.length} 条, 分类合计 ${allProcessed.length} 条, ` +
    `新增 ${fresh.length} 条 (已推过 ${allProcessed.length - fresh.length} 条)`
  );

  // 如果新增太少（< 20 条），仍然推送全部
  const itemsToPush = fresh.length >= 20 ? fresh : allProcessed;

  console.log("[INFO] 拉取天气和股市...");
  const extras = await fetchExtras();

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  console.log("[INFO] 生成飞书消息卡片...");
  const cards = buildSummaryCard(headlines, itemsToPush, today, extras);

  console.log(`[INFO] 推送中 (${cards.length} 张卡片)...`);
  const success = await pushToFeishuWebhook(cards);

  if (success) {
    // 记录已推送的链接
    const allLinks = itemsToPush.map((item) => item.link).filter(Boolean);
    savePushedLinks(allLinks);
    console.log("[OK] 每日新闻推送完成!");
  } else {
    console.error("[ERROR] 推送过程中出现失败");
  }
}

// 入口
const args = process.argv.slice(2);

if (args.includes("--server")) {
  startScheduler();
  startServer();
} else if (args.includes("--serve")) {
  startScheduler();
} else {
  runDailyTask()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[FATAL]", err);
      process.exit(1);
    });
}
