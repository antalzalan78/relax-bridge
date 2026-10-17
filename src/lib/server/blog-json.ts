/** Accept both native JSONB values and the JSON-encoded strings written by older blog saves. */
function decodeStoredJson(value: unknown): unknown {
  let decoded = value;
  for (let attempt = 0; attempt < 2 && typeof decoded === 'string'; attempt += 1) {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      throw new Error('Invalid stored blog JSON. The original data has not been changed.');
    }
  }
  return decoded;
}

export function readBlogJsonArray<T>(value: unknown): T[] {
  const decoded = decodeStoredJson(value);
  if (!Array.isArray(decoded)) throw new Error('Invalid stored blog list. The original data has not been changed.');
  return decoded as T[];
}

export function readBlogJsonObject<T extends object>(value: unknown): T {
  const decoded = decodeStoredJson(value);
  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid stored blog object. The original data has not been changed.');
  }
  return decoded as T;
}
