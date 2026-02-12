import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { PathNode, PathAnchor } from '../engine/scene-graph/path-node';
import { Vec2 } from '../shared/math/vec2';

/** PencilTool — freehand drawing by sampling drag points into a path. */
export class PencilTool extends BaseTool {
  readonly type: ToolType = 'pencil';
  readonly label = 'Pencil';
  readonly icon = 'pencil';
  readonly shortcut = 'B';

  private currentPath: PathNode | null = null;
  private lastPoint: Vec2 | null = null;

  constructor(private engine: CanvasEngine) { super(); }

  override onPointerDown(event: PointerEventData): void {
    const path = new PathNode('Pencil Path');
    path.fill.visible = false;
    path.stroke.visible = true;
    path.stroke.width = 2;
    const anchor: PathAnchor = {
      position: event.worldPosition,
      handleIn: Vec2.ZERO,
      handleOut: Vec2.ZERO,
      type: 'sharp',
    };
    path.addAnchor(anchor);
    this.currentPath = path;
    this.lastPoint = event.worldPosition;
    this.engine.sceneGraph.addNode(path, this.engine.activePage ?? undefined);
    this.engine.sceneGraph.notifyNodeChanged(path);
  }

  override onPointerMove(event: PointerEventData): void {
    if (!this.currentPath || !this.lastPoint) return;

    const minDistance = 3 / this.engine.viewport.camera.zoom;
    if (event.worldPosition.distanceTo(this.lastPoint) < minDistance) {
      return;
    }

    this.currentPath.addAnchor({
      position: event.worldPosition,
      handleIn: Vec2.ZERO,
      handleOut: Vec2.ZERO,
      type: 'sharp',
    });

    this.lastPoint = event.worldPosition;
    this.currentPath.markRenderDirty();
    this.currentPath.markBoundsDirty();
    this.engine.sceneGraph.notifyNodeChanged(this.currentPath);
  }

  override onPointerUp(): void {
    if (!this.currentPath) return;

    if (this.currentPath.anchors.length < 2) {
      this.engine.sceneGraph.removeNode(this.currentPath);
    } else {
      this.engine.selection.select(this.currentPath);
      this.engine.sceneGraph.notifyNodeChanged(this.currentPath);
    }

    this.currentPath = null;
    this.lastPoint = null;
  }
}
