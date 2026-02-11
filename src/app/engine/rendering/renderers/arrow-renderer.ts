import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for ArrowNode. */
export class ArrowRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'arrow';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS arrow draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
