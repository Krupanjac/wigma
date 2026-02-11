import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for GroupNode (container). */
export class GroupRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'group';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* Update container transform */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
