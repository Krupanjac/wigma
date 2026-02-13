/**
 * Cursor overlay — manages cursor appearance based on
 * tool state and hover target.
 */
export type CursorType =
  | 'default'
  | 'pointer'
  | 'grab'
  | 'grabbing'
  | 'crosshair'
  | 'text'
  | 'move'
  | 'nw-resize' | 'ne-resize' | 'sw-resize' | 'se-resize'
  | 'n-resize' | 's-resize' | 'e-resize' | 'w-resize'
  | 'rotate'
  | 'zoom-in'
  | 'zoom-out';

export class CursorOverlay {
  private currentCursor: CursorType = 'default';
  private canvasElement: HTMLElement | null = null;

  attach(element: HTMLElement): void {
    this.canvasElement = element;
  }

  setCursor(cursor: CursorType): void {
    if (this.currentCursor === cursor) return;
    this.currentCursor = cursor;

    if (this.canvasElement) {
      this.canvasElement.style.cursor = this.mapCursor(cursor);
    }
  }

  private mapCursor(cursor: CursorType): string {
    switch (cursor) {
      case 'rotate': return 'grab'; // Custom cursor would be used in production
      case 'zoom-in': return 'zoom-in';
      case 'zoom-out': return 'zoom-out';
      default: return cursor;
    }
  }

  dispose(): void {
    this.canvasElement = null;
  }
}
