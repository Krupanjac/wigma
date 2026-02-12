import { Vec2 } from '@shared/math/vec2';
import { Bounds } from '@shared/math/bounds';
import { Matrix2D } from '@shared/math/matrix2d';
import { uid } from '@shared/utils/uid';
import { Color, Colors } from '@shared/utils/color-utils';

/**
 * Node types supported in the scene graph.
 */
export type NodeType =
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'text'
  | 'image'
  | 'video'
  | 'path'
  | 'group';

/**
 * Dirty flags for deferred computation.
 *
 * Transform chain invalidation rules:
 * - Setting position/rotation/scale → transformDirty = true → propagate to children
 * - transformDirty → boundsDirty (world bounds depend on world transform)
 * - Any visual property change → renderDirty = true
 * - boundsDirty → spatial index needs update
 */
export interface DirtyFlags {
  transform: boolean;
  render: boolean;
  bounds: boolean;
}

/**
 * Fill/Stroke style for shapes.
 */
export interface FillStyle {
  color: Color;
  visible: boolean;
}

export interface StrokeStyle {
  color: Color;
  width: number;
  visible: boolean;
}

/**
 * Abstract base class for all scene graph nodes.
 *
 * Features:
 * - Unique ID
 * - Parent/child hierarchy
 * - Local transform (position, rotation, scale)
 * - Computed world transform (cached, recomputed when dirty)
 * - Dirty flag system for deferred computation
 * - Fill/stroke styling
 * - Visibility, opacity, lock state
 * - Name for layers panel
 */
export abstract class BaseNode {
  readonly id: string;
  readonly type: NodeType;

  name: string;
  parent: BaseNode | null = null;
  children: BaseNode[] = [];

  // ── Local transform ──
  private _x: number = 0;
  private _y: number = 0;
  private _width: number = 100;
  private _height: number = 100;
  private _rotation: number = 0;
  private _scaleX: number = 1;
  private _scaleY: number = 1;

  // ── Cached world transform ──
  private _localMatrix: Matrix2D = Matrix2D.IDENTITY;
  private _worldMatrix: Matrix2D = Matrix2D.IDENTITY;
  private _localBounds: Bounds = Bounds.EMPTY;
  private _worldBounds: Bounds = Bounds.EMPTY;

  // ── Dirty flags ──
  readonly dirty: DirtyFlags = {
    transform: true,
    render: true,
    bounds: true,
  };

  // ── Visual properties ──
  fill: FillStyle = { color: { ...Colors.WHITE }, visible: true };
  stroke: StrokeStyle = { color: { ...Colors.BLACK }, width: 1, visible: true };
  opacity: number = 1;
  visible: boolean = true;
  locked: boolean = false;

  // ── Render order (z-index within parent) ──
  renderOrder: number = 0;

  constructor(type: NodeType, name?: string) {
    this.id = uid();
    this.type = type;
    this.name = name ?? type;
  }

  // ── Position ──

  get x(): number { return this._x; }
  set x(value: number) {
    if (this._x !== value) {
      this._x = value;
      this.markTransformDirty();
    }
  }

  get y(): number { return this._y; }
  set y(value: number) {
    if (this._y !== value) {
      this._y = value;
      this.markTransformDirty();
    }
  }

  get position(): Vec2 { return new Vec2(this._x, this._y); }
  set position(v: Vec2) {
    const changed = this._x !== v.x || this._y !== v.y;
    this._x = v.x;
    this._y = v.y;
    if (changed) this.markTransformDirty();
  }

  // ── Size ──

  get width(): number { return this._width; }
  set width(value: number) {
    if (this._width !== value) {
      this._width = Math.max(0, value);
      this.markBoundsDirty();
      this.markRenderDirty();
    }
  }

  get height(): number { return this._height; }
  set height(value: number) {
    if (this._height !== value) {
      this._height = Math.max(0, value);
      this.markBoundsDirty();
      this.markRenderDirty();
    }
  }

  // ── Rotation & Scale ──

  get rotation(): number { return this._rotation; }
  set rotation(value: number) {
    if (this._rotation !== value) {
      this._rotation = value;
      this.markTransformDirty();
    }
  }

  get scaleX(): number { return this._scaleX; }
  set scaleX(value: number) {
    if (this._scaleX !== value) {
      this._scaleX = value;
      this.markTransformDirty();
    }
  }

  get scaleY(): number { return this._scaleY; }
  set scaleY(value: number) {
    if (this._scaleY !== value) {
      this._scaleY = value;
      this.markTransformDirty();
    }
  }

  // ── Transform computation ──

  get localMatrix(): Matrix2D {
    if (this.dirty.transform) {
      this._localMatrix = this.composeLocalMatrix();
    }
    return this._localMatrix;
  }

  get worldMatrix(): Matrix2D {
    if (this.dirty.transform) {
      this.updateWorldTransform();
    }
    return this._worldMatrix;
  }

  private updateWorldTransform(): void {
    this._localMatrix = this.composeLocalMatrix();

    if (this.parent) {
      this._worldMatrix = this.parent.worldMatrix.multiply(this._localMatrix);
    } else {
      this._worldMatrix = this._localMatrix;
    }

    this.dirty.transform = false;
    this.dirty.bounds = true;
  }

  private composeLocalMatrix(): Matrix2D {
    const localBounds = this.computeLocalBounds();
    const pivotX = (localBounds.minX + localBounds.maxX) / 2;
    const pivotY = (localBounds.minY + localBounds.maxY) / 2;

    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);
    const a = cos * this._scaleX;
    const b = sin * this._scaleX;
    const c = -sin * this._scaleY;
    const d = cos * this._scaleY;

    const tx = this._x + pivotX - (a * pivotX + c * pivotY);
    const ty = this._y + pivotY - (b * pivotX + d * pivotY);

    return new Matrix2D(a, b, c, d, tx, ty);
  }

  /** Compute local bounds (shape-specific, overridden by subclasses). */
  abstract computeLocalBounds(): Bounds;

  get localBounds(): Bounds {
    if (this.dirty.bounds) {
      this._localBounds = this.computeLocalBounds();
    }
    return this._localBounds;
  }

  get worldBounds(): Bounds {
    if (this.dirty.bounds || this.dirty.transform) {
      if (this.dirty.transform) this.updateWorldTransform();
      this._localBounds = this.computeLocalBounds();
      this._worldBounds = this.transformBoundsToWorld(this._localBounds);
      this.dirty.bounds = false;
    }
    return this._worldBounds;
  }

  private transformBoundsToWorld(local: Bounds): Bounds {
    const wm = this._worldMatrix;
    // Inline matrix application to avoid 4× Vec2 allocations per call
    const x0 = local.minX, y0 = local.minY;
    const x1 = local.maxX, y1 = local.maxY;

    const ax = wm.a * x0 + wm.c * y0 + wm.tx;
    const ay = wm.b * x0 + wm.d * y0 + wm.ty;
    const bx = wm.a * x1 + wm.c * y0 + wm.tx;
    const by = wm.b * x1 + wm.d * y0 + wm.ty;
    const cx = wm.a * x1 + wm.c * y1 + wm.tx;
    const cy = wm.b * x1 + wm.d * y1 + wm.ty;
    const dx = wm.a * x0 + wm.c * y1 + wm.tx;
    const dy = wm.b * x0 + wm.d * y1 + wm.ty;

    return new Bounds(
      Math.min(ax, bx, cx, dx),
      Math.min(ay, by, cy, dy),
      Math.max(ax, bx, cx, dx),
      Math.max(ay, by, cy, dy),
    );
  }

  // ── Dirty flag management ──

  markTransformDirty(): void {
    this.dirty.transform = true;
    this.dirty.bounds = true;
    // Propagate to children
    for (const child of this.children) {
      child.markTransformDirty();
    }
  }

  markRenderDirty(): void {
    this.dirty.render = true;
  }

  markBoundsDirty(): void {
    this.dirty.bounds = true;
    this.dirty.render = true;
  }

  clearDirtyFlags(): void {
    this.dirty.transform = false;
    this.dirty.render = false;
    this.dirty.bounds = false;
  }

  // ── Hierarchy ──

  addChild(child: BaseNode): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    child.renderOrder = this.children.length;
    this.children.push(child);
    child.markTransformDirty();
  }

  removeChild(child: BaseNode): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parent = null;
      // Reindex render orders
      for (let i = index; i < this.children.length; i++) {
        this.children[i].renderOrder = i;
      }
    }
  }

  /** Get depth in the scene tree (root = 0). */
  get depth(): number {
    let d = 0;
    let node: BaseNode | null = this.parent;
    while (node) {
      d++;
      node = node.parent;
    }
    return d;
  }

  /** Get the root node. */
  get root(): BaseNode {
    let node: BaseNode = this;
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }

  /** Serializable snapshot of core properties. */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
      rotation: this._rotation,
      scaleX: this._scaleX,
      scaleY: this._scaleY,
      fill: this.fill,
      stroke: this.stroke,
      opacity: this.opacity,
      visible: this.visible,
      locked: this.locked,
      children: this.children.map(c => c.toJSON()),
    };
  }

  /** Create a deep clone of this node with a new unique ID. */
  abstract clone(): BaseNode;

  /** Copy base properties from this node to a target node. */
  protected copyBaseTo(target: BaseNode): void {
    target._x = this._x;
    target._y = this._y;
    target._width = this._width;
    target._height = this._height;
    target._rotation = this._rotation;
    target._scaleX = this._scaleX;
    target._scaleY = this._scaleY;
    target.fill = { color: { ...this.fill.color }, visible: this.fill.visible };
    target.stroke = { color: { ...this.stroke.color }, width: this.stroke.width, visible: this.stroke.visible };
    target.opacity = this.opacity;
    target.visible = this.visible;
    target.locked = this.locked;
    target.name = this.name;
    target.markTransformDirty();
  }
}
