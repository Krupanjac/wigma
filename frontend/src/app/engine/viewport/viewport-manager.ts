import { Camera } from './camera';
import { ZoomController } from './zoom-controller';
import { Vec2 } from '@shared/math/vec2';
import { Bounds } from '@shared/math/bounds';
import { PAN_SPEED } from '@shared/constants';

/**
 * ViewportManager: pan, scroll-zoom, pinch-zoom,
 * fit-to-selection O(k), fit-to-all O(n).
 */
export class ViewportManager {
  readonly camera: Camera;
  readonly zoomController: ZoomController;

  private isPanning: boolean = false;
  private lastPanPoint: Vec2 = Vec2.ZERO;

  constructor() {
    this.camera = new Camera();
    this.zoomController = new ZoomController(this.camera);
  }

  /** Call when the container resizes. */
  resize(width: number, height: number): void {
    this.camera.setScreenSize(width, height);
  }

  // ── Panning ──

  startPan(screenPoint: Vec2): void {
    this.isPanning = true;
    this.lastPanPoint = screenPoint;
  }

  updatePan(screenPoint: Vec2): void {
    if (!this.isPanning) return;

    const dx = (screenPoint.x - this.lastPanPoint.x) / this.camera.zoom * PAN_SPEED;
    const dy = (screenPoint.y - this.lastPanPoint.y) / this.camera.zoom * PAN_SPEED;

    this.camera.setPosition(
      this.camera.x - dx,
      this.camera.y - dy
    );

    this.lastPanPoint = screenPoint;
  }

  endPan(): void {
    this.isPanning = false;
  }

  // ── Zoom ──

  /**
   * Trackpad/mouse-wheel pan in screen-space pixels.
   * Matches typical design tool behavior: two-finger scroll pans the canvas.
   */
  scrollPan(deltaX: number, deltaY: number): void {
    const dx = (deltaX / this.camera.zoom) * PAN_SPEED;
    const dy = (deltaY / this.camera.zoom) * PAN_SPEED;

    // Figma-like: canvas follows finger direction on trackpads.
    // With our camera model (world - camera), that means moving camera opposite.
    this.camera.setPosition(
      this.camera.x + dx,
      this.camera.y + dy
    );
  }

  /** Scroll-wheel zoom toward a screen-space anchor. */
  scrollZoom(delta: number, anchorX: number, anchorY: number): void {
    this.zoomController.zoomBy(delta, anchorX, anchorY);
  }

  /** Fit the viewport to show a specific bounds with padding. */
  fitToBounds(bounds: Bounds, padding: number = 64): void {
    if (bounds.isEmpty) return;

    const screenWidth = this.camera.screenWidth;
    const screenHeight = this.camera.screenHeight;

    const scaleX = (screenWidth - padding * 2) / bounds.width;
    const scaleY = (screenHeight - padding * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY);

    this.zoomController.setZoomImmediate(zoom);
    this.camera.setPosition(
      bounds.centerX - screenWidth / (2 * zoom),
      bounds.centerY - screenHeight / (2 * zoom)
    );
  }

  /** Fit viewport to show all given bounds. O(n). */
  fitToAll(allBounds: Bounds[]): void {
    if (allBounds.length === 0) return;

    let union = allBounds[0];
    for (let i = 1; i < allBounds.length; i++) {
      union = union.union(allBounds[i]);
    }

    this.fitToBounds(union);
  }

  /** Fit viewport to selection. O(k). */
  fitToSelection(selectedBounds: Bounds[]): void {
    this.fitToAll(selectedBounds);
  }

  /** Per-frame update. Returns true if viewport changed. */
  update(): boolean {
    return this.zoomController.update();
  }
}
