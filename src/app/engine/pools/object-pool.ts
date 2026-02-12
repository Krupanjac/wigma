import { ObjectPool } from '@shared/data-structures/object-pool';
import { Text as PixiText } from 'pixi.js';
import { POOL_TEXT_INITIAL } from '@shared/constants';

/**
 * Object pool for PixiJS Text instances (placeholder).
 * In production: wraps actual PIXI.Text objects.
 */
export class TextPool {
  private pool: ObjectPool<PixiText>;

  constructor(initialSize: number = POOL_TEXT_INITIAL) {
    this.pool = new ObjectPool<PixiText>(
      () => new PixiText({ text: '' }),
      (t) => {
        t.text = '';
        t.removeFromParent();
        t.position.set(0, 0);
        t.scale.set(1, 1);
        t.rotation = 0;
        t.alpha = 1;
        t.visible = true;
      },
      initialSize
    );
  }

  acquire(): PixiText { return this.pool.acquire(); }
  release(t: PixiText): void { this.pool.release(t); }
}

export const textPool = new TextPool();
