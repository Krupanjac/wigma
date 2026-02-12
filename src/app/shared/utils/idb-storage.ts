/**
 * Simple IndexedDB wrapper for storing large project data.
 *
 * localStorage has a ~5–10 MB limit which is easily exceeded by projects
 * containing embedded image/video data URLs. IndexedDB has no practical
 * size limit (browsers allocate a percentage of available disk space).
 *
 * Supports transparent gzip compression: when `setCompressed()` is used
 * the JSON string is gzip-compressed to an `ArrayBuffer` before writing,
 * and `getCompressed()` decompresses it back. Plain `get`/`set` still
 * work for uncompressed strings and for backwards-compatible reads.
 *
 * Usage:
 *   const store = new IdbStorage('wigma', 'projects');
 *   await store.setCompressed('key', jsonString);  // gzip → ArrayBuffer
 *   const val = await store.getDecompressed('key'); // ArrayBuffer → string
 */
export class IdbStorage {
  private dbPromise: Promise<IDBDatabase>;

  constructor(
    private dbName: string,
    private storeName: string,
  ) {
    this.dbPromise = this.open();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Read a raw value (string or ArrayBuffer). */
  async get(key: string): Promise<string | ArrayBuffer | null> {
    const db = await this.dbPromise;
    return new Promise<string | ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /** Write a raw value (string or ArrayBuffer). */
  async set(key: string, value: string | ArrayBuffer): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gzip-compress a string and store the resulting ArrayBuffer.
   */
  async setCompressed(key: string, value: string): Promise<void> {
    const compressed = await IdbStorage.compress(value);
    await this.set(key, compressed);
  }

  /**
   * Read a value and decompress if it's a gzip ArrayBuffer.
   * Falls back to returning the raw string for backwards compatibility
   * with data written before compression was introduced.
   */
  async getDecompressed(key: string): Promise<string | null> {
    const raw = await this.get(key);
    if (raw === null) return null;

    // Legacy: value was stored as a plain string
    if (typeof raw === 'string') return raw;

    // New: value is a gzip-compressed ArrayBuffer
    if (raw instanceof ArrayBuffer) {
      return IdbStorage.decompress(raw);
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ── Compression helpers ──────────────────────────────────

  /** Gzip-compress a string → ArrayBuffer using Compression Streams API. */
  private static async compress(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const CHUNK = 1 << 20; // 1 MB
    let offset = 0;

    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= data.length) {
          controller.close();
          return;
        }
        const slice = data.slice(offset, offset + CHUNK);
        offset += CHUNK;
        controller.enqueue(encoder.encode(slice));
      },
    });

    const compressed = source.pipeThrough(
      new CompressionStream('gzip') as any
    );
    const blob = await new Response(compressed).blob();
    return blob.arrayBuffer();
  }

  /** Decompress a gzip ArrayBuffer → string. */
  private static async decompress(buffer: ArrayBuffer): Promise<string> {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      },
    });

    const decompressed = source.pipeThrough(
      new DecompressionStream('gzip') as any
    );
    const blob = await new Response(decompressed).blob();
    return blob.text();
  }
}
