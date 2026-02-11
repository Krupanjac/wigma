import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_SPRITE_INITIAL } from '@shared/constants';

/**
 * Object pool for PixiJS Sprite instances.
 */
export class SpritePool {
  private pool: ObjectPool<unknown>;

  constructor(initialSize: number = POOL_SPRITE_INITIAL) {
    this.pool = new ObjectPool<unknown>(
      () => ({}), // In production: () => new Sprite()
      (_s) => {
        // In production: s.texture = Texture.EMPTY; s.removeFromParent();
      },
      initialSize
    );
  }

  acquire(): unknown { return this.pool.acquire(); }
  release(s: unknown): void { this.pool.release(s); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}
