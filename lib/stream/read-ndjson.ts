export async function consumeNdjsonStream<T>(
  response: Response,
  onRecord: (row: T) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        onRecord(JSON.parse(t) as T);
      } catch {
        throw new Error("Malformed stream line");
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    onRecord(JSON.parse(tail) as T);
  }
}
