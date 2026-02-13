import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  NgZone,
  inject,
  signal,
} from '@angular/core';
import { CanvasComponent } from './canvas.component';
import { ToolbarComponent } from './panels/toolbar/toolbar.component';
import { LayersPanelComponent } from './panels/layers-panel/layers-panel.component';
import { PropertiesPanelComponent } from './panels/properties-panel/properties-panel.component';
import { MenuBarComponent } from './panels/menu-bar/menu-bar.component';
import { ContextMenuComponent } from './panels/context-menu/context-menu.component';
import { LoaderComponent } from './loader.component';
import { CanvasEngine } from './engine/canvas-engine';
import { ToolManagerService } from './tools/tool-manager.service';
import { HistoryService } from './core/services/history.service';
import { ProjectService } from './core/services/project.service';
import { ClipboardService } from './core/services/clipboard.service';
import { ExportService } from './core/services/export.service';
import { KeybindingService } from './core/services/keybinding.service';
import { LoaderService } from './core/services/loader.service';
import { MenuCommandsService } from './panels/menu-bar/menu-commands.service';
import { ContextMenuService } from './panels/context-menu/context-menu.service';
import { Vec2 } from './shared/math/vec2';

@Component({
  selector: 'app-editor',
  imports: [
    CanvasComponent,
    ToolbarComponent,
    LayersPanelComponent,
    PropertiesPanelComponent,
    MenuBarComponent,
    ContextMenuComponent,
    LoaderComponent,
  ],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);
  private toolManager = inject(ToolManagerService);
  private history = inject(HistoryService);
  private project = inject(ProjectService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);
  private keybinding = inject(KeybindingService);
  private loader = inject(LoaderService);
  private menuCommands = inject(MenuCommandsService);
  private contextMenu = inject(ContextMenuService);

  engine: CanvasEngine | null = null;
  title = 'wigma';

  // Sidebars (Pages / Properties)
  readonly pagesWidth = signal(240);
  readonly propertiesWidth = signal(288);
  readonly pagesCollapsed = signal(false);
  readonly propertiesCollapsed = signal(false);

  private lastPagesWidth = 240;
  private lastPropertiesWidth = 288;

  private resizing: null | { side: 'pages' | 'properties'; startX: number; startWidth: number; pointerId: number } = null;
  private rafPending = false;
  private queuedClientX: number | null = null;

  private readonly PAGES_MIN = 180;
  private readonly PAGES_MAX = 420;
  private readonly PROPS_MIN = 240;
  private readonly PROPS_MAX = 520;
  private readonly COLLAPSE_THRESHOLD = 120;

  /** Dismiss function for the initial loading overlay. */
  private dismissInitLoader: (() => void) | null = null;

  ngOnInit(): void {
    // Show loading overlay until canvas is ready
    this.dismissInitLoader = this.loader.show('Initializing workspace…');

    // Create engine outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      this.engine = new CanvasEngine();
    });

    // Wire services
    this.toolManager.init(this.engine!);
    this.project.init(this.engine!); // async — restores from IndexedDB in background
    this.clipboard.init(this.engine!);
    this.exportService.init(this.engine!);
    this.menuCommands.init(this.engine!);
    this.contextMenu.init(this.engine!);

    // Register keybindings
    this.keybinding.init();
    this.keybinding.registerMany([
      { combo: 'ctrl+z', action: () => this.menuCommands.undo() },
      { combo: 'ctrl+shift+z', action: () => this.menuCommands.redo() },
      { combo: 'ctrl+y', action: () => this.menuCommands.redo() },
      { combo: 'ctrl+c', action: () => this.menuCommands.copy() },
      { combo: 'ctrl+x', action: () => this.menuCommands.cut() },
      { combo: 'ctrl+v', action: () => this.menuCommands.paste() },
      { combo: 'ctrl+a', action: () => this.menuCommands.selectAll() },
      { combo: 'ctrl+g', action: () => this.menuCommands.group() },
      { combo: 'delete', action: () => this.menuCommands.deleteSelection() },
      { combo: 'backspace', action: () => this.menuCommands.deleteSelection() },
      { combo: 'v', action: () => this.toolManager.setTool('select') },
      { combo: 'k', action: () => this.toolManager.setTool('scale') },
      { combo: 'f', action: () => this.toolManager.setTool('frame') },
      { combo: 'shift+s', action: () => this.toolManager.setTool('section') },
      { combo: 'x', action: () => this.toolManager.setTool('slice') },
      { combo: 'r', action: () => this.toolManager.setTool('rectangle') },
      { combo: 'o', action: () => this.toolManager.setTool('ellipse') },
      { combo: 'l', action: () => this.toolManager.setTool('line') },
      { combo: 'a', action: () => this.toolManager.setTool('arrow') },
      { combo: 'p', action: () => this.toolManager.setTool('pen') },
      { combo: 'b', action: () => this.toolManager.setTool('pencil') },
      { combo: 't', action: () => this.toolManager.setTool('text') },
      { combo: 'c', action: () => this.toolManager.setTool('comment') },
      { combo: 'i', action: () => this.toolManager.setTool('image') },
      { combo: 'shift+v', action: () => this.toolManager.setTool('video') },
      { combo: 'h', action: () => this.toolManager.setTool('hand') },
      { combo: 'z', action: () => this.toolManager.setTool('zoom') },
      { combo: 'ctrl+=', action: () => this.menuCommands.zoomIn() },
      { combo: 'ctrl+-', action: () => this.menuCommands.zoomOut() },
      { combo: 'ctrl+0', action: () => this.menuCommands.zoomTo100() },
      { combo: 'ctrl+1', action: () => this.menuCommands.zoomToFit() },
    ]);

    // Dismiss init loader when canvas is ready
    window.addEventListener('wigma:canvas-ready', this.onCanvasReady);
  }

  private onCanvasReady = (): void => {
    window.removeEventListener('wigma:canvas-ready', this.onCanvasReady);
    // Small delay to allow the first render frame to paint
    requestAnimationFrame(() => {
      this.dismissInitLoader?.();
      this.dismissInitLoader = null;
    });
  };

  startResize(side: 'pages' | 'properties', event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    const startWidth = side === 'pages'
      ? (this.pagesCollapsed() ? this.lastPagesWidth : this.pagesWidth())
      : (this.propertiesCollapsed() ? this.lastPropertiesWidth : this.propertiesWidth());

    this.resizing = { side, startX: event.clientX, startWidth, pointerId: event.pointerId };
    this.queuedClientX = event.clientX;

    window.addEventListener('pointermove', this.onResizeMove, { passive: false });
    window.addEventListener('pointerup', this.onResizeUp, { passive: true });
  }

  togglePages(): void {
    const next = !this.pagesCollapsed();
    if (next) {
      this.lastPagesWidth = this.pagesWidth();
    } else {
      this.pagesWidth.set(this.lastPagesWidth);
    }
    this.pagesCollapsed.set(next);
  }

  toggleProperties(): void {
    const next = !this.propertiesCollapsed();
    if (next) {
      this.lastPropertiesWidth = this.propertiesWidth();
    } else {
      this.propertiesWidth.set(this.lastPropertiesWidth);
    }
    this.propertiesCollapsed.set(next);
  }

  private onResizeMove = (event: PointerEvent): void => {
    if (!this.resizing) return;
    if (event.pointerId !== this.resizing.pointerId) return;
    event.preventDefault();

    this.queuedClientX = event.clientX;
    if (this.rafPending) return;
    this.rafPending = true;

    requestAnimationFrame(() => {
      this.rafPending = false;
      if (!this.resizing || this.queuedClientX === null) return;

      const dx = this.queuedClientX - this.resizing.startX;
      if (this.resizing.side === 'pages') {
        const proposed = this.resizing.startWidth + dx;
        if (proposed <= this.COLLAPSE_THRESHOLD) {
          this.pagesCollapsed.set(true);
          return;
        }
        this.pagesCollapsed.set(false);
        const clamped = Math.max(this.PAGES_MIN, Math.min(this.PAGES_MAX, proposed));
        this.pagesWidth.set(clamped);
        this.lastPagesWidth = clamped;
      } else {
        const proposed = this.resizing.startWidth - dx;
        if (proposed <= this.COLLAPSE_THRESHOLD) {
          this.propertiesCollapsed.set(true);
          return;
        }
        this.propertiesCollapsed.set(false);
        const clamped = Math.max(this.PROPS_MIN, Math.min(this.PROPS_MAX, proposed));
        this.propertiesWidth.set(clamped);
        this.lastPropertiesWidth = clamped;
      }
    });
  };

  private onResizeUp = (event: PointerEvent): void => {
    if (!this.resizing) return;
    if (event.pointerId !== this.resizing.pointerId) return;

    this.resizing = null;
    this.queuedClientX = null;
    window.removeEventListener('pointermove', this.onResizeMove);
    window.removeEventListener('pointerup', this.onResizeUp);
  };

  ngOnDestroy(): void {
    this.dismissInitLoader?.();
    window.removeEventListener('wigma:canvas-ready', this.onCanvasReady);
    void this.project.saveToBrowser();
    this.engine?.dispose();
    this.keybinding.unregisterAll();

    window.removeEventListener('pointermove', this.onResizeMove);
    window.removeEventListener('pointerup', this.onResizeUp);
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    void this.project.saveToBrowser();
  }

  @HostListener('document:contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (!this.engine) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const layerEntry = target.closest('[data-layer-entry="true"]') as HTMLElement | null;
    if (layerEntry) {
      event.preventDefault();
      const id = layerEntry.dataset['layerId'];
      const kind = layerEntry.dataset['layerKind'];
      if (!id || !kind) {
        this.contextMenu.hide();
        return;
      }
      if (kind === 'page') {
        this.contextMenu.open(event.clientX, event.clientY, { type: 'page', pageId: id });
      } else {
        this.contextMenu.open(event.clientX, event.clientY, { type: 'node', nodeId: id });
      }
      return;
    }

    const canvasHost = target.closest('app-canvas') as HTMLElement | null;
    if (canvasHost) {
      event.preventDefault();

      const rect = canvasHost.getBoundingClientRect();
      const screen = new Vec2(event.clientX - rect.left, event.clientY - rect.top);
      const world = this.engine.viewport.camera.screenToWorld(screen);
      const hit = this.engine.hitTester.hitTest(world);

      if (!hit && this.engine.selection.selectedNodeIds.length > 0) {
        this.contextMenu.open(event.clientX, event.clientY, { type: 'selection' });
      } else {
        this.contextMenu.open(event.clientX, event.clientY, { type: 'canvas', hitNodeId: hit?.id ?? null });
      }
      return;
    }

    this.contextMenu.hide();
  }
}
