import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for LineNode. */
export class LineRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'line';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS line draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
