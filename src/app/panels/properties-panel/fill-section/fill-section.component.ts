import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { colorToCss, colorToHex, hexToColor } from '../../../shared/utils/color-utils';


@Component({
  selector: 'app-fill-section',
  imports: [],
  templateUrl: './fill-section.component.html',
  styleUrl: './fill-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FillSectionComponent {

  @Input() engine: CanvasEngine | null = null;
  @Input() node: BaseNode | null = null;

  readonly Math = Math;

  colorToCss = colorToCss;
  colorToHex = colorToHex;

  setFillHex(raw: string): void {
    if (!this.node) return;
    const hex = raw.trim();
    if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return;
    const color = hexToColor(hex.startsWith('#') ? hex : `#${hex}`);
    this.node.fill = { ...this.node.fill, color };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  setFillPickerHex(raw: string): void {
    if (!this.node) return;
    const hex = raw.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return;
    const picked = hexToColor(hex.startsWith('#') ? hex : `#${hex}`);
    // Preserve current alpha from the opacity input.
    const color = { ...picked, a: this.node.fill.color.a };
    this.node.fill = { ...this.node.fill, color };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  setFillOpacityPercent(raw: string): void {
    if (!this.node) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(100, value));
    this.node.fill = { ...this.node.fill, color: { ...this.node.fill.color, a: clamped / 100 } };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  nudgeFillOpacity(delta: number, event?: MouseEvent): void {
    if (!this.node) return;
    const step = event?.shiftKey ? 10 : 1;
    const current = Math.round(this.node.fill.color.a * 100);
    const next = Math.max(0, Math.min(100, current + delta * step));
    this.node.fill = { ...this.node.fill, color: { ...this.node.fill.color, a: next / 100 } };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  toggleFillVisible(): void {
    if (!this.node) return;
    this.node.fill = { ...this.node.fill, visible: !this.node.fill.visible };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }
}
