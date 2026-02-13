import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { DEFAULT_CORNER_RADIUS } from '@shared/constants';

/**
 * Rectangle node with optional corner radius.
 */
export class RectangleNode extends BaseNode {
  cornerRadius: number = DEFAULT_CORNER_RADIUS;

  constructor(name?: string) {
    super('rectangle', name ?? 'Rectangle');
  }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      cornerRadius: this.cornerRadius,
    };
  }

  clone(): RectangleNode {
    const node = new RectangleNode(this.name);
    this.copyBaseTo(node);
    node.cornerRadius = this.cornerRadius;
    return node;
  }
}
