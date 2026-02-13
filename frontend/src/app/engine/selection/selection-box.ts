import { Vec2 } from '@shared/math/vec2';
import { Bounds } from '@shared/math/bounds';

/**
 * Selection box (rubber-band marquee) drawn during drag selection.
 */
export class SelectionBox {
  private _startPoint: Vec2 = Vec2.ZERO;
  private _endPoint: Vec2 = Vec2.ZERO;
  private _active: boolean = false;

  get isActive(): boolean { return this._active; }

  get startPoint(): Vec2 { return this._startPoint; }
  get endPoint(): Vec2 { return this._endPoint; }

  /** Get the AABB of the selection box in world coordinates. */
  get bounds(): Bounds {
    return new Bounds(
      Math.min(this._startPoint.x, this._endPoint.x),
      Math.min(this._startPoint.y, this._endPoint.y),
      Math.max(this._startPoint.x, this._endPoint.x),
      Math.max(this._startPoint.y, this._endPoint.y)
    );
  }

  start(worldPoint: Vec2): void {
    this._startPoint = worldPoint;
    this._endPoint = worldPoint;
    this._active = true;
  }

  update(worldPoint: Vec2): void {
    this._endPoint = worldPoint;
  }

  end(): Bounds {
    this._active = false;
    return this.bounds;
  }

  cancel(): void {
    this._active = false;
  }
}
