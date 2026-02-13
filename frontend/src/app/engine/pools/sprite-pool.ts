import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_SPRITE_INITIAL } from '@shared/constants';
import { Sprite, Texture } from 'pixi.js';

/**
 * Object pool for PixiJS Sprite instances.
 */
export class SpritePool {
  private pool: ObjectPool<Sprite>;

  constructor(initialSize: number = POOL_SPRITE_INITIAL) {
    this.pool = new ObjectPool<Sprite>(
      () => new Sprite(Texture.EMPTY),
      (s) => {
        s.texture = Texture.EMPTY;
        s.removeFromParent();
        s.position.set(0, 0);
        s.scale.set(1, 1);
        s.rotation = 0;
        s.alpha = 1;
        s.visible = true;
      },
      initialSize
    );
  }

  acquire(): Sprite { return this.pool.acquire(); }
  release(s: Sprite): void { this.pool.release(s); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}

export const spritePool = new SpritePool();
