import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_GRAPHICS_INITIAL } from '@shared/constants';
import { Graphics } from 'pixi.js';

/**
 * Object pool for PixiJS Graphics instances.
 * Pre-allocates on init to eliminate GC spikes.
 */
export class GraphicsPool {
  private pool: ObjectPool<Graphics>;

  constructor(initialSize: number = POOL_GRAPHICS_INITIAL) {
    this.pool = new ObjectPool<Graphics>(
      () => new Graphics(),
      (g) => {
        g.clear();
        g.removeFromParent();
        g.position.set(0, 0);
        g.scale.set(1, 1);
        g.rotation = 0;
        g.alpha = 1;
        g.visible = true;
      },
      initialSize
    );
  }

  acquire(): Graphics { return this.pool.acquire(); }
  release(g: Graphics): void { this.pool.release(g); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}

export const graphicsPool = new GraphicsPool();
