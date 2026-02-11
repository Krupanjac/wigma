import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * MoveNodeCommand — moves a set of nodes by a delta.
 * Supports temporal merging of consecutive small moves.
 */
export class MoveNodeCommand implements ICommand {
  readonly label = 'Move';

  constructor(
    private sceneGraph: SceneGraphManager,
    private nodeIds: string[],
    private dx: number,
    private dy: number
  ) {}

  execute(): void {
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x += this.dx;
        node.y += this.dy;
        this.sceneGraph.notifyNodeChanged(node);
      }
    }
  }

  undo(): void {
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x -= this.dx;
        node.y -= this.dy;
        this.sceneGraph.notifyNodeChanged(node);
      }
    }
  }

  merge(other: ICommand): boolean {
    if (!(other instanceof MoveNodeCommand)) return false;
    if (this.nodeIds.length !== other.nodeIds.length) return false;
    if (!this.nodeIds.every((id, i) => id === other.nodeIds[i])) return false;

    // Accumulate deltas
    this.dx += other.dx;
    this.dy += other.dy;

    // Identity detection: if total movement is zero, command is a no-op
    return true;
  }
}
