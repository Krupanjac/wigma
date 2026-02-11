import { findNearestSnap } from '@shared/utils/geometry-utils';
import { SNAP_THRESHOLD } from '@shared/constants';

/**
 * Snap result for a single axis.
 */
export interface SnapResult {
  snapped: boolean;
  value: number;
  guide: number;
  distance: number;
}

/**
 * SnapEngine — finds nearest snap guides using binary search.
 * O(log g) per axis, g = guide count.
 */
export class SnapEngine {
  private horizontalGuides: number[] = [];
  private verticalGuides: number[] = [];
  private threshold: number = SNAP_THRESHOLD;

  /** Set the snap threshold in screen-space pixels. */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /** Update guides from current scene state. */
  setGuides(horizontal: number[], vertical: number[]): void {
    this.horizontalGuides = horizontal.sort((a, b) => a - b);
    this.verticalGuides = vertical.sort((a, b) => a - b);
  }

  /** Add guides derived from a node's edges and center. */
  addNodeGuides(x: number, y: number, width: number, height: number): void {
    this.horizontalGuides.push(y, y + height / 2, y + height);
    this.verticalGuides.push(x, x + width / 2, x + width);
    this.horizontalGuides.sort((a, b) => a - b);
    this.verticalGuides.sort((a, b) => a - b);
  }

  /** Clear all guides. */
  clearGuides(): void {
    this.horizontalGuides = [];
    this.verticalGuides = [];
  }

  /** Snap a value on the X axis. */
  snapX(value: number, screenZoom: number = 1): SnapResult {
    const adjustedThreshold = this.threshold / screenZoom;
    const result = findNearestSnap(value, this.verticalGuides, adjustedThreshold);
    if (result) {
      return { snapped: true, value: result.guide, guide: result.guide, distance: result.distance };
    }
    return { snapped: false, value, guide: 0, distance: Infinity };
  }

  /** Snap a value on the Y axis. */
  snapY(value: number, screenZoom: number = 1): SnapResult {
    const adjustedThreshold = this.threshold / screenZoom;
    const result = findNearestSnap(value, this.horizontalGuides, adjustedThreshold);
    if (result) {
      return { snapped: true, value: result.guide, guide: result.guide, distance: result.distance };
    }
    return { snapped: false, value, guide: 0, distance: Infinity };
  }

  /** Snap a point on both axes. */
  snapPoint(x: number, y: number, screenZoom: number = 1): { x: SnapResult; y: SnapResult } {
    return {
      x: this.snapX(x, screenZoom),
      y: this.snapY(y, screenZoom),
    };
  }
}
