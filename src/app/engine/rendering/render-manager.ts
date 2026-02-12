import { Application, Container, Graphics } from 'pixi.js';
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
import { DEFAULT_CANVAS_BG, HANDLE_FILL, HANDLE_SIZE, HANDLE_STROKE, MARQUEE_FILL_ALPHA, MARQUEE_FILL_COLOR, MARQUEE_STROKE_ALPHA, MARQUEE_STROKE_COLOR, ROTATION_HANDLE_DISTANCE, SELECTION_COLOR, SELECTION_STROKE_WIDTH } from '@shared/constants';
import { Bounds } from '@shared/math/bounds';

/**
 * RenderManager — creates and owns the PixiJS Application,
 * manages the world container and display objects for each node.
 */
export class RenderManager {
  readonly rendererRegistry: NodeRendererRegistry;

  private app: Application | null = null;
  private worldContainer: Container | null = null;
  private displayObjects = new Map<string, Container>();
  private unsubscribe: (() => void) | null = null;

  private selectionOverlay = new SelectionOverlay();
  private guideOverlay = new GuideOverlay();
  private marqueeGfx = new Graphics();
  private marqueeBounds: Bounds | null = null;

  private singleSelectionGfx = new Graphics();
  private singleSelectionTargetId: string | null = null;

  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex,
    private viewport: ViewportManager,
    private selection: SelectionManager,
    private guides: GuideState
  ) {
    this.rendererRegistry = new NodeRendererRegistry();

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
      displayObj.visible = node.visible;

      // Re-draw shape only when visual properties changed
      if (node.dirty.render) {
        const renderer = this.rendererRegistry.get(node.type);
        if (renderer) {
          renderer.sync(node, displayObj);
        }
      }
    }

    // Clear dirty flags on all nodes
    for (const node of this.sceneGraph.getAllNodes()) {
      node.clearDirtyFlags();
    }

    // Single-selection overlay (parented to node)
    this.updateSingleSelectionOverlay();

    // Multi-selection overlay (screen-space)
    this.updateSelectionOverlay();

    // Guide overlay (screen-space)
    this.updateGuideOverlay();

    // Marquee overlay (screen-space)
    this.updateMarqueeOverlay();

    return true;
  }

  setMarqueeBounds(bounds: Bounds | null): void {
    this.marqueeBounds = bounds;
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

  // ── private helpers ───────────────────────────────────────

  private syncExistingNodes(): void {
    for (const node of this.sceneGraph.getRenderOrder()) {
      if (!this.displayObjects.has(node.id)) {
        this.onNodeAdded(node);
      }
    }
  }

  private onNodeAdded(node: BaseNode): void {
    if (!this.worldContainer) return;
    if (this.displayObjects.has(node.id)) return;

    const renderer = this.rendererRegistry.get(node.type);
    if (!renderer) return;

    const displayObj = renderer.create(node) as Container;
    this.displayObjects.set(node.id, displayObj);
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
    displayObj.visible = node.visible;
  }

  private onNodeRemoved(id: string): void {
    const displayObj = this.displayObjects.get(id);
    if (displayObj && this.worldContainer) {
      this.worldContainer.removeChild(displayObj);
      displayObj.destroy();
      this.displayObjects.delete(id);
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
    for (const [, obj] of this.displayObjects) {
      obj.destroy();
    }
    this.displayObjects.clear();
    this.detachSingleSelection();
    this.singleSelectionGfx.destroy();
    this.marqueeGfx.destroy();
    this.selectionOverlay.dispose();
    this.guideOverlay.dispose();
    this.app?.destroy(true);
    this.app = null;
  }
}
