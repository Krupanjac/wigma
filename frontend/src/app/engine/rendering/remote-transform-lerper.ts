import { BaseNode } from '../scene-graph/base-node';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SelectionManager } from '../selection/selection-manager';
import { SpatialIndex } from '../spatial/spatial-index';

/**
 * Smoothly interpolates remote geometry changes using **snapshot interpolation
 * with an adaptive buffer**.
 *
 * Algorithm:
 *   1. Incoming network updates are timestamped and pushed into a per-node
 *      ring buffer.
 *   2. The buffer delay is measured adaptively from actual inter-snapshot
 *      arrival times, keeping it as small as possible while ensuring we
 *      (almost) always have a "next" snapshot to interpolate toward.
 *   3. On each render frame we compute:
 *        renderTime = now − adaptiveDelay
 *      and linearly interpolate between the two snapshots bracketing it.
 *   4. If renderTime overshoots the last snapshot during active streaming,
 *      we hold at the last known position (zero-lag clamp) instead of
 *      falling into a slow settle loop.
 *   5. When updates stop, we snap quickly to the exact final position.
 *
 * PERFORMANCE: Does NOT call sceneGraph.notifyNodesChanged().
 */

/** Minimum buffer delay (ms). Floor so we always have *some* smoothing. */
const MIN_BUFFER_MS = 20;

/** Maximum buffer delay (ms). Cap for pathological network conditions. */
const MAX_BUFFER_MS = 120;

/**
 * Multiplier on measured average inter-snapshot interval.
 * 1.2× means the buffer is 20% larger than the average gap — enough to
 * absorb normal jitter without adding unnecessary latency.
 */
const BUFFER_MULTIPLIER = 1.2;

/** EMA alpha for inter-snapshot interval measurement. */
const INTERVAL_ALPHA = 0.3;

/** Maximum snapshots kept per node. */
const MAX_SNAPSHOTS = 20;

/** After this many ms of no new snapshots, consider streaming done. */
const IDLE_TIMEOUT_MS = 200;

/** When settling to final target (idle), close this fraction of the gap/frame. */
const SETTLE_FACTOR = 0.7;

/** Below this threshold (px / units) snap exactly. */
const SNAP_THRESHOLD = 0.15;

type PropKey = 'x' | 'y' | 'width' | 'height' | 'scaleX' | 'scaleY' | 'rotation';

/** A single timestamped state snapshot. */
interface Snapshot {
  time: number;
  props: Partial<Record<PropKey, number>>;
}

/** Per-node interpolation state. */
interface NodeEntry {
  snapshots: Snapshot[];
  latest: Partial<Record<PropKey, number>>;
  /** EMA of inter-snapshot interval (ms). */
  avgInterval: number;
  /** Timestamp of the last pushed snapshot. */
  lastPushTime: number;
}

export class RemoteTransformLerper {
  private nodes = new Map<string, NodeEntry>();

  constructor(
    private sceneGraph: SceneGraphManager,
    private selection: SelectionManager,
    private spatialIndex: SpatialIndex,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /** Push an absolute-target snapshot for a remotely-changed node. */
  setTarget(nodeId: string, target: Partial<Record<PropKey, number>>): void {
    const now = performance.now();
    let entry = this.nodes.get(nodeId);
    if (!entry) {
      entry = { snapshots: [], latest: {}, avgInterval: 50, lastPushTime: 0 };
      this.nodes.set(nodeId, entry);
    }
    Object.assign(entry.latest, target);
    this.pushSnapshot(entry, now);
  }

  /** Apply a position delta to multiple nodes' targets. */
  addDelta(nodeIds: string[], dx: number, dy: number): void {
    const now = performance.now();
    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;

      let entry = this.nodes.get(id);
      if (!entry) {
        entry = { snapshots: [], latest: {}, avgInterval: 50, lastPushTime: 0 };
        this.nodes.set(id, entry);
      }

      entry.latest.x = (entry.latest.x ?? node.x) + dx;
      entry.latest.y = (entry.latest.y ?? node.y) + dy;
      this.pushSnapshot(entry, now);
    }
  }

  get hasActiveTargets(): boolean { return this.nodes.size > 0; }

  isLerping(nodeId: string): boolean { return this.nodes.has(nodeId); }

  /**
   * Advance all interpolations by one frame.
   * Call once per rAF, before rendering.
   */
  tick(): boolean {
    if (this.nodes.size === 0) return false;

    const now = performance.now();
    const completed: string[] = [];
    const changedNodes: BaseNode[] = [];

    for (const [id, entry] of this.nodes) {
      const node = this.sceneGraph.getNode(id);
      if (!node) { completed.push(id); continue; }
      if (this.selection.isSelected(id)) continue;

      const snaps = entry.snapshots;
      if (snaps.length === 0) { completed.push(id); continue; }

      const lastSnap = snaps[snaps.length - 1];
      const isStreaming = (now - lastSnap.time) < IDLE_TIMEOUT_MS;

      // Adaptive buffer delay based on measured interval
      const bufferDelay = Math.min(
        MAX_BUFFER_MS,
        Math.max(MIN_BUFFER_MS, entry.avgInterval * BUFFER_MULTIPLIER),
      );
      const renderTime = now - bufferDelay;

      let nodeChanged = false;
      let allDone = true;

      if (snaps.length === 1) {
        // Only one snapshot — jump to it
        for (const key of Object.keys(snaps[0].props) as PropKey[]) {
          const tgt = snaps[0].props[key]!;
          if (node[key] !== tgt) {
            this.writeProp(node, key, tgt);
            nodeChanged = true;
          }
        }
        allDone = !isStreaming;
      } else if (renderTime <= snaps[0].time) {
        // renderTime is before the first snapshot — jump to first
        for (const key of Object.keys(snaps[0].props) as PropKey[]) {
          const tgt = snaps[0].props[key]!;
          if (node[key] !== tgt) {
            this.writeProp(node, key, tgt);
            nodeChanged = true;
          }
        }
        allDone = false;
      } else if (renderTime >= lastSnap.time) {
        if (isStreaming) {
          // ── Streaming but overshot buffer: hold at last known position ──
          // This avoids the slow-settling trap. We just display the latest
          // authoritative position directly — zero additional lag.
          for (const key of Object.keys(lastSnap.props) as PropKey[]) {
            const tgt = lastSnap.props[key]!;
            if (node[key] !== tgt) {
              this.writeProp(node, key, tgt);
              nodeChanged = true;
            }
          }
          allDone = false;
        } else {
          // ── Idle: settle quickly to exact final position ──
          for (const key of Object.keys(lastSnap.props) as PropKey[]) {
            const tgt = lastSnap.props[key]!;
            const cur = node[key];
            const delta = tgt - cur;
            if (Math.abs(delta) < SNAP_THRESHOLD) {
              if (cur !== tgt) {
                this.writeProp(node, key, tgt);
                nodeChanged = true;
              }
            } else {
              this.writeProp(node, key, cur + delta * SETTLE_FACTOR);
              nodeChanged = true;
              allDone = false;
            }
          }
        }
      } else {
        // ── Core interpolation: find bracketing snapshots ──
        let s0 = snaps[0];
        let s1 = snaps[1];
        for (let i = 1; i < snaps.length; i++) {
          if (snaps[i].time >= renderTime) {
            s0 = snaps[i - 1];
            s1 = snaps[i];
            break;
          }
        }

        const span = s1.time - s0.time;
        const t = span > 0 ? Math.min(1, (renderTime - s0.time) / span) : 1;

        // Collect all property keys from both snapshots
        const allKeys = new Set<PropKey>();
        for (const k of Object.keys(s0.props) as PropKey[]) allKeys.add(k);
        for (const k of Object.keys(s1.props) as PropKey[]) allKeys.add(k);

        for (const key of allKeys) {
          const v0 = s0.props[key];
          const v1 = s1.props[key];

          let value: number;
          if (v0 !== undefined && v1 !== undefined) {
            value = v0 + (v1 - v0) * t;
          } else {
            value = v1 ?? v0!;
          }

          if ((key === 'width' || key === 'height') && value < 0) value = 0;

          if (node[key] !== value) {
            this.writeProp(node, key, value);
            nodeChanged = true;
          }
        }
        allDone = false;
      }

      if (nodeChanged) changedNodes.push(node);
      if (allDone) completed.push(id);

      // Prune old snapshots
      this.pruneSnapshots(entry, renderTime);
    }

    for (const id of completed) this.nodes.delete(id);

    for (const node of changedNodes) {
      if (node.dirty.bounds) {
        this.spatialIndex.update(node.id, node.worldBounds);
      }
    }

    return changedNodes.length > 0;
  }

  removeTarget(nodeId: string): void { this.nodes.delete(nodeId); }
  clear(): void { this.nodes.clear(); }

  /* ------------------------------------------------------------------ */
  /*  Internals                                                          */
  /* ------------------------------------------------------------------ */

  private pushSnapshot(entry: NodeEntry, time: number): void {
    // Update adaptive interval measurement
    if (entry.lastPushTime > 0) {
      const gap = time - entry.lastPushTime;
      if (gap > 0 && gap < 500) {
        entry.avgInterval = entry.avgInterval * (1 - INTERVAL_ALPHA) + gap * INTERVAL_ALPHA;
      }
    }
    entry.lastPushTime = time;

    entry.snapshots.push({ time, props: { ...entry.latest } });
    if (entry.snapshots.length > MAX_SNAPSHOTS) {
      entry.snapshots.splice(0, entry.snapshots.length - MAX_SNAPSHOTS);
    }
  }

  private pruneSnapshots(entry: NodeEntry, renderTime: number): void {
    const snaps = entry.snapshots;
    if (snaps.length <= 2) return;

    let cutoff = 0;
    for (let i = 0; i < snaps.length - 1; i++) {
      if (snaps[i + 1].time <= renderTime) {
        cutoff = i;
      }
    }
    if (cutoff > 0) {
      snaps.splice(0, cutoff);
    }
  }

  private writeProp(node: BaseNode, key: PropKey, value: number): void {
    (node as any)['_' + key] = value;
    node.markTransformDirty();
    if (key === 'width' || key === 'height') {
      node.markBoundsDirty();
      node.markRenderDirty();
    }
  }
}
