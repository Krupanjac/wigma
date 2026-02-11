import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { DragHandler } from '../engine/interaction/drag-handler';
import { SelectionBox } from '../engine/selection/selection-box';
import { BaseNode } from '../engine/scene-graph/base-node';

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
    this.dragHandler.end();
  }

  private handleMove(_event: PointerEventData): void {
    const delta = this.dragHandler.worldDelta;
    for (const node of this.engine.selection.selectedNodes) {
      node.x = node.x + delta.x;
      node.y = node.y + delta.y;
    }
  }

  override onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.engine.selection.clearSelection();
      this.selectionBox.cancel();
      this.mode = 'idle';
    }
  }
}
