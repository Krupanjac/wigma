import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { PolygonNode } from '../../../engine/scene-graph/polygon-node';
import { StarNode } from '../../../engine/scene-graph/star-node';
import { Bounds } from '../../../shared/math/bounds';

@Component({
  selector: 'app-transform-section',
  imports: [],
  templateUrl: './transform-section.component.html',
  styleUrl: './transform-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransformSectionComponent {
  @Input() engine: CanvasEngine | null = null;
  @Input() node: BaseNode | null = null;
  @Input() refreshTick = 0;

  private roundNumber(value: number): number {
    const precision = 100;
    return Math.round((value + Number.EPSILON) * precision) / precision;
  }

  private worldBounds(node: BaseNode | null): Bounds {
    if (!node) return Bounds.EMPTY;
    const bounds = node.worldBounds;
    return bounds.isEmpty
      ? Bounds.fromXYWH(node.x, node.y, node.width, node.height)
      : bounds;
  }

  formatNumber(value: number): string {
    return this.roundNumber(value).toString();
  }

  displayX(): string {
    return this.formatNumber(this.worldBounds(this.node).minX);
  }

  displayY(): string {
    return this.formatNumber(this.worldBounds(this.node).minY);
  }

  displayWidth(): string {
    return this.formatNumber(this.worldBounds(this.node).width);
  }

  displayHeight(): string {
    return this.formatNumber(this.worldBounds(this.node).height);
  }

  asPolygon(node: BaseNode | null): PolygonNode | null {
    return node?.type === 'polygon' ? (node as PolygonNode) : null;
  }

  asStar(node: BaseNode | null): StarNode | null {
    return node?.type === 'star' ? (node as StarNode) : null;
  }

  setNumber(
    key: 'x' | 'y' | 'width' | 'height' | 'rotation',
    raw: string
  ): void {
    if (!this.node) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;

    const next = this.roundNumber(value);

    if (key === 'x' || key === 'y') {
      const b = this.worldBounds(this.node);
      const dx = key === 'x' ? next - b.minX : 0;
      const dy = key === 'y' ? next - b.minY : 0;
      this.node.x = this.node.x + dx;
      this.node.y = this.node.y + dy;
      this.engine?.sceneGraph.notifyNodeChanged(this.node);
      return;
    }

    if (key === 'width' || key === 'height') {
      const b = this.worldBounds(this.node);
      const desired = Math.max(0.01, next);

      if (key === 'width') {
        if (b.width <= 1e-6) return;
        const left = b.minX;
        const factor = desired / b.width;
        this.node.scaleX = this.node.scaleX * factor;
        const after = this.worldBounds(this.node);
        this.node.x = this.node.x + (left - after.minX);
      } else {
        if (b.height <= 1e-6) return;
        const top = b.minY;
        const factor = desired / b.height;
        this.node.scaleY = this.node.scaleY * factor;
        const after = this.worldBounds(this.node);
        this.node.y = this.node.y + (top - after.minY);
      }

      this.engine?.sceneGraph.notifyNodeChanged(this.node);
      return;
    }

    this.node.rotation = next;
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  nudgeNumber(key: 'x' | 'y' | 'width' | 'height' | 'rotation', delta: number, event?: MouseEvent): void {
    if (!this.node) return;
    const step = event?.shiftKey ? 10 : 1;

    if (key === 'x') {
      const current = this.worldBounds(this.node).minX;
      this.setNumber('x', (current + delta * step).toString());
      return;
    }
    if (key === 'y') {
      const current = this.worldBounds(this.node).minY;
      this.setNumber('y', (current + delta * step).toString());
      return;
    }
    if (key === 'width') {
      const current = this.worldBounds(this.node).width;
      this.setNumber('width', (current + delta * step).toString());
      return;
    }
    if (key === 'height') {
      const current = this.worldBounds(this.node).height;
      this.setNumber('height', (current + delta * step).toString());
      return;
    }

    const current = this.node.rotation;
    this.setNumber('rotation', (current + delta * step).toString());
  }

  setPolygonSides(raw: string): void {
    const poly = this.asPolygon(this.node);
    if (!poly) return;
    const value = Math.max(3, Math.floor(Number(raw)));
    if (!Number.isFinite(value)) return;
    poly.sides = value;
    this.engine?.sceneGraph.notifyNodeChanged(poly);
  }

  nudgePolygonSides(delta: number, event?: MouseEvent): void {
    const poly = this.asPolygon(this.node);
    if (!poly) return;
    const step = event?.shiftKey ? 5 : 1;
    poly.sides = Math.max(3, poly.sides + delta * step);
    this.engine?.sceneGraph.notifyNodeChanged(poly);
  }

  setStarPoints(raw: string): void {
    const star = this.asStar(this.node);
    if (!star) return;
    const value = Math.max(3, Math.floor(Number(raw)));
    if (!Number.isFinite(value)) return;
    star.points = value;
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

  nudgeStarPoints(delta: number, event?: MouseEvent): void {
    const star = this.asStar(this.node);
    if (!star) return;
    const step = event?.shiftKey ? 5 : 1;
    star.points = Math.max(3, star.points + delta * step);
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

  setStarInnerRatio(raw: string): void {
    const star = this.asStar(this.node);
    if (!star) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    star.innerRadiusRatio = this.roundNumber(value);
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

  nudgeStarInnerRatio(delta: number, event?: MouseEvent): void {
    const star = this.asStar(this.node);
    if (!star) return;
    const step = event?.shiftKey ? 0.1 : 0.01;
    star.innerRadiusRatio = this.roundNumber(star.innerRadiusRatio + delta * step);
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

}
