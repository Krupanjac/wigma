import { Vec2 } from '@shared/math/vec2';
import { Bounds } from '@shared/math/bounds';
import { Matrix2D } from '@shared/math/matrix2d';
import { MIN_ZOOM, MAX_ZOOM } from '@shared/constants';

/**
 * Camera with viewMatrix / inverseViewMatrix.
 *
 * View matrix transforms from world space to screen space.
 * Inverse view matrix transforms from screen space to world space.
 *
 * All operations are O(1).
 */
export class Camera {
  private _x: number = 0;
  private _y: number = 0;
  private _zoom: number = 1;
  private _viewMatrix: Matrix2D = Matrix2D.IDENTITY;
  private _inverseViewMatrix: Matrix2D = Matrix2D.IDENTITY;
  private _dirty: boolean = true;
  private _screenWidth: number = 1;
  private _screenHeight: number = 1;

  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get zoom(): number { return this._zoom; }

  get viewMatrix(): Matrix2D {
    if (this._dirty) this.updateMatrices();
    return this._viewMatrix;
  }

  get inverseViewMatrix(): Matrix2D {
    if (this._dirty) this.updateMatrices();
    return this._inverseViewMatrix;
  }

  setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
    this._dirty = true;
  }

  setZoom(zoom: number): void {
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this._dirty = true;
  }

  setScreenSize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
    this._dirty = true;
  }

  /** Convert a screen-space point to world-space. O(1). */
  screenToWorld(screenPoint: Vec2): Vec2 {
    return this.inverseViewMatrix.apply(screenPoint);
  }

  /** Convert a world-space point to screen-space. O(1). */
  worldToScreen(worldPoint: Vec2): Vec2 {
    return this.viewMatrix.apply(worldPoint);
  }

  /** Get the visible bounds in world space. O(1). */
  getVisibleBounds(): Bounds {
    const topLeft = this.screenToWorld(Vec2.ZERO);
    const bottomRight = this.screenToWorld(
      new Vec2(this._screenWidth, this._screenHeight)
    );
    return new Bounds(
      Math.min(topLeft.x, bottomRight.x),
      Math.min(topLeft.y, bottomRight.y),
      Math.max(topLeft.x, bottomRight.x),
      Math.max(topLeft.y, bottomRight.y)
    );
  }

  private updateMatrices(): void {
    // View matrix: translate then scale
    this._viewMatrix = Matrix2D.translation(-this._x, -this._y)
      .scale(this._zoom, this._zoom);

    const inv = this._viewMatrix.invert();
    this._inverseViewMatrix = inv ?? Matrix2D.IDENTITY;

    this._dirty = false;
  }
}
