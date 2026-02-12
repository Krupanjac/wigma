import { ObjectPool } from '@shared/data-structures/object-pool';
import { POOL_CONTAINER_INITIAL } from '@shared/constants';
import { Container } from 'pixi.js';

/**
 * Object pool for PixiJS Container instances.
 */
export class ContainerPool {
  private pool: ObjectPool<Container>;

  constructor(initialSize: number = POOL_CONTAINER_INITIAL) {
    this.pool = new ObjectPool<Container>(
      () => new Container(),
      (c) => {
        c.removeChildren();
        c.removeFromParent();
        c.position.set(0, 0);
        c.scale.set(1, 1);
        c.rotation = 0;
        c.alpha = 1;
        c.visible = true;
      },
      initialSize
    );
  }

  acquire(): Container { return this.pool.acquire(); }
  release(c: Container): void { this.pool.release(c); }
  get active(): number { return this.pool.active; }
  get available(): number { return this.pool.available; }
}

export const containerPool = new ContainerPool();
