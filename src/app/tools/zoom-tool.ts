import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';

/** ZoomTool — click to zoom in, alt+click to zoom out. */
export class ZoomTool extends BaseTool {
  readonly type: ToolType = 'zoom';
  readonly label = 'Zoom';
  readonly icon = 'zoom-in';
  readonly shortcut = 'Z';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const factor = event.altKey ? 0.5 : 2;
    const currentZoom = this.engine.viewport.camera.zoom;
    this.engine.viewport.zoomController.zoomTo(currentZoom * factor);
  }
}
