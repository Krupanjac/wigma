import { Vec2 } from '@shared/math/vec2';

/**
 * DragHandler — manages drag state and delta computation.
 */
export class DragHandler {
  private _isDragging: boolean = false;
  private _startWorldPos: Vec2 = Vec2.ZERO;
  private _startScreenPos: Vec2 = Vec2.ZERO;
  private _currentWorldPos: Vec2 = Vec2.ZERO;
  private _currentScreenPos: Vec2 = Vec2.ZERO;

  /** Minimum screen-space distance before drag initiates. */
  dragThreshold: number = 3;

  private _thresholdMet: boolean = false;

  get isDragging(): boolean { return this._isDragging; }
  get isThresholdMet(): boolean { return this._thresholdMet; }

  get startWorldPos(): Vec2 { return this._startWorldPos; }
  get startScreenPos(): Vec2 { return this._startScreenPos; }
  get currentWorldPos(): Vec2 { return this._currentWorldPos; }
  get currentScreenPos(): Vec2 { return this._currentScreenPos; }

  get worldDelta(): Vec2 {
    return this._currentWorldPos.sub(this._startWorldPos);
  }

  get screenDelta(): Vec2 {
    return this._currentScreenPos.sub(this._startScreenPos);
  }

  start(screenPos: Vec2, worldPos: Vec2): void {
    this._isDragging = true;
    this._thresholdMet = false;
    this._startScreenPos = screenPos;
    this._startWorldPos = worldPos;
    this._currentScreenPos = screenPos;
    this._currentWorldPos = worldPos;
  }

  update(screenPos: Vec2, worldPos: Vec2): void {
    this._currentScreenPos = screenPos;
    this._currentWorldPos = worldPos;

    if (!this._thresholdMet) {
      const dist = this._currentScreenPos.distanceTo(this._startScreenPos);
      if (dist >= this.dragThreshold) {
        this._thresholdMet = true;
      }
    }
  }

  end(): void {
    this._isDragging = false;
    this._thresholdMet = false;
  }

  cancel(): void {
    this._isDragging = false;
    this._thresholdMet = false;
  }
}
