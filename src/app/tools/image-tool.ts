import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { ImageNode } from '../engine/scene-graph/image-node';

/** ImageTool — click to place an image placeholder node. */
export class ImageTool extends BaseTool {
  readonly type: ToolType = 'image';
  readonly label = 'Image';
  readonly icon = 'image';
  readonly shortcut = 'I';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const node = new ImageNode('Image');
    node.x = event.worldPosition.x;
    node.y = event.worldPosition.y;
    node.width = 240;
    node.height = 160;
    this.engine.sceneGraph.addNode(node, this.engine.activePage ?? undefined);
    this.engine.selection.select(node);
    this.engine.sceneGraph.notifyNodeChanged(node);
  }
}
