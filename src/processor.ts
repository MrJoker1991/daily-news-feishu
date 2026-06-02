import { compareTwoStrings } from "string-similarity";
import type { NewsItem } from "./types.js";
import { feedsConfig } from "./config.js";

const SIMILARITY_THRESHOLD = 0.65;

// 重要关键词，命中越多分越高
const KEYWORD_SCORE_MAP: [string, number][] = [
  ["AI", 5],
  ["人工智能", 5],
  ["发布", 3],
  ["上市", 3],
  ["突破", 4],
  ["政策", 4],
  ["制裁", 4],
  ["收购", 3],
  ["融资", 3],
  ["裁员", 3],
  ["芯片", 4],
  ["火箭", 3],
  ["癌症", 3],
  ["疫苗", 3],
  ["地震", 5],
  ["重大", 3],
  ["首次", 4],
  ["万亿", 3],
  ["GDP", 3],
  ["央行", 3],
  ["降息", 3],
  ["加息", 3],
  ["关税", 4],
  ["战争", 5],
  ["发射", 3],
  ["苹果", 2],
  ["华为", 3],
  ["特斯拉", 2],
  ["大模型", 4],
  ["OpenAI", 4],
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "科技": ["AI", "芯片", "手机", "软件", "互联网", "App", "苹果", "华为", "小米", "大模型", "GPU", "CPU"],
  "财经": ["股市", "基金", "人民币", "美元", "央行", "利率", "A股", "港股", "美股", "IPO", "融资", "GDP"],
  "社会": ["政策", "政府", "法院", "教育", "医疗", "交通", "住房", "环保"],
  "科学": ["研究", "发现", "NASA", "SpaceX", "基因", "量子", "火星", "月球", "生物", "物理"],
};

function getSourceWeight(source: string): number {
  for (const feeds of Object.values(feedsConfig.feeds)) {
    const found = feeds.find((f) => f.name === source);
    if (found) return found.weight;
  }
  return 1;
}

function isToday(pubDate: string): boolean {
  if (!pubDate) return true; // 没有日期则保留
  const now = new Date();
  const pub = new Date(pubDate);
  const diffMs = now.getTime() - pub.getTime();
  return diffMs < 48 * 60 * 60 * 1000; // 48小时内
}

function computeScore(item: NewsItem): number {
  let score = 0;

  // 来源权重
  score += getSourceWeight(item.source);

  // 关键词命中
  for (const [kw, pts] of KEYWORD_SCORE_MAP) {
    if (item.title.includes(kw) || item.summary.includes(kw)) {
      score += pts;
    }
  }

  // 标题长度（太短或太长扣分，30-80字最佳）
  const len = item.title.length;
  if (len >= 15 && len <= 60) score += 2;
  else if (len < 10 || len > 100) score -= 1;

  // 有时间戳且越近加分
  if (item.pubDate) {
    const pubTime = new Date(item.pubDate).getTime();
    if (!isNaN(pubTime)) {
      const hoursAgo = (Date.now() - pubTime) / (1000 * 60 * 60);
      if (hoursAgo < 6) score += 3;
      else if (hoursAgo < 12) score += 2;
      else if (hoursAgo < 24) score += 1;
    }
  }

  return score;
}

function refineCategory(item: NewsItem): string {
  // 如果原标题中包含其他分类关键词，尝试重新归类
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (item.category === cat) continue;
    for (const kw of keywords) {
      if (item.title.includes(kw)) {
        return cat;
      }
    }
  }
  return item.category;
}

export function processNews(newsItems: NewsItem[]): {
  headlines: NewsItem[];
  categorized: Record<string, NewsItem[]>;
} {
  // 过滤48小时外的旧闻
  const recent = newsItems.filter((item) => isToday(item.pubDate));

  // 去重
  const deduped = deduplicate(recent);

  // 评分
  for (const item of deduped) {
    item.score = computeScore(item);
    item.category = refineCategory(item);
  }

  // 按分数降序排序
  deduped.sort((a, b) => b.score - a.score);

  // 今日头条：Top 15
  const headlines = deduped.slice(0, 15);

  // 按分类分组
  const categorized: Record<string, NewsItem[]> = {};
  for (const item of deduped) {
    const cat = item.category || "综合";
    if (!categorized[cat]) categorized[cat] = [];
    if (categorized[cat].length < 8) {
      categorized[cat].push(item);
    }
  }

  return { headlines, categorized };
}

function deduplicate(items: NewsItem[]): NewsItem[] {
  const result: NewsItem[] = [];

  for (const item of items) {
    const isDup = result.some(
      (r) => compareTwoStrings(r.title, item.title) >= SIMILARITY_THRESHOLD
    );
    if (!isDup) {
      result.push(item);
    }
  }

  return result;
}
