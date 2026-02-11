import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CanvasEngine } from '../../../engine/canvas-engine';
import { BaseNode } from '../../../engine/scene-graph/base-node';
import { PolygonNode } from '../../../engine/scene-graph/polygon-node';
import { StarNode } from '../../../engine/scene-graph/star-node';

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

    (this.node as unknown as Record<string, number>)[key] = value;
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
  }

  nudgeNumber(key: 'x' | 'y' | 'width' | 'height' | 'rotation', delta: number, event?: MouseEvent): void {
    if (!this.node) return;
    const step = event?.shiftKey ? 10 : 1;
    const current = (this.node as unknown as Record<string, number>)[key] ?? 0;
    const next = current + delta * step;
    (this.node as unknown as Record<string, number>)[key] = next;
    this.engine?.sceneGraph.notifyNodeChanged(this.node);
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
    star.innerRadiusRatio = value;
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

  nudgeStarInnerRatio(delta: number, event?: MouseEvent): void {
    const star = this.asStar(this.node);
    if (!star) return;
    const step = event?.shiftKey ? 0.1 : 0.01;
    star.innerRadiusRatio = star.innerRadiusRatio + delta * step;
    this.engine?.sceneGraph.notifyNodeChanged(star);
  }

}
