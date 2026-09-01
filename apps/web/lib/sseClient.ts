export interface SSEEvent {
  event: string;
  data: unknown;
}

export async function* parseSSEStream(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const eventMatch = rawEvent.match(/^event: (.+)$/m);
      const dataMatch = rawEvent.match(/^data: ([\s\S]+)$/m);
      if (!dataMatch) continue;

      yield { event: eventMatch?.[1] ?? "message", data: JSON.parse(dataMatch[1]) };
    }
  }
}
