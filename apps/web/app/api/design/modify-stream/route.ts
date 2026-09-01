import { streamDesignModify } from "@/lib/apiClient";

// 300s is the ceiling on Vercel Hobby (Pro/Enterprise default to 300s too but
// can go higher). Explicit here since this route can legitimately take 100s+
// with image-generation retries.
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json();
  const upstream = await streamDesignModify(body);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
