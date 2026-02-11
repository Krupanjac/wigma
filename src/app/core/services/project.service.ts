import { Injectable, signal, computed, inject } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { HistoryService } from './history.service';
import { DocumentModel, PageModel } from '../models/document.model';
import { uid } from '../../shared/utils/uid';
import { SceneNodeModel } from '../models/scene-node.model';

/**
 * ProjectService — manages project/document state.
 *
 * Provides signals for the current document and active selection.
 * Bridges Angular UI to the engine scene graph.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private history = inject(HistoryService);
  private engine: CanvasEngine | null = null;

  private _document = signal<DocumentModel>({
    id: uid(),
    name: 'Untitled',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: 0x09090b,
    },
    nodes: [],
  });

  private _isDirty = signal(false);

  readonly document = computed(() => this._document());
  readonly isDirty = computed(() => this._isDirty());

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  rename(name: string): void {
    const doc = this._document();
    this._document.set({ ...doc, name, updatedAt: new Date().toISOString() });
    this._isDirty.set(true);
  }

  markSaved(): void {
    this._isDirty.set(false);
  }

  /** Export current document as JSON. */
  toJSON(): string {
    return JSON.stringify(this._document());
  }

  /** Load a project from JSON. */
  fromJSON(json: string): void {
    const doc = JSON.parse(json) as DocumentModel;
    this._document.set(doc);
    this.history.clear();
    this._isDirty.set(false);
  }
}
