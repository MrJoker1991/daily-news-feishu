import type { NewsItem } from "./types.js";
import { feedsConfig } from "./config.js";

// 重要关键词，命中越多分越高
const KEYWORD_SCORE_MAP: [string, number][] = [
  ["AI", 5], ["人工智能", 5], ["发布", 3], ["上市", 3],
  ["突破", 4], ["政策", 4], ["制裁", 4], ["收购", 3],
  ["融资", 3], ["裁员", 3], ["芯片", 4], ["火箭", 3],
  ["癌症", 3], ["疫苗", 3], ["地震", 5], ["重大", 3],
  ["首次", 4], ["万亿", 3], ["GDP", 3], ["央行", 3],
  ["降息", 3], ["加息", 3], ["关税", 4], ["战争", 5],
  ["发射", 3], ["苹果", 2], ["华为", 3], ["特斯拉", 2],
  ["大模型", 4], ["OpenAI", 4],
  ["A股", 4], ["涨停", 4], ["跌停", 4], ["牛市", 3],
  ["熊市", 3], ["大盘", 3], ["上证", 3], ["深证", 3],
  ["创业板", 3], ["科创板", 3], ["北交所", 3], ["券商", 2],
  ["分红", 2], ["回购", 2], ["ST", 2], ["退市", 3], ["ETF", 2],
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "科技": ["AI", "芯片", "手机", "软件", "互联网", "App", "苹果", "华为", "小米", "大模型", "GPU", "CPU"],
  "财经": ["股市", "基金", "人民币", "美元", "央行", "利率", "A股", "港股", "美股", "IPO", "融资", "GDP"],
  "社会": ["政策", "政府", "法院", "教育", "医疗", "交通", "住房", "环保"],
  "科学": ["研究", "发现", "NASA", "SpaceX", "基因", "量子", "火星", "月球", "生物", "物理"],
};

// 语义去重：提取标题中的关键词
const STOP_WORDS = new Set([
  "的", "了", "在", "是", "有", "和", "也", "就", "都", "而", "及", "与",
  "这", "那", "或", "但", "不", "被", "从", "到", "对", "把", "让", "向",
  "为", "因", "所", "以", "等", "个", "之", "其", "中", "将", "已", "可",
  "能", "会", "要", "又", "更", "很", "最", "再", "才", "便", "只", "没",
  "上", "下", "前", "后", "里", "外", "大", "小", "多", "少", "新", "旧",
  "高", "低", "长", "短", "好", "坏", "快", "慢", "早", "晚", "各", "每",
  "某", "此", "该", "本", "什么", "怎么", "如何", "为何", "哪些", "多少",
  "来", "去", "做", "说", "看", "想", "知道", "可以", "需要", "应该",
  "可能", "已经", "正在", "一直", "还是", "不过", "但是", "因为",
  "所以", "如果", "虽然", "然而", "而且", "然后", "之后", "之前",
  "今天", "昨天", "明天", "今年", "去年", "一个", "一种", "一些",
  "他们", "我们", "你们", "她们", "自己", "这个", "那个", "什么",
  "吗", "呢", "吧", "啊", "哦", "嗯", "啦", "呀", "么",
]);

function extractKeywords(title: string): Set<string> {
  // 简单分词：按标点和空格分割，过滤停用词和短词
  const raw = title.replace(/[，,。！？、：；（）《》""''【】\[\]{}·\s]+/g, "|");
  const words = raw.split("|").filter((w) => {
    if (w.length < 2) return false;
    if (STOP_WORDS.has(w)) return false;
    return true;
  });
  return new Set(words);
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  let overlap = 0;
  for (const w of a) {
    // 检查完全匹配或包含关系
    for (const w2 of b) {
      if (w === w2 || w.includes(w2) || w2.includes(w)) {
        overlap++;
        break;
      }
    }
  }
  return overlap;
}

function getSourceWeight(source: string): number {
  for (const feeds of Object.values(feedsConfig.feeds)) {
    const found = feeds.find((f) => f.name === source);
    if (found) return found.weight;
  }
  return 1;
}

function isRecent(pubDate: string): boolean {
  if (!pubDate) return true;
  const now = new Date();
  const pub = new Date(pubDate);
  return now.getTime() - pub.getTime() < 24 * 60 * 60 * 1000;
}

function computeScore(item: NewsItem): number {
  let score = getSourceWeight(item.source);

  for (const [kw, pts] of KEYWORD_SCORE_MAP) {
    if (item.title.includes(kw) || item.summary.includes(kw)) score += pts;
  }

  const len = item.title.length;
  if (len >= 15 && len <= 60) score += 2;
  else if (len < 10 || len > 100) score -= 1;

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
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (item.category === cat) continue;
    for (const kw of keywords) {
      if (item.title.includes(kw)) return cat;
    }
  }
  return item.category;
}

export function processNews(newsItems: NewsItem[]): {
  headlines: NewsItem[];
  categorized: Record<string, NewsItem[]>;
} {
  // 24小时过滤
  const recent = newsItems.filter((item) => isRecent(item.pubDate));

  // 语义去重：关键词重叠 ≥ 2 个视为重复
  const deduped = semanticDedup(recent);

  // 评分
  for (const item of deduped) {
    item.score = computeScore(item);
    item.category = refineCategory(item);
  }

  deduped.sort((a, b) => b.score - a.score);

  const headlines = deduped.slice(0, 15);

  const categorized: Record<string, NewsItem[]> = {};
  for (const item of deduped) {
    const cat = item.category || "综合";
    if (!categorized[cat]) categorized[cat] = [];
    if (categorized[cat].length < 8) categorized[cat].push(item);
  }

  return { headlines, categorized };
}

function semanticDedup(items: NewsItem[]): NewsItem[] {
  const result: NewsItem[] = [];
  const keywordsCache: Set<string>[] = [];

  for (const item of items) {
    const kw = extractKeywords(item.title);
    const isDup = keywordsCache.some((cached) => keywordOverlap(kw, cached) >= 2);

    if (!isDup) {
      result.push(item);
      keywordsCache.push(kw);
    }
  }

  return result;
}
