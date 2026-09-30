import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const IMAGE_FETCH_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 6_000;
const MAX_IMAGES = 8;
// Generous but bounded — professional photography can run a few MB; this
// just guards against an outlier blowing up the OpenAI request payload.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  // Base64 data URIs, not remote URLs — see fetchImageAsDataUrl for why.
  imageDataUrls: string[];
}

// Some contractor sites' hosting/WAF (e.g. Cloudflare bot protection) allows
// normal browser/residential traffic but blocks or stalls requests from
// OpenAI's own server-side infrastructure specifically — confirmed by our
// own fetch() succeeding instantly against the same URL that OpenAI's vision
// API reported as unreachable. Asking OpenAI to fetch a remote image URL is
// therefore unreliable in general; downloading the bytes ourselves (already
// proven to work, since this module already fetches the page HTML the same
// way) and handing OpenAI a base64 data URI instead sidesteps the problem
// entirely, for any contractor site, not just this one.
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "BuildMyHomeBot/1.0 (+contractor product page reader)" },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    // One bad/slow image must never fail the whole page (CLAUDE2 §3d) — it
    // just contributes nothing, same as a fully unreachable page does.
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
        // Some contractor sites hardcode absolute http:// URLs in <img src>
        // (typically a leftover from an http->https migration) even though
        // the page itself is served over https — upgrading is safe here
        // since we already reached this same host over https to get the page.
        .map((resolved) => resolved.replace(/^http:\/\//, "https://"))
    ),
  ].slice(0, MAX_IMAGES);

  const fetchedImages = await Promise.all(imageUrls.map((imgUrl) => fetchImageAsDataUrl(imgUrl)));
  const imageDataUrls = fetchedImages.filter((dataUrl): dataUrl is string => dataUrl !== null);

  return { url, title, text, imageDataUrls };
}
