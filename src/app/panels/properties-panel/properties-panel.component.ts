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

  @Input() engine: CanvasEngine | null = null;

  readonly selectedNodes = signal<BaseNode[]>([]);
  readonly selectedNode = computed(() => this.selectedNodes()[0] ?? null);

  readonly selectedCount = computed(() => this.selectedNodes().length);
  readonly hasText = computed(() => this.selectedNodes().some(n => n.type === 'text'));

  private unsubscribeSelection: (() => void) | null = null;

  ngOnChanges(): void {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;

    if (!this.engine) {
      this.selectedNodes.set([]);
      return;
    }

    const sync = () => {
      const nodes = this.engine?.selection.selectedNodes ?? [];
      this.ngZone.run(() => {
        this.selectedNodes.set(nodes);
      });
    };

    sync();
    this.unsubscribeSelection = this.engine.selection.onChange(sync);
  }

  ngOnDestroy(): void {
    this.unsubscribeSelection?.();
  }
}
