import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { DragHandler } from '../engine/interaction/drag-handler';
import { SelectionBox } from '../engine/selection/selection-box';
import { BaseNode } from '../engine/scene-graph/base-node';
import { Vec2 } from '@shared/math/vec2';
import { HANDLE_SIZE, ROTATION_HANDLE_DISTANCE, SNAP_THRESHOLD } from '@shared/constants';
import { Bounds } from '@shared/math/bounds';
import { Matrix2D } from '@shared/math/matrix2d';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface ResizeState {
  nodeId: string;
  startScaleX: number;
  startScaleY: number;
  startX: number;
  startY: number;
  startWorldInv: Matrix2D;
  centerLocal: Vec2;
  handleLocal: Vec2;
  anchorLocal: Vec2;
  anchorWorld: Vec2;
}

interface RotationState {
  nodeId: string;
  startRotation: number;
  centerWorld: Vec2;
  startAngle: number;
}

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
  private mode: 'idle' | 'moving' | 'marquee' | 'resizing' | 'rotating' = 'idle';
  private hitNode: BaseNode | null = null;
  private activeResizeHandle: ResizeHandle | null = null;
  private resizeState: ResizeState | null = null;
  private rotationState: RotationState | null = null;

  private lastEffectiveWorldPos: Vec2 | null = null;
  private pointerCompensation: Vec2 = Vec2.ZERO;
  private moveExcludeIds = new Set<string>();
  private marqueeBaseSelectionIds = new Set<string>();
  private marqueePreviewSelectionIds = new Set<string>();

  constructor(private engine: CanvasEngine) {
    super();
  }

  override onActivate(): void {
    this.engine.interaction.setCursor('default');
  }

  override onDeactivate(): void {
    this.mode = 'idle';
    this.activeResizeHandle = null;
    this.resizeState = null;
    this.rotationState = null;
    this.engine.guides.clear();
  }

  isTransformInteractionActive(): boolean {
    return this.mode === 'resizing' || this.mode === 'rotating';
  }

  tryStartTransformInteraction(event: PointerEventData): boolean {
    const transformHit = this.hitTransformHandle(event);
    if (!transformHit || this.engine.selection.count !== 1) {
      return false;
    }

    this.dragHandler.start(event.screenPosition, event.worldPosition);
    const node = this.engine.selection.selectedNodes[0];

    if (transformHit === 'rotate') {
      this.mode = 'rotating';
      this.rotationState = this.createRotationState(node, event.worldPosition);
      this.engine.interaction.setCursor('grabbing');
    } else {
      this.mode = 'resizing';
      this.activeResizeHandle = transformHit;
      this.resizeState = this.createResizeState(node, transformHit);
      this.engine.interaction.setCursor(this.cursorForResizeHandle(transformHit));
    }

    return true;
  }

  handleTransformPointerMove(event: PointerEventData): boolean {
    if (this.mode === 'resizing' || this.mode === 'rotating') {
      if (this.dragHandler.isDragging) {
        this.dragHandler.update(event.screenPosition, event.worldPosition);
        if (this.mode === 'resizing') {
          this.handleResize(event);
        } else {
          this.handleRotate(event);
        }
      }
      return true;
    }

    this.updateHoverCursor(event);
    return this.hitTransformHandle(event) !== null;
  }

  handleTransformPointerUp(event: PointerEventData): boolean {
    if (this.mode !== 'resizing' && this.mode !== 'rotating') {
      return false;
    }

    this.mode = 'idle';
    this.activeResizeHandle = null;
    this.resizeState = null;
    this.rotationState = null;
    this.dragHandler.end();
    this.updateHoverCursor(event);
    return true;
  }

  override onPointerDown(event: PointerEventData): void {
    if (this.tryStartTransformInteraction(event)) {
      return;
    }

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
      this.engine.interaction.setCursor('move');
    } else {
      // Start marquee selection
      this.marqueeBaseSelectionIds = new Set(this.engine.selection.selectedNodeIds);
      if (!event.shiftKey) {
        this.engine.selection.clearSelection();
        this.marqueeBaseSelectionIds.clear();
      }
      this.selectionBox.start(event.worldPosition);
      this.engine.renderManager.setMarqueeBounds(this.selectionBox.bounds);
      this.marqueePreviewSelectionIds.clear();
      this.mode = 'marquee';
      this.engine.interaction.setCursor('crosshair');
    }
  }

  override onPointerMove(event: PointerEventData): void {
    if (this.mode === 'resizing' || this.mode === 'rotating') {
      this.dragHandler.update(event.screenPosition, event.worldPosition);
      if (this.mode === 'resizing') {
        this.handleResize(event);
      } else {
        this.handleRotate(event);
      }
      return;
    }

    if (!this.dragHandler.isDragging) {
      this.updateHoverCursor(event);
      return;
    }

    this.dragHandler.update(event.screenPosition, event.worldPosition);

    if (!this.dragHandler.isThresholdMet) return;

    switch (this.mode) {
      case 'moving':
        this.handleMove(event);
        break;
      case 'marquee':
        this.selectionBox.update(event.worldPosition);
        this.engine.renderManager.setMarqueeBounds(this.selectionBox.bounds);
        this.updateMarqueePreview(event.shiftKey);
        break;
    }
  }

  override onPointerUp(event: PointerEventData): void {
    if (this.mode === 'marquee' && this.selectionBox.isActive) {
      this.selectionBox.end();
      this.updateMarqueePreview(event.shiftKey);
    }

    this.mode = 'idle';
    this.hitNode = null;
    this.activeResizeHandle = null;
    this.resizeState = null;
    this.rotationState = null;
    this.lastEffectiveWorldPos = null;
    this.pointerCompensation = Vec2.ZERO;
    this.moveExcludeIds.clear();
    this.marqueeBaseSelectionIds.clear();
    this.marqueePreviewSelectionIds.clear();
    this.engine.guides.clear();
    this.engine.renderManager.setMarqueeBounds(null);
    this.dragHandler.end();
    this.updateHoverCursor(event);
  }

  private updateMarqueePreview(shiftKey: boolean): void {
    const ids = this.engine.spatialIndex.queryRange(this.selectionBox.bounds);
    const hitNodes = ids
      .map(id => this.engine.sceneGraph.getNode(id))
      .filter((n): n is BaseNode => n !== undefined && n.visible && !n.locked);

    const nextNodes: BaseNode[] = [];
    const nextIds = new Set<string>();

    if (shiftKey) {
      for (const id of this.marqueeBaseSelectionIds) {
        const node = this.engine.sceneGraph.getNode(id);
        if (!node || !node.visible || node.locked) continue;
        nextNodes.push(node);
        nextIds.add(id);
      }
    }

    for (const node of hitNodes) {
      if (nextIds.has(node.id)) continue;
      nextNodes.push(node);
      nextIds.add(node.id);
    }

    if (this.sameIdSet(this.marqueePreviewSelectionIds, nextIds)) {
      return;
    }

    this.marqueePreviewSelectionIds = nextIds;
    this.engine.selection.selectMultiple(nextNodes);
  }

  private sameIdSet(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
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

  private handleResize(event: PointerEventData): void {
    if (!this.activeResizeHandle || !this.resizeState) return;

    const node = this.engine.sceneGraph.getNode(this.resizeState.nodeId);
    if (!node) return;

    const localPos = this.resizeState.startWorldInv.apply(event.worldPosition);

    const hasX = this.activeResizeHandle.includes('e') || this.activeResizeHandle.includes('w');
    const hasY = this.activeResizeHandle.includes('n') || this.activeResizeHandle.includes('s');

    let scaleX = this.resizeState.startScaleX;
    let scaleY = this.resizeState.startScaleY;

    if (hasX) {
      const denomX = this.resizeState.handleLocal.x - this.resizeState.centerLocal.x;
      if (Math.abs(denomX) > 1e-6) {
        const factorX = (localPos.x - this.resizeState.centerLocal.x) / denomX;
        const nextMagX = Math.max(0.05, Math.abs(this.resizeState.startScaleX * factorX));
        scaleX = Math.sign(this.resizeState.startScaleX || 1) * nextMagX;
      }
    }

    if (hasY) {
      const denomY = this.resizeState.handleLocal.y - this.resizeState.centerLocal.y;
      if (Math.abs(denomY) > 1e-6) {
        const factorY = (localPos.y - this.resizeState.centerLocal.y) / denomY;
        const nextMagY = Math.max(0.05, Math.abs(this.resizeState.startScaleY * factorY));
        scaleY = Math.sign(this.resizeState.startScaleY || 1) * nextMagY;
      }
    }

    node.x = this.resizeState.startX;
    node.y = this.resizeState.startY;
    node.scaleX = scaleX;
    node.scaleY = scaleY;

    const anchorNowWorld = node.worldMatrix.apply(this.resizeState.anchorLocal);
    const anchorDelta = this.resizeState.anchorWorld.sub(anchorNowWorld);
    node.x = node.x + anchorDelta.x;
    node.y = node.y + anchorDelta.y;

    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  private handleRotate(event: PointerEventData): void {
    if (!this.rotationState) return;

    const node = this.engine.sceneGraph.getNode(this.rotationState.nodeId);
    if (!node) return;

    const currentAngle = Math.atan2(
      event.worldPosition.y - this.rotationState.centerWorld.y,
      event.worldPosition.x - this.rotationState.centerWorld.x
    );

    const delta = this.normalizeAngle(currentAngle - this.rotationState.startAngle);
    node.rotation = this.rotationState.startRotation + delta;
    this.engine.sceneGraph.notifyNodeChanged(node);
  }

  private normalizeAngle(angle: number): number {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
  }

  private updateHoverCursor(event: PointerEventData): void {
    if (this.mode === 'resizing' && this.activeResizeHandle) {
      this.engine.interaction.setCursor(this.cursorForResizeHandle(this.activeResizeHandle));
      return;
    }
    if (this.mode === 'rotating') {
      this.engine.interaction.setCursor('grabbing');
      return;
    }
    if (this.mode === 'moving') {
      this.engine.interaction.setCursor('move');
      return;
    }
    if (this.mode === 'marquee') {
      this.engine.interaction.setCursor('crosshair');
      return;
    }

    const handle = this.hitTransformHandle(event);
    if (handle === 'rotate') {
      this.engine.interaction.setCursor('grab');
      return;
    }
    if (handle) {
      this.engine.interaction.setCursor(this.cursorForResizeHandle(handle));
      return;
    }

    this.engine.interaction.setCursor('default');
  }

  private hitTransformHandle(event: PointerEventData): ResizeHandle | 'rotate' | null {
    if (this.engine.selection.count !== 1) return null;
    const node = this.engine.selection.selectedNodes[0];
    const localBounds = node.localBounds;
    if (localBounds.isEmpty || localBounds.width <= 0 || localBounds.height <= 0) return null;

    const inv = node.worldMatrix.invert();
    if (!inv) return null;
    const local = inv.apply(event.worldPosition);

    const zoom = this.engine.viewport.camera.zoom;
    const sx = Math.max(1e-6, Math.abs(node.scaleX));
    const sy = Math.max(1e-6, Math.abs(node.scaleY));
    const handleHalfW = (HANDLE_SIZE / (zoom * sx)) / 2;
    const handleHalfH = (HANDLE_SIZE / (zoom * sy)) / 2;
    const edgePadX = handleHalfW;
    const edgePadY = handleHalfH;

    const minX = localBounds.minX;
    const minY = localBounds.minY;
    const maxX = localBounds.maxX;
    const maxY = localBounds.maxY;
    const cx = localBounds.centerX;
    const cy = localBounds.centerY;

    const rotY = minY - (ROTATION_HANDLE_DISTANCE / (zoom * sy));
    const rotRadius = Math.min(handleHalfW, handleHalfH) * 1.2;
    if (local.distanceTo(new Vec2(cx, rotY)) <= rotRadius) {
      return 'rotate';
    }

    const handleOrder: Array<ResizeHandle> = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    for (const handle of handleOrder) {
      const pt = this.handlePoint(localBounds, handle);
      if (
        local.x >= pt.x - handleHalfW &&
        local.x <= pt.x + handleHalfW &&
        local.y >= pt.y - handleHalfH &&
        local.y <= pt.y + handleHalfH
      ) {
        return handle;
      }
    }

    const onTopEdge = Math.abs(local.y - minY) <= edgePadY && local.x >= minX + edgePadX && local.x <= maxX - edgePadX;
    if (onTopEdge) return 'n';

    const onBottomEdge = Math.abs(local.y - maxY) <= edgePadY && local.x >= minX + edgePadX && local.x <= maxX - edgePadX;
    if (onBottomEdge) return 's';

    const onLeftEdge = Math.abs(local.x - minX) <= edgePadX && local.y >= minY + edgePadY && local.y <= maxY - edgePadY;
    if (onLeftEdge) return 'w';

    const onRightEdge = Math.abs(local.x - maxX) <= edgePadX && local.y >= minY + edgePadY && local.y <= maxY - edgePadY;
    if (onRightEdge) return 'e';

    return null;
  }

  private createResizeState(node: BaseNode, handle: ResizeHandle): ResizeState {
    const bounds = node.localBounds;
    const handleLocal = this.handlePoint(bounds, handle);
    const anchorLocal = this.handlePoint(bounds, this.oppositeHandle(handle));
    const startWorldInv = node.worldMatrix.invert();
    if (!startWorldInv) {
      throw new Error('Node transform is not invertible for resize interaction.');
    }

    return {
      nodeId: node.id,
      startScaleX: node.scaleX,
      startScaleY: node.scaleY,
      startX: node.x,
      startY: node.y,
      startWorldInv,
      centerLocal: bounds.center,
      handleLocal,
      anchorLocal,
      anchorWorld: node.worldMatrix.apply(anchorLocal),
    };
  }

  private createRotationState(node: BaseNode, pointerWorld: Vec2): RotationState {
    const centerLocal = node.localBounds.center;
    const centerWorld = node.worldMatrix.apply(centerLocal);

    return {
      nodeId: node.id,
      startRotation: node.rotation,
      centerWorld,
      startAngle: Math.atan2(pointerWorld.y - centerWorld.y, pointerWorld.x - centerWorld.x),
    };
  }

  private handlePoint(bounds: Bounds, handle: ResizeHandle): Vec2 {
    switch (handle) {
      case 'nw': return new Vec2(bounds.minX, bounds.minY);
      case 'n': return new Vec2(bounds.centerX, bounds.minY);
      case 'ne': return new Vec2(bounds.maxX, bounds.minY);
      case 'w': return new Vec2(bounds.minX, bounds.centerY);
      case 'e': return new Vec2(bounds.maxX, bounds.centerY);
      case 'sw': return new Vec2(bounds.minX, bounds.maxY);
      case 's': return new Vec2(bounds.centerX, bounds.maxY);
      case 'se':
      default:
        return new Vec2(bounds.maxX, bounds.maxY);
    }
  }

  private oppositeHandle(handle: ResizeHandle): ResizeHandle {
    switch (handle) {
      case 'nw': return 'se';
      case 'n': return 's';
      case 'ne': return 'sw';
      case 'w': return 'e';
      case 'e': return 'w';
      case 'sw': return 'ne';
      case 's': return 'n';
      case 'se':
      default:
        return 'nw';
    }
  }

  private cursorForResizeHandle(handle: ResizeHandle): string {
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
      default:
        return 'ew-resize';
    }
  }

  override onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.engine.selection.clearSelection();
      this.selectionBox.cancel();
      this.mode = 'idle';
      this.activeResizeHandle = null;
      this.resizeState = null;
      this.rotationState = null;
      this.engine.guides.clear();
      this.marqueeBaseSelectionIds.clear();
      this.marqueePreviewSelectionIds.clear();
      this.engine.renderManager.setMarqueeBounds(null);
      this.engine.interaction.setCursor('default');
    }
  }
}
