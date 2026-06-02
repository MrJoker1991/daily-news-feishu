import { fetchAllNews } from "./fetcher.js";
import { processNews } from "./processor.js";
import { buildFeishuCards } from "./formatter.js";
import { pushToFeishuWebhook } from "./pusher.js";
import { startScheduler } from "./scheduler.js";
import { startServer } from "./server.js";

export async function runDailyTask(): Promise<void> {
  console.log("[INFO] 开始拉取新闻...");
  const rawNews = await fetchAllNews();

  if (rawNews.length === 0) {
    console.warn("[WARN] 未拉取到任何新闻，跳过推送");
    return;
  }

  console.log("[INFO] 处理新闻（去重 + 评分 + 分类）...");
  const { headlines, categorized } = processNews(rawNews);

  const catCount = Object.values(categorized).flat().length;
  console.log(
    `[INFO] 处理后: 头条 ${headlines.length} 条, 分类合计 ${catCount} 条`
  );

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  console.log("[INFO] 生成飞书消息卡片...");
  const cards = buildFeishuCards(headlines, categorized, today);

  console.log(`[INFO] 推送中 (${cards.length} 张卡片)...`);
  const success = await pushToFeishuWebhook(cards);

  if (success) {
    console.log("[OK] 每日新闻推送完成!");
  } else {
    console.error("[ERROR] 推送过程中出现失败");
  }
}

// 入口
const args = process.argv.slice(2);

if (args.includes("--server")) {
  // HTTP 服务模式：接收飞书菜单回调
  startServer();
} else if (args.includes("--serve")) {
  // 定时任务模式
  startScheduler();
} else {
  // 手动单次执行
  runDailyTask()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[FATAL]", err);
      process.exit(1);
    });
}
