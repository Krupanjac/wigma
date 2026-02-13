import { ICommand } from './command.interface';
import { SceneGraphManager } from '../../engine/scene-graph/scene-graph-manager';

/**
 * BatchCommand — wraps multiple commands into a single undoable operation.
 * All sub-commands execute/undo atomically.
 *
 * When a SceneGraphManager is provided, the batch wraps execution in
 * beginBatch/endBatch so that `hierarchy-changed` events are coalesced
 * into a single emission at the end instead of N individual ones.
 */
export class BatchCommand implements ICommand {
  readonly label: string;

  constructor(
    private commands: ICommand[],
    label?: string,
    private sceneGraph?: SceneGraphManager,
  ) {
    this.label = label ?? `Batch (${commands.length} operations)`;
  }

  execute(): void {
    this.sceneGraph?.beginBatch();
    for (const cmd of this.commands) {
      cmd.execute();
    }
    this.sceneGraph?.endBatch();
  }

  undo(): void {
    this.sceneGraph?.beginBatch();
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
    this.sceneGraph?.endBatch();
  }

  /** Number of sub-commands. */
  get count(): number {
    return this.commands.length;
  }
}
