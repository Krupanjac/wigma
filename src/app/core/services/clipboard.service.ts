import { Injectable, signal, inject } from '@angular/core';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { CanvasEngine } from '../../engine/canvas-engine';
import { HistoryService } from './history.service';
import { CreateNodeCommand } from '../commands/create-node.command';
import { DeleteNodeCommand } from '../commands/delete-node.command';
import { BatchCommand } from '../commands/batch-command';

/**
 * ClipboardService — cut/copy/paste for scene nodes.
 *
 * Stores serialized snapshots of nodes. Paste applies an offset to avoid
 * exact overlap.
 */
@Injectable({
  providedIn: 'root'
})
export class ClipboardService {
  private history = inject(HistoryService);

  private buffer: BaseNode[] = [];
  private pasteOffset = 20;
  private pasteCount = 0;

  private engine: CanvasEngine | null = null;

  readonly hasContent = signal(false);

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  copy(nodes: BaseNode[]): void {
    this.buffer = nodes.map(n => n.clone());
    this.pasteCount = 0;
    this.hasContent.set(this.buffer.length > 0);
  }

  cut(nodes: BaseNode[]): void {
    this.copy(nodes);
    if (!this.engine) return;

    const commands = nodes.map(n =>
      new DeleteNodeCommand(this.engine!.sceneGraph, n)
    );
    this.history.execute(new BatchCommand(commands, 'Cut'));
  }

  paste(): BaseNode[] {
    if (!this.engine || this.buffer.length === 0) return [];

    this.pasteCount++;
    const offset = this.pasteOffset * this.pasteCount;
    const clones = this.buffer.map(n => {
      const clone = n.clone();
      clone.x += offset;
      clone.y += offset;
      return clone;
    });

    const commands = clones.map(n =>
      new CreateNodeCommand(this.engine!.sceneGraph, n)
    );
    this.history.execute(new BatchCommand(commands, 'Paste'));

    return clones;
  }

  clear(): void {
    this.buffer = [];
    this.pasteCount = 0;
    this.hasContent.set(false);
  }
}
