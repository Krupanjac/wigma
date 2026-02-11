import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';

/**
 * Arrow styles for line endpoints.
 */
export type ArrowHead = 'none' | 'triangle' | 'circle' | 'diamond';

/**
 * Arrow node — a line with configurable arrowheads.
 */
export class ArrowNode extends BaseNode {
  startPoint: Vec2 = Vec2.ZERO;
  endPoint: Vec2 = new Vec2(100, 0);
  startArrow: ArrowHead = 'none';
  endArrow: ArrowHead = 'triangle';
  arrowSize: number = 12;

  constructor(name?: string) {
    super('arrow', name ?? 'Arrow');
    this.fill.visible = false;
    this.stroke.visible = true;
    this.stroke.width = 2;
  }

  computeLocalBounds(): Bounds {
    const expand = this.arrowSize + this.stroke.width;
    return new Bounds(
      Math.min(this.startPoint.x, this.endPoint.x) - expand,
      Math.min(this.startPoint.y, this.endPoint.y) - expand,
      Math.max(this.startPoint.x, this.endPoint.x) + expand,
      Math.max(this.startPoint.y, this.endPoint.y) + expand
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      startPoint: this.startPoint.toArray(),
      endPoint: this.endPoint.toArray(),
      startArrow: this.startArrow,
      endArrow: this.endArrow,
      arrowSize: this.arrowSize,
    };
  }

  clone(): ArrowNode {
    const node = new ArrowNode(this.name);
    this.copyBaseTo(node);
    node.startPoint = this.startPoint.clone();
    node.endPoint = this.endPoint.clone();
    node.startArrow = this.startArrow;
    node.endArrow = this.endArrow;
    node.arrowSize = this.arrowSize;
    return node;
  }
}
