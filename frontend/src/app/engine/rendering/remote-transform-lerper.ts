import { BaseNode } from '../scene-graph/base-node';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SelectionManager } from '../selection/selection-manager';

/**
 * Smoothly interpolates remote geometry changes (move/resize) on other users' edits.
 *
 * Without interpolation, remote edits arrive at ~20 Hz and cause visible "jumps"
 * as nodes snap to new positions. This lerper stores target transforms and
 * smoothly transitions toward them each render frame (~60 Hz), producing the
 * same silky smoothness as CSS-transitioned remote cursors.
 *
 * Integration:
 *   - CanvasEngine calls `tick()` each frame BEFORE RenderManager.frame()
 *   - CollabProvider calls `setTarget()` when receiving remote transform ops
 *   - Locally-selected nodes are skipped (local user has priority)
 */

/** Interpolation factor per frame — higher = snappier, lower = smoother */
const LERP_FACTOR = 0.35;

/** Snap threshold — stop lerping when delta is below this (pixels/scale units) */
const SNAP_THRESHOLD = 0.15;

interface LerpTarget {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

export class RemoteTransformLerper {
  /** Active lerp targets by node ID. */
  private targets = new Map<string, LerpTarget>();

  constructor(
    private sceneGraph: SceneGraphManager,
    private selection: SelectionManager,
  ) {}

  /**
   * Set target transform values for a remotely-changed node.
   * Only the specified properties will be interpolated.
   * Call this instead of directly assigning node.x/y/etc for remote ops.
   */
  setTarget(nodeId: string, target: LerpTarget): void {
    const existing = this.targets.get(nodeId);
    if (existing) {
      // Merge — new target values override
      Object.assign(existing, target);
    } else {
      this.targets.set(nodeId, { ...target });
    }
  }

  /**
   * Apply a delta (dx, dy) to multiple nodes' lerp targets.
   * If a node has no active target, its current position is used as baseline.
   */
  addDelta(nodeIds: string[], dx: number, dy: number): void {
    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;

      const existing = this.targets.get(id);
      if (existing) {
        existing.x = (existing.x ?? node.x) + dx;
        existing.y = (existing.y ?? node.y) + dy;
      } else {
        this.targets.set(id, {
          x: node.x + dx,
          y: node.y + dy,
        });
      }
    }
  }

  /** Whether any lerp targets are active. */
  get hasActiveTargets(): boolean {
    return this.targets.size > 0;
  }

  /** Check if a specific node is currently being lerped. */
  isLerping(nodeId: string): boolean {
    return this.targets.has(nodeId);
  }

  /**
   * Advance all active lerp targets by one frame.
   * Call once per requestAnimationFrame, before rendering.
   * Returns true if any nodes were updated (scene needs redraw).
   */
  tick(): boolean {
    if (this.targets.size === 0) return false;

    const completed: string[] = [];
    let anyUpdated = false;
    const changedNodes: BaseNode[] = [];

    for (const [id, target] of this.targets) {
      const node = this.sceneGraph.getNode(id);
      if (!node) {
        completed.push(id);
        continue;
      }

      // Skip locally-selected nodes — local user has priority
      if (this.selection.isSelected(id)) {
        // Snap to target immediately when deselected (handled by clearing)
        continue;
      }

      let allDone = true;

      // Lerp each property
      if (target.x !== undefined) {
        const done = this.lerpProp(node, 'x', target.x);
        allDone = allDone && done;
      }
      if (target.y !== undefined) {
        const done = this.lerpProp(node, 'y', target.y);
        allDone = allDone && done;
      }
      if (target.width !== undefined) {
        const done = this.lerpProp(node, 'width', target.width);
        allDone = allDone && done;
      }
      if (target.height !== undefined) {
        const done = this.lerpProp(node, 'height', target.height);
        allDone = allDone && done;
      }
      if (target.scaleX !== undefined) {
        const done = this.lerpProp(node, 'scaleX', target.scaleX);
        allDone = allDone && done;
      }
      if (target.scaleY !== undefined) {
        const done = this.lerpProp(node, 'scaleY', target.scaleY);
        allDone = allDone && done;
      }
      if (target.rotation !== undefined) {
        const done = this.lerpProp(node, 'rotation', target.rotation);
        allDone = allDone && done;
      }

      anyUpdated = true;
      changedNodes.push(node);

      if (allDone) {
        completed.push(id);
      }
    }

    // Clean up completed targets
    for (const id of completed) {
      this.targets.delete(id);
    }

    // Batch-notify scene graph for spatial index + render updates
    if (changedNodes.length > 0) {
      this.sceneGraph.notifyNodesChanged(changedNodes);
    }

    return anyUpdated;
  }

  /** Remove a target (e.g. when node is deleted). */
  removeTarget(nodeId: string): void {
    this.targets.delete(nodeId);
  }

  /** Clear all targets. */
  clear(): void {
    this.targets.clear();
  }

  /**
   * Lerp a single numeric property toward target.
   * Returns true when the property has reached the target (snapped).
   */
  private lerpProp(
    node: BaseNode,
    prop: 'x' | 'y' | 'width' | 'height' | 'scaleX' | 'scaleY' | 'rotation',
    target: number,
  ): boolean {
    const current = node[prop];
    const delta = target - current;

    if (Math.abs(delta) < SNAP_THRESHOLD) {
      // Close enough — snap to target
      (node as any)['_' + prop] = target;
      node.markTransformDirty();
      if (prop === 'width' || prop === 'height') {
        node.markBoundsDirty();
        node.markRenderDirty();
      }
      return true;
    }

    // Lerp toward target
    const next = current + delta * LERP_FACTOR;
    (node as any)['_' + prop] = next;
    node.markTransformDirty();
    if (prop === 'width' || prop === 'height') {
      node.markBoundsDirty();
      node.markRenderDirty();
    }
    return false;
  }
}
