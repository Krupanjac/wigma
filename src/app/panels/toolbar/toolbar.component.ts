import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToolManagerService } from '../../tools/tool-manager.service';
import { ToolType } from '../../tools/base-tool';
import { TOOL_DEFINITIONS, TOOL_GROUPS, ToolGroupId, ToolGroupModel, ToolModel } from '../../core/models/tool.model';
import { EditorMode, EditorModeService } from '../../core/services/editor-mode.service';

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent {
  private toolManager = inject(ToolManagerService);
  private editorModeService = inject(EditorModeService);

  readonly activeToolType = this.toolManager.activeToolType;
  readonly activeMode = this.editorModeService.mode;
  readonly modes: EditorMode[] = ['draw', 'design', 'dev'];
  readonly toolGroups = TOOL_GROUPS;
  readonly openGroupId = signal<ToolGroupId | null>(null);
  readonly dropdownLeft = signal(0);
  readonly dropdownTop = signal(0);
  readonly lastSelectedByGroup = signal<Record<ToolGroupId, ToolType>>(
    TOOL_GROUPS.reduce((acc, group) => {
      acc[group.id] = group.tools[0];
      return acc;
    }, {} as Record<ToolGroupId, ToolType>)
  );

  private readonly toolMap = new Map<ToolType, ToolModel>(
    TOOL_DEFINITIONS.map(t => [t.type, t])
  );

  tool(type: ToolType): ToolModel | undefined {
    return this.toolMap.get(type);
  }

  toolTitle(type: ToolType): string {
    const info = this.tool(type);
    if (!info) return type;
    return info.shortcut ? `${info.label} (${info.shortcut})` : info.label;
  }

  groupPrimaryTool(groupId: ToolGroupId): ToolType {
    return this.lastSelectedByGroup()[groupId] ?? 'select';
  }

  groupById(groupId: ToolGroupId): ToolGroupModel | null {
    return this.toolGroups.find(g => g.id === groupId) ?? null;
  }

  groupHasDropdown(groupId: ToolGroupId): boolean {
    const group = this.groupById(groupId);
    return !!group && group.tools.length > 1;
  }

  iconLabel(type: ToolType): string {
    switch (type) {
      case 'select': return 'V';
      case 'hand': return 'H';
      case 'scale': return 'K';
      case 'frame': return 'F';
      case 'section': return 'S';
      case 'slice': return 'SL';
      case 'rectangle': return 'R';
      case 'ellipse': return 'O';
      case 'polygon': return '⬡';
      case 'star': return '★';
      case 'line': return 'L';
      case 'arrow': return '→';
      case 'image': return 'IMG';
      case 'video': return 'VID';
      case 'pen': return 'P';
      case 'pencil': return 'B';
      case 'text': return 'T';
      case 'comment': return 'C';
      case 'zoom': return 'Z';
    }
  }

  iconPath(type: ToolType): string {
    switch (type) {
      case 'select': return 'M5 4l7 16 1-7 6-1-14-8z';
      case 'hand': return 'M7 11V7a1 1 0 012 0v4m0 0V6a1 1 0 112 0v5m0 0V7a1 1 0 112 0v4m0 0V8a1 1 0 112 0v6c0 3-2 6-5 6h-1c-3 0-5-2-5-5v-3a1 1 0 112 0v1';
      case 'scale': return 'M5 19V5h14M9 15l10-10M13 5h6v6';
      case 'frame': return 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';
      case 'section': return 'M6 5h12M6 12h9M6 19h12';
      case 'slice': return 'M4 20L20 4M8 4h12v12';
      case 'rectangle': return 'M4 6h16v12H4z';
      case 'ellipse': return 'M12 6c4.5 0 8 2.7 8 6s-3.5 6-8 6-8-2.7-8-6 3.5-6 8-6z';
      case 'polygon': return 'M12 4l7 5v6l-7 5-7-5V9z';
      case 'star': return 'M12 4l2.5 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.1 3 1-5.8-4.2-4.1 5.8-.8z';
      case 'line': return 'M5 19L19 5';
      case 'arrow': return 'M5 12h12M13 6l6 6-6 6';
      case 'image': return 'M4 6h16v12H4zM8 10h.01M20 16l-5-5-4 4-2-2-5 5';
      case 'video': return 'M4 7h11v10H4zM15 10l5-3v10l-5-3z';
      case 'pen': return 'M4 20l4-1 9-9-3-3-9 9-1 4zM14 7l3 3';
      case 'pencil': return 'M4 20l4-1 10-10-3-3L5 16l-1 4z';
      case 'text': return 'M4 6h16M12 6v14';
      case 'comment': return 'M5 6h14v10H9l-4 4V6z';
      case 'zoom': return 'M11 4a7 7 0 105.3 11.6L20 19';
    }
  }

  selectTool(type: ToolType): void {
    this.toolManager.setTool(type);
    this.rememberGroupTool(type);
    this.openGroupId.set(null);
  }

  activateGroupTool(groupId: ToolGroupId, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.groupHasDropdown(groupId)) {
      this.toggleGroup(groupId, event);
      return;
    }

    this.selectTool(this.groupPrimaryTool(groupId));
  }

  selectToolFromMenu(type: ToolType, event: PointerEvent): void {
    event.stopPropagation();
    this.selectTool(type);
  }

  toggleGroup(groupId: ToolGroupId, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.groupHasDropdown(groupId)) {
      this.openGroupId.set(null);
      return;
    }

    if (this.openGroupId() === groupId) {
      this.openGroupId.set(null);
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      this.dropdownLeft.set(rect.left + rect.width / 2);
      this.dropdownTop.set(rect.top - 8);
    }

    this.openGroupId.set(groupId);
  }

  private rememberGroupTool(type: ToolType): void {
    const group = this.toolGroups.find(g => g.tools.includes(type));
    if (!group) return;
    this.lastSelectedByGroup.update(state => ({
      ...state,
      [group.id]: type,
    }));
  }

  setMode(mode: EditorMode): void {
    this.editorModeService.setMode(mode);
    this.openGroupId.set(null);
  }
}
