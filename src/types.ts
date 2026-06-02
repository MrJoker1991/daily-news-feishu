export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  pubDate: string;
  source: string;
  category: string;
  score: number;
}

export interface FeedConfig {
  name: string;
  url: string;
  weight: number;
}

export interface FeedsConfig {
  feeds: Record<string, FeedConfig[]>;
}

export interface FeishuCard {
  config: { wide_screen_mode: boolean };
  header: { title: { tag: string; content: string }; template?: string };
  elements: Array<Record<string, any>>;
}
