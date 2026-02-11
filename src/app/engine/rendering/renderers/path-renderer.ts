import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { PathNode } from '../../scene-graph/path-node';
import { colorToNumber } from '@shared/utils/color-utils';

export class PathRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'path';

  create(_node: BaseNode): Graphics {
    return new Graphics();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    const path = node as PathNode;
    gfx.clear();
    const segments = path.getSegments();
    if (segments.length === 0) return;
    gfx.moveTo(segments[0].p0.x, segments[0].p0.y);
    for (const seg of segments) {
      gfx.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
    }
    if (path.closed && path.fill.visible) {
      gfx.fill({ color: colorToNumber(path.fill.color), alpha: path.fill.color.a });
    }
    if (path.stroke.visible && path.stroke.width > 0) {
      gfx.stroke({ color: colorToNumber(path.stroke.color), width: path.stroke.width });
    }
  }

  destroy(gfx: Graphics): void {
    gfx.destroy();
  }
}
