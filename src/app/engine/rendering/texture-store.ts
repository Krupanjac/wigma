import { Assets, Texture } from 'pixi.js';

/**
 * TextureStore — global cache for image/video textures keyed by
 * a short content hash rather than the full data URL.
 *
 * Why this exists:
 * - Data URLs for images can be 1–20 MB. Using them directly as
 *   PixiJS Asset cache keys means every cache lookup does O(n)
 *   string hashing on megabytes of data.
 * - When copy/pasting image nodes, each clone shares the same `src`
 *   string reference, but each would trigger a separate `Assets.load()`
 *   call with the full data URL.
 * - This store maps a cheap short hash → texture, and remembers which
 *   data URLs have already been loaded. Lookups are O(1) against the
 *   short hash.
 *
 * Usage:
 *   const texture = await TextureStore.load(node.src);
 */
export class TextureStore {
  /** Short hash → loaded Texture */
  private static cache = new Map<string, Texture>();

  /** Short hash → pending load promise (prevents duplicate loads) */
  private static pending = new Map<string, Promise<Texture>>();

  /** Full src → short hash (avoids rehashing the same string) */
  private static srcToHash = new Map<string, string>();

  /**
   * Load (or return cached) texture for a given source URL/data URL.
   */
  static async load(src: string): Promise<Texture> {
    const hash = this.getHash(src);

    // Already loaded
    const cached = this.cache.get(hash);
    if (cached) return cached;

    // Currently loading
    const inflight = this.pending.get(hash);
    if (inflight) return inflight;

    // Start loading
    const promise = Assets.load<Texture>(src).then(texture => {
      this.cache.set(hash, texture);
      this.pending.delete(hash);
      return texture;
    });
    this.pending.set(hash, promise);
    return promise;
  }

  /**
   * Check if a source has already been loaded (synchronous).
   */
  static has(src: string): boolean {
    const hash = this.getHash(src);
    return this.cache.has(hash);
  }

  /**
   * Get a previously loaded texture synchronously (returns null if not loaded).
   */
  static get(src: string): Texture | null {
    const hash = this.getHash(src);
    return this.cache.get(hash) ?? null;
  }

  /**
   * Compute (and cache) a short hash for a source string.
   * Uses first 64 + last 64 chars + length as a fast fingerprint.
   * Collision-safe enough for data URLs (length is part of the key).
   */
  private static getHash(src: string): string {
    const existing = this.srcToHash.get(src);
    if (existing) return existing;

    // For regular URLs, use the URL itself as hash (short)
    if (src.length < 256) {
      this.srcToHash.set(src, src);
      return src;
    }

    // For data URLs, create a fast fingerprint
    const prefix = src.substring(0, 64);
    const suffix = src.substring(src.length - 64);
    const hash = `${prefix}|${src.length}|${suffix}`;
    this.srcToHash.set(src, hash);
    return hash;
  }

  /** Clear all cached textures. */
  static clear(): void {
    this.cache.clear();
    this.pending.clear();
    this.srcToHash.clear();
  }
}
