import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';
import { GroupNode } from '../../engine/scene-graph/group-node';

/**
 * GroupNodesCommand — groups selected nodes into a new GroupNode.
 */
export class GroupNodesCommand implements ICommand {
  readonly label = 'Group';
  private group: GroupNode;
  private originalParents: Map<string, { parentId: string; index: number }> = new Map();

  constructor(
    private sceneGraph: SceneGraphManager,
    private nodeIds: string[]
  ) {
    this.group = new GroupNode('Group');

    // Record original positions
    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node?.parent) {
        this.originalParents.set(id, {
          parentId: node.parent.id,
          index: node.parent.children.indexOf(node),
        });
      }
    }
  }

  execute(): void {
    // Add group to scene at the position of the first node's parent
    const firstNode = this.sceneGraph.getNode(this.nodeIds[0]);
    const parent = firstNode?.parent ?? this.sceneGraph.root;
    this.sceneGraph.addNode(this.group, parent);

    // Move nodes into group
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        this.sceneGraph.moveNode(node, this.group);
      }
    }
  }

  undo(): void {
    // Move nodes back to original parents
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      const info = this.originalParents.get(id);
      if (node && info) {
        const parent = this.sceneGraph.getNode(info.parentId);
        if (parent) {
          this.sceneGraph.moveNode(node, parent, info.index);
        }
      }
    }

    // Remove the group
    this.sceneGraph.removeNode(this.group);
  }
}
