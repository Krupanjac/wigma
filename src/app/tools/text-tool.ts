import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { TextNode } from '../engine/scene-graph/text-node';

/** TextTool — click to create text nodes. */
export class TextTool extends BaseTool {
  readonly type: ToolType = 'text';
  readonly label = 'Text';
  readonly icon = 'type';
  readonly shortcut = 'T';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const node = new TextNode();
    node.x = event.worldPosition.x;
    node.y = event.worldPosition.y;
    this.engine.sceneGraph.addNode(node);
    this.engine.selection.select(node);
  }
}
