export function encodeNdjsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}
