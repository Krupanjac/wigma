import {
  Component,
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
import { CanvasEngine } from './engine/canvas-engine';
import { ToolManagerService } from './tools/tool-manager.service';
import { HistoryService } from './core/services/history.service';
import { ProjectService } from './core/services/project.service';
import { ClipboardService } from './core/services/clipboard.service';
import { ExportService } from './core/services/export.service';
import { KeybindingService } from './core/services/keybinding.service';
import { MenuCommandsService } from './panels/menu-bar/menu-commands.service';

@Component({
  selector: 'app-root',
  imports: [
    CanvasComponent,
    ToolbarComponent,
    LayersPanelComponent,
    PropertiesPanelComponent,
    MenuBarComponent,
    ContextMenuComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);
  private toolManager = inject(ToolManagerService);
  private history = inject(HistoryService);
  private project = inject(ProjectService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);
  private keybinding = inject(KeybindingService);
  private menuCommands = inject(MenuCommandsService);

  engine: CanvasEngine | null = null;

  ngOnInit(): void {
    // Create engine outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      this.engine = new CanvasEngine();
    });

    // Wire services
    this.toolManager.init(this.engine!);
    this.project.init(this.engine!);
    this.clipboard.init(this.engine!);
    this.exportService.init(this.engine!);
    this.menuCommands.init(this.engine!);

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
      { combo: 'r', action: () => this.toolManager.setTool('rectangle') },
      { combo: 'o', action: () => this.toolManager.setTool('ellipse') },
      { combo: 'l', action: () => this.toolManager.setTool('line') },
      { combo: 'p', action: () => this.toolManager.setTool('pen') },
      { combo: 't', action: () => this.toolManager.setTool('text') },
      { combo: 'h', action: () => this.toolManager.setTool('hand') },
      { combo: 'z', action: () => this.toolManager.setTool('zoom') },
      { combo: 'ctrl+=', action: () => this.menuCommands.zoomIn() },
      { combo: 'ctrl+-', action: () => this.menuCommands.zoomOut() },
      { combo: 'ctrl+0', action: () => this.menuCommands.zoomTo100() },
      { combo: 'ctrl+1', action: () => this.menuCommands.zoomToFit() },
    ]);
  }

  ngOnDestroy(): void {
    this.engine?.dispose();
    this.keybinding.unregisterAll();
  }
}
