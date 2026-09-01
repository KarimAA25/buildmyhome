import type { FastifyReply } from "fastify";

// Some networks/intermediaries (mobile carriers especially) kill HTTP/1.1
// connections that look idle. Our pipeline goes silent for 45-90s+ at a time
// during image generation, so send a no-op comment line periodically to keep
// the connection visibly alive. SSE comment lines start with ":" and are
// ignored by conforming parsers (including ours, which skips lines with no
// "data:" field).
const HEARTBEAT_INTERVAL_MS = 15_000;

export function startSSE(reply: FastifyReply) {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  reply.hijack();

  const heartbeat = setInterval(() => {
    if (reply.raw.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    reply.raw.write(": heartbeat\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  reply.raw.on("close", () => clearInterval(heartbeat));

  return {
    send(event: string, data: unknown) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    },
    end() {
      clearInterval(heartbeat);
      if (!reply.raw.writableEnded) reply.raw.end();
    },
  };
}
