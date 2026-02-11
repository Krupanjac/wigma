import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for EllipseNode. */
export class EllipseRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'ellipse';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS ellipse draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
