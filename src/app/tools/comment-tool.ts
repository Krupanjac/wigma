import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { TextNode } from '../engine/scene-graph/text-node';
import { hexToColor } from '../shared/utils/color-utils';

/** CommentTool — click to place a comment note and start editing text. */
export class CommentTool extends BaseTool {
  readonly type: ToolType = 'comment';
  readonly label = 'Comment';
  readonly icon = 'comment';
  readonly shortcut = 'C';

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const node = new TextNode('Comment');
    node.text = '';
    node.x = event.worldPosition.x;
    node.y = event.worldPosition.y;
    node.width = 220;
    node.height = 32;
    node.fill = { color: hexToColor('#fef08a'), visible: true };
    this.engine.sceneGraph.addNode(node, this.engine.activePage ?? undefined);
    this.engine.selection.select(node);
    node.markRenderDirty();
    node.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(node);

    window.dispatchEvent(new CustomEvent('wigma:text-edit-start', {
      detail: { nodeId: node.id },
    }));
  }
}
