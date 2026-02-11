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
    this.x = v.x;
    this.y = v.y;
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
      this._localMatrix = Matrix2D.fromTRS(
        this._x, this._y,
        this._rotation,
        this._scaleX, this._scaleY
      );
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
    this._localMatrix = Matrix2D.fromTRS(
      this._x, this._y,
      this._rotation,
      this._scaleX, this._scaleY
    );

    if (this.parent) {
      this._worldMatrix = this.parent.worldMatrix.multiply(this._localMatrix);
    } else {
      this._worldMatrix = this._localMatrix;
    }

    this.dirty.transform = false;
    this.dirty.bounds = true;
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
    const corners = [
      wm.apply(new Vec2(local.minX, local.minY)),
      wm.apply(new Vec2(local.maxX, local.minY)),
      wm.apply(new Vec2(local.maxX, local.maxY)),
      wm.apply(new Vec2(local.minX, local.maxY)),
    ];
    return Bounds.fromPoints(corners);
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
    target.fill = { ...this.fill };
    target.stroke = { ...this.stroke };
    target.opacity = this.opacity;
    target.visible = this.visible;
    target.locked = this.locked;
    target.name = this.name;
    target.markTransformDirty();
  }
}
