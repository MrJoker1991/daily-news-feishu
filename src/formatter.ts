import type { NewsItem, FeishuCard } from "./types.js";

const CATEGORY_ICONS: Record<string, string> = {
  "科技": "💻",
  "财经": "💰",
  "社会": "🌍",
  "科学": "🔬",
  "热点": "🔥",
  "综合": "📋",
};

const GAP = "\n\n"; // 条目间距
const GREY = (t: string) => `<font color='grey'>${t}</font>`;

function buildHeadlinesSection(items: NewsItem[]): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < Math.min(items.length, 12); i++) {
    const item = items[i];
    const link = item.link ? `[阅读](${item.link})` : "";
    parts.push(
      [
        `**${i + 1}.  ${item.title}**  ${GREY(link)}`,
        GREY(`　　　${item.source}  ·  热度 ${item.score}`),
      ].join("\n")
    );
  }
  return parts.join(GAP);
}

function buildCategorySection(catName: string, items: NewsItem[]): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    const item = items[i];
    const link = item.link ? `[→](${item.link})` : "";
    parts.push(
      [
        `**${item.title}**  ${GREY(link)}`,
        GREY(`　　　${item.source}`),
      ].join("\n")
    );
  }
  return parts.join(GAP);
}

function buildOneLiners(items: NewsItem[]): string {
  const pool = items.sort(() => Math.random() - 0.5).slice(0, 8);
  const parts: string[] = [];
  for (const item of pool) {
    const oneLine = item.summary?.split(/[。！？\n]/)[0] || item.title;
    parts.push(GREY(oneLine.slice(0, 100)));
  }
  return parts.join(GAP);
}

export function buildFeishuCards(
  headlines: NewsItem[],
  categorized: Record<string, NewsItem[]>,
  dateStr: string
): FeishuCard[] {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  const sections: Record<string, any>[] = [];

  // 标题区
  sections.push({
    tag: "markdown",
    content: `📰 **每日新闻早报**\n${GREY(dateStr)}`,
  });
  sections.push({ tag: "hr" });

  // 今日头条
  sections.push({
    tag: "markdown",
    content: `🔥 **今日头条**\n${buildHeadlinesSection(headlines)}`,
  });
  sections.push({ tag: "hr" });

  // 各分类
  const catOrder = ["科技", "财经", "社会", "热点", "综合"];
  for (const cat of catOrder) {
    const items = categorized[cat];
    if (!items || items.length === 0) continue;
    const icon = CATEGORY_ICONS[cat] || "📌";
    sections.push({
      tag: "markdown",
      content: `${icon} **${cat}**\n${buildCategorySection(cat, items)}`,
    });
    sections.push({ tag: "hr" });
  }

  // 一句话速览
  const allItems = Object.values(categorized).flat();
  sections.push({
    tag: "markdown",
    content: `📝 **今日速览**\n${buildOneLiners(allItems)}`,
  });
  sections.push({ tag: "hr" });

  // 页脚
  sections.push({
    tag: "note",
    elements: [{ tag: "plain_text", content: `🤖 自动生成于 ${now}` }],
  });

  // 分卡
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

function makeCard(elements: Record<string, any>[], part: number): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: part > 0 ? `每日新闻早报 (${part})` : "每日新闻早报",
      },
      template: "blue",
    },
    elements,
  };
}
