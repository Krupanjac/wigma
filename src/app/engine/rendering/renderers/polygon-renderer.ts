import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for PolygonNode. */
export class PolygonRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'polygon';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS polygon draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
