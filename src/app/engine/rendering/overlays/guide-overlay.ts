/**
 * Guide overlay — renders snap/alignment guides.
 */
export class GuideOverlay {
  private guides: { axis: 'x' | 'y'; value: number }[] = [];

  setGuides(guides: { axis: 'x' | 'y'; value: number }[]): void {
    this.guides = guides;
  }

  clearGuides(): void {
    this.guides = [];
  }

  update(_zoom: number): void {
    // In full implementation: draw horizontal/vertical guide lines
    // using PixiJS Graphics with SNAP_LINE_COLOR
  }

  dispose(): void {
    this.guides = [];
  }
}
