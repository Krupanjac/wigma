import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { ImageNode } from '../engine/scene-graph/image-node';

/** VideoTool — click to place a video placeholder node. */
export class VideoTool extends BaseTool {
  readonly type: ToolType = 'video';
  readonly label = 'Video';
  readonly icon = 'video';
  readonly shortcut = 'Shift+V';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const node = new ImageNode('Video');
    node.x = event.worldPosition.x;
    node.y = event.worldPosition.y;
    node.width = 320;
    node.height = 180;
    this.engine.sceneGraph.addNode(node, this.engine.activePage ?? undefined);
    this.engine.selection.select(node);
    this.engine.sceneGraph.notifyNodeChanged(node);
  }
}
