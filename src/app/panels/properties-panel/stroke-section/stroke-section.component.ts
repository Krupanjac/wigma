import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { colorToCss, colorToHex, hexToColor } from '../../../shared/utils/color-utils';

@Component({
  selector: 'app-stroke-section',
  imports: [],
  templateUrl: './stroke-section.component.html',
  styleUrl: './stroke-section.component.css',
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

  setStrokeWidth(raw: string): void {
    if (!this.node) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    this.node.stroke = { ...this.node.stroke, width: Math.max(0, value) };
    this.node.markRenderDirty();
    this.node.markBoundsDirty();
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

}
