import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToolManagerService } from '../../tools/tool-manager.service';
import { ToolType } from '../../tools/base-tool';

interface ToolButton {
  type: ToolType;
  label: string;
  icon: string;
  shortcut: string;
}

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent {
  private toolManager = inject(ToolManagerService);

  readonly activeToolType = this.toolManager.activeToolType;

  readonly tools: ToolButton[] = [
    { type: 'select',    label: 'Select',    icon: 'V', shortcut: 'V' },
    { type: 'rectangle', label: 'Rectangle', icon: 'R', shortcut: 'R' },
    { type: 'ellipse',   label: 'Ellipse',   icon: 'O', shortcut: 'O' },
    { type: 'polygon',   label: 'Polygon',   icon: '\u2B21', shortcut: '' },
    { type: 'star',      label: 'Star',      icon: '\u2605', shortcut: '' },
    { type: 'line',      label: 'Line',      icon: 'L', shortcut: 'L' },
    { type: 'arrow',     label: 'Arrow',     icon: '\u2192', shortcut: '' },
    { type: 'pen',       label: 'Pen',       icon: 'P', shortcut: 'P' },
    { type: 'text',      label: 'Text',      icon: 'T', shortcut: 'T' },
    { type: 'hand',      label: 'Hand',      icon: 'H', shortcut: 'H' },
    { type: 'zoom',      label: 'Zoom',      icon: 'Z', shortcut: 'Z' },
  ];

  selectTool(type: ToolType): void {
    this.toolManager.setTool(type);
  }
}
