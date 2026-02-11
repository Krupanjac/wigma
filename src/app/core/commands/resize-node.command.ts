import { ICommand } from './command.interface';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * ResizeNodeCommand — resizes a node to new dimensions.
 */
export class ResizeNodeCommand implements ICommand {
  readonly label = 'Resize';

  constructor(
    private sceneGraph: SceneGraphManager,
    private nodeId: string,
    private oldX: number,
    private oldY: number,
    private oldWidth: number,
    private oldHeight: number,
    private newX: number,
    private newY: number,
    private newWidth: number,
    private newHeight: number
  ) {}

  execute(): void {
    const node = this.sceneGraph.getNode(this.nodeId);
    if (node) {
      node.x = this.newX;
      node.y = this.newY;
      node.width = this.newWidth;
      node.height = this.newHeight;
      this.sceneGraph.notifyNodeChanged(node);
    }
  }

  undo(): void {
    const node = this.sceneGraph.getNode(this.nodeId);
    if (node) {
      node.x = this.oldX;
      node.y = this.oldY;
      node.width = this.oldWidth;
      node.height = this.oldHeight;
      this.sceneGraph.notifyNodeChanged(node);
    }
  }
}
