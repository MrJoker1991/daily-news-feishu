import Parser from "rss-parser";
import axios from "axios";
import type { NewsItem } from "./types.js";
import { feedsConfig } from "./config.js";

const FETCH_TIMEOUT = 12000;
const GLOBAL_DEADLINE = 15000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function buildSummary(item: Parser.Item): string {
  if (item.summary) return stripHtml(item.summary).slice(0, 200);
  if (item.contentSnippet) return item.contentSnippet.slice(0, 200);
  if (item.content) return stripHtml(item.content).slice(0, 200);
  return "";
}

async function fetchRSS(
  name: string,
  url: string,
  category: string
): Promise<NewsItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items || []).map((item) => ({
    title: (item.title || "").trim(),
    link: item.link || "",
    summary: buildSummary(item),
    pubDate: item.pubDate || item.isoDate || "",
    source: name,
    category,
    score: 0,
  }));
}

async function fetchZhihuDaily(): Promise<NewsItem[]> {
  const { data } = await axios.get(
    "https://news-at.zhihu.com/api/4/news/latest",
    { timeout: FETCH_TIMEOUT }
  );
  const stories = data.stories || [];
  return stories.map((s: any) => ({
    title: s.title?.trim() || "",
    link: `https://daily.zhihu.com/story/${s.id}`,
    summary: s.hint || "",
    pubDate: data.date || "",
    source: "知乎日报",
    category: "综合",
    score: 0,
  }));
}

// 天气（wttr.in 免费 API）
export interface WeatherInfo {
  text: string;
  temp: string;
  humidity: string;
}

export async function fetchWeather(
  city: string = "Beijing"
): Promise<WeatherInfo | null> {
  try {
    const { data } = await axios.get(
      `https://wttr.in/${encodeURIComponent(city)}?format=%C|%t|%h`,
      { timeout: 8000 }
    );
    const parts = (data as string).split("|");
    return {
      text: parts[0]?.trim() || "",
      temp: parts[1]?.trim() || "",
      humidity: parts[2]?.trim() || "",
    };
  } catch {
    return null;
  }
}

// A股指数（东方财富免费接口）
export interface StockIndex {
  name: string;
  price: string;
  change: string;
  changePct: string;
}

export async function fetchStockIndex(): Promise<StockIndex | null> {
  try {
    const { data } = await axios.get(
      "https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f43,f44,f45,f46,f47,f48,f170",
      { timeout: 8000 }
    );
    const d = data.data;
    if (!d) return null;
    return {
      name: "上证指数",
      price: (d.f43 / 100).toFixed(2),
      change: (d.f169 / 100).toFixed(2),
      changePct: (d.f170 / 100).toFixed(2),
    };
  } catch {
    return null;
  }
}

// 批量拉取
export async function fetchAllNews(): Promise<NewsItem[]> {
  const allResults: NewsItem[] = [];
  const pending: Promise<void>[] = [];

  for (const [category, feedList] of Object.entries(feedsConfig.feeds)) {
    for (const feed of feedList) {
      const task = (feed.name === "知乎日报"
        ? fetchZhihuDaily()
        : fetchRSS(feed.name, feed.url, category)
      )
        .then((items) => { allResults.push(...items); })
        .catch((err) => {
          console.warn(`[WARN] 拉取失败 ${feed.name}: ${(err as Error).message}`);
        });
      pending.push(task);
    }
  }

  const deadline = new Promise<void>((r) => { setTimeout(r, GLOBAL_DEADLINE); });
  await Promise.race([Promise.all(pending), deadline]);

  console.log(`[INFO] 共拉取 ${allResults.length} 条新闻`);
  return allResults;
}

// 流式拉取
export async function fetchAllNewsStreaming(
  onSource: (name: string, items: NewsItem[], isFirst: boolean) => Promise<void>
): Promise<NewsItem[]> {
  const allResults: NewsItem[] = [];
  const pending: Promise<void>[] = [];
  let firstSent = false;

  for (const [category, feedList] of Object.entries(feedsConfig.feeds)) {
    for (const feed of feedList) {
      const task = (feed.name === "知乎日报"
        ? fetchZhihuDaily()
        : fetchRSS(feed.name, feed.url, category)
      )
        .then(async (items) => {
          allResults.push(...items);
          if (items.length > 0) {
            await onSource(feed.name, items, !firstSent);
            firstSent = true;
          }
        })
        .catch((err) => {
          console.warn(`[WARN] 拉取失败 ${feed.name}: ${(err as Error).message}`);
        });
      pending.push(task);
    }
  }

  const deadline = new Promise<void>((r) => { setTimeout(r, GLOBAL_DEADLINE); });
  await Promise.race([Promise.all(pending), deadline]);

  console.log(`[INFO] 共拉取 ${allResults.length} 条新闻`);
  return allResults;
}
