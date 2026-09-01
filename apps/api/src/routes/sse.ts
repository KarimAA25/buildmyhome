import type { FastifyReply } from "fastify";

export function startSSE(reply: FastifyReply) {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  reply.hijack();

  return {
    send(event: string, data: unknown) {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      reply.raw.end();
    },
  };
}
