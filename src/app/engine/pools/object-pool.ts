import { ObjectPool } from '@shared/data-structures/object-pool';

/**
 * Object pool for PixiJS Text instances (placeholder).
 * In production: wraps actual PIXI.Text objects.
 */
export class TextPool {
  private pool: ObjectPool<unknown>;

  constructor(initialSize: number = 16) {
    this.pool = new ObjectPool<unknown>(
      () => ({}),
      (_t) => { /* reset text content */ },
      initialSize
    );
  }

  acquire(): unknown { return this.pool.acquire(); }
  release(t: unknown): void { this.pool.release(t); }
}
