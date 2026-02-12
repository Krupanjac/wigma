import { Injectable, signal, inject } from '@angular/core';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { CanvasEngine } from '../../engine/canvas-engine';
import { HistoryService } from './history.service';
import { CreateNodeCommand } from '../commands/create-node.command';
import { DeleteNodeCommand } from '../commands/delete-node.command';
import { BatchCommand } from '../commands/batch-command';

interface ClipboardEntry {
  node: BaseNode;
  parentId: string | null;
}

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

  private buffer: ClipboardEntry[] = [];
  private pasteOffset = 20;
  private pasteCount = 0;

  private engine: CanvasEngine | null = null;

  readonly hasContent = signal(false);

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  copy(nodes: BaseNode[]): void {
    const unique = Array.from(new Map(nodes.map(n => [n.id, n])).values());
    const selectedIds = new Set(unique.map(n => n.id));
    const topLevel = unique.filter(node => {
      let current = node.parent;
      while (current) {
        if (selectedIds.has(current.id)) {
          return false;
        }
        current = current.parent;
      }
      return true;
    });

    this.buffer = topLevel.map(n => ({
      node: n.clone(),
      parentId: n.parent?.id ?? null,
    }));

    this.pasteCount = 0;
    this.hasContent.set(this.buffer.length > 0);
  }

  cut(nodes: BaseNode[]): void {
    this.copy(nodes);
    if (!this.engine) return;

    const sg = this.engine!.sceneGraph;
    const commands = nodes.map(n =>
      new DeleteNodeCommand(sg, n)
    );
    this.history.execute(new BatchCommand(commands, 'Cut', sg));
  }

  paste(): BaseNode[] {
    if (!this.engine || this.buffer.length === 0) return [];
    const activePage = this.engine.activePage;
    if (!activePage) return [];

    this.pasteCount++;
    const offset = this.pasteOffset * this.pasteCount;
    const clones = this.buffer.map(entry => {
      const clone = entry.node.clone();
      clone.x += offset;
      clone.y += offset;
      return clone;
    });

    const sg = this.engine!.sceneGraph;
    const commands = clones.map((node, index) => {
      const entry = this.buffer[index];
      const sourceParent = entry.parentId
        ? sg.getNode(entry.parentId)
        : undefined;

      const targetParentId = sourceParent && this.engine!.isNodeInActivePage(sourceParent)
        ? sourceParent.id
        : activePage.id;

      return new CreateNodeCommand(sg, node, targetParentId);
    });
    this.history.execute(new BatchCommand(commands, 'Paste', sg));

    return clones;
  }

  clear(): void {
    this.buffer = [];
    this.pasteCount = 0;
    this.hasContent.set(false);
  }
}
