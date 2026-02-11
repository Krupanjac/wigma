import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SpatialIndex } from '../spatial/spatial-index';
import { ViewportManager } from '../viewport/viewport-manager';
import { NodeRendererRegistry } from './node-renderer.registry';
import { RenderPipeline } from './render-pipeline';

/**
 * RenderManager orchestrates the three PixiJS RenderGroups:
 * - Content: Scene graph nodes
 * - Overlay: Selection handles, guides, snaps
 * - Grid: Background grid
 *
 * Bridges the scene graph to PixiJS display objects.
 */
export class RenderManager {
  readonly pipeline: RenderPipeline;
  readonly rendererRegistry: NodeRendererRegistry;

  // Display object tracking
  private displayObjects = new Map<string, unknown>();

  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex,
    private viewport: ViewportManager
  ) {
    this.rendererRegistry = new NodeRendererRegistry();
    this.pipeline = new RenderPipeline(
      sceneGraph, spatialIndex, viewport, this.rendererRegistry
    );

    // Listen for scene events
    this.sceneGraph.on(event => {
      switch (event.type) {
        case 'node-added':
          this.onNodeAdded(event.node.id);
          break;
        case 'node-removed':
          this.onNodeRemoved(event.node.id);
          break;
      }
    });
  }

  /** Run one render frame. */
  frame(): boolean {
    return this.pipeline.frame();
  }

  private onNodeAdded(id: string): void {
    const node = this.sceneGraph.getNode(id);
    if (!node) return;

    const renderer = this.rendererRegistry.get(node.type);
    if (!renderer) return;

    const displayObject = renderer.create(node);
    this.displayObjects.set(id, displayObject);
  }

  private onNodeRemoved(id: string): void {
    const displayObject = this.displayObjects.get(id);
    if (displayObject) {
      this.displayObjects.delete(id);
      // In full implementation: return to pool
    }
  }

  /** Get the display object for a node. */
  getDisplayObject(id: string): unknown | undefined {
    return this.displayObjects.get(id);
  }

  /** Get the PixiJS Application instance (if initialized). */
  getApp(): unknown | null {
    return null; // Will be set when PixiJS Application is created
  }

  /** Dispose all display objects. */
  dispose(): void {
    this.displayObjects.clear();
  }
}
