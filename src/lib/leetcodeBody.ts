/**
 * Bounded reading of a response body. Used for the few LeetCode responses this extension looks at:
 * nothing beyond `maxBytes` is ever read, so an unexpectedly large body cannot be buffered.
 */

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response body is larger than ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

/** Reads the body as UTF-8 text. Rejects with `BodyTooLargeError` as soon as `maxBytes` is exceeded. */
export async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!response.body) {
    const text = await response.text();
    if (text.length > maxBytes) throw new BodyTooLargeError(maxBytes);
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError(maxBytes);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
