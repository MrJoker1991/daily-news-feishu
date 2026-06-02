import axios from "axios";
import type { FeishuCard } from "./types.js";
import { FEISHU_APP_ID, FEISHU_APP_SECRET } from "./config.js";

let cachedToken = "";
let tokenExpireAt = 0;

function log(label: string, data?: any): void {
  const ts = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  if (data !== undefined) {
    console.log(`[${ts}] [${label}]`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${ts}] [${label}]`);
  }
}

export async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireAt - 60_000) {
    return cachedToken;
  }

  log("GET_TOKEN", { appId: FEISHU_APP_ID.slice(0, 8) + "..." });

  try {
    const { data } = await axios.post(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      { app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );

    log("TOKEN_RESULT", { code: data.code, msg: data.msg });

    if (data.code !== 0) {
      throw new Error(`获取 tenant_access_token 失败: ${JSON.stringify(data)}`);
    }

    cachedToken = data.tenant_access_token;
    tokenExpireAt = Date.now() + data.expire * 1000;
    log("TOKEN_OK", { expiresIn: data.expire });
    return cachedToken;
  } catch (err: any) {
    log("TOKEN_ERROR", {
      message: err.message,
      response: err.response?.data,
    });
    throw err;
  }
}

export async function sendCardsToChat(
  chatId: string,
  cards: FeishuCard[]
): Promise<void> {
  log("SEND_START", { chatId, cardCount: cards.length });

  let token: string;
  try {
    token = await getTenantAccessToken();
  } catch {
    log("SEND_SKIP_TOKEN", "无法获取 token，跳过发送");
    return;
  }

  for (let i = 0; i < cards.length; i++) {
    try {
      const body = {
        receive_id: chatId,
        msg_type: "interactive",
        content: JSON.stringify(cards[i]),
      };

      const { data } = await axios.post(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      log(`SEND_CARD_${i + 1}`, {
        code: data.code,
        msg: data.msg,
        messageId: data.data?.message_id,
      });

      if (data.code !== 0) {
        console.error(
          `[ERROR] 消息发送失败 (${i + 1}/${cards.length}): ${JSON.stringify(data)}`
        );
      }
    } catch (err: any) {
      console.error(
        `[ERROR] 消息发送异常 (${i + 1}/${cards.length}):`,
        err.message,
        err.response?.data
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
