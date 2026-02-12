import { Container } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { containerPool } from '../../pools/container-pool';

export class GroupRenderer extends BaseRenderer<Container> {
  readonly nodeType: NodeType = 'group';

  create(_node: BaseNode): Container {
    return containerPool.acquire();
  }

  sync(_node: BaseNode, _displayObject: Container): void {
    // Groups have no visual representation
  }

  destroy(displayObject: Container): void {
    containerPool.release(displayObject);
  }
}
