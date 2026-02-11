import { Application, Container } from 'pixi.js';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SpatialIndex } from '../spatial/spatial-index';
import { ViewportManager } from '../viewport/viewport-manager';
import { NodeRendererRegistry } from './node-renderer.registry';
import { BaseNode } from '../scene-graph/base-node';
import { SelectionManager } from '../selection/selection-manager';
import { SelectionOverlay } from './overlays/selection-overlay';
import { Vec2 } from '@shared/math/vec2';

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

  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex,
    private viewport: ViewportManager,
    private selection: SelectionManager
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
      background: '#f5f5f5',
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

    // Sync any nodes added before init (e.g. Layer 0)
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
      displayObj.position.set(node.x, node.y);
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

    // Selection overlay (screen-space)
    this.updateSelectionOverlay();

    return true;
  }

  private updateSelectionOverlay(): void {
    if (!this.app) return;
    const cam = this.viewport.camera;

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
    displayObj.position.set(node.x, node.y);
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
    this.selectionOverlay.dispose();
    this.app?.destroy(true);
    this.app = null;
  }
}
