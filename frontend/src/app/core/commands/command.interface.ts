/**
 * ICommand interface for undo/redo system.
 *
 * Commands encapsulate state-changing operations and know how to reverse them.
 * The optional merge() method allows consecutive similar commands to be
 * combined within a temporal merge window (e.g., multiple move deltas).
 */
export interface ICommand {
  /** Human-readable label for the history panel. */
  readonly label: string;

  /** Execute the command (do/redo). */
  execute(): void;

  /** Reverse the command (undo). */
  undo(): void;

  /**
   * Attempt to merge this command with another.
   * Returns true if merge was successful, false if they should remain separate.
   * Used for temporal merging within the MERGE_WINDOW_MS (300ms).
   */
  merge?(other: ICommand): boolean;
}
