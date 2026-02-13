import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';
import { starVertices } from '@shared/utils/geometry-utils';

/**
 * Star node with configurable number of points and inner radius ratio.
 */
export class StarNode extends BaseNode {
  private _points: number = 5;
  private _innerRadiusRatio: number = 0.4;
  private _vertices: Vec2[] = [];

  constructor(name?: string) {
    super('star', name ?? 'Star');
    this.rebuildVertices();
  }

  get points(): number { return this._points; }
  set points(value: number) {
    const next = Math.max(3, Math.floor(value));
    if (next === this._points) return;
    this._points = next;
    this.updateGeometry();
  }

  get innerRadiusRatio(): number { return this._innerRadiusRatio; }
  set innerRadiusRatio(value: number) {
    const next = Math.max(0.01, Math.min(0.99, value));
    if (next === this._innerRadiusRatio) return;
    this._innerRadiusRatio = next;
    this.updateGeometry();
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

  private updateGeometry(): void {
    this.rebuildVertices();
    this.markRenderDirty();
    this.markBoundsDirty();
  }

  private rebuildVertices(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const outerRadius = Math.min(cx, cy);
    const innerRadius = outerRadius * this._innerRadiusRatio;
    this._vertices = starVertices(this._points, outerRadius, innerRadius, cx, cy);
  }

  computeLocalBounds(): Bounds {
    if (this._vertices.length === 0) {
      return Bounds.EMPTY;
    }
    return Bounds.fromPoints(this._vertices);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      points: this._points,
      innerRadiusRatio: this._innerRadiusRatio,
    };
  }

  clone(): StarNode {
    const node = new StarNode(this.name);
    this.copyBaseTo(node);
    node.points = this._points;
    node.innerRadiusRatio = this._innerRadiusRatio;
    return node;
  }
}
