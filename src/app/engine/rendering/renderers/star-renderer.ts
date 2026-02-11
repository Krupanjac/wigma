import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for StarNode. */
export class StarRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'star';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS star draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
