import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';

/**
 * Image node for bitmap content.
 * Stores a reference to the source URL; actual texture management
 * is handled by the renderer.
 */
export class ImageNode extends BaseNode {
  src: string = '';
  /** Natural dimensions of the source image. */
  naturalWidth: number = 0;
  naturalHeight: number = 0;
  /** Object-fit behavior. */
  fit: 'fill' | 'contain' | 'cover' = 'fill';

  constructor(name?: string) {
    super('image', name ?? 'Image');
  }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      src: this.src,
      naturalWidth: this.naturalWidth,
      naturalHeight: this.naturalHeight,
      fit: this.fit,
    };
  }

  clone(): ImageNode {
    const node = new ImageNode(this.name);
    this.copyBaseTo(node);
    node.src = this.src;
    node.naturalWidth = this.naturalWidth;
    node.naturalHeight = this.naturalHeight;
    node.fit = this.fit;
    return node;
  }
}
