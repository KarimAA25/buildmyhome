import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 6_000;
const MAX_IMAGES = 8;

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  imageUrls: string[];
}

// A contractor's page being down, slow, or restructured must never crash a
// generation (CLAUDE2 §3d) — every failure here is caught by the caller and
// treated as "this page contributed nothing," not a hard error.
export async function fetchPageContent(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "BuildMyHomeBot/1.0 (+contractor product page reader)" },
    });
    if (!response.ok) {
      throw new Error(`Fetching ${url} returned HTTP ${response.status}`);
    }
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

  const imageUrls = [
    ...new Set(
      $("img")
        .map((_, el) => $(el).attr("src"))
        .get()
        .filter((src): src is string => Boolean(src))
        .map((src) => {
          try {
            return new URL(src, url).href;
          } catch {
            return null;
          }
        })
        .filter((resolved): resolved is string => resolved !== null && /^https?:\/\//.test(resolved))
    ),
  ].slice(0, MAX_IMAGES);

  return { url, title, text, imageUrls };
}
