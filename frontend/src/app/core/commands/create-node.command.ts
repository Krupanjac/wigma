import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * CreateNodeCommand — adds a new node to the scene graph.
 */
export class CreateNodeCommand implements ICommand {
  readonly label: string;

  constructor(
    private sceneGraph: SceneGraphManager,
    private node: BaseNode,
    private parentId?: string
  ) {
    this.label = `Create ${node.type}`;
  }

  execute(): void {
    const parent = this.parentId
      ? this.sceneGraph.getNode(this.parentId)
      : undefined;
    this.sceneGraph.addNode(this.node, parent);
  }

  undo(): void {
    this.sceneGraph.removeNode(this.node);
  }
}
