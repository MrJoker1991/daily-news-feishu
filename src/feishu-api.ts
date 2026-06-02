import axios from "axios";
import type { FeishuCard } from "./types.js";
import { FEISHU_APP_ID, FEISHU_APP_SECRET } from "./config.js";

let cachedToken = "";
let tokenExpireAt = 0;

export async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireAt - 60_000) {
    return cachedToken;
  }

  const { data } = await axios.post(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    { app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${JSON.stringify(data)}`);
  }

  cachedToken = data.tenant_access_token;
  tokenExpireAt = Date.now() + data.expire * 1000;
  return cachedToken;
}

export async function sendCardsToChat(
  chatId: string,
  cards: FeishuCard[]
): Promise<void> {
  const token = await getTenantAccessToken();

  for (let i = 0; i < cards.length; i++) {
    try {
      await axios.post(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        {
          receive_id: chatId,
          msg_type: "interactive",
          content: JSON.stringify(cards[i]),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );
      console.log(`[OK] 消息发送成功 (${i + 1}/${cards.length})`);
    } catch (err) {
      console.error(
        `[ERROR] 消息发送失败 (${i + 1}/${cards.length}): ${(err as Error).message}`
      );
    }

    if (i < cards.length - 1) {
      await sleep(500);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
