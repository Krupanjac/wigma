import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for TextNode. */
export class TextRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'text';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS Text object update */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
