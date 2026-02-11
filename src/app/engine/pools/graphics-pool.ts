import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_GRAPHICS_INITIAL } from '@shared/constants';

/**
 * Object pool for PixiJS Graphics instances.
 * Pre-allocates on init to eliminate GC spikes.
 */
export class GraphicsPool {
  private pool: ObjectPool<unknown>;

  constructor(initialSize: number = POOL_GRAPHICS_INITIAL) {
    this.pool = new ObjectPool<unknown>(
      () => ({}), // In production: () => new Graphics()
      (_g) => {
        // In production: g.clear(); g.removeFromParent();
      },
      initialSize
    );
  }

  acquire(): unknown { return this.pool.acquire(); }
  release(g: unknown): void { this.pool.release(g); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}
