import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * DeleteNodeCommand — removes a node (preserving parent & index for undo).
 */
export class DeleteNodeCommand implements ICommand {
  readonly label = 'Delete';
  private parentId: string | null = null;
  private index: number = 0;

  constructor(
    private sceneGraph: SceneGraphManager,
    private node: BaseNode
  ) {
    this.parentId = node.parent?.id ?? null;
    this.index = node.parent?.children.indexOf(node) ?? 0;
  }

  execute(): void {
    this.sceneGraph.removeNode(this.node);
  }

  undo(): void {
    const parent = this.parentId
      ? this.sceneGraph.getNode(this.parentId)
      : undefined;
    this.sceneGraph.addNode(this.node, parent, this.index);
  }
}
