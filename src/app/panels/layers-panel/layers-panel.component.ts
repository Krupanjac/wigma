import { ChangeDetectionStrategy, Component, Input, NgZone, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { GroupNode } from '../../engine/scene-graph/group-node';

interface LayerEntry {
  id: string;
  name: string;
  type: string;
  kind: 'page' | 'node';
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

/**
 * LayersPanelComponent — displays the scene hierarchy.
 *
 * Subscribes to scene graph events to keep the node list reactive.
 */
@Component({
  selector: 'app-layers-panel',
  imports: [],
  templateUrl: './layers-panel.component.html',
  styleUrl: './layers-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent implements OnChanges, OnDestroy {
  private ngZone = inject(NgZone);

  @Input() engine: CanvasEngine | null = null;

  /** Flat list of pages and nodes (excluding root). */
  readonly nodes = signal<LayerEntry[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly editingId = signal<string | null>(null);
  readonly editingName = signal('');

  private allEntriesById = new Map<string, LayerEntry>();
  private unsubscribe: (() => void) | null = null;
  private unsubscribeSelection: (() => void) | null = null;
  private removeRenameRequestListener: (() => void) | null = null;

  ngOnChanges(): void {
    // Unsubscribe from previous engine
    this.unsubscribe?.();
    this.unsubscribe = null;

    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;

    this.removeRenameRequestListener?.();
    this.removeRenameRequestListener = null;

    if (!this.engine) return;

    const onRenameRequest = (event: Event): void => {
      const custom = event as CustomEvent<{ id?: string }>;
      const id = custom.detail?.id;
      if (!id) return;
      this.ngZone.run(() => this.startRenameById(id));
    };
    window.addEventListener('wigma:layers-rename-request', onRenameRequest as EventListener);
    this.removeRenameRequestListener = () => {
      window.removeEventListener('wigma:layers-rename-request', onRenameRequest as EventListener);
    };

    // Build initial list
    this.refreshNodes();

    // Subscribe to scene graph changes
    this.unsubscribe = this.engine.sceneGraph.on(() => {
      this.refreshNodes();
    });

    const syncSelection = () => {
      const ids = new Set(this.engine?.selection.selectedNodeIds ?? []);
      this.ngZone.run(() => this.selectedIds.set(ids));
    };
    syncSelection();
    this.unsubscribeSelection = this.engine.selection.onChange(syncSelection);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribeSelection?.();
    this.removeRenameRequestListener?.();
  }

  private refreshNodes(): void {
    if (!this.engine) return;

    this.allEntriesById.clear();
    const entries: LayerEntry[] = [];
    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');
    const expanded = new Set(this.expandedIds());

    const collect = (parentId: string, depth: number, visibleParent: boolean): void => {
      const parent = this.engine!.sceneGraph.getNode(parentId);
      if (!parent) return;
      const parentExpanded = expanded.has(parent.id);

      for (const child of parent.children) {
        const entry: LayerEntry = {
          id: child.id,
          name: child.name,
          type: child.type,
          kind: 'node',
          depth,
          hasChildren: child.children.length > 0,
          parentId,
        };

        this.allEntriesById.set(entry.id, entry);
        if (visibleParent) {
          entries.push(entry);
        }

        if (child.children.length > 0) {
          if (!expanded.has(child.id)) {
            expanded.add(child.id);
          }
          collect(child.id, depth + 1, visibleParent && parentExpanded);
        }
      }
    };

    for (const page of pages) {
      if (!expanded.has(page.id)) {
        expanded.add(page.id);
      }

      const pageEntry: LayerEntry = {
        id: page.id,
        name: page.name,
        type: page.type,
        kind: 'page',
        depth: 0,
        hasChildren: page.children.length > 0,
        parentId: this.engine.sceneGraph.root.id,
      };

      this.allEntriesById.set(page.id, pageEntry);
      entries.push(pageEntry);
      collect(page.id, 1, expanded.has(page.id));
    }

    this.expandedIds.set(expanded);
    this.nodes.set(entries);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id) || this.engine?.activePageId === id;
  }

  onLayerClick(id: string, event: MouseEvent): void {
    if (!this.engine) return;
    if (this.editingId()) {
      this.commitRename();
    }

    const entry = this.nodes().find(e => e.id === id);
    if (entry?.kind === 'page') {
      this.engine.setActivePage(id);
      return;
    }

    // Sync with engine selection
    const node = this.engine.sceneGraph.getNode(id);
    if (node) {
      if (event.shiftKey) {
        this.engine.selection.toggleSelection(node);
      } else {
        this.engine.selection.select(node);
      }
    }
  }

  addPage(): void {
    if (!this.engine) return;

    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');
    const page = new GroupNode(`Page ${pages.length + 1}`);
    page.width = 0;
    page.height = 0;
    this.engine.sceneGraph.addNode(page);
    this.engine.setActivePage(page.id);
    this.expandedIds.update(s => {
      const next = new Set(s);
      next.add(page.id);
      return next;
    });
    this.refreshNodes();
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpanded(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    this.refreshNodes();
  }

  iconFor(entry: LayerEntry): string {
    if (entry.kind === 'page') return 'page';
    if (entry.type === 'group') return 'group';
    return entry.type;
  }

  onRenameDblClick(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.startRenameById(id);
  }

  private startRenameById(id: string): void {
    const entry = this.nodes().find(n => n.id === id);
    if (!entry) return;
    this.editingId.set(id);
    this.editingName.set(entry.name);
  }

  onRenameInput(value: string): void {
    this.editingName.set(value);
  }

  onRenameKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitRename();
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }

  commitRename(): void {
    if (!this.engine) return;
    const id = this.editingId();
    if (!id) return;

    const raw = this.editingName().trim();
    if (!raw) {
      this.cancelRename();
      return;
    }

    const node = this.engine.sceneGraph.getNode(id);
    if (node) {
      node.name = raw;
      this.engine.sceneGraph.notifyNodeChanged(node);
    }

    this.editingId.set(null);
    this.editingName.set('');
    this.refreshNodes();
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  toggleVisible(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.engine) return;
    const node = this.engine.sceneGraph.getNode(id);
    if (!node) return;
    node.visible = !node.visible;
    this.engine.sceneGraph.notifyNodeChanged(node);
    this.refreshNodes();
  }

  toggleLocked(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.engine) return;
    const node = this.engine.sceneGraph.getNode(id);
    if (!node) return;
    node.locked = !node.locked;
    this.engine.sceneGraph.notifyNodeChanged(node);
    this.refreshNodes();
  }

  isVisible(id: string): boolean {
    const node = this.engine?.sceneGraph.getNode(id);
    return node?.visible ?? true;
  }

  isLocked(id: string): boolean {
    const node = this.engine?.sceneGraph.getNode(id);
    return node?.locked ?? false;
  }

  shouldShowVisibilityAction(id: string): boolean {
    return this.isSelected(id) || !this.isVisible(id);
  }

  shouldShowLockAction(id: string): boolean {
    return this.isSelected(id) || this.isLocked(id);
  }

  hasChildren(id: string): boolean {
    return this.allEntriesById.get(id)?.hasChildren ?? false;
  }
}
