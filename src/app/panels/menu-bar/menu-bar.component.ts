import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MenuCommandsService } from './menu-commands.service';

interface MenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  action: () => void;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-menu-bar',
  imports: [],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuBarComponent {
  private cmds = inject(MenuCommandsService);

  readonly activeMenu = signal<string | null>(null);

  readonly menus: Menu[] = [
    {
      label: 'File',
      items: [
        { label: 'Export PNG', action: () => this.cmds.exportPNG() },
        { label: 'Export JSON', action: () => this.cmds.exportJSON() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => this.cmds.undo() },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => this.cmds.redo() },
        { label: '', separator: true, action: () => {} },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => this.cmds.cut() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => this.cmds.copy() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => this.cmds.paste() },
        { label: 'Delete', shortcut: 'Del', action: () => this.cmds.deleteSelection() },
        { label: '', separator: true, action: () => {} },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => this.cmds.selectAll() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', shortcut: 'Ctrl+=', action: () => this.cmds.zoomIn() },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => this.cmds.zoomOut() },
        { label: 'Zoom to 100%', shortcut: 'Ctrl+0', action: () => this.cmds.zoomTo100() },
        { label: 'Zoom to Fit', shortcut: 'Ctrl+1', action: () => this.cmds.zoomToFit() },
      ],
    },
    {
      label: 'Arrange',
      items: [
        { label: 'Group', shortcut: 'Ctrl+G', action: () => this.cmds.group() },
      ],
    },
  ];

  openMenu(label: string): void {
    this.activeMenu.set(label);
  }

  closeMenu(): void {
    this.activeMenu.set(null);
  }
}
