/**
 * The optional LeetCode settings section of a JSON backup file.
 *
 * The backup file is the serialized `AppState` plus, at the top level, `leetcodeSettings`: only the
 * three LeetCode preferences (username, detectionEnabled, showDetectionStatus). Submission events, the
 * profile cache, the sync configuration and anything credential-like are never written. The section is
 * not part of `AppState`: `validateState` ignores it, Chrome sync never carries it, and old files
 * without it import exactly as before.
 */
import { validateUsername } from './leetcodeProfile';
import { normalizePrefs, type LeetCodePrefs, type LeetCodeStorage } from './leetcodeStorage';

export const LEETCODE_SETTINGS_KEY = 'leetcodeSettings';

export class BackupSectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupSectionError';
  }
}

const SECTION_FIELDS: ReadonlySet<string> = new Set(['username', 'detectionEnabled', 'showDetectionStatus']);

/** The section as written to a file: exactly these fields and nothing else. */
export function leetCodeSettingsSection(prefs: LeetCodePrefs): Record<string, unknown> {
  return {
    ...(prefs.username !== undefined ? { username: prefs.username } : {}),
    detectionEnabled: prefs.detectionEnabled,
    showDetectionStatus: prefs.showDetectionStatus === true,
  };
}

/** Adds the LeetCode settings section to the JSON produced by `actions.exportJson()`. */
export function withLeetCodeSettings(stateJson: string, prefs: LeetCodePrefs): string {
  const parsed = JSON.parse(stateJson) as Record<string, unknown>;
  return JSON.stringify({ ...parsed, [LEETCODE_SETTINGS_KEY]: leetCodeSettingsSection(prefs) }, null, 2);
}

function fail(message: string): never {
  throw new BackupSectionError(`Invalid "${LEETCODE_SETTINGS_KEY}" section: ${message}`);
}

/** Strictly validates a section value. Unknown fields are rejected, never silently dropped. */
export function validateLeetCodeSettingsSection(value: unknown): LeetCodePrefs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('expected an object.');
  const section = value as Record<string, unknown>;
  for (const key of Object.keys(section)) {
    if (!SECTION_FIELDS.has(key)) fail(`unexpected field "${key}".`);
  }
  if (typeof section.detectionEnabled !== 'boolean') fail('"detectionEnabled" must be true or false.');
  if (section.showDetectionStatus !== undefined && typeof section.showDetectionStatus !== 'boolean') {
    fail('"showDetectionStatus" must be true or false.');
  }
  if (section.username !== undefined) {
    if (typeof section.username !== 'string') fail('"username" must be text.');
    const checked = validateUsername(section.username);
    if (!checked.ok) fail(`"username": ${checked.message}`);
  }
  return normalizePrefs(section);
}

/**
 * The LeetCode preferences stored in a backup file, or null when the file has no section (an old
 * file, or text that is not JSON: the state validation reports that). Throws `BackupSectionError` for
 * a malformed section so the whole import is refused before anything is changed.
 */
export function readLeetCodeSettingsSection(raw: string): LeetCodePrefs | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, LEETCODE_SETTINGS_KEY)) return null;
  return validateLeetCodeSettingsSection((parsed as Record<string, unknown>)[LEETCODE_SETTINGS_KEY]);
}

/** Replaces the three preferences with the file's values (a missing username clears it). */
export async function restoreLeetCodeSettings(storage: LeetCodeStorage, prefs: LeetCodePrefs): Promise<void> {
  await storage.updatePrefs({
    detectionEnabled: prefs.detectionEnabled,
    showDetectionStatus: prefs.showDetectionStatus === true,
    username: prefs.username ?? null,
  });
}
