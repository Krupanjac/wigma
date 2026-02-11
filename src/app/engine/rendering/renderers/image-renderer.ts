import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

/** Renderer for ImageNode. */
export class ImageRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'image';
  create(_node: BaseNode): unknown { return {}; }
  sync(_node: BaseNode, _displayObject: unknown): void { /* PixiJS Sprite update */ }
  destroy(_displayObject: unknown): void { /* Return to pool */ }
}
