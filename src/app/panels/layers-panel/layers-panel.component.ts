import { ChangeDetectionStrategy, Component, HostListener, Input, NgZone, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { GroupNode } from '../../engine/scene-graph/group-node';
import { MenuCommandsService } from '../menu-bar/menu-commands.service';

interface SidebarMenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  action?: () => void;
}

interface SidebarMenuSection {
  title: string;
  items: SidebarMenuItem[];
}

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
  private menuCommands = inject(MenuCommandsService);

  @Input() engine: CanvasEngine | null = null;

  /** Flat list of pages and nodes (excluding root). */
  readonly nodes = signal<LayerEntry[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly editingId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly logoMenuOpen = signal(false);
  readonly logoMenuSections: SidebarMenuSection[] = [
    {
      title: 'File',
      items: [
        { label: 'New Project', action: () => this.menuCommands.newProject() },
        { label: 'Save to Browser', action: () => this.menuCommands.saveProjectToBrowser() },
        { separator: true, label: '' },
        { label: 'Export PNG', action: () => this.menuCommands.exportPNG() },
        { label: 'Export JSON', action: () => this.menuCommands.exportJSON() },
      ],
    },
    {
      title: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => this.menuCommands.undo() },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => this.menuCommands.redo() },
        { separator: true, label: '' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => this.menuCommands.cut() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => this.menuCommands.copy() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => this.menuCommands.paste() },
        { label: 'Delete', shortcut: 'Del', action: () => this.menuCommands.deleteSelection() },
        { separator: true, label: '' },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => this.menuCommands.selectAll() },
      ],
    },
    {
      title: 'View',
      items: [
        { label: 'Zoom In', shortcut: 'Ctrl+=', action: () => this.menuCommands.zoomIn() },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => this.menuCommands.zoomOut() },
        { label: 'Zoom to 100%', shortcut: 'Ctrl+0', action: () => this.menuCommands.zoomTo100() },
        { label: 'Zoom to Fit', shortcut: 'Ctrl+1', action: () => this.menuCommands.zoomToFit() },
      ],
    },
    {
      title: 'Arrange',
      items: [
        { label: 'Group', shortcut: 'Ctrl+G', action: () => this.menuCommands.group() },
      ],
    },
  ];

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

    // Subscribe to scene graph changes (debounced, skip property-only changes)
    let refreshPending = false;
    this.unsubscribe = this.engine.sceneGraph.on(event => {
      // Skip events that don't change hierarchy structure
      if (event.type === 'node-changed' || event.type === 'nodes-changed') return;
      if (refreshPending) return;
      refreshPending = true;
      queueMicrotask(() => {
        refreshPending = false;
        this.refreshNodes();
      });
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

  toggleLogoMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.logoMenuOpen.update(v => !v);
  }

  closeLogoMenu(): void {
    this.logoMenuOpen.set(false);
  }

  runLogoMenuAction(item: SidebarMenuItem, event: MouseEvent): void {
    event.stopPropagation();
    item.action?.();
    this.closeLogoMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeLogoMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeLogoMenu();
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
