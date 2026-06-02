import type { NewsItem, FeishuCard } from "./types.js";

const GREY = (t: string) => `<font color='grey'>${t}</font>`;

function periodTitle(): { label: string; icon: string } {
  const h = new Date().getHours();
  if (h < 12) return { icon: "🌅", label: "新闻早报" };
  if (h < 18) return { icon: "☀️", label: "午间速递" };
  return { icon: "🌙", label: "晚间速递" };
}

// 今日头条：跨来源高分聚合
function buildHeadlines(items: NewsItem[]): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const item = items[i];
    const link = item.link ? `[阅读](${item.link})` : "";
    parts.push(
      [
        `**${i + 1}.  ${item.title}**  ${GREY(link)}`,
        GREY(`　　　${item.source}  ·  热度 ${item.score}`),
      ].join("\n")
    );
  }
  return parts.join("\n\n");
}

// 按来源分组
function groupBySource(items: NewsItem[]): Map<string, NewsItem[]> {
  const map = new Map<string, NewsItem[]>();
  for (const item of items) {
    const list = map.get(item.source) || [];
    list.push(item);
    map.set(item.source, list);
  }
  // 按来源的新闻数量排序
  return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
}

function buildSourceBlock(source: string, items: NewsItem[]): string {
  const parts: string[] = [];
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    const item = items[i];
    const link = item.link ? `[→](${item.link})` : "";
    parts.push(`**${item.title}**  ${GREY(link)}`);
  }
  return `**${source}**  ${GREY(`(${items.length}条)`)}\n${parts.join("\n\n")}`;
}

export function buildFeishuCards(
  headlines: NewsItem[],
  categorized: Record<string, NewsItem[]>,
  dateStr: string
): FeishuCard[] {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { icon, label } = periodTitle();
  const allItems = Object.values(categorized).flat();

  const sections: Record<string, any>[] = [];

  // 标题区
  sections.push({
    tag: "markdown",
    content: `${icon} **${label}**\n${GREY(dateStr + "  ·  " + allItems.length + " 条新闻")}`,
  });
  sections.push({ tag: "hr" });

  // 今日头条
  if (headlines.length > 0) {
    sections.push({
      tag: "markdown",
      content: `🔥 **今日头条**\n${buildHeadlines(headlines)}`,
    });
    sections.push({ tag: "hr" });
  }

  // 按来源排列
  const sourceMap = groupBySource(allItems);
  const sourceOrder = [
    "36氪", "IT之家", "少数派",
    "华尔街见闻", "财新网", "雪球",
    "澎湃新闻", "界面新闻",
    "百度热搜", "知乎日报",
  ];
  for (const src of sourceOrder) {
    const items = sourceMap.get(src);
    if (!items || items.length === 0) continue;
    sourceMap.delete(src); // 标记已处理
    sections.push({
      tag: "markdown",
      content: buildSourceBlock(src, items),
    });
    sections.push({ tag: "hr" });
  }
  // 剩余的来源
  for (const [src, items] of sourceMap) {
    sections.push({
      tag: "markdown",
      content: buildSourceBlock(src, items),
    });
    sections.push({ tag: "hr" });
  }

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
  const { icon, label } = periodTitle();
  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: part > 0 ? `${icon} ${label} (${part})` : `${icon} ${label}`,
      },
      template: "blue",
    },
    elements,
  };
}
