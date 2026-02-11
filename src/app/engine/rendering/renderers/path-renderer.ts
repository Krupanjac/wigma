import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for PathNode (Bézier curves). */
export class PathRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'path';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS Graphics Bézier path draw */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
