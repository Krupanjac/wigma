import { ChangeDetectionStrategy, Component, computed, inject, Input, NgZone, OnChanges, OnDestroy, signal } from '@angular/core';
import { TransformSectionComponent } from './transform-section/transform-section.component';
import { FillSectionComponent } from './fill-section/fill-section.component';
import { StrokeSectionComponent } from './stroke-section/stroke-section.component';
import { TextSectionComponent } from './text-section/text-section.component';
import { CanvasEngine } from '../../engine/canvas-engine';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { MenuCommandsService } from '../menu-bar/menu-commands.service';
import { ProjectService } from '../../core/services/project.service';
import { ExportService } from '../../core/services/export.service';

@Component({
  selector: 'app-properties-panel',
  imports: [
    TransformSectionComponent,
    FillSectionComponent,
    StrokeSectionComponent,
    TextSectionComponent,
  ],
  templateUrl: './properties-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent implements OnChanges, OnDestroy {
  private ngZone = inject(NgZone);
  private menuCommands = inject(MenuCommandsService);
  private exportService = inject(ExportService);

  readonly project = inject(ProjectService);

  readonly Math = Math;

  @Input() engine: CanvasEngine | null = null;

  readonly selectedNodes = signal<BaseNode[]>([]);
  readonly selectedNode = computed(() => this.selectedNodes()[0] ?? null);
  readonly refreshTick = signal(0);

  readonly selectedCount = computed(() => this.selectedNodes().length);
  readonly hasText = computed(() => this.selectedNodes().some(n => n.type === 'text'));

  private unsubscribeSelection: (() => void) | null = null;
  private syncPending = false;

  ngOnChanges(): void {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;

    if (!this.engine) {
      this.selectedNodes.set([]);
      return;
    }

    const sync = () => {
      if (this.syncPending) return;
      this.syncPending = true;
      queueMicrotask(() => {
        this.syncPending = false;
        const nodes = this.engine?.selection.selectedNodes ?? [];
        this.ngZone.run(() => {
          this.selectedNodes.set(nodes);
          this.refreshTick.update(v => v + 1);
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

  createNewProject(): void {
    this.menuCommands.newProject();
  }

  setProjectName(raw: string): void {
    this.project.rename(raw);
  }

  setProjectDescription(raw: string): void {
    this.project.setDescription(raw);
  }

  saveProject(): void {
    this.menuCommands.saveProjectToBrowser();
  }

  exportProjectJson(): void {
    const json = this.menuCommands.exportProjectJSON();
    const filename = this.project.document().name || 'wigma-project';
    void this.exportService.downloadProjectJSON(json, filename);
  }

  exportPng(): void {
    this.menuCommands.exportPNG();
  }

  onImportProjectChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isGzip = file.name.endsWith('.gz');

    if (isGzip) {
      file.arrayBuffer().then(buffer => {
        const source = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(buffer));
            controller.close();
          },
        });
        const decompressed = source.pipeThrough(
          new DecompressionStream('gzip') as any
        );
        return new Response(decompressed).text();
      }).then(text => {
        if (!text) return;
        this.menuCommands.importProjectJSON(text);
        input.value = '';
      }).catch(err => {
        console.error('Failed to decompress .json.gz:', err);
        alert('Import failed: could not decompress the file.');
        input.value = '';
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        if (!text) return;
        this.menuCommands.importProjectJSON(text);
        input.value = '';
      };
      reader.readAsText(file);
    }
  }
}
