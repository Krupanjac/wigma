import { BaseNode } from '../scene-graph/base-node';
import { Bounds, MutableBounds } from '@shared/math/bounds';

/**
 * Alignment utilities for multi-selection alignment operations.
 */
export type AlignmentDirection =
  | 'left' | 'center-h' | 'right'
  | 'top' | 'center-v' | 'bottom';

export type DistributeDirection = 'horizontal' | 'vertical';

export interface AlignmentResult {
  nodeId: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
}

/**
 * Align a set of nodes to the selection's bounding box.
 */
export function alignNodes(
  nodes: BaseNode[],
  direction: AlignmentDirection
): AlignmentResult[] {
  if (nodes.length < 2) return [];

  // Compute group bounds
  const mb = new MutableBounds();
  for (const node of nodes) {
    mb.unionMut(node.worldBounds);
  }
  const groupBounds = mb.toImmutable();

  const results: AlignmentResult[] = [];

  for (const node of nodes) {
    const wb = node.worldBounds;
    let newX = node.x;
    let newY = node.y;

    switch (direction) {
      case 'left':
        newX = node.x + (groupBounds.minX - wb.minX);
        break;
      case 'center-h':
        newX = node.x + (groupBounds.centerX - wb.centerX);
        break;
      case 'right':
        newX = node.x + (groupBounds.maxX - wb.maxX);
        break;
      case 'top':
        newY = node.y + (groupBounds.minY - wb.minY);
        break;
      case 'center-v':
        newY = node.y + (groupBounds.centerY - wb.centerY);
        break;
      case 'bottom':
        newY = node.y + (groupBounds.maxY - wb.maxY);
        break;
    }

    results.push({
      nodeId: node.id,
      oldX: node.x,
      oldY: node.y,
      newX,
      newY,
    });
  }

  return results;
}

/**
 * Distribute nodes evenly along an axis.
 */
export function distributeNodes(
  nodes: BaseNode[],
  direction: DistributeDirection
): AlignmentResult[] {
  if (nodes.length < 3) return [];

  const sorted = [...nodes].sort((a, b) => {
    const aBounds = a.worldBounds;
    const bBounds = b.worldBounds;
    return direction === 'horizontal'
      ? aBounds.centerX - bBounds.centerX
      : aBounds.centerY - bBounds.centerY;
  });

  const first = sorted[0].worldBounds;
  const last = sorted[sorted.length - 1].worldBounds;

  const totalSpace = direction === 'horizontal'
    ? last.centerX - first.centerX
    : last.centerY - first.centerY;

  const step = totalSpace / (sorted.length - 1);

  const results: AlignmentResult[] = [];

  for (let i = 1; i < sorted.length - 1; i++) {
    const node = sorted[i];
    const wb = node.worldBounds;
    let newX = node.x;
    let newY = node.y;

    if (direction === 'horizontal') {
      const targetCenterX = first.centerX + step * i;
      newX = node.x + (targetCenterX - wb.centerX);
    } else {
      const targetCenterY = first.centerY + step * i;
      newY = node.y + (targetCenterY - wb.centerY);
    }

    results.push({
      nodeId: node.id,
      oldX: node.x,
      oldY: node.y,
      newX,
      newY,
    });
  }

  return results;
}
