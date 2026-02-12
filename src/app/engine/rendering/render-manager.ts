import { Application, Container, Graphics, Text as PixiText } from 'pixi.js';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SpatialIndex } from '../spatial/spatial-index';
import { ViewportManager } from '../viewport/viewport-manager';
import { NodeRendererRegistry } from './node-renderer.registry';
import { BaseNode } from '../scene-graph/base-node';
import { SelectionManager } from '../selection/selection-manager';
import { SelectionOverlay } from './overlays/selection-overlay';
import { Vec2 } from '@shared/math/vec2';
import { GuideState } from '../interaction/guide-state';
import { GuideOverlay } from './overlays/guide-overlay';
import { DEFAULT_CANVAS_BG, HANDLE_FILL, HANDLE_SIZE, HANDLE_STROKE, HOVER_OUTLINE_ALPHA, HOVER_OUTLINE_COLOR, HOVER_OUTLINE_WIDTH, MARQUEE_FILL_ALPHA, MARQUEE_FILL_COLOR, MARQUEE_STROKE_ALPHA, MARQUEE_STROKE_COLOR, ROTATION_HANDLE_DISTANCE, SELECTION_COLOR, SELECTION_EDGE_ALPHA, SELECTION_EDGE_WIDTH, SELECTION_STROKE_WIDTH } from '@shared/constants';
import { RectangleNode } from '../scene-graph/rectangle-node';
import { EllipseNode } from '../scene-graph/ellipse-node';
import { PolygonNode } from '../scene-graph/polygon-node';
import { StarNode } from '../scene-graph/star-node';
import { PathNode } from '../scene-graph/path-node';
import { Bounds } from '@shared/math/bounds';
import { graphicsPool } from '../pools/graphics-pool';
import { textPool } from '../pools/object-pool';

/**
 * RenderManager — creates and owns the PixiJS Application,
 * manages the world container and display objects for each node.
 */
export class RenderManager {
  readonly rendererRegistry: NodeRendererRegistry;

  private app: Application | null = null;
  private worldContainer: Container | null = null;
  private displayObjects = new Map<string, Container>();
  private displayNodeTypes = new Map<string, BaseNode['type']>();
  private unsubscribe: (() => void) | null = null;

  private selectionOverlay = new SelectionOverlay();
  private guideOverlay = new GuideOverlay();
  private marqueeGfx = graphicsPool.acquire();
  private marqueeBounds: Bounds | null = null;
  private sizeBadgeBg = graphicsPool.acquire();
  private sizeBadgeText = textPool.acquire();
  private sizeBadgeKey = '';

  private singleSelectionGfx = graphicsPool.acquire();
  private singleSelectionTargetId: string | null = null;

  // ── Hover & edge outlines ────────────────────────────────
  private hoverGfx = graphicsPool.acquire();
  private hoverTargetId: string | null = null;
  private edgeGfxMap = new Map<string, Graphics>();
  private _hoveredNodeId: string | null = null;
  private _lastHoverZoom = -1;
  private _lastEdgeZoom = -1;
  private _lastEdgeSelectionSnapshot: string[] = [];

  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex,
    private viewport: ViewportManager,
    private selection: SelectionManager,
    private guides: GuideState,
    private isNodeInActivePage: (node: BaseNode) => boolean
  ) {
    this.rendererRegistry = new NodeRendererRegistry();
    this.sizeBadgeText.style = {
      fontSize: 11,
      fill: 0xffffff,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '500',
    };

    // Listen for scene events
    this.unsubscribe = this.sceneGraph.on(event => {
      switch (event.type) {
        case 'node-added':
          if (event.node !== this.sceneGraph.root) {
            this.onNodeAdded(event.node);
          }
          break;
        case 'node-removed':
          this.onNodeRemoved(event.node.id);
          break;
      }
    });
  }

  /** Initialise the PixiJS Application (async). */
  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: DEFAULT_CANVAS_BG,
      resizeTo: container,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    container.appendChild(this.app.canvas as HTMLElement);

    // World container moves/scales with camera
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Overlays in screen-space (on top of world)
    this.selectionOverlay.attach(this.app.stage);
    this.guideOverlay.attach(this.app.stage);
    this.app.stage.addChild(this.marqueeGfx);
    this.app.stage.addChild(this.sizeBadgeBg);
    this.app.stage.addChild(this.sizeBadgeText);

    // Sync any nodes added before init (e.g. default page)
    this.syncExistingNodes();
  }

  /** Run one render frame. */
  frame(): boolean {
    if (!this.app || !this.worldContainer) return false;

    // Update viewport (lerped zoom etc.)
    this.viewport.update();

    // Apply camera transform to the world container
    const cam = this.viewport.camera;
    this.worldContainer.position.set(-cam.x * cam.zoom, -cam.y * cam.zoom);
    this.worldContainer.scale.set(cam.zoom, cam.zoom);

    // Sync every tracked display object
    for (const [id, displayObj] of this.displayObjects) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;

      // Always update transform (cheap)
      const localBounds = node.localBounds;
      const pivotX = (localBounds.minX + localBounds.maxX) / 2;
      const pivotY = (localBounds.minY + localBounds.maxY) / 2;
      displayObj.pivot.set(pivotX, pivotY);
      displayObj.position.set(node.x + pivotX, node.y + pivotY);
      displayObj.rotation = node.rotation;
      displayObj.scale.set(node.scaleX, node.scaleY);
      displayObj.alpha = node.opacity;
      displayObj.visible = node.visible && this.isNodeInActivePage(node);

      // Re-draw shape only when visual properties changed
      if (node.dirty.render) {
        const renderer = this.rendererRegistry.get(node.type);
        if (renderer) {
          renderer.sync(node, displayObj);
        }
      }
    }

    // Clear dirty flags on all nodes (no array allocation)
    this.sceneGraph.forEachNode(node => node.clearDirtyFlags());

    // Hover outline (parented to node in world-space)
    this.updateHoverOutline();

    // Selected-node edge outlines (parented to each selected node)
    this.updateSelectedEdgeOutlines();

    // Single-selection overlay (parented to node)
    this.updateSingleSelectionOverlay();

    // Multi-selection overlay (screen-space)
    this.updateSelectionOverlay();

    // Guide overlay (screen-space)
    this.updateGuideOverlay();

    // Marquee overlay (screen-space)
    this.updateMarqueeOverlay();

    // Single-selection size badge (screen-space)
    this.updateSizeBadgeOverlay();

    return true;
  }

  setMarqueeBounds(bounds: Bounds | null): void {
    this.marqueeBounds = bounds;
  }

  setHoveredNodeId(id: string | null): void {
    this._hoveredNodeId = id;
  }

  // ── Hover outline ─────────────────────────────────────────

  private updateHoverOutline(): void {
    // Determine target: hovered node that is NOT selected and NOT a page
    let targetNode: BaseNode | null = null;
    if (this._hoveredNodeId) {
      const node = this.sceneGraph.getNode(this._hoveredNodeId);
      if (node && node.visible && this.isNodeInActivePage(node) && !this.selection.isSelected(node.id)) {
        if (node.parent !== this.sceneGraph.root) {
          targetNode = node;
        }
      }
    }

    // Detach from previous host if target changed
    if (this.hoverTargetId && this.hoverTargetId !== targetNode?.id) {
      const prevObj = this.displayObjects.get(this.hoverTargetId);
      if (prevObj) prevObj.removeChild(this.hoverGfx);
      this.hoverGfx.clear();
      this.hoverTargetId = null;
      this._lastHoverZoom = -1;
    }

    if (!targetNode) return;

    const displayObj = this.displayObjects.get(targetNode.id);
    if (!displayObj) return;

    // Attach if needed
    const justAttached = this.hoverTargetId !== targetNode.id;
    if (justAttached) {
      displayObj.addChild(this.hoverGfx);
      this.hoverTargetId = targetNode.id;
    }

    // Skip redraw if nothing changed (same target, same zoom, no render-dirty)
    const cam = this.viewport.camera;
    if (!justAttached && cam.zoom === this._lastHoverZoom && !targetNode.dirty.render) {
      return;
    }
    this._lastHoverZoom = cam.zoom;

    // Draw outline matching geometry shape
    const sx = Math.max(1e-6, Math.abs(targetNode.scaleX));
    const sy = Math.max(1e-6, Math.abs(targetNode.scaleY));
    const strokeW = HOVER_OUTLINE_WIDTH / (cam.zoom * Math.max(sx, sy));

    this.hoverGfx.clear();
    this.drawNodeOutline(this.hoverGfx, targetNode, strokeW, HOVER_OUTLINE_COLOR, HOVER_OUTLINE_ALPHA);
  }

  // ── Selected edge outlines ────────────────────────────────

  private updateSelectedEdgeOutlines(): void {
    const cam = this.viewport.camera;
    const currentIds = this.selection.selectedNodeIds; // string[]

    // Detect if selection set changed (by reference comparison of sorted snapshot)
    const selectionChanged = !this.arraysEqual(currentIds, this._lastEdgeSelectionSnapshot);
    if (selectionChanged) {
      this._lastEdgeSelectionSnapshot = currentIds.slice();
    }

    const zoomChanged = cam.zoom !== this._lastEdgeZoom;

    // Remove outlines for nodes no longer selected
    if (selectionChanged) {
      const currentSet = new Set(currentIds);
      for (const [id, gfx] of this.edgeGfxMap) {
        if (!currentSet.has(id)) {
          const prevObj = this.displayObjects.get(id);
          if (prevObj) prevObj.removeChild(gfx);
          gfx.clear();
          graphicsPool.release(gfx);
          this.edgeGfxMap.delete(id);
        }
      }
    }

    // Check if any selected node has render-dirty flag
    let anyNodeDirty = false;
    if (!selectionChanged && !zoomChanged) {
      for (const nodeId of currentIds) {
        const node = this.sceneGraph.getNode(nodeId);
        if (node?.dirty.render) { anyNodeDirty = true; break; }
      }
      if (!anyNodeDirty) return; // nothing changed, skip all redraws
    }

    this._lastEdgeZoom = cam.zoom;

    // Draw/update outlines for each selected node
    for (const nodeId of currentIds) {
      const node = this.sceneGraph.getNode(nodeId);
      if (!node || !node.visible || !this.isNodeInActivePage(node)) continue;
      if (node.parent === this.sceneGraph.root) continue; // skip pages
      if (node.type === 'group') continue; // skip groups (they have no own geometry)

      const displayObj = this.displayObjects.get(nodeId);
      if (!displayObj) continue;

      let gfx = this.edgeGfxMap.get(nodeId);
      const isNew = !gfx;
      if (!gfx) {
        gfx = graphicsPool.acquire();
        this.edgeGfxMap.set(nodeId, gfx);
        displayObj.addChild(gfx);
      }

      // Only redraw this node's outline if it's new, dirty, or zoom changed
      if (!isNew && !zoomChanged && !selectionChanged && !node.dirty.render) continue;

      const sx = Math.max(1e-6, Math.abs(node.scaleX));
      const sy = Math.max(1e-6, Math.abs(node.scaleY));
      const strokeW = SELECTION_EDGE_WIDTH / (cam.zoom * Math.max(sx, sy));

      gfx.clear();
      this.drawNodeOutline(gfx, node, strokeW, SELECTION_COLOR, SELECTION_EDGE_ALPHA);
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ── Shared outline drawing ────────────────────────────────

  private drawNodeOutline(gfx: Graphics, node: BaseNode, strokeW: number, color: number, alpha: number): void {
    switch (node.type) {
      case 'rectangle': {
        const rect = node as RectangleNode;
        if (rect.cornerRadius > 0) {
          gfx.roundRect(0, 0, rect.width, rect.height, rect.cornerRadius);
        } else {
          gfx.rect(0, 0, rect.width, rect.height);
        }
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
      case 'ellipse': {
        gfx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2);
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
      case 'polygon': {
        const poly = node as PolygonNode;
        const sides = poly.sides;
        const cx = node.width / 2;
        const cy = node.height / 2;
        const rx = node.width / 2;
        const ry = node.height / 2;
        for (let i = 0; i <= sides; i++) {
          const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
          const px = cx + rx * Math.cos(angle);
          const py = cy + ry * Math.sin(angle);
          if (i === 0) gfx.moveTo(px, py);
          else gfx.lineTo(px, py);
        }
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
      case 'star': {
        const star = node as StarNode;
        const points = star.points;
        const innerRatio = star.innerRadiusRatio;
        const cx = node.width / 2;
        const cy = node.height / 2;
        const outerRx = node.width / 2;
        const outerRy = node.height / 2;
        const innerRx = outerRx * innerRatio;
        const innerRy = outerRy * innerRatio;
        const total = points * 2;
        for (let i = 0; i <= total; i++) {
          const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
          const isOuter = i % 2 === 0;
          const px = cx + (isOuter ? outerRx : innerRx) * Math.cos(angle);
          const py = cy + (isOuter ? outerRy : innerRy) * Math.sin(angle);
          if (i === 0) gfx.moveTo(px, py);
          else gfx.lineTo(px, py);
        }
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
      case 'path': {
        const pathNode = node as PathNode;
        if (pathNode.anchors.length >= 2) {
          const anchors = pathNode.anchors;
          gfx.moveTo(anchors[0].position.x, anchors[0].position.y);
          for (let i = 1; i < anchors.length; i++) {
            const prev = anchors[i - 1];
            const curr = anchors[i];
            gfx.bezierCurveTo(
              prev.position.x + prev.handleOut.x, prev.position.y + prev.handleOut.y,
              curr.position.x + curr.handleIn.x, curr.position.y + curr.handleIn.y,
              curr.position.x, curr.position.y
            );
          }
          if (pathNode.closed && anchors.length > 2) {
            const last = anchors[anchors.length - 1];
            const first = anchors[0];
            gfx.bezierCurveTo(
              last.position.x + last.handleOut.x, last.position.y + last.handleOut.y,
              first.position.x + first.handleIn.x, first.position.y + first.handleIn.y,
              first.position.x, first.position.y
            );
          }
          gfx.stroke({ color, alpha, width: strokeW });
        }
        break;
      }
      case 'line':
      case 'arrow': {
        // Lines/arrows: just use bounding box edges
        gfx.rect(0, 0, node.width, node.height);
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
      case 'text':
      case 'image':
      case 'video':
      default: {
        // Fallback: bounding rect
        gfx.rect(0, 0, node.width, node.height);
        gfx.stroke({ color, alpha, width: strokeW });
        break;
      }
    }
  }

  private updateSelectionOverlay(): void {
    if (!this.app) return;
    const cam = this.viewport.camera;

    if (this.selection.count === 1) {
      // Prefer the node-parented overlay for single selection
      this.selectionOverlay.hide();
      return;
    }

    if (!this.selection.hasSelection) {
      this.selectionOverlay.hide();
      return;
    }

    const b = this.selection.bounds;
    if (b.isEmpty) {
      this.selectionOverlay.hide();
      return;
    }

    const topLeft = cam.worldToScreen(new Vec2(b.minX, b.minY));
    const bottomRight = cam.worldToScreen(new Vec2(b.maxX, b.maxY));

    this.selectionOverlay.show();
    this.selectionOverlay.update(
      Math.min(topLeft.x, bottomRight.x),
      Math.min(topLeft.y, bottomRight.y),
      Math.max(topLeft.x, bottomRight.x),
      Math.max(topLeft.y, bottomRight.y),
      cam.zoom
    );
  }

  private updateSingleSelectionOverlay(): void {
    const cam = this.viewport.camera;

    if (this.selection.count !== 1) {
      this.detachSingleSelection();
      return;
    }

    const node = this.selection.selectedNodes[0];
    const displayObj = this.displayObjects.get(node.id);
    if (!displayObj) {
      this.detachSingleSelection();
      return;
    }

    if (this.singleSelectionTargetId !== node.id) {
      this.detachSingleSelection();
      displayObj.addChild(this.singleSelectionGfx);
      this.singleSelectionTargetId = node.id;
    }

    const lb = node.computeLocalBounds();
    const w = lb.width;
    const h = lb.height;
    if (w <= 0 || h <= 0) {
      this.singleSelectionGfx.clear();
      return;
    }

    // Keep stroke + handles approximately constant in screen-space
    const sx = Math.max(1e-6, Math.abs(node.scaleX));
    const sy = Math.max(1e-6, Math.abs(node.scaleY));
    const strokeW = SELECTION_STROKE_WIDTH / (cam.zoom * Math.max(sx, sy));
    const handleW = HANDLE_SIZE / (cam.zoom * sx);
    const handleH = HANDLE_SIZE / (cam.zoom * sy);
    const handleHalfW = handleW / 2;
    const handleHalfH = handleH / 2;
    const rotDist = ROTATION_HANDLE_DISTANCE / (cam.zoom * sy);
    const rotRadius = Math.min(handleW, handleH) / 2;

    const minX = lb.minX;
    const minY = lb.minY;
    const maxX = lb.maxX;
    const maxY = lb.maxY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    this.singleSelectionGfx.clear();

    // Outline
    this.singleSelectionGfx.rect(minX, minY, w, h);
    this.singleSelectionGfx.stroke({ color: SELECTION_COLOR, width: strokeW });

    // Handles
    const handlePoints: Array<[number, number]> = [
      [minX, minY],
      [cx, minY],
      [maxX, minY],
      [minX, cy],
      [maxX, cy],
      [minX, maxY],
      [cx, maxY],
      [maxX, maxY],
    ];

    for (const [hx, hy] of handlePoints) {
      this.singleSelectionGfx.rect(hx - handleHalfW, hy - handleHalfH, handleW, handleH);
      this.singleSelectionGfx.fill({ color: HANDLE_FILL, alpha: 1 });
      this.singleSelectionGfx.stroke({ color: HANDLE_STROKE, width: strokeW });
    }

    // Rotation handle
    const rotX = cx;
    const rotY = minY - rotDist;
    this.singleSelectionGfx.moveTo(cx, minY);
    this.singleSelectionGfx.lineTo(rotX, rotY);
    this.singleSelectionGfx.stroke({ color: SELECTION_COLOR, width: strokeW });
    this.singleSelectionGfx.circle(rotX, rotY, rotRadius);
    this.singleSelectionGfx.fill({ color: HANDLE_FILL, alpha: 1 });
    this.singleSelectionGfx.stroke({ color: HANDLE_STROKE, width: strokeW });
  }

  private detachSingleSelection(): void {
    if (this.singleSelectionTargetId) {
      const prev = this.displayObjects.get(this.singleSelectionTargetId);
      if (prev) {
        prev.removeChild(this.singleSelectionGfx);
      }
    }
    this.singleSelectionGfx.clear();
    this.singleSelectionTargetId = null;
  }

  private updateGuideOverlay(): void {
    if (!this.app) return;
    const cam = this.viewport.camera;
    this.guideOverlay.setGuides(this.guides.guides);
    this.guideOverlay.update(cam);
  }

  private updateMarqueeOverlay(): void {
    this.marqueeGfx.clear();
    if (!this.marqueeBounds || this.marqueeBounds.isEmpty) return;

    const cam = this.viewport.camera;
    const topLeft = cam.worldToScreen(new Vec2(this.marqueeBounds.minX, this.marqueeBounds.minY));
    const bottomRight = cam.worldToScreen(new Vec2(this.marqueeBounds.maxX, this.marqueeBounds.maxY));

    const minX = Math.min(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const w = Math.abs(bottomRight.x - topLeft.x);
    const h = Math.abs(bottomRight.y - topLeft.y);

    if (w <= 0 || h <= 0) return;

    this.marqueeGfx.rect(minX, minY, w, h);
    this.marqueeGfx.fill({ color: MARQUEE_FILL_COLOR, alpha: MARQUEE_FILL_ALPHA });
    this.marqueeGfx.stroke({ color: MARQUEE_STROKE_COLOR, alpha: MARQUEE_STROKE_ALPHA, width: 1 });
  }

  private updateSizeBadgeOverlay(): void {
    this.sizeBadgeBg.clear();

    if (this.selection.count !== 1) {
      this.sizeBadgeText.visible = false;
      this.sizeBadgeKey = '';
      return;
    }

    const node = this.selection.selectedNodes[0];
    const localBounds = node.localBounds;
    const width = localBounds.width * Math.abs(node.scaleX);
    const height = localBounds.height * Math.abs(node.scaleY);

    if (width <= 0 || height <= 0) {
      this.sizeBadgeText.visible = false;
      this.sizeBadgeKey = '';
      return;
    }

    const text = `W ${this.formatSizeValue(width)}  H ${this.formatSizeValue(height)}`;
    if (text !== this.sizeBadgeKey) {
      this.sizeBadgeText.text = text;
      this.sizeBadgeKey = text;
    }

    const cam = this.viewport.camera;
    const wb = node.worldBounds;
    const bottomCenter = cam.worldToScreen(new Vec2((wb.minX + wb.maxX) / 2, wb.maxY));

    const padX = 6;
    const padY = 3;
    const badgeX = bottomCenter.x - this.sizeBadgeText.width / 2;
    const badgeY = bottomCenter.y + 8;

    this.sizeBadgeText.visible = true;
    this.sizeBadgeText.x = badgeX;
    this.sizeBadgeText.y = badgeY;

    const bgX = badgeX - padX;
    const bgY = badgeY - padY;
    const bgW = this.sizeBadgeText.width + padX * 2;
    const bgH = this.sizeBadgeText.height + padY * 2;

    this.sizeBadgeBg.roundRect(bgX, bgY, bgW, bgH, 4);
    this.sizeBadgeBg.fill({ color: 0x1f2937, alpha: 0.95 });
    this.sizeBadgeBg.stroke({ color: 0x374151, alpha: 1, width: 1 });
  }

  private formatSizeValue(value: number): string {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return rounded.toFixed(2);
  }

  // ── private helpers ───────────────────────────────────────

  private syncExistingNodes(): void {
    let syncedCount = 0;
    for (const node of this.sceneGraph.getRenderOrder()) {
      if (!this.displayObjects.has(node.id)) {
        this.onNodeAdded(node);
        syncedCount++;
      }
    }
    console.warn('[Wigma Render] syncExistingNodes — synced', syncedCount, 'nodes, displayObjects total:', this.displayObjects.size);
  }

  private onNodeAdded(node: BaseNode): void {
    if (!this.worldContainer) return;
    if (this.displayObjects.has(node.id)) return;

    const renderer = this.rendererRegistry.get(node.type);
    if (!renderer) return;

    const displayObj = renderer.create(node) as Container;
    this.displayObjects.set(node.id, displayObj);
    this.displayNodeTypes.set(node.id, node.type);
    this.worldContainer.addChild(displayObj);

    // Initial sync
    renderer.sync(node, displayObj);
    const localBounds = node.localBounds;
    const pivotX = (localBounds.minX + localBounds.maxX) / 2;
    const pivotY = (localBounds.minY + localBounds.maxY) / 2;
    displayObj.pivot.set(pivotX, pivotY);
    displayObj.position.set(node.x + pivotX, node.y + pivotY);
    displayObj.rotation = node.rotation;
    displayObj.scale.set(node.scaleX, node.scaleY);
    displayObj.alpha = node.opacity;
    displayObj.visible = node.visible && this.isNodeInActivePage(node);
  }

  private onNodeRemoved(id: string): void {
    const displayObj = this.displayObjects.get(id);
    if (displayObj && this.worldContainer) {
      this.worldContainer.removeChild(displayObj);

      const nodeType = this.displayNodeTypes.get(id);
      const renderer = nodeType ? this.rendererRegistry.get(nodeType) : null;
      if (renderer) {
        renderer.destroy(displayObj);
      } else {
        displayObj.destroy();
      }

      this.displayObjects.delete(id);
      this.displayNodeTypes.delete(id);
    }
  }

  // ── public accessors ──────────────────────────────────────

  getDisplayObject(id: string): Container | undefined {
    return this.displayObjects.get(id);
  }

  getApp(): Application | null {
    return this.app;
  }

  /** Dispose all display objects and the PixiJS app. */
  dispose(): void {
    this.unsubscribe?.();
    for (const [id, obj] of this.displayObjects) {
      const nodeType = this.displayNodeTypes.get(id);
      const renderer = nodeType ? this.rendererRegistry.get(nodeType) : null;
      if (renderer) {
        renderer.destroy(obj);
      } else {
        obj.destroy();
      }
    }
    this.displayObjects.clear();
    this.displayNodeTypes.clear();
    this.detachSingleSelection();
    graphicsPool.release(this.singleSelectionGfx);
    graphicsPool.release(this.marqueeGfx);
    graphicsPool.release(this.sizeBadgeBg);
    graphicsPool.release(this.hoverGfx);
    for (const [, gfx] of this.edgeGfxMap) {
      graphicsPool.release(gfx);
    }
    this.edgeGfxMap.clear();
    textPool.release(this.sizeBadgeText);
    this.selectionOverlay.dispose();
    this.guideOverlay.dispose();
    this.app?.destroy(true);
    this.app = null;
  }
}
