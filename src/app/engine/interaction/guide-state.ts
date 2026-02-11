export type Guide = { axis: 'x' | 'y'; value: number };

/**
 * GuideState holds the currently active alignment/snap guides to render.
 * Values are in world-space coordinates.
 */
export class GuideState {
  private _guides: Guide[] = [];

  get guides(): Guide[] {
    return this._guides;
  }

  setGuides(guides: Guide[]): void {
    this._guides = guides;
  }

  clear(): void {
    this._guides = [];
  }
}
