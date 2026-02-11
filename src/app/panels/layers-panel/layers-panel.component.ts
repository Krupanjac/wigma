import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';

interface LayerEntry {
  id: string;
  name: string;
  type: string;
}

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
export class LayersPanelComponent implements OnChanges, OnDestroy {
  @Input() engine: CanvasEngine | null = null;

  /** Flat list of nodes to show (excluding root). */
  readonly nodes = signal<LayerEntry[]>([]);
  private selectedSet = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  ngOnChanges(): void {
    // Unsubscribe from previous engine
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (!this.engine) return;

    // Build initial list
    this.refreshNodes();

    // Subscribe to scene graph changes
    this.unsubscribe = this.engine.sceneGraph.on(() => {
      this.refreshNodes();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  private refreshNodes(): void {
    if (!this.engine) return;
    const allNodes = this.engine.sceneGraph.getRenderOrder();
    this.nodes.set(
      allNodes.map(n => ({ id: n.id, name: n.name, type: n.type }))
    );
  }

  isSelected(id: string): boolean {
    return this.selectedSet.has(id);
  }

  onLayerClick(id: string, event: MouseEvent): void {
    if (!this.engine) return;

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

    // Sync with engine selection
    const node = this.engine.sceneGraph.getNode(id);
    if (node) {
      if (event.shiftKey) {
        this.engine.selection.toggleSelection(node);
      } else {
        this.engine.selection.select(node);
      }
    }
  }
}
