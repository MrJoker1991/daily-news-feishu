import type { NewsItem, FeishuCard } from "./types.js";

const CATEGORY_ICONS: Record<string, string> = {
  "科技": "💻",
  "财经": "💰",
  "社会": "🌍",
  "科学": "🔬",
  "热点": "🔥",
  "综合": "📋",
};

function formatNewsList(items: NewsItem[], maxCount: number): string {
  return items
    .slice(0, maxCount)
    .map((item, i) => {
      const link = item.link ? ` [阅读](${item.link})` : "";
      return `${i + 1}. **${item.title}** — _${item.source}_${link}`;
    })
    .join("\n");
}

function formatOneLiners(items: NewsItem[]): string {
  const pool = items.slice(0, 20);
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 10);
  return shuffled
    .map((item) => {
      const link = item.link ? ` [→](${item.link})` : "";
      return `• ${item.title}${link}`;
    })
    .join("\n");
}

function buildMarkdownContent(
  headlines: NewsItem[],
  categorized: Record<string, NewsItem[]>,
  dateStr: string
): string {
  const parts: string[] = [];

  parts.push(`📰 **每日新闻早报 — ${dateStr}**\n`);

  parts.push(`🔥 **今日头条**\n${formatNewsList(headlines, 15)}\n`);

  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    const icon = CATEGORY_ICONS[cat] || "📌";
    parts.push(`${icon} **${cat}**\n${formatNewsList(items, 8)}\n`);
  }

  const allItems = Object.values(categorized).flat();
  parts.push(`📝 **一句话看点**\n${formatOneLiners(allItems)}\n`);

  parts.push(
    `> 🤖 自动生成于 ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
  );

  return parts.join("\n");
}

function splitMarkdown(content: string, maxLen: number): string[] {
  const chunks: string[] = [];
  const lines = content.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length > maxLen) {
      chunks.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks.length > 0 ? chunks : [content];
}

export function buildFeishuCards(
  headlines: NewsItem[],
  categorized: Record<string, NewsItem[]>,
  dateStr: string
): FeishuCard[] {
  const md = buildMarkdownContent(headlines, categorized, dateStr);
  const chunks = splitMarkdown(md, 25000);

  return chunks.map((chunk, i) => ({
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content:
          chunks.length > 1
            ? `每日新闻早报 (${i + 1}/${chunks.length})`
            : "每日新闻早报",
      },
      template: "blue",
    },
    elements: [{ tag: "markdown", content: chunk }],
  }));
}
