import { ChangeDetectionStrategy, Component, Input, NgZone, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';

interface LayerEntry {
  id: string;
  name: string;
  type: string;
  kind: 'page' | 'node';
  depth: number;
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
  private ngZone = inject(NgZone);

  @Input() engine: CanvasEngine | null = null;

  /** Flat list of pages and nodes (excluding root). */
  readonly nodes = signal<LayerEntry[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  private unsubscribe: (() => void) | null = null;
  private unsubscribeSelection: (() => void) | null = null;

  ngOnChanges(): void {
    // Unsubscribe from previous engine
    this.unsubscribe?.();
    this.unsubscribe = null;

    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;

    if (!this.engine) return;

    // Build initial list
    this.refreshNodes();

    // Subscribe to scene graph changes
    this.unsubscribe = this.engine.sceneGraph.on(() => {
      this.refreshNodes();
    });

    const syncSelection = () => {
      const ids = new Set(this.engine?.selection.selectedNodeIds ?? []);
      this.ngZone.run(() => this.selectedIds.set(ids));
    };
    syncSelection();
    this.unsubscribeSelection = this.engine.selection.onChange(syncSelection);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribeSelection?.();
  }

  private refreshNodes(): void {
    if (!this.engine) return;

    const entries: LayerEntry[] = [];
    const pages = this.engine.sceneGraph.root.children.filter(n => n.type === 'group');

    const collect = (parentId: string, depth: number): void => {
      const parent = this.engine!.sceneGraph.getNode(parentId);
      if (!parent) return;
      for (const child of parent.children) {
        entries.push({
          id: child.id,
          name: child.name,
          type: child.type,
          kind: 'node',
          depth,
        });
        if (child.children.length > 0) {
          collect(child.id, depth + 1);
        }
      }
    };

    for (const page of pages) {
      entries.push({ id: page.id, name: page.name, type: page.type, kind: 'page', depth: 0 });
      collect(page.id, 1);
    }

    this.nodes.set(entries);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id) || this.engine?.activePageId === id;
  }

  onLayerClick(id: string, event: MouseEvent): void {
    if (!this.engine) return;

    const entry = this.nodes().find(e => e.id === id);
    if (entry?.kind === 'page') {
      this.engine.setActivePage(id);
      return;
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
