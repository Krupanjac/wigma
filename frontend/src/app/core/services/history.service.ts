import { Injectable, signal, computed } from '@angular/core';
import { ICommand } from '../commands/command.interface';

/**
 * HistoryService — undo/redo stack with temporal merge window.
 *
 * - Max 200 commands in the undo stack.
 * - 300ms merge window: consecutive merge-compatible commands are combined.
 * - Pushing a new command clears the redo stack.
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private static readonly MAX_UNDO = 200;
  private static readonly MERGE_WINDOW_MS = 300;

  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private lastPushTime = 0;

  private _canUndo = signal(false);
  private _canRedo = signal(false);
  private _undoLabel = signal<string | null>(null);
  private _redoLabel = signal<string | null>(null);

  readonly canUndo = computed(() => this._canUndo());
  readonly canRedo = computed(() => this._canRedo());
  readonly undoLabel = computed(() => this._undoLabel());
  readonly redoLabel = computed(() => this._redoLabel());

  /**
   * Execute a command and push it on the undo stack.
   * Attempts temporal merging with the previous command.
   */
  execute(command: ICommand): void {
    command.execute();

    const now = Date.now();
    const elapsed = now - this.lastPushTime;
    this.lastPushTime = now;

    // Try temporal merge
    if (
      elapsed < HistoryService.MERGE_WINDOW_MS &&
      this.undoStack.length > 0
    ) {
      const prev = this.undoStack[this.undoStack.length - 1];
      if (prev.merge && prev.merge(command)) {
        // Merged into previous; skip push
        this.redoStack.length = 0;
        this.updateSignals();
        return;
      }
    }

    this.undoStack.push(command);

    // Cap undo stack
    if (this.undoStack.length > HistoryService.MAX_UNDO) {
      this.undoStack.shift();
    }

    // Any new command clears redo
    this.redoStack.length = 0;
    this.updateSignals();
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
      this.updateSignals();
    }
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
      this.updateSignals();
    }
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lastPushTime = 0;
    this.updateSignals();
  }

  private updateSignals(): void {
    this._canUndo.set(this.undoStack.length > 0);
    this._canRedo.set(this.redoStack.length > 0);
    this._undoLabel.set(
      this.undoStack.length > 0
        ? this.undoStack[this.undoStack.length - 1].label
        : null
    );
    this._redoLabel.set(
      this.redoStack.length > 0
        ? this.redoStack[this.redoStack.length - 1].label
        : null
    );
  }
}
