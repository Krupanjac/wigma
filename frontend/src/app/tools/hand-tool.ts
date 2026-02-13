import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { Vec2 } from '../shared/math/vec2';

/** HandTool — pan the canvas by dragging. */
export class HandTool extends BaseTool {
  readonly type: ToolType = 'hand';
  readonly label = 'Hand';
  readonly icon = 'hand';
  readonly shortcut = 'H';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    this.engine.viewport.startPan(event.screenPosition);
  }

  override onPointerMove(event: PointerEventData): void {
    this.engine.viewport.updatePan(event.screenPosition);
  }

  override onPointerUp(_event: PointerEventData): void {
    this.engine.viewport.endPan();
  }
}
