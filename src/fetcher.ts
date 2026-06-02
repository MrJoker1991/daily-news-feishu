import Parser from "rss-parser";
import axios from "axios";
import type { NewsItem } from "./types.js";
import { feedsConfig } from "./config.js";

const FETCH_TIMEOUT = 12000; // 单源超时 12s
const GLOBAL_DEADLINE = 15000; // 总截止 15s

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

export async function fetchAllNews(): Promise<NewsItem[]> {
  // 收集所有拉取任务
  const allResults: NewsItem[] = [];
  const pending: Promise<void>[] = [];

  for (const [category, feedList] of Object.entries(feedsConfig.feeds)) {
    for (const feed of feedList) {
      const task = (feed.name === "知乎日报" ? fetchZhihuDaily() : fetchRSS(feed.name, feed.url, category))
        .then((items) => {
          allResults.push(...items);
        })
        .catch((err) => {
          console.warn(`[WARN] 拉取失败 ${feed.name}: ${(err as Error).message}`);
        });
      pending.push(task);
    }
  }

  // 全局截止时间：15s 后不管怎样都返回
  const deadline = new Promise<void>((resolve) =>
    setTimeout(resolve, GLOBAL_DEADLINE)
  );

  await Promise.race([Promise.all(pending), deadline]);

  console.log(`[INFO] 共拉取 ${allResults.length} 条新闻 (${pending.length} 个源, ${GLOBAL_DEADLINE / 1000}s 截止)`);
  return allResults;
}
