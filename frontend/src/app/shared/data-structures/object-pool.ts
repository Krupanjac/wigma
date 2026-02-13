/**
 * Generic Object Pool with acquire/release pattern.
 * O(1) amortized for both operations.
 * Eliminates GC spikes on undo/redo/paste.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private activeCount = 0;

  /**
   * @param factory Creates a new instance of T.
   * @param reset Resets an instance to a clean state before reuse.
   * @param initialSize Number of instances to pre-allocate.
   */
  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    initialSize: number = 0
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Acquire an instance from the pool. O(1) amortized. */
  acquire(): T {
    this.activeCount++;
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** Release an instance back to the pool. O(1). */
  release(item: T): void {
    this.reset(item);
    this.activeCount--;
    this.pool.push(item);
  }

  /** Release multiple items back to the pool. */
  releaseAll(items: T[]): void {
    for (const item of items) {
      this.release(item);
    }
  }

  /** Pre-allocate additional instances. */
  preallocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Number of items currently checked out. */
  get active(): number {
    return this.activeCount;
  }

  /** Number of items available in the pool. */
  get available(): number {
    return this.pool.length;
  }

  /** Total capacity (active + available). */
  get size(): number {
    return this.activeCount + this.pool.length;
  }

  /** Drain the pool, removing all available instances. */
  drain(): void {
    this.pool.length = 0;
  }
}
