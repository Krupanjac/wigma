import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * ReorderNodeCommand — changes a node's position in its parent's children array.
 */
export class ReorderNodeCommand implements ICommand {
  readonly label = 'Reorder';

  constructor(
    private sceneGraph: SceneGraphManager,
    private nodeId: string,
    private oldIndex: number,
    private newIndex: number
  ) {}

  execute(): void {
    const node = this.sceneGraph.getNode(this.nodeId);
    if (node?.parent) {
      this.sceneGraph.moveNode(node, node.parent, this.newIndex);
    }
  }

  undo(): void {
    const node = this.sceneGraph.getNode(this.nodeId);
    if (node?.parent) {
      this.sceneGraph.moveNode(node, node.parent, this.oldIndex);
    }
  }
}
