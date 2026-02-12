import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { TextNode } from '../../../engine/scene-graph/text-node';

@Component({
  selector: 'app-text-section',
  imports: [],
  templateUrl: './text-section.component.html',
  styleUrl: './text-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextSectionComponent implements AfterViewInit, OnChanges {
  @ViewChild('textContentInput') textContentInput?: ElementRef<HTMLTextAreaElement>;

  @Input() engine: CanvasEngine | null = null;
  @Input() node: BaseNode | null = null;

  private lastFocusedNodeId: string | null = null;

  ngAfterViewInit(): void {
    this.tryFocusTextInput();
  }

  ngOnChanges(): void {
    this.tryFocusTextInput();
  }

  get textNode(): TextNode | null {
    return this.node?.type === 'text' ? this.node as TextNode : null;
  }

  onTextInput(raw: string): void {
    const node = this.textNode;
    if (!node || !this.engine) return;
    if (node.text === raw) return;
    node.text = raw;
    node.markRenderDirty();
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  setFontSize(raw: string): void {
    const node = this.textNode;
    if (!node || !this.engine) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const size = Math.max(1, value);
    if (node.fontSize === size) return;
    node.fontSize = size;
    node.markRenderDirty();
    node.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  setLineHeight(raw: string): void {
    const node = this.textNode;
    if (!node || !this.engine) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const lineHeight = Math.max(0.1, value);
    if (node.lineHeight === lineHeight) return;
    node.lineHeight = lineHeight;
    node.markRenderDirty();
    node.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  setFontFamily(raw: string): void {
    const node = this.textNode;
    if (!node || !this.engine) return;
    const family = raw.trim();
    if (!family || node.fontFamily === family) return;
    node.fontFamily = family;
    node.markRenderDirty();
    node.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  private tryFocusTextInput(): void {
    const node = this.textNode;
    if (!node) {
      this.lastFocusedNodeId = null;
      return;
    }

    if (this.lastFocusedNodeId === node.id) {
      return;
    }

    queueMicrotask(() => {
      const input = this.textContentInput?.nativeElement;
      if (!input) return;

      const active = document.activeElement;
      if (this.isEditableElement(active) && active !== input) {
        return;
      }

      input.focus();
      input.select();
      this.lastFocusedNodeId = node.id;
    });
  }

  private isEditableElement(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }
}
