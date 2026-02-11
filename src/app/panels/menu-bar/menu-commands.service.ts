import { Injectable, inject } from '@angular/core';
import { HistoryService } from '../../core/services/history.service';
import { ClipboardService } from '../../core/services/clipboard.service';
import { ExportService } from '../../core/services/export.service';
import { ProjectService } from '../../core/services/project.service';
import { CanvasEngine } from '../../engine/canvas-engine';
import { ToolManagerService } from '../../tools/tool-manager.service';
import { DeleteNodeCommand } from '../../core/commands/delete-node.command';
import { GroupNodesCommand } from '../../core/commands/group-nodes.command';
import { BatchCommand } from '../../core/commands/batch-command';

/**
 * MenuCommandsService — actions triggered from the menu bar, context menu,
 * and keyboard shortcuts.
 */
@Injectable({
  providedIn: 'root'
})
export class MenuCommandsService {
  private history = inject(HistoryService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);
  private project = inject(ProjectService);
  private toolManager = inject(ToolManagerService);

  private engine: CanvasEngine | null = null;

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  // ── Edit ────────────────────────────────────────────────
  undo(): void { this.history.undo(); }
  redo(): void { this.history.redo(); }

  copy(): void {
    if (!this.engine) return;
    const nodes = this.engine.selection.selectedNodes;
    this.clipboard.copy(nodes);
  }

  cut(): void {
    if (!this.engine) return;
    const nodes = this.engine.selection.selectedNodes;
    this.clipboard.cut(nodes);
    this.engine.selection.clearSelection();
  }

  paste(): void {
    if (!this.engine) return;
    const pasted = this.clipboard.paste();
    if (pasted.length > 0) {
      this.engine.selection.clearSelection();
      this.engine.selection.selectMultiple(pasted);
    }
  }

  deleteSelection(): void {
    if (!this.engine) return;
    const nodes = this.engine.selection.selectedNodes;
    if (nodes.length === 0) return;

    const commands = nodes.map(n =>
      new DeleteNodeCommand(this.engine!.sceneGraph, n)
    );
    this.history.execute(new BatchCommand(commands, 'Delete'));
    this.engine.selection.clearSelection();
  }

  selectAll(): void {
    if (!this.engine) return;
    const allNodes = this.engine.sceneGraph.getAllNodes()
      .filter(n => n !== this.engine!.sceneGraph.root);
    this.engine.selection.selectMultiple(allNodes);
  }

  // ── Arrange ─────────────────────────────────────────────
  group(): void {
    if (!this.engine) return;
    const nodeIds = this.engine.selection.selectedNodeIds;
    if (nodeIds.length < 2) return;

    const cmd = new GroupNodesCommand(this.engine.sceneGraph, nodeIds);
    this.history.execute(cmd);
  }

  // ── View ────────────────────────────────────────────────
  zoomIn(): void  { this.engine?.viewport.zoomController.setZoomImmediate((this.engine?.viewport.camera.zoom ?? 1) * 1.25); }
  zoomOut(): void { this.engine?.viewport.zoomController.setZoomImmediate((this.engine?.viewport.camera.zoom ?? 1) * 0.8); }
  zoomToFit(): void {
    if (!this.engine) return;
    const allNodes = this.engine.sceneGraph.getAllNodes()
      .filter(n => n !== this.engine!.sceneGraph.root);
    const allBounds = allNodes.map(n => n.worldBounds);
    this.engine.viewport.fitToAll(allBounds);
  }
  zoomTo100(): void { this.engine?.viewport.camera.setZoom(1); }

  // ── Export ──────────────────────────────────────────────
  exportPNG(): void  { this.exportService.downloadPNG(); }
  exportJSON(): void { this.exportService.downloadJSON(); }
}
