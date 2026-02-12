import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { RectangleNode } from '../engine/scene-graph/rectangle-node';
import { DragHandler } from '../engine/interaction/drag-handler';
import { hexToColor } from '../shared/utils/color-utils';

/** FrameTool — click+drag to create frame rectangles. */
export class FrameTool extends BaseTool {
  readonly type: ToolType = 'frame';
  readonly label = 'Frame';
  readonly icon = 'frame';
  readonly shortcut = 'F';

  private dragHandler = new DragHandler();
  private currentNode: RectangleNode | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    this.dragHandler.start(event.screenPosition, event.worldPosition);
    this.currentNode = new RectangleNode('Frame');
    this.currentNode.fill = { color: hexToColor('#11182720'), visible: true };
    this.currentNode.stroke = { color: hexToColor('#60a5fa'), width: 1, visible: true };
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
