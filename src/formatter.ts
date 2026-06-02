import type { NewsItem, FeishuCard } from "./types.js";

const CATEGORY_ICONS: Record<string, string> = {
  "科技": "💻",
  "财经": "💰",
  "社会": "🌍",
  "科学": "🔬",
  "热点": "🔥",
  "综合": "📋",
};

// 头条：编号 + 来源标签
function buildHeadlinesSection(items: NewsItem[]): string {
  if (items.length === 0) return "";
  const lines = ["**🔥 今日头条**\n"];
  for (let i = 0; i < Math.min(items.length, 12); i++) {
    const item = items[i];
    const link = item.link ? ` [阅读](${item.link})` : "";
    lines.push(`${i + 1}. **${item.title}**  ${link}`);
    lines.push(`   <font color='grey'>${item.source} · 热度 ${item.score}</font>`);
  }
  return lines.join("\n");
}

// 分类新闻：简洁条目
function buildCategorySection(catName: string, items: NewsItem[]): string {
  if (items.length === 0) return "";
  const icon = CATEGORY_ICONS[catName] || "📌";
  const lines = [`**${icon} ${catName}**\n`];
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    const item = items[i];
    const link = item.link ? ` [→](${item.link})` : "";
    lines.push(`• **${item.title}**${link}`);
  }
  return lines.join("\n");
}

// 一句话看点
function buildOneLiners(items: NewsItem[]): string {
  const pool = items.sort(() => Math.random() - 0.5).slice(0, 8);
  const lines = ["**📝 一句话速览**\n"];
  for (const item of pool) {
    const link = item.link ? ` [→](${item.link})` : "";
    // 截取摘要第一句
    const oneLine = item.summary?.split(/[。！？]/)[0] || item.title;
    lines.push(`• ${oneLine.slice(0, 80)}${link}`);
  }
  return lines.join("\n");
}

export function buildFeishuCards(
  headlines: NewsItem[],
  categorized: Record<string, NewsItem[]>,
  dateStr: string
): FeishuCard[] {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  // 收集所有分类板块
  const sections: Record<string, any>[] = [];

  // 标题
  sections.push({
    tag: "markdown",
    content: `📰 **每日新闻早报 — ${dateStr}**`,
  });

  sections.push({ tag: "hr" });

  // 今日头条
  sections.push({ tag: "markdown", content: buildHeadlinesSection(headlines) });
  sections.push({ tag: "hr" });

  // 各分类
  const catOrder = ["科技", "财经", "社会", "热点", "综合"];
  for (const cat of catOrder) {
    const items = categorized[cat];
    if (!items || items.length === 0) continue;
    sections.push({ tag: "markdown", content: buildCategorySection(cat, items) });
    sections.push({ tag: "hr" });
  }

  // 一句话看点
  const allItems = Object.values(categorized).flat();
  sections.push({ tag: "markdown", content: buildOneLiners(allItems) });
  sections.push({ tag: "hr" });

  // 页脚
  sections.push({
    tag: "note",
    elements: [
      {
        tag: "plain_text",
        content: `🤖 自动生成于 ${now}`,
      },
    ],
  });

  // 估算每张卡片能装多少个 section，超出则分卡
  // Feishu 卡片消息 content 总长度限制约 30KB（JSON 序列化后）
  const maxCardSize = 25000;
  const cards: FeishuCard[] = [];
  let currentElements: Record<string, any>[] = [];
  let currentSize = 0;

  for (const sec of sections) {
    const secSize = JSON.stringify(sec).length;
    if (currentSize + secSize > maxCardSize && currentElements.length > 0) {
      cards.push(makeCard(currentElements, cards.length + 1));
      currentElements = [];
      currentSize = 0;
    }
    currentElements.push(sec);
    currentSize += secSize;
  }

  if (currentElements.length > 0) {
    cards.push(makeCard(currentElements, cards.length > 0 ? cards.length + 1 : 0));
  }

  return cards;
}

function makeCard(
  elements: Record<string, any>[],
  part: number
): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: part > 0 ? `每日新闻早报 (${part})` : "每日新闻早报",
      },
      template: "blue",
    },
    elements: elements,
  };
}
