import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { EllipseNode } from '../engine/scene-graph/ellipse-node';
import { DragHandler } from '../engine/interaction/drag-handler';

/**
 * EllipseTool — click+drag to create ellipses.
 */
export class EllipseTool extends BaseTool {
  readonly type: ToolType = 'ellipse';
  readonly label = 'Ellipse';
  readonly icon = 'circle';
  readonly shortcut = 'O';

  private dragHandler = new DragHandler();
  private currentNode: EllipseNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    this.dragHandler.start(event.screenPosition, event.worldPosition);
    this.currentNode = new EllipseNode();
    this.currentNode.x = event.worldPosition.x;
    this.currentNode.y = event.worldPosition.y;
    this.currentNode.width = 0;
    this.currentNode.height = 0;
    this.engine.sceneGraph.addNode(this.currentNode, this.engine.activePage ?? undefined);
  }

  override onPointerMove(event: PointerEventData): void {
    if (!this.currentNode) return;
    this.dragHandler.update(event.screenPosition, event.worldPosition);
    const delta = this.dragHandler.worldDelta;
    const startPos = this.dragHandler.startWorldPos;

    this.currentNode.x = Math.min(startPos.x, event.worldPosition.x);
    this.currentNode.y = Math.min(startPos.y, event.worldPosition.y);
    this.currentNode.width = Math.abs(delta.x);
    this.currentNode.height = event.shiftKey ? Math.abs(delta.x) : Math.abs(delta.y);

    this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
  }

  override onPointerUp(_event: PointerEventData): void {
    if (this.currentNode && this.currentNode.width > 1 && this.currentNode.height > 1) {
      this.engine.selection.select(this.currentNode);
      this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
    } else if (this.currentNode) {
      this.engine.sceneGraph.removeNode(this.currentNode);
    }
    this.currentNode = null;
    this.dragHandler.end();
  }
}
