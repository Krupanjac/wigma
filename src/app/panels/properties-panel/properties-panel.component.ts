import { ChangeDetectionStrategy, Component, computed, inject, Input, NgZone, OnChanges, OnDestroy, signal } from '@angular/core';
import { TransformSectionComponent } from './transform-section/transform-section.component';
import { FillSectionComponent } from './fill-section/fill-section.component';
import { StrokeSectionComponent } from './stroke-section/stroke-section.component';
import { TextSectionComponent } from './text-section/text-section.component';
import { CanvasEngine } from '../../engine/canvas-engine';
import { BaseNode } from '../../engine/scene-graph/base-node';

@Component({
  selector: 'app-properties-panel',
  imports: [
    TransformSectionComponent,
    FillSectionComponent,
    StrokeSectionComponent,
    TextSectionComponent,
  ],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent implements OnChanges, OnDestroy {
  private ngZone = inject(NgZone);

  readonly Math = Math;

  @Input() engine: CanvasEngine | null = null;

  readonly selectedNodes = signal<BaseNode[]>([]);
  readonly selectedNode = computed(() => this.selectedNodes()[0] ?? null);

  readonly selectedCount = computed(() => this.selectedNodes().length);
  readonly hasText = computed(() => this.selectedNodes().some(n => n.type === 'text'));

  private unsubscribeSelection: (() => void) | null = null;
  private rafPending = false;

  ngOnChanges(): void {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;

    if (!this.engine) {
      this.selectedNodes.set([]);
      return;
    }

    const sync = () => {
      if (this.rafPending) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        const nodes = this.engine?.selection.selectedNodes ?? [];
        this.ngZone.run(() => {
          this.selectedNodes.set(nodes);
        });
      });
    };

    sync();
    this.unsubscribeSelection = this.engine.selection.onChange(sync);
  }

  ngOnDestroy(): void {
    this.unsubscribeSelection?.();
  }

  setName(raw: string): void {
    const node = this.selectedNode();
    if (!node || !this.engine) return;
    const name = raw.trim();
    if (!name) return;
    node.name = name;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  toggleVisible(): void {
    const node = this.selectedNode();
    if (!node || !this.engine) return;
    node.visible = !node.visible;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  toggleLocked(): void {
    const node = this.selectedNode();
    if (!node || !this.engine) return;
    node.locked = !node.locked;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  setOpacityPercent(raw: string): void {
    const node = this.selectedNode();
    if (!node || !this.engine) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(100, value));
    node.opacity = clamped / 100;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  nudgeOpacity(delta: number, event?: MouseEvent): void {
    const node = this.selectedNode();
    if (!node || !this.engine) return;
    const step = event?.shiftKey ? 10 : 1;
    const current = Math.round(node.opacity * 100);
    const next = Math.max(0, Math.min(100, current + delta * step));
    node.opacity = next / 100;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }
}
