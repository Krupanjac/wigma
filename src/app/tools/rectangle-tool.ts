import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { RectangleNode } from '../engine/scene-graph/rectangle-node';
import { DragHandler } from '../engine/interaction/drag-handler';

/**
 * RectangleTool — click+drag to create rectangles.
 */
export class RectangleTool extends BaseTool {
  readonly type: ToolType = 'rectangle';
  readonly label = 'Rectangle';
  readonly icon = 'square';
  readonly shortcut = 'R';

  private dragHandler = new DragHandler();
  private currentNode: RectangleNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    this.dragHandler.start(event.screenPosition, event.worldPosition);

    this.currentNode = new RectangleNode();
    this.currentNode.x = event.worldPosition.x;
    this.currentNode.y = event.worldPosition.y;
    this.currentNode.width = 0;
    this.currentNode.height = 0;
    this.engine.sceneGraph.addNode(this.currentNode);
  }

  override onPointerMove(event: PointerEventData): void {
    if (!this.currentNode) return;
    this.dragHandler.update(event.screenPosition, event.worldPosition);

    const delta = this.dragHandler.worldDelta;
    const startPos = this.dragHandler.startWorldPos;

    if (event.shiftKey) {
      // Constrain to square
      const size = Math.max(Math.abs(delta.x), Math.abs(delta.y));
      this.currentNode.width = size;
      this.currentNode.height = size;
      this.currentNode.x = delta.x < 0 ? startPos.x - size : startPos.x;
      this.currentNode.y = delta.y < 0 ? startPos.y - size : startPos.y;
    } else {
      this.currentNode.x = Math.min(startPos.x, event.worldPosition.x);
      this.currentNode.y = Math.min(startPos.y, event.worldPosition.y);
      this.currentNode.width = Math.abs(delta.x);
      this.currentNode.height = Math.abs(delta.y);
    }
  }

  override onPointerUp(_event: PointerEventData): void {
    if (this.currentNode) {
      // Remove zero-size rectangles
      if (this.currentNode.width < 1 && this.currentNode.height < 1) {
        this.engine.sceneGraph.removeNode(this.currentNode);
      } else {
        this.engine.selection.select(this.currentNode);
      }
    }
    this.currentNode = null;
    this.dragHandler.end();
  }
}
