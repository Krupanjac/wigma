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

  constructor(private camera: Camera) {
    this.targetZoom = camera.zoom;
    this.currentZoom = camera.zoom;
  }

  /** Set zoom target (will lerp toward it). */
  zoomTo(zoom: number): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.lerpFramesRemaining = ZOOM_LERP_FRAMES;
  }

  /** Zoom by delta (scroll wheel). */
  zoomBy(delta: number, anchorX: number, anchorY: number): void {
    const factor = 1 - delta * ZOOM_SPEED;
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.targetZoom * factor));
    this.lerpFramesRemaining = ZOOM_LERP_FRAMES;

    // Adjust camera position to zoom toward anchor point
    const worldBeforeX = (anchorX / this.currentZoom) + this.camera.x;
    const worldBeforeY = (anchorY / this.currentZoom) + this.camera.y;
    const worldAfterX = (anchorX / this.targetZoom) + this.camera.x;
    const worldAfterY = (anchorY / this.targetZoom) + this.camera.y;

    this.camera.setPosition(
      this.camera.x + (worldBeforeX - worldAfterX),
      this.camera.y + (worldBeforeY - worldAfterY)
    );
  }

  /** Immediate zoom (no animation). */
  setZoomImmediate(zoom: number): void {
    this.targetZoom = zoom;
    this.currentZoom = zoom;
    this.lerpFramesRemaining = 0;
    this.camera.setZoom(zoom);
  }

  /** Update per frame — apply lerp if active. Returns true if zoom changed. */
  update(): boolean {
    if (this.lerpFramesRemaining <= 0) return false;

    this.lerpFramesRemaining--;
    const t = 1 - (this.lerpFramesRemaining / ZOOM_LERP_FRAMES);
    this.currentZoom = this.currentZoom + (this.targetZoom - this.currentZoom) * t;

    if (this.lerpFramesRemaining <= 0) {
      this.currentZoom = this.targetZoom;
    }

    this.camera.setZoom(this.currentZoom);
    return true;
  }
}
