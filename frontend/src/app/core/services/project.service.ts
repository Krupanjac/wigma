import { Injectable, signal, computed, inject } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { HistoryService } from './history.service';
import { DocumentModel } from '../models/document.model';
import { uid } from '../../shared/utils/uid';
import { SceneNodeModel } from '../models/scene-node.model';
import { BaseNode, NodeType } from '../../engine/scene-graph/base-node';
import { GroupNode } from '../../engine/scene-graph/group-node';
import { RectangleNode } from '../../engine/scene-graph/rectangle-node';
import { EllipseNode } from '../../engine/scene-graph/ellipse-node';
import { PolygonNode } from '../../engine/scene-graph/polygon-node';
import { StarNode } from '../../engine/scene-graph/star-node';
import { LineNode } from '../../engine/scene-graph/line-node';
import { ArrowNode } from '../../engine/scene-graph/arrow-node';
import { TextNode } from '../../engine/scene-graph/text-node';
import { ImageNode } from '../../engine/scene-graph/image-node';
import { VideoNode } from '../../engine/scene-graph/video-node';
import { PathNode, AnchorType, PathAnchor } from '../../engine/scene-graph/path-node';
import { Vec2 } from '../../shared/math/vec2';
import { SceneEvent } from '../../engine/scene-graph/scene-graph-manager';
import { IdbStorage } from '../../shared/utils/idb-storage';
import { ExportRenderer } from '../../engine/rendering/export-renderer';
import type { DbProject, DocumentData } from '@wigma/shared';
import { ProjectApiService } from './project-api.service';

/* ── Diagnostic logging helper ─────────────────────────────── */
const LOG_PREFIX = '[Wigma Persist]';
function plog(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}
function countNodesDeep(nodes: SceneNodeModel[]): number {
  let c = 0;
  for (const n of nodes) {
    c += 1 + countNodesDeep(n.children ?? []);
  }
  return c;
}

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
  private static readonly STORAGE_KEY = 'wigma.project.v1';

  private history = inject(HistoryService);
  private projectApi = inject(ProjectApiService);
  private engine: CanvasEngine | null = null;
  private unsubscribeScene: (() => void) | null = null;
  private persistQueued = false;
  private idb = new IdbStorage('wigma-db', 'snapshots');
  private suspendPersistence = false;
  private sessionActivated = false;

  private _document = signal<DocumentModel>({
    id: uid(),
    name: 'Untitled',
    description: '',
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

  /** Remote project metadata (null = offline/local mode). */
  private _remoteProject = signal<DbProject | null>(null);

  /** Whether this project is backed by a remote Supabase project. */
  readonly isRemote = computed(() => this._remoteProject() !== null);

  /** Current remote project (for displaying metadata in UI). */
  readonly remoteProject = computed(() => this._remoteProject());

  readonly document = computed(() => this._document());
  readonly isDirty = computed(() => this._isDirty());

  async init(engine: CanvasEngine): Promise<void> {
    this.engine = engine;
    plog('init — engine attached');

    this.unsubscribeScene?.();
    this.unsubscribeScene = this.engine.sceneGraph.on(event => {
      this.onSceneEvent(event);
    });

    // Expose a global debug helper on window
    (globalThis as Record<string, unknown>)['__wigmaDebug'] = () => this.debugDump();

    // If a remote project is already set (via EditorShellComponent.setRemoteProject),
    // skip browser restore — loadFromRemote() will load the correct data.
    // Only restore from browser for local/offline projects.
    if (this._remoteProject()) {
      plog('init — remote project set, skipping browser restore (loadFromRemote will handle it)');
      // Start with a blank canvas; loadFromRemote overwrites it shortly.
      this.newProject(this._remoteProject()!.name ?? 'Untitled', false, false);
    } else {
      const restored = await this.restoreFromBrowser();
      plog('init — restored from browser:', restored);
      if (!restored) {
        this.newProject('Untitled', false, false);
      }
    }
  }

  // ── Remote Project Context ─────────────────────────────────────────────

  /**
   * Set the remote project context (called by EditorShellComponent).
   * Updates document metadata to match the remote project.
   */
  setRemoteProject(project: DbProject): void {
    this._remoteProject.set(project);

    // Sync document metadata with remote
    const doc = this._document();
    this._document.set({
      ...doc,
      id: project.id,
      name: project.name,
      description: project.description,
      canvas: project.canvas_config,
    });

    plog('setRemoteProject — id:', project.id, 'name:', project.name);
  }

  /** Clear the remote project context (called on navigation away). */
  clearRemoteProject(): void {
    this._remoteProject.set(null);
    plog('clearRemoteProject');
  }

  /** Dump current state to console for debugging. */
  debugDump(): void {
    const doc = this._document();
    const rootChildren = this.engine?.sceneGraph.root.children ?? [];
    const activePageId = this.engine?.activePageId;
    console.group(`${LOG_PREFIX} Debug Dump`);
    console.log('sessionActivated:', this.sessionActivated);
    console.log('suspendPersistence:', this.suspendPersistence);
    console.log('engine present:', !!this.engine);
    console.log('document.nodes.length:', doc.nodes.length);
    console.log('document total node count:', countNodesDeep(doc.nodes));
    console.log('engine root.children.length:', rootChildren.length);
    console.log('engine activePageId:', activePageId);
    for (const page of rootChildren) {
      console.log(`  page "${page.name}" id=${page.id} children=${page.children.length}`);
      for (const child of page.children) {
        console.log(`    └─ ${child.type} "${child.name}" id=${child.id} pos=(${child.x},${child.y}) size=${child.width}×${child.height}`);
      }
    }
    const raw = localStorage.getItem(ProjectService.STORAGE_KEY);
    if (raw) {
      console.log('localStorage (legacy): present,', raw.length, 'bytes');
    } else {
      console.log('localStorage (legacy): EMPTY');
    }
    console.log('Storage: IndexedDB (wigma-db/snapshots)');
    console.groupEnd();
  }

  rename(name: string): void {
    const nextName = name.trim();
    if (!nextName) return;
    const doc = this._document();
    this._document.set({ ...doc, name: nextName, updatedAt: new Date().toISOString() });
    void this.writeBrowserSnapshot();
    this._isDirty.set(true);
  }

  setDescription(description: string): void {
    const doc = this._document();
    this._document.set({ ...doc, description, updatedAt: new Date().toISOString() });
    void this.writeBrowserSnapshot();
    this._isDirty.set(true);
  }

  markSaved(): void {
    this._isDirty.set(false);
  }

  /** Export current document as JSON. */
  toJSON(): string {
    this.refreshDocumentFromEngine();
    const doc = this._document();
    plog('toJSON — pages:', doc.nodes.length, 'total nodes:', countNodesDeep(doc.nodes));
    return JSON.stringify(doc, null, 2);
  }

  /** Load a project from JSON. */
  fromJSON(json: string): void {
    plog('fromJSON — input length:', json.length);
    let doc: DocumentModel;
    try {
      doc = JSON.parse(json) as DocumentModel;
    } catch (e) {
      console.error(LOG_PREFIX, 'fromJSON — JSON parse error:', e);
      alert('Import failed: the file does not contain valid JSON.');
      return;
    }
    if (!doc || typeof doc !== 'object') {
      console.error(LOG_PREFIX, 'fromJSON — parsed value is not an object');
      alert('Import failed: unexpected file format.');
      return;
    }
    // Ensure nodes array exists
    if (!Array.isArray(doc.nodes)) {
      plog('fromJSON — doc.nodes is not an array, defaulting to empty');
      doc.nodes = [];
    }
    plog('fromJSON — parsed doc pages:', doc.nodes.length, 'total nodes:', countNodesDeep(doc.nodes));
    this.loadDocument(doc, false, true);
  }

  newProject(name: string = 'Untitled', markDirty: boolean = true, persist: boolean = true): void {
    const doc: DocumentModel = {
      id: uid(),
      name,
      description: '',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: 0x09090b,
      },
      nodes: [
        {
          id: uid(),
          type: 'group',
          name: 'Page 1',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          fill: { color: { r: 255, g: 255, b: 255, a: 1 }, visible: false },
          stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, width: 1, visible: false },
          opacity: 1,
          visible: true,
          locked: false,
          parentId: null,
          children: [],
          data: {},
        },
      ],
    };

    this.loadDocument(doc, markDirty, persist);
  }

  async saveToBrowser(): Promise<void> {
    this.refreshDocumentFromEngine();
    this.sessionActivated = true;
    const doc = this._document();
    plog('saveToBrowser — pages:', doc.nodes.length, 'total nodes:', countNodesDeep(doc.nodes));
    await this.writeBrowserSnapshot();
    this._isDirty.set(false);
  }

  /**
   * Save the current scene graph to Supabase (remote project).
   * Falls back to saveToBrowser() if not in remote mode.
   */
  async save(): Promise<{ error: string | null }> {
    this.refreshDocumentFromEngine();
    const doc = this._document();
    const remote = this._remoteProject();

    // Always persist locally too
    this.sessionActivated = true;
    await this.writeBrowserSnapshot();

    if (!remote) {
      plog('save — local mode, saved to browser only');
      this._isDirty.set(false);
      return { error: null };
    }

    const docData: DocumentData = {
      nodes: doc.nodes,
      canvas: doc.canvas,
    };

    plog('save — remote project', remote.id, 'pages:', doc.nodes.length, 'total nodes:', countNodesDeep(doc.nodes));

    // Generate thumbnail in parallel with saving data
    const thumbnailPromise = this.generateThumbnail();

    const { error } = await this.projectApi.saveProjectData(remote.id, docData);

    if (error) {
      console.error(LOG_PREFIX, 'save — remote error:', error);
      return { error };
    }

    // Save thumbnail (non-blocking — don't fail the save if thumbnail fails)
    thumbnailPromise.then(async (thumbnail) => {
      if (thumbnail) {
        const { error: thumbError } = await this.projectApi.updateProject(remote.id, {
          thumbnail_path: thumbnail,
        });
        if (thumbError) {
          console.warn(LOG_PREFIX, 'save — thumbnail update failed:', thumbError);
        } else {
          plog('save — thumbnail saved');
        }
      }
    });

    this._isDirty.set(false);
    plog('save — remote success');
    return { error: null };
  }

  /**
   * Generate a small thumbnail of the active page as a data URL.
   * Returns null if there's no content to render.
   */
  private async generateThumbnail(): Promise<string | null> {
    if (!this.engine) return null;

    const page = this.engine.activePage;
    if (!page || page.children.length === 0) return null;

    try {
      const exportRenderer = new ExportRenderer(
        this.engine.sceneGraph,
        this.engine.renderManager,
      );

      const thumbnail = await exportRenderer.renderPage(page, {
        scale: 0.5,           // Low res for thumbnail
        format: 'webp',
        quality: 0.6,
        padding: 20,
        background: 0x1a1a1a,
        includeBackground: true,
      });

      plog('generateThumbnail — size:', thumbnail.length);
      return thumbnail;
    } catch (e) {
      console.warn(LOG_PREFIX, 'generateThumbnail — failed:', e);
      return null;
    }
  }

  /**
   * Load scene graph from Supabase for the given remote project.
   * Returns true if data was loaded, false if the project is empty.
   */
  async loadFromRemote(projectId: string): Promise<boolean> {
    plog('loadFromRemote — fetching project_data for', projectId);

    const { data, error } = await this.projectApi.loadProjectData(projectId);

    if (error) {
      console.error(LOG_PREFIX, 'loadFromRemote — error:', error);
      return false;
    }

    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      plog('loadFromRemote — no saved scene data, starting fresh');
      return false;
    }

    plog('loadFromRemote — loaded', data.nodes.length, 'pages, total nodes:', countNodesDeep(data.nodes));

    const remote = this._remoteProject();
    const doc: DocumentModel = {
      id: remote?.id ?? uid(),
      name: remote?.name ?? 'Untitled',
      description: remote?.description ?? '',
      version: remote?.version ?? '1.0.0',
      createdAt: remote?.created_at ?? new Date().toISOString(),
      updatedAt: remote?.updated_at ?? new Date().toISOString(),
      canvas: data.canvas ?? { width: 1920, height: 1080, backgroundColor: 0x09090b },
      nodes: data.nodes,
    };

    this.loadDocument(doc, false, true);
    return true;
  }

  async restoreFromBrowser(): Promise<boolean> {
    const raw = await this.readBrowserSnapshot();
    if (!raw) {
      plog('restoreFromBrowser — no data');
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DocumentModel>;
      if (!parsed || typeof parsed !== 'object') {
        plog('restoreFromBrowser — parsed data is not an object');
        return false;
      }
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const doc: DocumentModel = {
        id: parsed.id ?? uid(),
        name: parsed.name ?? 'Untitled',
        description: parsed.description ?? '',
        version: parsed.version ?? '1.0.0',
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        canvas: parsed.canvas ?? { width: 1920, height: 1080, backgroundColor: 0x09090b },
        nodes,
      };
      plog('restoreFromBrowser — parsed. pages:', nodes.length, 'total nodes:', countNodesDeep(nodes));
      this.loadDocument(doc, false, true);
      return true;
    } catch (e) {
      console.error(LOG_PREFIX, 'restoreFromBrowser — error:', e);
      return false;
    }
  }

  private schedulePersist(): void {
    if (this.suspendPersistence) return;
    if (!this.sessionActivated) return;
    if (this.persistQueued) return;
    this.persistQueued = true;

    queueMicrotask(() => {
      this.persistQueued = false;
      if (this.suspendPersistence) return; // re-check after microtask
      this.refreshDocumentFromEngine();
      void this.writeBrowserSnapshot();
      this._isDirty.set(true);
    });
  }

  private persistImmediately(markDirty: boolean): void {
    if (this.suspendPersistence) return;
    if (!this.sessionActivated) return;
    this.refreshDocumentFromEngine();
    void this.writeBrowserSnapshot();
    if (markDirty) this._isDirty.set(true);
  }

  private refreshDocumentFromEngine(): void {
    if (!this.engine) {
      plog('refreshDocumentFromEngine — no engine, skipping');
      return;
    }

    const prev = this._document();
    const pages: SceneNodeModel[] = [];
    const rootChildren = this.engine.sceneGraph.root.children;
    plog('refreshDocumentFromEngine — root.children count:', rootChildren.length);

    for (const page of rootChildren) {
      if (page.type !== 'group') {
        plog('  skipping non-group root child:', page.type, page.name);
        continue;
      }
      try {
        const serialized = this.serializeNode(page);
        plog('  serialized page', page.name, '— children:', serialized.children.length);
        pages.push(serialized);
      } catch (e) {
        console.error(LOG_PREFIX, '  serializeNode error for page', page.name, e);
      }
    }

    this._document.set({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: pages,
    });
    plog('refreshDocumentFromEngine — total pages:', pages.length, 'total nodes:', countNodesDeep(pages));
  }

  private loadDocument(doc: DocumentModel, markDirty: boolean, persist: boolean): void {
    if (!this.engine) {
      plog('loadDocument — no engine, aborting');
      return;
    }

    // Ensure nodes is always an array
    const docNodes = Array.isArray(doc.nodes) ? doc.nodes : [];
    plog('loadDocument — input pages:', docNodes.length, 'total nodes:', countNodesDeep(docNodes), 'persist:', persist);

    this.suspendPersistence = true;
    try {
      this.engine.runWithoutAutoPageSelection(() => {
        this.engine!.selection.clearSelection();
        this.engine!.guides.clear();
        this.engine!.sceneGraph.clear();

        const idMap = new Map<string, string>();
        const pages = docNodes.filter(n => n.type === 'group');
        const targetPages = pages.length > 0 ? pages : [this.createFallbackPageNode()];

        plog('loadDocument — deserializing', targetPages.length, 'pages');
        for (const pageModel of targetPages) {
          try {
            const page = this.deserializeNode(pageModel, idMap);
            plog('  deserialized page', page.name, 'children:', page.children.length);
            this.engine!.sceneGraph.addNode(page);
          } catch (e) {
            console.error(LOG_PREFIX, '  deserializeNode error for page', pageModel.name, e);
          }
        }

        const firstPageId = this.engine!.sceneGraph.root.children[0]?.id;
        plog('loadDocument — setting active page:', firstPageId);
        if (firstPageId) {
          this.engine!.setActivePage(firstPageId);
        }
      });

      // Verify engine state
      const root = this.engine.sceneGraph.root;
      plog('loadDocument — after load: root.children:', root.children.length,
           'activePageId:', this.engine.activePageId);
      for (const page of root.children) {
        plog('  engine page', page.name, 'id:', page.id, 'children:', page.children.length);
      }

      // Sync document signal from engine's actual state (correct IDs)
      this.refreshDocumentFromEngine();

      // Update metadata from the loaded document
      const refreshed = this._document();
      this._document.set({
        ...refreshed,
        id: doc.id ?? refreshed.id,
        name: doc.name ?? refreshed.name,
        description: doc.description ?? '',
        version: doc.version ?? refreshed.version,
        createdAt: doc.createdAt ?? refreshed.createdAt,
      });

      this.history.clear();
      this._isDirty.set(markDirty);
      this.sessionActivated = persist;
      if (persist) {
        void this.writeBrowserSnapshot();
      }
    } catch (e) {
      console.error(LOG_PREFIX, 'loadDocument — CRITICAL ERROR:', e);
    } finally {
      this.suspendPersistence = false;
    }
  }

  private onSceneEvent(event: SceneEvent): void {
    try {
      if (this.suspendPersistence) return;

      if (!this.sessionActivated && event.type === 'node-added') {
        const isPage = event.node.parent === this.engine?.sceneGraph.root;
        if (!isPage) {
          plog('session activated by first non-page node-added:', event.node.type, event.node.name);
          this.sessionActivated = true;
          this.persistImmediately(true);
        }
        return;
      }

      if (event.type === 'node-added') {
        this.schedulePersist();
        return;
      }

      if (
        event.type === 'node-removed' ||
        event.type === 'node-changed' ||
        event.type === 'hierarchy-changed' ||
        event.type === 'node-reordered'
      ) {
        this.schedulePersist();
      }
    } catch (e) {
      console.error(LOG_PREFIX, 'onSceneEvent error:', e);
    }
  }

  private createFallbackPageNode(): SceneNodeModel {
    return {
      id: uid(),
      type: 'group',
      name: 'Page 1',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fill: { color: { r: 255, g: 255, b: 255, a: 1 }, visible: false },
      stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, width: 1, visible: false },
      opacity: 1,
      visible: true,
      locked: false,
      parentId: null,
      children: [],
      data: {},
    };
  }

  private serializeNode(node: BaseNode): SceneNodeModel {
    const raw = node.toJSON() as Record<string, unknown>;
    const children = node.children.map(child => this.serializeNode(child));

    const base: SceneNodeModel = {
      id: String(raw['id'] ?? node.id),
      type: node.type,
      name: String(raw['name'] ?? node.name),
      x: Number(raw['x'] ?? node.x),
      y: Number(raw['y'] ?? node.y),
      width: Number(raw['width'] ?? node.width),
      height: Number(raw['height'] ?? node.height),
      rotation: Number(raw['rotation'] ?? node.rotation),
      scaleX: Number(raw['scaleX'] ?? node.scaleX),
      scaleY: Number(raw['scaleY'] ?? node.scaleY),
      fill: (raw['fill'] as SceneNodeModel['fill']) ?? node.fill,
      stroke: (raw['stroke'] as SceneNodeModel['stroke']) ?? node.stroke,
      opacity: Number(raw['opacity'] ?? node.opacity),
      visible: Boolean(raw['visible'] ?? node.visible),
      locked: Boolean(raw['locked'] ?? node.locked),
      parentId: node.parent ? node.parent.id : null,
      children,
      data: {},
    };

    const reserved = new Set([
      'id', 'type', 'name', 'x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY',
      'fill', 'stroke', 'opacity', 'visible', 'locked', 'children',
    ]);

    for (const [key, value] of Object.entries(raw)) {
      if (reserved.has(key)) continue;
      base.data[key] = value;
    }

    return base;
  }

  private deserializeNode(model: SceneNodeModel, idMap: Map<string, string>): BaseNode {
    const node = this.createNodeByType(model.type, model.name);
    idMap.set(model.id, node.id);

    node.x = model.x;
    node.y = model.y;
    node.width = model.width;
    node.height = model.height;
    node.rotation = model.rotation;
    node.scaleX = model.scaleX;
    node.scaleY = model.scaleY;
    node.fill = { ...model.fill };
    node.stroke = { ...model.stroke };
    node.opacity = model.opacity;
    node.visible = model.visible;
    node.locked = model.locked;

    this.applyTypeData(node, model.data);

    for (const child of model.children ?? []) {
      node.addChild(this.deserializeNode(child, idMap));
    }

    return node;
  }

  private createNodeByType(type: NodeType, name: string): BaseNode {
    switch (type) {
      case 'rectangle': return new RectangleNode(name);
      case 'ellipse': return new EllipseNode(name);
      case 'polygon': return new PolygonNode(name);
      case 'star': return new StarNode(name);
      case 'line': return new LineNode(name);
      case 'arrow': return new ArrowNode(name);
      case 'text': return new TextNode(name);
      case 'image': return new ImageNode(name);
      case 'video': return new VideoNode(name);
      case 'path': return new PathNode(name);
      case 'group':
      default:
        return new GroupNode(name);
    }
  }

  private applyTypeData(node: BaseNode, data: Record<string, unknown> | undefined): void {
    if (!data) return;

    if (node instanceof RectangleNode && typeof data['cornerRadius'] === 'number') {
      node.cornerRadius = data['cornerRadius'];
    }

    if (node instanceof PolygonNode && typeof data['sides'] === 'number') {
      node.sides = data['sides'];
    }

    if (node instanceof StarNode) {
      if (typeof data['points'] === 'number') {
        node.points = data['points'];
      }
      if (typeof data['innerRadiusRatio'] === 'number') {
        node.innerRadiusRatio = data['innerRadiusRatio'];
      }
    }

    if (node instanceof LineNode) {
      const sp = data['startPoint'];
      const ep = data['endPoint'];
      if (Array.isArray(sp) && sp.length === 2) {
        node.startPoint = new Vec2(Number(sp[0]), Number(sp[1]));
      }
      if (Array.isArray(ep) && ep.length === 2) {
        node.endPoint = new Vec2(Number(ep[0]), Number(ep[1]));
      }
    }

    if (node instanceof ArrowNode) {
      const sp = data['startPoint'];
      const ep = data['endPoint'];
      if (Array.isArray(sp) && sp.length === 2) {
        node.startPoint = new Vec2(Number(sp[0]), Number(sp[1]));
      }
      if (Array.isArray(ep) && ep.length === 2) {
        node.endPoint = new Vec2(Number(ep[0]), Number(ep[1]));
      }
      if (typeof data['startArrow'] === 'string') {
        node.startArrow = data['startArrow'] as ArrowNode['startArrow'];
      }
      if (typeof data['endArrow'] === 'string') {
        node.endArrow = data['endArrow'] as ArrowNode['endArrow'];
      }
      if (typeof data['arrowSize'] === 'number') {
        node.arrowSize = data['arrowSize'];
      }
    }

    if (node instanceof TextNode) {
      if (typeof data['text'] === 'string') node.text = data['text'];
      if (typeof data['fontSize'] === 'number') node.fontSize = data['fontSize'];
      if (typeof data['fontFamily'] === 'string') node.fontFamily = data['fontFamily'];
      if (typeof data['fontWeight'] === 'string') node.fontWeight = data['fontWeight'] as TextNode['fontWeight'];
      if (typeof data['fontStyle'] === 'string') node.fontStyle = data['fontStyle'] as TextNode['fontStyle'];
      if (typeof data['textAlign'] === 'string') node.textAlign = data['textAlign'] as TextNode['textAlign'];
      if (typeof data['verticalAlign'] === 'string') node.verticalAlign = data['verticalAlign'] as TextNode['verticalAlign'];
      if (typeof data['lineHeight'] === 'number') node.lineHeight = data['lineHeight'];
      if (typeof data['letterSpacing'] === 'number') node.letterSpacing = data['letterSpacing'];
    }

    if (node instanceof ImageNode) {
      if (typeof data['src'] === 'string') node.src = data['src'];
      if (typeof data['naturalWidth'] === 'number') node.naturalWidth = data['naturalWidth'];
      if (typeof data['naturalHeight'] === 'number') node.naturalHeight = data['naturalHeight'];
      if (data['fit'] === 'fill' || data['fit'] === 'contain' || data['fit'] === 'cover') {
        node.fit = data['fit'];
      }
    }

    if (node instanceof VideoNode) {
      if (typeof data['src'] === 'string') node.src = data['src'];
      if (typeof data['posterSrc'] === 'string') node.posterSrc = data['posterSrc'];
      if (typeof data['naturalWidth'] === 'number') node.naturalWidth = data['naturalWidth'];
      if (typeof data['naturalHeight'] === 'number') node.naturalHeight = data['naturalHeight'];
      if (typeof data['duration'] === 'number') node.duration = data['duration'];
    }

    if (node instanceof GroupNode && typeof data['expanded'] === 'boolean') {
      node.expanded = data['expanded'];
    }

    if (node instanceof PathNode) {
      if (typeof data['closed'] === 'boolean') {
        node.closed = data['closed'];
      }
      const anchorsRaw = data['anchors'];
      if (Array.isArray(anchorsRaw)) {
        const anchors: PathAnchor[] = [];
        for (const item of anchorsRaw) {
          if (!item || typeof item !== 'object') continue;
          const position = (item as Record<string, unknown>)['position'];
          const handleIn = (item as Record<string, unknown>)['handleIn'];
          const handleOut = (item as Record<string, unknown>)['handleOut'];
          const type = (item as Record<string, unknown>)['type'];
          if (!Array.isArray(position) || !Array.isArray(handleIn) || !Array.isArray(handleOut)) continue;
          if (position.length !== 2 || handleIn.length !== 2 || handleOut.length !== 2) continue;
          anchors.push({
            position: new Vec2(Number(position[0]), Number(position[1])),
            handleIn: new Vec2(Number(handleIn[0]), Number(handleIn[1])),
            handleOut: new Vec2(Number(handleOut[0]), Number(handleOut[1])),
            type: (typeof type === 'string' ? type : 'sharp') as AnchorType,
          });
        }
        node.anchors = anchors;
      }
    }
  }

  /** Get the project-scoped IndexedDB key. */
  private get snapshotKey(): string {
    const projectId = this._remoteProject()?.id;
    return projectId
      ? `${ProjectService.STORAGE_KEY}:${projectId}`
      : ProjectService.STORAGE_KEY;
  }

  private async writeBrowserSnapshot(): Promise<void> {
    try {
      const doc = this._document();
      const json = JSON.stringify(doc);
      const key = this.snapshotKey;
      await this.idb.setCompressed(key, json);
      plog('writeBrowserSnapshot — compressed & wrote', json.length, 'chars, key:', key,
           'pages:', doc.nodes.length, 'total nodes:', countNodesDeep(doc.nodes));
    } catch (e) {
      console.error(LOG_PREFIX, 'writeBrowserSnapshot error:', e);
    }
  }

  private async readBrowserSnapshot(): Promise<string | null> {
    try {
      const key = this.snapshotKey;

      // Try project-scoped key in IndexedDB first
      const idbRaw = await this.idb.getDecompressed(key);
      if (idbRaw) {
        plog('readBrowserSnapshot — found', idbRaw.length, 'chars in IndexedDB, key:', key);
        return idbRaw;
      }

      // Migrate from old global localStorage key if it exists and no remote project
      if (!this._remoteProject()) {
        const lsRaw = localStorage.getItem(ProjectService.STORAGE_KEY);
        if (lsRaw) {
          plog('readBrowserSnapshot — migrating', lsRaw.length, 'bytes from localStorage to IndexedDB');
          await this.idb.set(key, lsRaw);
          localStorage.removeItem(ProjectService.STORAGE_KEY);
          return lsRaw;
        }
      }

      plog('readBrowserSnapshot — empty, key:', key);
      return null;
    } catch (e) {
      console.error(LOG_PREFIX, 'readBrowserSnapshot error:', e);
      return null;
    }
  }
}
