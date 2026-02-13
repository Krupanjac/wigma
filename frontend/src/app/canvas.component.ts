import {
  ChangeDetectionStrategy,
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  inject,
} from '@angular/core';
import { CanvasEngine } from './engine/canvas-engine';
import { TextNode } from './engine/scene-graph/text-node';
import { Vec2 } from './shared/math/vec2';
import { colorToCss } from './shared/utils/color-utils';

/**
 * CanvasComponent — hosts the PixiJS rendering surface.
 *
 * Initializes the engine inside NgZone.runOutsideAngular()
 * and handles container resize via ResizeObserver.
 */
@Component({
  selector: 'app-canvas',
  imports: [],
  templateUrl: './canvas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  private ngZone = inject(NgZone);
  private resizeObserver: ResizeObserver | null = null;
  private removeTextEditStartListener: (() => void) | null = null;

  @Input() engine: CanvasEngine | null = null;
  @ViewChild('canvasContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasTextEditor') textEditorRef?: ElementRef<HTMLTextAreaElement>;

  isTextEditing = false;
  editingNodeId: string | null = null;
  editingText = '';
  editorLeft = 0;
  editorTop = 0;
  editorWidth = 200;
  editorHeight = 24;
  editorFontSize = 16;
  editorFontFamily = 'Inter';
  editorLineHeight = 1.2;
  editorColor = '#ffffff';

  ngAfterViewInit(): void {
    if (!this.engine) return;

    const container = this.containerRef.nativeElement;

    const onTextEditStart = (event: Event): void => {
      const custom = event as CustomEvent<{ nodeId?: string }>;
      const nodeId = custom.detail?.nodeId;
      if (!nodeId) return;
      this.startCanvasTextEdit(nodeId);
    };
    window.addEventListener('wigma:text-edit-start', onTextEditStart as EventListener);
    this.removeTextEditStartListener = () => {
      window.removeEventListener('wigma:text-edit-start', onTextEditStart as EventListener);
    };

    this.ngZone.runOutsideAngular(async () => {
      await this.engine!.init(container);

      // Canvas & engine fully initialized — dismiss global init loader
      window.dispatchEvent(new Event('wigma:canvas-ready'));

      // Watch for resize
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          this.engine!.resize(width, height);
        }
      });
      this.resizeObserver.observe(container);
    });
  }

  ngOnDestroy(): void {
    this.endCanvasTextEdit();
    this.removeTextEditStartListener?.();
    this.removeTextEditStartListener = null;
    this.resizeObserver?.disconnect();
  }

  onCanvasTextInput(value: string): void {
    this.editingText = value;

    const node = this.getEditingTextNode();
    if (!node || !this.engine) return;

    if (node.text !== value) {
      node.text = value;
      node.markRenderDirty();
      node.markBoundsDirty();
      this.engine.sceneGraph.notifyNodeChanged(node);
      this.syncEditorRect(node);
    }
  }

  endCanvasTextEdit(): void {
    this.isTextEditing = false;
    this.editingNodeId = null;
  }

  private startCanvasTextEdit(nodeId: string): void {
    if (!this.engine) return;
    const node = this.engine.sceneGraph.getNode(nodeId);
    if (!node || node.type !== 'text') return;

    const textNode = node as TextNode;
    this.editingNodeId = textNode.id;
    this.editingText = textNode.text;
    this.editorFontFamily = textNode.fontFamily;
    this.editorFontSize = textNode.fontSize * Math.max(1e-6, Math.abs(textNode.scaleY));
    this.editorLineHeight = textNode.lineHeight;
    this.editorColor = colorToCss(textNode.fill.color);
    this.syncEditorRect(textNode);
    this.isTextEditing = true;

    queueMicrotask(() => {
      const input = this.textEditorRef?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  private syncEditorRect(node: TextNode): void {
    if (!this.engine) return;

    const camera = this.engine.viewport.camera;
    const topLeft = camera.worldToScreen(new Vec2(node.worldBounds.minX, node.worldBounds.minY));
    const width = Math.max(24, node.worldBounds.width);
    const height = Math.max(20, node.worldBounds.height);

    this.editorLeft = topLeft.x;
    this.editorTop = topLeft.y;
    this.editorWidth = width;
    this.editorHeight = height;
  }

  private getEditingTextNode(): TextNode | null {
    if (!this.engine || !this.editingNodeId) return null;
    const node = this.engine.sceneGraph.getNode(this.editingNodeId);
    return node && node.type === 'text' ? node as TextNode : null;
  }
}
