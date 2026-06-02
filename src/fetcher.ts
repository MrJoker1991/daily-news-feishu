import Parser from "rss-parser";
import axios from "axios";
import type { NewsItem } from "./types.js";
import { feedsConfig } from "./config.js";

const parser = new Parser({
  timeout: 30000,
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
  try {
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
  } catch (err) {
    console.warn(`[WARN] 拉取失败 ${name} (${url}): ${(err as Error).message}`);
    return [];
  }
}

async function fetchZhihuDaily(): Promise<NewsItem[]> {
  try {
    const { data } = await axios.get(
      "https://news-at.zhihu.com/api/4/news/latest",
      { timeout: 30000 }
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
  } catch (err) {
    console.warn(`[WARN] 拉取失败 知乎日报: ${(err as Error).message}`);
    return [];
  }
}

export async function fetchAllNews(): Promise<NewsItem[]> {
  const tasks: Promise<NewsItem[]>[] = [];

  for (const [category, feedList] of Object.entries(feedsConfig.feeds)) {
    for (const feed of feedList) {
      if (feed.name === "知乎日报") {
        tasks.push(fetchZhihuDaily());
      } else {
        tasks.push(fetchRSS(feed.name, feed.url, category));
      }
    }
  }

  const results = await Promise.allSettled(tasks);
  const allNews: NewsItem[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allNews.push(...result.value);
    }
  }

  console.log(`[INFO] 共拉取 ${allNews.length} 条新闻`);
  return allNews;
}
