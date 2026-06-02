import axios from "axios";
import type { FeishuCard } from "./types.js";
import { FEISHU_WEBHOOK_URL } from "./config.js";

export async function pushToFeishuWebhook(
  cards: FeishuCard[]
): Promise<boolean> {
  if (!FEISHU_WEBHOOK_URL || FEISHU_WEBHOOK_URL.includes("your-webhook-token")) {
    console.error("[ERROR] 未配置有效的 FEISHU_WEBHOOK_URL，请在 .env 中设置");
    return false;
  }

  let allSuccess = true;

  for (let i = 0; i < cards.length; i++) {
    const success = await sendOneCard(cards[i], i + 1, cards.length);
    if (!success) allSuccess = false;
    if (i < cards.length - 1) await sleep(1000);
  }

  return allSuccess;
}

async function sendOneCard(
  card: FeishuCard,
  index: number,
  total: number
): Promise<boolean> {
  const maxRetries = 2;
  const label = total > 1 ? ` (${index}/${total})` : "";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const { data } = await axios.post(
        FEISHU_WEBHOOK_URL,
        { msg_type: "interactive", card },
        { timeout: 30000 }
      );

      if (data.code === 0 || data.StatusCode === 0) {
        console.log(`[OK] Webhook 推送成功${label}`);
        return true;
      } else {
        console.warn(
          `[WARN] Webhook 返回异常${label}: ${JSON.stringify(data)}`
        );
      }
    } catch (err) {
      console.warn(
        `[WARN] Webhook 推送失败${label} (尝试 ${attempt}/${maxRetries + 1}): ${(err as Error).message}`
      );
    }

    if (attempt <= maxRetries) await sleep(5000);
  }

  console.error(`[ERROR] Webhook 推送最终失败${label}`);
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
