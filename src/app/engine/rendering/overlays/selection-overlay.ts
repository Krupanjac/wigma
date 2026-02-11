/**
 * Selection overlay — renders selection bounds, resize handles,
 * and rotation handle over selected nodes.
 */
export class SelectionOverlay {
  private visible: boolean = false;

  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }

  /**
   * Update the overlay to match current selection bounds.
   * Draws: bounding rectangle, 8 resize handles, rotation handle.
   */
  update(
    _minX: number, _minY: number,
    _maxX: number, _maxY: number,
    _zoom: number
  ): void {
    // In full implementation: draw using PixiJS Graphics
    // Handles scaled inversely by zoom to maintain constant screen size
  }

  dispose(): void {
    this.visible = false;
  }
}
