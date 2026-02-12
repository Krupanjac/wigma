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
import { PathNode, AnchorType, PathAnchor } from '../../engine/scene-graph/path-node';
import { Vec2 } from '../../shared/math/vec2';

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
  private engine: CanvasEngine | null = null;
  private unsubscribeScene: (() => void) | null = null;
  private persistQueued = false;
  private suspendPersistence = false;

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

  readonly document = computed(() => this._document());
  readonly isDirty = computed(() => this._isDirty());

  init(engine: CanvasEngine): void {
    this.engine = engine;

    this.unsubscribeScene?.();
    this.unsubscribeScene = this.engine.sceneGraph.on(() => {
      this.schedulePersist();
    });

    if (!this.restoreFromBrowser()) {
      this.newProject('Untitled', false);
    }
  }

  rename(name: string): void {
    const nextName = name.trim();
    if (!nextName) return;
    const doc = this._document();
    this._document.set({ ...doc, name: nextName, updatedAt: new Date().toISOString() });
    this.writeBrowserSnapshot();
    this._isDirty.set(true);
  }

  setDescription(description: string): void {
    const doc = this._document();
    this._document.set({ ...doc, description, updatedAt: new Date().toISOString() });
    this.writeBrowserSnapshot();
    this._isDirty.set(true);
  }

  markSaved(): void {
    this._isDirty.set(false);
  }

  /** Export current document as JSON. */
  toJSON(): string {
    this.refreshDocumentFromEngine();
    return JSON.stringify(this._document(), null, 2);
  }

  /** Load a project from JSON. */
  fromJSON(json: string): void {
    const doc = JSON.parse(json) as DocumentModel;
    this.loadDocument(doc, false);
  }

  newProject(name: string = 'Untitled', markDirty: boolean = true): void {
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

    this.loadDocument(doc, markDirty);
  }

  saveToBrowser(): void {
    this.refreshDocumentFromEngine();
    this.writeBrowserSnapshot();
    this._isDirty.set(false);
  }

  restoreFromBrowser(): boolean {
    const raw = this.readBrowserSnapshot();
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw) as Partial<DocumentModel>;
      const doc: DocumentModel = {
        id: parsed.id ?? uid(),
        name: parsed.name ?? 'Untitled',
        description: parsed.description ?? '',
        version: parsed.version ?? '1.0.0',
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        canvas: parsed.canvas ?? { width: 1920, height: 1080, backgroundColor: 0x09090b },
        nodes: parsed.nodes ?? [],
      };
      this.loadDocument(doc, false);
      return true;
    } catch {
      return false;
    }
  }

  private schedulePersist(): void {
    if (this.suspendPersistence) return;
    if (this.persistQueued) return;
    this.persistQueued = true;

    queueMicrotask(() => {
      this.persistQueued = false;
      this.refreshDocumentFromEngine();
      this.writeBrowserSnapshot();
      this._isDirty.set(true);
    });
  }

  private refreshDocumentFromEngine(): void {
    if (!this.engine) return;

    const prev = this._document();
    const pages = this.engine.sceneGraph.root.children
      .filter(n => n.type === 'group')
      .map(p => this.serializeNode(p));

    this._document.set({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: pages,
    });
  }

  private loadDocument(doc: DocumentModel, markDirty: boolean): void {
    if (!this.engine) return;

    this.suspendPersistence = true;
    this.engine.selection.clearSelection();
    this.engine.guides.clear();
    this.engine.sceneGraph.clear();

    const idMap = new Map<string, string>();
    const pages = doc.nodes.filter(n => n.type === 'group');
    const targetPages = pages.length > 0 ? pages : [this.createFallbackPageNode()];

    for (const pageModel of targetPages) {
      const page = this.deserializeNode(pageModel, idMap);
      this.engine.sceneGraph.addNode(page);
    }

    const firstPageId = this.engine.sceneGraph.root.children[0]?.id;
    if (firstPageId) {
      this.engine.setActivePage(firstPageId);
    }

    this._document.set({
      ...doc,
      description: doc.description ?? '',
      updatedAt: new Date().toISOString(),
    });
    this.history.clear();
    this._isDirty.set(markDirty);
    this.writeBrowserSnapshot();
    this.suspendPersistence = false;
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

  private writeBrowserSnapshot(): void {
    try {
      localStorage.setItem(ProjectService.STORAGE_KEY, JSON.stringify(this._document()));
    } catch {
      // no-op (storage may be blocked/full)
    }
  }

  private readBrowserSnapshot(): string | null {
    try {
      return localStorage.getItem(ProjectService.STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
