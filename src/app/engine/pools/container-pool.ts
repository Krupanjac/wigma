import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_CONTAINER_INITIAL } from '@shared/constants';

/**
 * Object pool for PixiJS Container instances.
 */
export class ContainerPool {
  private pool: ObjectPool<unknown>;

  constructor(initialSize: number = POOL_CONTAINER_INITIAL) {
    this.pool = new ObjectPool<unknown>(
      () => ({}), // In production: () => new Container()
      (_c) => {
        // In production: c.removeChildren(); c.removeFromParent();
      },
      initialSize
    );
  }

  acquire(): unknown { return this.pool.acquire(); }
  release(c: unknown): void { this.pool.release(c); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}
