import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { DragHandler } from '../engine/interaction/drag-handler';
import { SelectionBox } from '../engine/selection/selection-box';
import { BaseNode } from '../engine/scene-graph/base-node';
import { Vec2 } from '@shared/math/vec2';
import { SNAP_THRESHOLD } from '@shared/constants';

/**
 * SelectTool — the most complex tool.
 *
 * State machine:
 * - Idle: waiting for input
 * - Click: single click to select
 * - Shift-click: toggle selection
 * - Rubber-band marquee: drag on empty space → spatialIndex.queryRange()
 * - Drag-move: drag on selected node(s) → move them
 * - Resize handles: drag on handle → resize
 * - Group enter: double-click on group
 */
export class SelectTool extends BaseTool {
  readonly type: ToolType = 'select';
  readonly label = 'Select';
  readonly icon = 'cursor';
  readonly shortcut = 'V';

  private dragHandler = new DragHandler();
  private selectionBox = new SelectionBox();
  private mode: 'idle' | 'moving' | 'marquee' | 'resizing' = 'idle';
  private hitNode: BaseNode | null = null;

  private lastEffectiveWorldPos: Vec2 | null = null;
  private pointerCompensation: Vec2 = Vec2.ZERO;
  private moveExcludeIds = new Set<string>();

  constructor(private engine: CanvasEngine) {
    super();
  }

  override onPointerDown(event: PointerEventData): void {
    this.dragHandler.start(event.screenPosition, event.worldPosition);

    // Hit test under cursor
    this.hitNode = this.engine.hitTester.hitTest(event.worldPosition);

    if (this.hitNode) {
      if (event.shiftKey) {
        this.engine.selection.toggleSelection(this.hitNode);
      } else if (!this.engine.selection.isSelected(this.hitNode.id)) {
        this.engine.selection.select(this.hitNode);
      }

      this.pointerCompensation = Vec2.ZERO;
      this.lastEffectiveWorldPos = event.worldPosition;
      this.moveExcludeIds = new Set(this.engine.selection.selectedNodeIds);

      this.mode = 'moving';
    } else {
      // Start marquee selection
      if (!event.shiftKey) {
        this.engine.selection.clearSelection();
      }
      this.selectionBox.start(event.worldPosition);
      this.mode = 'marquee';
    }
  }

  override onPointerMove(event: PointerEventData): void {
    this.dragHandler.update(event.screenPosition, event.worldPosition);

    if (!this.dragHandler.isDragging || !this.dragHandler.isThresholdMet) return;

    switch (this.mode) {
      case 'moving':
        this.handleMove(event);
        break;
      case 'marquee':
        this.selectionBox.update(event.worldPosition);
        break;
    }
  }

  override onPointerUp(event: PointerEventData): void {
    if (this.mode === 'marquee' && this.selectionBox.isActive) {
      const bounds = this.selectionBox.end();
      // Query R-tree for nodes in marquee
      const ids = this.engine.spatialIndex.queryRange(bounds);
      const nodes = ids
        .map(id => this.engine.sceneGraph.getNode(id))
        .filter((n): n is BaseNode => n !== undefined && n.visible && !n.locked);

      if (event.shiftKey) {
        for (const node of nodes) {
          this.engine.selection.addToSelection(node);
        }
      } else {
        this.engine.selection.selectMultiple(nodes);
      }
    }

    this.mode = 'idle';
    this.hitNode = null;
    this.lastEffectiveWorldPos = null;
    this.pointerCompensation = Vec2.ZERO;
    this.moveExcludeIds.clear();
    this.engine.guides.clear();
    this.dragHandler.end();
  }

  private handleMove(event: PointerEventData): void {
    if (!this.lastEffectiveWorldPos) {
      this.lastEffectiveWorldPos = event.worldPosition;
      return;
    }

    const effectiveWorld = event.worldPosition.add(this.pointerCompensation);
    let delta = effectiveWorld.sub(this.lastEffectiveWorldPos);

    const zoom = this.engine.viewport.camera.zoom;
    const tol = SNAP_THRESHOLD / zoom;
    const b = this.engine.selection.bounds;

    const proposed = {
      minX: b.minX + delta.x,
      maxX: b.maxX + delta.x,
      minY: b.minY + delta.y,
      maxY: b.maxY + delta.y,
    };
    const centerX = (proposed.minX + proposed.maxX) / 2;
    const centerY = (proposed.minY + proposed.maxY) / 2;

    let snapOffsetX = 0;
    let snapGuideX: number | null = null;
    const xCandidates = [proposed.minX, centerX, proposed.maxX];
    for (const c of xCandidates) {
      const best = this.engine.alignmentIndex.nearestX(c, tol, this.moveExcludeIds);
      if (!best) continue;
      const off = best.value - c;
      if (snapGuideX === null || Math.abs(off) < Math.abs(snapOffsetX)) {
        snapOffsetX = off;
        snapGuideX = best.value;
      }
    }

    let snapOffsetY = 0;
    let snapGuideY: number | null = null;
    const yCandidates = [proposed.minY, centerY, proposed.maxY];
    for (const c of yCandidates) {
      const best = this.engine.alignmentIndex.nearestY(c, tol, this.moveExcludeIds);
      if (!best) continue;
      const off = best.value - c;
      if (snapGuideY === null || Math.abs(off) < Math.abs(snapOffsetY)) {
        snapOffsetY = off;
        snapGuideY = best.value;
      }
    }

    if (snapGuideX !== null) {
      delta = new Vec2(delta.x + snapOffsetX, delta.y);
    }
    if (snapGuideY !== null) {
      delta = new Vec2(delta.x, delta.y + snapOffsetY);
    }

    // Keep pointer and object movement coherent while snapping
    this.pointerCompensation = this.pointerCompensation.add(new Vec2(snapOffsetX, snapOffsetY));

    const guides = [] as Array<{ axis: 'x' | 'y'; value: number }>;
    if (snapGuideX !== null) guides.push({ axis: 'x', value: snapGuideX });
    if (snapGuideY !== null) guides.push({ axis: 'y', value: snapGuideY });
    this.engine.guides.setGuides(guides);

    for (const node of this.engine.selection.selectedNodes) {
      node.x = node.x + delta.x;
      node.y = node.y + delta.y;
      this.engine.sceneGraph.notifyNodeChanged(node);
    }

    this.lastEffectiveWorldPos = event.worldPosition.add(this.pointerCompensation);
  }

  override onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.engine.selection.clearSelection();
      this.selectionBox.cancel();
      this.mode = 'idle';
      this.engine.guides.clear();
    }
  }
}
