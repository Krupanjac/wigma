import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';

/**
 * Ellipse node defined by center + radii.
 * Width/height represent the full diameter.
 */
export class EllipseNode extends BaseNode {
  constructor(name?: string) {
    super('ellipse', name ?? 'Ellipse');
  }

  get rx(): number { return this.width / 2; }
  get ry(): number { return this.height / 2; }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  clone(): EllipseNode {
    const node = new EllipseNode(this.name);
    this.copyBaseTo(node);
    return node;
  }
}
