import { Injectable, signal } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { GroupNode } from '../../engine/scene-graph/group-node';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { MenuCommandsService } from '../menu-bar/menu-commands.service';
import { ContextMenuItem, ContextMenuTarget } from './context-menu.model';

@Injectable({
  providedIn: 'root',
})
export class ContextMenuService {
  readonly visible = signal(false);
  readonly position = signal({ x: 0, y: 0 });
  readonly items = signal<ContextMenuItem[]>([]);

  private engine: CanvasEngine | null = null;

  constructor(private menuCommands: MenuCommandsService) {}

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  hide(): void {
    this.visible.set(false);
  }

  open(x: number, y: number, target: ContextMenuTarget): void {
    this.position.set({ x, y });
    this.items.set(this.buildItems(target));
    this.visible.set(true);
  }

  private buildItems(target: ContextMenuTarget): ContextMenuItem[] {
    switch (target.type) {
      case 'page':
        return this.buildPageItems(target.pageId);
      case 'node':
        return this.buildNodeItems(target.nodeId);
      case 'layer':
        return this.buildLayerItems(target.nodeId);
      case 'selection':
        return this.buildSelectionItems();
      case 'canvas':
      default:
        if (target.hitNodeId) {
          return this.buildNodeItems(target.hitNodeId);
        }
        return this.buildCanvasItems();
    }
  }

  private buildCanvasItems(): ContextMenuItem[] {
    return [
      this.action('paste', 'Paste', () => this.menuCommands.paste(), 'Ctrl+V'),
      this.separator('s-1'),
      this.action('select-all', 'Select All', () => this.menuCommands.selectAll(), 'Ctrl+A'),
      this.separator('s-2'),
      this.action('zoom-in', 'Zoom In', () => this.menuCommands.zoomIn(), 'Ctrl+='),
      this.action('zoom-out', 'Zoom Out', () => this.menuCommands.zoomOut(), 'Ctrl+-'),
      this.action('zoom-fit', 'Zoom to Fit', () => this.menuCommands.zoomToFit(), 'Ctrl+1'),
    ];
  }

  private buildSelectionItems(): ContextMenuItem[] {
    const selectionCount = this.engine?.selection.selectedNodeIds.length ?? 0;

    return [
      this.action('cut', 'Cut', () => this.menuCommands.cut(), 'Ctrl+X', selectionCount === 0),
      this.action('copy', 'Copy', () => this.menuCommands.copy(), 'Ctrl+C', selectionCount === 0),
      this.action('paste', 'Paste', () => this.menuCommands.paste(), 'Ctrl+V'),
      this.separator('s-1'),
      this.action('group', 'Group Selection', () => this.menuCommands.group(), 'Ctrl+G', selectionCount < 2),
      this.separator('s-2'),
      this.action('delete', 'Delete', () => this.menuCommands.deleteSelection(), 'Delete', selectionCount === 0),
    ];
  }

  private buildNodeItems(nodeId: string): ContextMenuItem[] {
    const node = this.engine?.sceneGraph.getNode(nodeId);
    if (!node || node === this.engine?.sceneGraph.root) {
      return this.buildCanvasItems();
    }

    this.ensureNodeSelected(node);

    const isVisible = node.visible;
    const isLocked = node.locked;
    const selectionCount = this.engine?.selection.selectedNodeIds.length ?? 0;

    return [
      this.action('cut', 'Cut', () => this.menuCommands.cut(), 'Ctrl+X'),
      this.action('copy', 'Copy', () => this.menuCommands.copy(), 'Ctrl+C'),
      this.action('paste', 'Paste', () => this.menuCommands.paste(), 'Ctrl+V'),
      this.separator('s-1'),
      this.action('toggle-visible', isVisible ? 'Hide' : 'Show', () => this.toggleNodeVisible(node)),
      this.action('toggle-lock', isLocked ? 'Unlock' : 'Lock', () => this.toggleNodeLocked(node)),
      this.separator('s-2'),
      this.action('group', 'Group Selection', () => this.menuCommands.group(), 'Ctrl+G', selectionCount < 2),
      this.action('delete', 'Delete', () => this.menuCommands.deleteSelection(), 'Delete'),
    ];
  }

  private buildPageItems(pageId: string): ContextMenuItem[] {
    const page = this.engine?.sceneGraph.getNode(pageId);
    if (!page || page.type !== 'group' || page.parent !== this.engine?.sceneGraph.root) {
      return this.buildCanvasItems();
    }

    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');
    const canDelete = pages.length > 1;

    return [
      this.action('set-active-page', 'Set as Active Page', () => this.engine?.setActivePage(pageId)),
      this.action('rename-page', 'Rename', () => this.requestRename(pageId)),
      this.separator('s-1'),
      this.action('new-page', 'New Page', () => this.addPage()),
      this.action('delete-page', 'Delete Page', () => this.deletePage(page as GroupNode), undefined, !canDelete),
      this.separator('s-2'),
      this.action('paste', 'Paste', () => this.menuCommands.paste(), 'Ctrl+V'),
    ];
  }

  private addPage(): void {
    if (!this.engine) return;
    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');
    const page = new GroupNode(`Page ${pages.length + 1}`);
    page.width = 0;
    page.height = 0;
    this.engine.sceneGraph.addNode(page);
    this.engine.setActivePage(page.id);
  }

  private deletePage(page: GroupNode): void {
    if (!this.engine) return;
    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');
    if (pages.length <= 1) return;

    const wasActive = this.engine.activePageId === page.id;
    this.engine.sceneGraph.removeNode(page);

    if (wasActive) {
      const nextPage = this.engine.sceneGraph.root.children.find(n => n.type === 'group');
      if (nextPage) {
        this.engine.setActivePage(nextPage.id);
      }
    }
  }

  private toggleNodeVisible(node: BaseNode): void {
    if (!this.engine) return;
    node.visible = !node.visible;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  private toggleNodeLocked(node: BaseNode): void {
    if (!this.engine) return;
    node.locked = !node.locked;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  private ensureNodeSelected(node: BaseNode): void {
    if (!this.engine) return;
    if (this.engine.selection.isSelected(node.id)) return;
    this.engine.selection.select(node);
  }

  private buildLayerItems(nodeId: string): ContextMenuItem[] {
    const node = this.engine?.sceneGraph.getNode(nodeId);
    if (!node || node === this.engine?.sceneGraph.root) {
      return this.buildCanvasItems();
    }

    this.ensureNodeSelected(node);

    const isVisible = node.visible;
    const isLocked = node.locked;
    const selectionCount = this.engine?.selection.selectedNodeIds.length ?? 0;

    return [
      this.action('focus', 'Focus on Layer', () => this.focusOnNode(node)),
      this.separator('s-focus'),
      this.action('cut', 'Cut', () => this.menuCommands.cut(), 'Ctrl+X'),
      this.action('copy', 'Copy', () => this.menuCommands.copy(), 'Ctrl+C'),
      this.action('paste', 'Paste', () => this.menuCommands.paste(), 'Ctrl+V'),
      this.separator('s-1'),
      this.action('toggle-visible', isVisible ? 'Hide' : 'Show', () => this.toggleNodeVisible(node)),
      this.action('toggle-lock', isLocked ? 'Unlock' : 'Lock', () => this.toggleNodeLocked(node)),
      this.separator('s-2'),
      this.action('group', 'Group Selection', () => this.menuCommands.group(), 'Ctrl+G', selectionCount < 2),
      this.action('delete', 'Delete', () => this.menuCommands.deleteSelection(), 'Delete'),
    ];
  }

  private focusOnNode(node: BaseNode): void {
    if (!this.engine) return;
    this.engine.viewport.fitToBounds(node.worldBounds, 100);
  }

  private requestRename(nodeId: string): void {
    window.dispatchEvent(new CustomEvent('wigma:layers-rename-request', { detail: { id: nodeId } }));
  }

  private action(
    id: string,
    label: string,
    action: () => void,
    shortcut?: string,
    disabled: boolean = false,
  ): ContextMenuItem {
    return {
      id,
      kind: 'action',
      label,
      shortcut,
      disabled,
      action,
    };
  }

  private separator(id: string): ContextMenuItem {
    return {
      id,
      kind: 'separator',
    };
  }
}
