import { Camera } from './camera';
import { ZOOM_SPEED, ZOOM_LERP_FRAMES, MIN_ZOOM, MAX_ZOOM } from '@shared/constants';

/**
 * Zoom controller with smooth lerped zoom transitions.
 * Zoom is lerped over ZOOM_LERP_FRAMES frames for smooth feel.
 */
export class ZoomController {
  private targetZoom: number = 1;
  private currentZoom: number = 1;
  private lerpFramesRemaining: number = 0;

  private hasAnchor: boolean = false;
  private anchorScreenX: number = 0;
  private anchorScreenY: number = 0;
  private anchorWorldX: number = 0;
  private anchorWorldY: number = 0;

  constructor(private camera: Camera) {
    this.targetZoom = camera.zoom;
    this.currentZoom = camera.zoom;
  }

  /** Set zoom target (will lerp toward it). */
  zoomTo(zoom: number): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.lerpFramesRemaining = ZOOM_LERP_FRAMES;
  }

  /**
   * Set zoom target anchored to a screen-space point.
   * Keeps the world point under the anchor fixed during the lerp.
   */
  zoomToAt(zoom: number, anchorX: number, anchorY: number): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.lerpFramesRemaining = ZOOM_LERP_FRAMES;

    this.hasAnchor = true;
    this.anchorScreenX = anchorX;
    this.anchorScreenY = anchorY;
    this.anchorWorldX = (anchorX / this.currentZoom) + this.camera.x;
    this.anchorWorldY = (anchorY / this.currentZoom) + this.camera.y;
  }

  /** Zoom by delta (scroll wheel). */
  zoomBy(delta: number, anchorX: number, anchorY: number): void {
    const factor = 1 - delta * ZOOM_SPEED;
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.targetZoom * factor));
    this.lerpFramesRemaining = ZOOM_LERP_FRAMES;

    // Preserve the world point under the cursor for the entire lerp.
    // (Without this, the point drifts while zoom is interpolating.)
    this.hasAnchor = true;
    this.anchorScreenX = anchorX;
    this.anchorScreenY = anchorY;
    this.anchorWorldX = (anchorX / this.currentZoom) + this.camera.x;
    this.anchorWorldY = (anchorY / this.currentZoom) + this.camera.y;
  }

  /** Immediate zoom (no animation). */
  setZoomImmediate(zoom: number): void {
    this.targetZoom = zoom;
    this.currentZoom = zoom;
    this.lerpFramesRemaining = 0;
    this.hasAnchor = false;
    this.camera.setZoom(zoom);
  }

  /** Smoothing factor for exponential decay (0 = instant, 1 = no movement). */
  private static readonly LERP_FACTOR = 0.15;

  /** Update per frame — apply lerp if active. Returns true if zoom changed. */
  update(): boolean {
    if (this.lerpFramesRemaining <= 0) return false;

    this.lerpFramesRemaining--;

    // Exponential decay: fixed proportion of remaining distance each frame
    this.currentZoom = this.currentZoom + (this.targetZoom - this.currentZoom) * ZoomController.LERP_FACTOR;

    // Snap to target when close enough to avoid infinite convergence
    if (Math.abs(this.currentZoom - this.targetZoom) < 1e-6 || this.lerpFramesRemaining <= 0) {
      this.currentZoom = this.targetZoom;
      this.lerpFramesRemaining = 0;
    }

    this.camera.setZoom(this.currentZoom);

    if (this.hasAnchor) {
      this.camera.setPosition(
        this.anchorWorldX - (this.anchorScreenX / this.currentZoom),
        this.anchorWorldY - (this.anchorScreenY / this.currentZoom)
      );
    }
    return true;
  }
}
