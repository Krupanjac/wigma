import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';

/**
 * Video node for embedded video content.
 * Stores a data-URL source for the video and a poster frame (first frame).
 * Actual video playback/thumbnail is handled by the renderer.
 */
export class VideoNode extends BaseNode {
  /** Video data-URL or blob URL. */
  src: string = '';
  /** Poster frame image data-URL (auto-extracted from first frame). */
  posterSrc: string = '';
  /** Natural dimensions of the source video. */
  naturalWidth: number = 0;
  naturalHeight: number = 0;
  /** Duration in seconds. */
  duration: number = 0;

  constructor(name?: string) {
    super('video', name ?? 'Video');
  }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      src: this.src,
      posterSrc: this.posterSrc,
      naturalWidth: this.naturalWidth,
      naturalHeight: this.naturalHeight,
      duration: this.duration,
    };
  }

  clone(): VideoNode {
    const node = new VideoNode(this.name);
    this.copyBaseTo(node);
    node.src = this.src;
    node.posterSrc = this.posterSrc;
    node.naturalWidth = this.naturalWidth;
    node.naturalHeight = this.naturalHeight;
    node.duration = this.duration;
    return node;
  }
}
