import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { RectangleNode } from '../../scene-graph/rectangle-node';
import { colorToNumber } from '@shared/utils/color-utils';

/**
 * Renderer for RectangleNode using PixiJS Graphics.
 */
export class RectangleRenderer extends BaseRenderer<unknown> {
  readonly nodeType: NodeType = 'rectangle';

  create(_node: BaseNode): unknown {
    // Will be replaced with actual PixiJS Graphics from pool
    return {};
  }

  sync(node: BaseNode, _displayObject: unknown): void {
    const rect = node as RectangleNode;
    // In full implementation: clear graphics, draw rounded rect,
    // apply fill/stroke from node properties
    void rect.cornerRadius;
    void colorToNumber;
  }

  destroy(_displayObject: unknown): void {
    // Return to graphics pool
  }
}
