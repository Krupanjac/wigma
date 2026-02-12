/**
 * Simple IndexedDB wrapper for storing large project data.
 *
 * localStorage has a ~5–10 MB limit which is easily exceeded by projects
 * containing embedded image/video data URLs. IndexedDB has no practical
 * size limit (browsers allocate a percentage of available disk space).
 *
 * Usage:
 *   const store = new IdbStorage('wigma', 'projects');
 *   await store.set('key', jsonString);
 *   const val = await store.get('key');
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

  async get(key: string): Promise<string | null> {
    const db = await this.dbPromise;
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
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
}
