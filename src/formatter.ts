import type { NewsItem, FeishuCard } from "./types.js";

const GREY = (t: string) => `<font color='grey'>${t}</font>`;

export function periodTitle(): { label: string; icon: string } {
  const h = new Date().getHours();
  if (h < 12) return { icon: "🌅", label: "新闻早报" };
  if (h < 18) return { icon: "☀️", label: "午间速递" };
  return { icon: "🌙", label: "晚间速递" };
}

const SOURCE_ORDER = [
  "36氪", "IT之家", "少数派",
  "华尔街见闻", "财新网", "雪球",
  "界面新闻",
  "百度热搜", "知乎日报",
];

function formatItems(items: NewsItem[], maxCount: number, showScore = false): string {
  const parts: string[] = [];
  for (let i = 0; i < Math.min(items.length, maxCount); i++) {
    const item = items[i];
    const link = item.link ? `[→](${item.link})` : "";
    const scoreLine = showScore
      ? `\n${GREY(`　　　${item.source}  ·  热度 ${item.score}`)}`
      : "";
    parts.push(`**${item.title}**  ${GREY(link)}${scoreLine}`);
  }
  return parts.join("\n\n");
}

function groupBySource(items: NewsItem[]): Map<string, NewsItem[]> {
  const map = new Map<string, NewsItem[]>();
  for (const item of items) {
    const list = map.get(item.source) || [];
    list.push(item);
    map.set(item.source, list);
  }
  return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
}

// 单源卡片（带序号 n/total）
export function buildSourceCard(
  source: string,
  items: NewsItem[],
  index: number,
  total: number
): FeishuCard {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { icon, label } = periodTitle();
  const isFirst = index === 0;
  const tag = `${index + 1}/${total}`;

  const body = `**${source}**  ${GREY(`(${items.length}条)`)}\n${formatItems(items, 8)}`;

  const elements: Record<string, any>[] = [];

  if (isFirst) {
    elements.push({
      tag: "markdown",
      content: `${icon} **${label}**  ${GREY(tag)}\n${GREY(now)}`,
    });
    elements.push({ tag: "hr" });

    const top3 = items.slice(0, 3);
    if (top3.length > 0) {
      const hlParts = top3.map((item, i) => {
        const link = item.link ? `[阅读](${item.link})` : "";
        return `**${i + 1}.  ${item.title}**  ${GREY(link)}`;
      });
      elements.push({
        tag: "markdown",
        content: `🔥 **今日头条**\n${hlParts.join("\n\n")}`,
      });
      elements.push({ tag: "hr" });
    }

    elements.push({
      tag: "markdown",
      content: `${body}\n\n---\n${GREY(`共 ${total} 个来源 · 陆续加载中…`)}`,
    });
  } else {
    elements.push({ tag: "markdown", content: body });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: isFirst ? `${icon} ${label}` : `${tag} 📌 ${source}`,
      },
      template: isFirst ? "blue" : "wathet",
    },
    elements,
  };
}

// 汇总卡片（带序号 + 天气股市）
export function buildSummaryCard(
  headlines: NewsItem[],
  allItems: NewsItem[],
  dateStr: string,
  extras?: { weather?: string; stock?: string }
): FeishuCard[] {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { icon, label } = periodTitle();

  const elements: Record<string, any>[] = [];

  // 标题
  let subtitle = `${dateStr}  ·  ${allItems.length} 条新闻`;
  if (extras?.weather) subtitle += `  ·  ${extras.weather}`;
  if (extras?.stock) subtitle += `  ·  ${extras.stock}`;

  elements.push({
    tag: "markdown",
    content: `${icon} **${label}**\n${GREY(subtitle)}`,
  });
  elements.push({ tag: "hr" });

  // 今日头条
  if (headlines.length > 0) {
    elements.push({
      tag: "markdown",
      content: `🔥 **今日头条**\n${formatItems(headlines, 10, true)}`,
    });
    elements.push({ tag: "hr" });
  }

  // 按来源排列
  const sourceMap = groupBySource(allItems);
  for (const src of SOURCE_ORDER) {
    const items = sourceMap.get(src);
    if (!items || items.length === 0) continue;
    sourceMap.delete(src);
    elements.push({
      tag: "markdown",
      content: `**${src}**  ${GREY(`(${items.length}条)`)}\n${formatItems(items, 6)}`,
    });
    elements.push({ tag: "hr" });
  }
  for (const [src, items] of sourceMap) {
    elements.push({
      tag: "markdown",
      content: `**${src}**  ${GREY(`(${items.length}条)`)}\n${formatItems(items, 6)}`,
    });
    elements.push({ tag: "hr" });
  }

  // 页脚
  elements.push({
    tag: "note",
    elements: [{ tag: "plain_text", content: `🤖 自动生成于 ${now}` }],
  });

  // 分卡
  const maxCardSize = 25000;
  const cards: FeishuCard[] = [];
  let currentElements: Record<string, any>[] = [];
  let currentSize = 0;

  for (const sec of elements) {
    const secSize = JSON.stringify(sec).length;
    if (currentSize + secSize > maxCardSize && currentElements.length > 0) {
      const cardNum = cards.length + 1;
      cards.push(makeSubCard(currentElements, cardNum));
      currentElements = [];
      currentSize = 0;
    }
    currentElements.push(sec);
    currentSize += secSize;
  }

  if (currentElements.length > 0) {
    cards.push(makeSubCard(currentElements, cards.length > 0 ? cards.length + 1 : 0));
  }

  return cards;
}

function makeSubCard(elements: Record<string, any>[], part: number): FeishuCard {
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
