import { ICommand } from './command.interface';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * ModifyPropertyCommand — changes any property on a node.
 * Generic command for fill, stroke, opacity, text, etc.
 */
export class ModifyPropertyCommand implements ICommand {
  readonly label: string;

  constructor(
    private sceneGraph: SceneGraphManager,
    private nodeId: string,
    private property: string,
    private oldValue: unknown,
    private newValue: unknown
  ) {
    this.label = `Change ${property}`;
  }

  execute(): void {
    const node = this.sceneGraph.getNode(this.nodeId) as Record<string, unknown> | undefined;
    if (node) {
      node[this.property] = this.newValue;
      this.sceneGraph.notifyNodeChanged(node as unknown as BaseNode);
    }
  }

  undo(): void {
    const node = this.sceneGraph.getNode(this.nodeId) as Record<string, unknown> | undefined;
    if (node) {
      node[this.property] = this.oldValue;
      this.sceneGraph.notifyNodeChanged(node as unknown as BaseNode);
    }
  }

  merge(other: ICommand): boolean {
    if (!(other instanceof ModifyPropertyCommand)) return false;
    if (this.nodeId !== other.nodeId || this.property !== other.property) return false;
    this.newValue = other.newValue;
    return true;
  }
}
