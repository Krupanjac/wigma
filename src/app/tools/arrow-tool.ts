import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { ArrowNode } from '../engine/scene-graph/arrow-node';
import { DragHandler } from '../engine/interaction/drag-handler';

/** ArrowTool — click+drag to draw arrows. */
export class ArrowTool extends BaseTool {
  readonly type: ToolType = 'arrow';
  readonly label = 'Arrow';
  readonly icon = 'arrow-right';
  readonly shortcut = 'A';

  private dragHandler = new DragHandler();
  private currentNode: ArrowNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(e: PointerEventData): void {
    this.dragHandler.start(e.screenPosition, e.worldPosition);
    this.currentNode = new ArrowNode();
    this.currentNode.startPoint = e.worldPosition;
    this.currentNode.endPoint = e.worldPosition;
    this.engine.sceneGraph.addNode(this.currentNode);
  }

  override onPointerMove(e: PointerEventData): void {
    if (!this.currentNode) return;
    this.dragHandler.update(e.screenPosition, e.worldPosition);
    this.currentNode.endPoint = e.worldPosition;
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
