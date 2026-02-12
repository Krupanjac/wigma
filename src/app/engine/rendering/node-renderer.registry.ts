import { NodeType } from '../scene-graph/base-node';
import { BaseRenderer } from './renderers/base-renderer';
import { RectangleRenderer } from './renderers/rectangle-renderer';
import { EllipseRenderer } from './renderers/ellipse-renderer';
import { PolygonRenderer } from './renderers/polygon-renderer';
import { StarRenderer } from './renderers/star-renderer';
import { LineRenderer } from './renderers/line-renderer';
import { ArrowRenderer } from './renderers/arrow-renderer';
import { TextRenderer } from './renderers/text-renderer';
import { ImageRenderer } from './renderers/image-renderer';
import { VideoRenderer } from './renderers/video-renderer';
import { PathRenderer } from './renderers/path-renderer';
import { GroupRenderer } from './renderers/group-renderer';

/**
 * Registry mapping NodeType → BaseRenderer.
 * Provides O(1) lookup for the correct renderer per node type.
 */
export class NodeRendererRegistry {
  private renderers = new Map<NodeType, BaseRenderer>();

  constructor() {
    this.register(new RectangleRenderer());
    this.register(new EllipseRenderer());
    this.register(new PolygonRenderer());
    this.register(new StarRenderer());
    this.register(new LineRenderer());
    this.register(new ArrowRenderer());
    this.register(new TextRenderer());
    this.register(new ImageRenderer());
    this.register(new VideoRenderer());
    this.register(new PathRenderer());
    this.register(new GroupRenderer());
  }

  register(renderer: BaseRenderer): void {
    this.renderers.set(renderer.nodeType, renderer);
  }

  get(nodeType: NodeType): BaseRenderer | undefined {
    return this.renderers.get(nodeType);
  }
}
