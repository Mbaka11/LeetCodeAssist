import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');
const DOCUMENTED_EXTENSION_ID = 'ghpljfdplcicmcfoemfifmmibbdjcmja';

/** Chrome's rule: SHA-256 of the DER public key, first 16 bytes, each hex digit mapped 0-f -> a-p. */
async function extensionIdFromKey(base64Der: string): Promise<string> {
  const der = Uint8Array.from(atob(base64Der), (c) => c.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', der)).slice(0, 16);
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('').replace(/[0-9a-f]/g, (digit) => String.fromCharCode('a'.charCodeAt(0) + parseInt(digit, 16)));
}

describe('pinned extension ID', () => {
  const key = /key:\s*["']([A-Za-z0-9+/=]+)["']/.exec(read('../../wxt.config.ts'))?.[1] ?? '';

  it('the manifest key in wxt.config.ts is a public key that derives the documented extension ID', async () => {
    expect(key.startsWith('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA')).toBe(true);
    expect(await extensionIdFromKey(key)).toBe(DOCUMENTED_EXTENSION_ID);
  });
  it('the documentation states that same ID', () => {
    for (const file of ['../../README.md', '../../docs/sync.md', '../../CHANGELOG.md']) expect(read(file), file).toContain(DOCUMENTED_EXTENSION_ID);
  });
  it('the config contains no private key material', () => {
    // Assembled so that this file itself does not contain the marker a repository secret scan looks for.
    expect(read('../../wxt.config.ts')).not.toContain(['PRIVATE', 'KEY'].join(' '));
  });
});
