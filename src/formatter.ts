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

// 统一的条目格式
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

// 单源卡片（流式 + 批量共用）
export function buildSourceCard(
  source: string,
  items: NewsItem[],
  isFirst: boolean,
  totalSources: number
): FeishuCard {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { icon, label } = periodTitle();
  const elements: Record<string, any>[] = [];

  const body = `**${source}**  ${GREY(`(${items.length}条)`)}\n${formatItems(items, 8)}`;

  if (isFirst) {
    // 第一张：带标题头和头条
    elements.push({
      tag: "markdown",
      content: `${icon} **${label}**\n${GREY(now)}`,
    });
    elements.push({ tag: "hr" });

    // 取本来源前 3 条作为头条预览
    const top3 = items.slice(0, 3);
    if (top3.length > 0) {
      const hlParts: string[] = [];
      for (let i = 0; i < top3.length; i++) {
        const item = top3[i];
        const link = item.link ? `[阅读](${item.link})` : "";
        hlParts.push(`**${i + 1}.  ${item.title}**  ${GREY(link)}`);
      }
      elements.push({
        tag: "markdown",
        content: `🔥 **今日头条**\n${hlParts.join("\n\n")}`,
      });
      elements.push({ tag: "hr" });
    }

    elements.push({ tag: "markdown", content: `${body}\n\n---\n${GREY(`共 ${totalSources} 个来源 · 更多内容加载中…`)}` });
  } else {
    elements.push({ tag: "markdown", content: body });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: isFirst ? `${icon} ${label}` : `📌 ${source}`,
      },
      template: isFirst ? "blue" : "wathet",
    },
    elements,
  };
}

// 汇总卡片（流式结束 + 批量定时推送）
export function buildSummaryCard(
  headlines: NewsItem[],
  allItems: NewsItem[],
  dateStr: string
): FeishuCard[] {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { icon, label } = periodTitle();

  const elements: Record<string, any>[] = [];

  // 标题
  elements.push({
    tag: "markdown",
    content: `${icon} **${label}**\n${GREY(dateStr + "  ·  " + allItems.length + " 条新闻")}`,
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
      cards.push({
        config: { wide_screen_mode: true },
        header: {
          title: {
            tag: "plain_text",
            content: cards.length > 0 ? `${icon} ${label} (${cards.length + 1})` : `${icon} ${label}`,
          },
          template: "blue",
        },
        elements: currentElements,
      });
      currentElements = [];
      currentSize = 0;
    }
    currentElements.push(sec);
    currentSize += secSize;
  }

  if (currentElements.length > 0) {
    cards.push({
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: `${icon} ${label}` },
        template: "blue",
      },
      elements: currentElements,
    });
  }

  return cards;
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
