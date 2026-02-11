import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';

export class ImageRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'image';

  create(_node: BaseNode): Graphics {
    return new Graphics();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    gfx.clear();
    gfx.rect(0, 0, node.width, node.height);
    gfx.fill({ color: 0xcccccc });
    gfx.stroke({ color: 0x999999, width: 1 });
  }

  destroy(gfx: Graphics): void {
    gfx.destroy();
  }
}
