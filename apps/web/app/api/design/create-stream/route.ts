import { streamDesignCreate } from "@/lib/apiClient";

export async function POST(request: Request) {
  const body = await request.json();
  const upstream = await streamDesignCreate(body);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
