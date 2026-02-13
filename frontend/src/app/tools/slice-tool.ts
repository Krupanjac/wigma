import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { RectangleNode } from '../engine/scene-graph/rectangle-node';
import { DragHandler } from '../engine/interaction/drag-handler';
import { hexToColor } from '../shared/utils/color-utils';

/** SliceTool — click+drag to create export slices. */
export class SliceTool extends BaseTool {
  readonly type: ToolType = 'slice';
  readonly label = 'Slice';
  readonly icon = 'slice';
  readonly shortcut = 'X';

  private dragHandler = new DragHandler();
  private currentNode: RectangleNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    this.dragHandler.start(event.screenPosition, event.worldPosition);
    this.currentNode = new RectangleNode('Slice');
    this.currentNode.fill = { color: hexToColor('#00000000'), visible: false };
    this.currentNode.stroke = { color: hexToColor('#f59e0b'), width: 1, visible: true };
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
    this.currentNode.height = Math.abs(delta.y);
    this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
  }

  override onPointerUp(): void {
    if (!this.currentNode) return;
    if (this.currentNode.width < 1 && this.currentNode.height < 1) {
      this.engine.sceneGraph.removeNode(this.currentNode);
    } else {
      this.engine.selection.select(this.currentNode);
      this.engine.sceneGraph.notifyNodeChanged(this.currentNode);
    }
    this.currentNode = null;
    this.dragHandler.end();
  }
}
