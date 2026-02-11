import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';
import { regularPolygonVertices } from '@shared/utils/geometry-utils';

/**
 * Regular polygon node.
 */
export class PolygonNode extends BaseNode {
  private _sides: number = 5;
  private _vertices: Vec2[] = [];

  constructor(name?: string) {
    super('polygon', name ?? 'Polygon');
    this.rebuildVertices();
  }

  get sides(): number { return this._sides; }
  set sides(value: number) {
    this._sides = Math.max(3, value);
    this.rebuildVertices();
    this.markRenderDirty();
    this.markBoundsDirty();
  }

  get vertices(): Vec2[] { return this._vertices; }

  override get width(): number { return super.width; }
  override set width(value: number) {
    const before = super.width;
    super.width = value;
    if (super.width !== before) {
      this.rebuildVertices();
    }
  }

  override get height(): number { return super.height; }
  override set height(value: number) {
    const before = super.height;
    super.height = value;
    if (super.height !== before) {
      this.rebuildVertices();
    }
  }

  private rebuildVertices(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(cx, cy);
    this._vertices = regularPolygonVertices(this._sides, radius, cx, cy);
  }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      sides: this._sides,
    };
  }

  clone(): PolygonNode {
    const node = new PolygonNode(this.name);
    this.copyBaseTo(node);
    node.sides = this._sides;
    return node;
  }
}
