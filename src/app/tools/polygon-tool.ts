import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { PolygonNode } from '../engine/scene-graph/polygon-node';
import { DragHandler } from '../engine/interaction/drag-handler';

/** PolygonTool — click+drag to create regular polygons. */
export class PolygonTool extends BaseTool {
  readonly type: ToolType = 'polygon';
  readonly label = 'Polygon';
  readonly icon = 'pentagon';
  readonly shortcut = 'P';

  private dragHandler = new DragHandler();
  private currentNode: PolygonNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(e: PointerEventData): void {
    this.dragHandler.start(e.screenPosition, e.worldPosition);
    this.currentNode = new PolygonNode();
    this.currentNode.x = e.worldPosition.x;
    this.currentNode.y = e.worldPosition.y;
    this.currentNode.width = 0;
    this.currentNode.height = 0;
    this.engine.sceneGraph.addNode(this.currentNode);
  }

  override onPointerMove(e: PointerEventData): void {
    if (!this.currentNode) return;
    this.dragHandler.update(e.screenPosition, e.worldPosition);
    const d = this.dragHandler.worldDelta;
    const s = this.dragHandler.startWorldPos;
    const size = Math.max(Math.abs(d.x), Math.abs(d.y));
    this.currentNode.x = s.x - size / 2;
    this.currentNode.y = s.y - size / 2;
    this.currentNode.width = size;
    this.currentNode.height = size;
  }

  override onPointerUp(_e: PointerEventData): void {
    if (this.currentNode && this.currentNode.width > 1) {
      this.engine.selection.select(this.currentNode);
    } else if (this.currentNode) {
      this.engine.sceneGraph.removeNode(this.currentNode);
    }
    this.currentNode = null;
    this.dragHandler.end();
  }
}
