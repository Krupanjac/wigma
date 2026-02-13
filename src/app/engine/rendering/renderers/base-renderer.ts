import { BaseNode, NodeType } from '../../scene-graph/base-node';

/**
 * Abstract base renderer. Each renderer implementation manages
 * PixiJS display objects for a specific node type.
 *
 * The renderer follows an object-pooling pattern:
 * - create(node): Acquire a display object (from pool) and configure it
 * - sync(node, displayObject): Update display object when renderDirty
 * - destroy(displayObject): Return display object to pool
 */
export abstract class BaseRenderer<T = unknown> {
  abstract readonly nodeType: NodeType;

  /** Create a new display object for the given node. */
  abstract create(node: BaseNode): T;

  /** Sync the display object with current node properties (only when renderDirty). */
  abstract sync(node: BaseNode, displayObject: T): void;

  /** Destroy/return the display object to the pool. */
  abstract destroy(displayObject: T, nodeId?: string): void;
}
