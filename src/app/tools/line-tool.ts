import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { LineNode } from '../engine/scene-graph/line-node';
import { Vec2 } from '../shared/math/vec2';
import { DragHandler } from '../engine/interaction/drag-handler';

/** LineTool — click+drag to draw straight lines. */
export class LineTool extends BaseTool {
  readonly type: ToolType = 'line';
  readonly label = 'Line';
  readonly icon = 'minus';
  readonly shortcut = 'L';

  private dragHandler = new DragHandler();
  private currentNode: LineNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(e: PointerEventData): void {
    this.dragHandler.start(e.screenPosition, e.worldPosition);
    this.currentNode = new LineNode();
    this.currentNode.startPoint = e.worldPosition;
    this.currentNode.endPoint = e.worldPosition;
    this.engine.sceneGraph.addNode(this.currentNode, this.engine.activePage ?? undefined);
  }

  override onPointerMove(e: PointerEventData): void {
    if (!this.currentNode) return;
    this.dragHandler.update(e.screenPosition, e.worldPosition);

    let endPoint = e.worldPosition;
    if (e.shiftKey) {
      // Constrain to 45° increments
      const delta = e.worldPosition.sub(this.currentNode.startPoint);
      const angle = Math.round(delta.angle() / (Math.PI / 4)) * (Math.PI / 4);
      const len = delta.length();
      endPoint = this.currentNode.startPoint.add(
        new Vec2(Math.cos(angle) * len, Math.sin(angle) * len)
      );
    }
    this.currentNode.endPoint = endPoint;
    this.currentNode.markRenderDirty();
    this.currentNode.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
  }

  override onPointerUp(_e: PointerEventData): void {
    if (this.currentNode) {
      const dist = this.currentNode.startPoint.distanceTo(this.currentNode.endPoint);
      if (dist < 2) {
        this.engine.sceneGraph.removeNode(this.currentNode);
      } else {
        this.engine.selection.select(this.currentNode);
        this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
      }
    }
    this.currentNode = null;
    this.dragHandler.end();
  }
}
