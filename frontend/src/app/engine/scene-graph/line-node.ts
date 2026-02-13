import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';

/**
 * Line node — a simple two-point line segment.
 */
export class LineNode extends BaseNode {
  startPoint: Vec2 = Vec2.ZERO;
  endPoint: Vec2 = new Vec2(100, 0);

  constructor(name?: string) {
    super('line', name ?? 'Line');
    this.fill.visible = false;
    this.stroke.visible = true;
    this.stroke.width = 2;
  }

  computeLocalBounds(): Bounds {
    const halfStroke = this.stroke.width / 2;
    return new Bounds(
      Math.min(this.startPoint.x, this.endPoint.x) - halfStroke,
      Math.min(this.startPoint.y, this.endPoint.y) - halfStroke,
      Math.max(this.startPoint.x, this.endPoint.x) + halfStroke,
      Math.max(this.startPoint.y, this.endPoint.y) + halfStroke
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      startPoint: this.startPoint.toArray(),
      endPoint: this.endPoint.toArray(),
    };
  }

  clone(): LineNode {
    const node = new LineNode(this.name);
    this.copyBaseTo(node);
    node.startPoint = this.startPoint.clone();
    node.endPoint = this.endPoint.clone();
    return node;
  }
}
