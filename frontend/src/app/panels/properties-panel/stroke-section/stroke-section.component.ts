import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { colorToCss, colorToHex, hexToColor } from '../../../shared/utils/color-utils';

@Component({
  selector: 'app-stroke-section',
  imports: [],
  templateUrl: './stroke-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StrokeSectionComponent {
  @Input() engine: CanvasEngine | null = null;
  @Input() node: BaseNode | null = null;

  colorToCss = colorToCss;
  colorToHex = colorToHex;

  setStrokeHex(raw: string): void {
    if (!this.node) return;
    const hex = raw.trim();
    if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return;
    const color = hexToColor(hex.startsWith('#') ? hex : `#${hex}`);
    this.node.stroke = { ...this.node.stroke, color };
    this.node.markRenderDirty();
    this.node.markBoundsDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  setStrokePickerHex(raw: string): void {
    if (!this.node) return;
    const hex = raw.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return;
    const picked = hexToColor(hex.startsWith('#') ? hex : `#${hex}`);
    const color = { ...picked, a: this.node.stroke.color.a };
    this.node.stroke = { ...this.node.stroke, color };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  setStrokeWidth(raw: string): void {
    if (!this.node) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    this.node.stroke = { ...this.node.stroke, width: Math.max(0, value) };
    this.node.markRenderDirty();
    this.node.markBoundsDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  nudgeStrokeWidth(delta: number, event?: MouseEvent): void {
    if (!this.node) return;
    const step = event?.shiftKey ? 10 : 1;
    const next = Math.max(0, this.node.stroke.width + delta * step);
    this.node.stroke = { ...this.node.stroke, width: next };
    this.node.markRenderDirty();
    this.node.markBoundsDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  toggleStrokeVisible(): void {
    if (!this.node) return;
    this.node.stroke = { ...this.node.stroke, visible: !this.node.stroke.visible };
    this.node.markRenderDirty();
    this.node.markBoundsDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

}
