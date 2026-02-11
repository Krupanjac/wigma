/**
 * Generate a unique identifier string.
 * Uses crypto.randomUUID with a fallback for environments without it.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return fallbackUid();
}

/**
 * Generate a short unique ID (8 chars) for display purposes.
 */
export function shortId(): string {
  return uid().slice(0, 8);
}

/**
 * Fallback UUID v4 generator.
 */
function fallbackUid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
