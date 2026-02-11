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

  setFillOpacityPercent(raw: string): void {
    if (!this.node) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(100, value));
    this.node.fill = { ...this.node.fill, color: { ...this.node.fill.color, a: clamped / 100 } };
    this.node.markRenderDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }
}
