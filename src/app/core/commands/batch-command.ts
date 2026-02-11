import { ICommand } from './command.interface';

/**
 * BatchCommand — wraps multiple commands into a single undoable operation.
 * All sub-commands execute/undo atomically.
 */
export class BatchCommand implements ICommand {
  readonly label: string;

  constructor(
    private commands: ICommand[],
    label?: string
  ) {
    this.label = label ?? `Batch (${commands.length} operations)`;
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  /** Number of sub-commands. */
  get count(): number {
    return this.commands.length;
  }
}
