import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { PathNode, PathAnchor } from '../engine/scene-graph/path-node';
import { Vec2 } from '../shared/math/vec2';

/**
 * PenTool — cubic Bézier path creation.
 *
 * - Click = sharp anchor (no handles)
 * - Click+drag = smooth anchor (symmetric handles)
 * - Close path by clicking on first anchor
 * - Escape to finish open path
 */
export class PenTool extends BaseTool {
  readonly type: ToolType = 'pen';
  readonly label = 'Pen';
  readonly icon = 'pen-tool';
  readonly shortcut = 'P';

  private currentPath: PathNode | null = null;
  private isDragging: boolean = false;
  private currentAnchorIndex: number = -1;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const pos = event.worldPosition;

    if (!this.currentPath) {
      // Start new path
      this.currentPath = new PathNode();
      this.engine.sceneGraph.addNode(this.currentPath);
    } else if (this.currentPath.anchors.length > 0) {
      // Check if closing the path (clicking near first anchor)
      const first = this.currentPath.anchors[0].position;
      if (pos.distanceTo(first) < 10 / this.engine.viewport.camera.zoom) {
        this.currentPath.closed = true;
        this.finishPath();
        return;
      }
    }

    // Add new anchor
    const anchor: PathAnchor = {
      position: pos,
      handleIn: Vec2.ZERO,
      handleOut: Vec2.ZERO,
      type: 'sharp',
    };
    this.currentPath.addAnchor(anchor);
    this.currentAnchorIndex = this.currentPath.anchors.length - 1;
    this.isDragging = true;
  }

  override onPointerMove(event: PointerEventData): void {
    if (!this.isDragging || !this.currentPath || this.currentAnchorIndex < 0) return;

    const anchor = this.currentPath.anchors[this.currentAnchorIndex];
    const handleOut = event.worldPosition.sub(anchor.position);

    anchor.handleOut = handleOut;
    anchor.handleIn = handleOut.negate(); // Mirror symmetric
    anchor.type = 'smooth';

    this.currentPath.markRenderDirty();
    this.currentPath.markBoundsDirty();
  }

  override onPointerUp(_event: PointerEventData): void {
    this.isDragging = false;
  }

  override onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter') {
      this.finishPath();
    }
  }

  private finishPath(): void {
    if (this.currentPath) {
      if (this.currentPath.anchors.length < 2) {
        this.engine.sceneGraph.removeNode(this.currentPath);
      } else {
        this.engine.selection.select(this.currentPath);
      }
    }
    this.currentPath = null;
    this.currentAnchorIndex = -1;
    this.isDragging = false;
  }

  override onDeactivate(): void {
    this.finishPath();
  }
}
