import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { BaseNode } from '../../engine/scene-graph/base-node';

/**
 * LayersPanelComponent — displays the scene hierarchy.
 *
 * Subscribes to scene graph events to keep the node list reactive.
 */
@Component({
  selector: 'app-layers-panel',
  imports: [],
  templateUrl: './layers-panel.component.html',
  styleUrl: './layers-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent {
  /** Flat list of nodes to show (excluding root). */
  readonly nodes = signal<{ id: string; name: string; type: string }[]>([]);
  private selectedSet = new Set<string>();

  isSelected(id: string): boolean {
    return this.selectedSet.has(id);
  }

  onLayerClick(id: string, event: MouseEvent): void {
    if (event.shiftKey) {
      if (this.selectedSet.has(id)) {
        this.selectedSet.delete(id);
      } else {
        this.selectedSet.add(id);
      }
    } else {
      this.selectedSet.clear();
      this.selectedSet.add(id);
    }
  }
}
