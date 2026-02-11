import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SpatialIndex } from '../spatial/spatial-index';
import { ViewportManager } from '../viewport/viewport-manager';
import { NodeRendererRegistry } from './node-renderer.registry';
import { IDLE_FRAME_SKIP } from '@shared/constants';

/**
 * Rendering pipeline frame lifecycle:
 *
 * 1. Check dirty flags across scene graph
 * 2. Update world transforms for dirty nodes
 * 3. Update spatial index for nodes with dirty bounds
 * 4. Viewport culling: spatialIndex.queryRange(camera.getVisibleBounds())
 * 5. Sync visible nodes' renderers (only when renderDirty)
 * 6. PixiJS GPU draw
 *
 * Idle frame skipping: When no dirty flags are set, skip the frame entirely.
 */
export class RenderPipeline {
  private _frameSkipActive = true;

  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex,
    private viewport: ViewportManager,
    private rendererRegistry: NodeRendererRegistry
  ) {}

  /** Execute one render frame. Returns true if anything was drawn. */
  frame(): boolean {
    // Step 1: Check if any work needs to be done
    const viewportChanged = this.viewport.update();
    const hasDirtyNodes = this.checkDirtyNodes();

    if (IDLE_FRAME_SKIP && this._frameSkipActive && !viewportChanged && !hasDirtyNodes) {
      return false; // Skip idle frame
    }

    // Step 2: Update world transforms
    this.updateTransforms();

    // Step 3: Update spatial index
    this.updateSpatialIndex();

    // Step 4: Viewport culling
    const visibleBounds = this.viewport.camera.getVisibleBounds();
    const visibleIds = this.spatialIndex.queryRange(visibleBounds);

    // Step 5: Sync renderers
    this.syncRenderers(visibleIds);

    // Step 6: Clear dirty flags on rendered nodes
    this.clearDirtyFlags(visibleIds);

    return true;
  }

  private checkDirtyNodes(): boolean {
    for (const node of this.sceneGraph.getAllNodes()) {
      if (node.dirty.transform || node.dirty.render || node.dirty.bounds) {
        return true;
      }
    }
    return false;
  }

  private updateTransforms(): void {
    for (const node of this.sceneGraph.getAllNodes()) {
      if (node.dirty.transform) {
        // Access worldMatrix triggers recomputation
        void node.worldMatrix;
      }
    }
  }

  private updateSpatialIndex(): void {
    for (const node of this.sceneGraph.getAllNodes()) {
      if (node.dirty.bounds && node !== this.sceneGraph.root) {
        this.spatialIndex.update(node.id, node.worldBounds);
      }
    }
  }

  private syncRenderers(visibleIds: string[]): void {
    for (const id of visibleIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node || !node.visible) continue;

      const renderer = this.rendererRegistry.get(node.type);
      if (!renderer) continue;

      if (node.dirty.render) {
        // In full implementation: renderer.sync(node, displayObject)
        void renderer;
      }
    }
  }

  private clearDirtyFlags(visibleIds: string[]): void {
    for (const id of visibleIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.clearDirtyFlags();
      }
    }
  }

  /** Enable/disable idle frame skipping. */
  set frameSkipEnabled(value: boolean) {
    this._frameSkipActive = value;
  }
}
